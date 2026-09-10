import re
import unicodedata
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_owner, require_personal
from app.db.session import get_db
from app.models.personal_branding import PersonalBranding
from app.models.user import User, UserRole
from app.schemas.branding import BrandingUpdate
from app.services.branding_service import FITLAND_BRANDING, get_branding_for_owner, get_personal_branding, personal_for_user, save_branding

router = APIRouter()
UPLOAD_DIR = Path(__file__).resolve().parents[3] / "uploads" / "branding"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


@router.get("/platform")
def platform_branding():
    return {**FITLAND_BRANDING, "is_fallback": True, "initials": "FT"}


def _brand_slug(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii").lower()
    normalized = re.sub(r"^personal[\s-]+", "", normalized)
    return re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")


@router.get("/public")
def public_branding(
    email: str | None = Query(default=None, min_length=5, max_length=255),
    slug: str | None = Query(default=None, min_length=2, max_length=100),
    db: Session = Depends(get_db),
):
    personal = None
    if slug:
        requested_slug = _brand_slug(slug)
        personal = db.scalar(
            select(User).join(PersonalBranding, PersonalBranding.personal_id == User.id).where(
                User.role == UserRole.PERSONAL,
                User.is_active.is_(True),
                PersonalBranding.slug == requested_slug,
            )
        )
    elif email:
        normalized_email = email.strip().lower()
        personal = db.scalar(select(User).where(func.lower(User.email) == normalized_email, User.role == UserRole.PERSONAL))
        if not personal:
            student_user = db.scalar(select(User).where(func.lower(User.email) == normalized_email, User.role == UserRole.STUDENT))
            personal = personal_for_user(db, student_user) if student_user else None
    if not personal:
        return {**FITLAND_BRANDING, "is_fallback": True, "initials": "FT"}
    return get_personal_branding(db, personal)


@router.get("/me")
def my_branding(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == UserRole.OWNER:
        return {**FITLAND_BRANDING, "is_fallback": False, "initials": "FT"}
    personal = personal_for_user(db, current_user)
    if not personal:
        return {**FITLAND_BRANDING, "is_fallback": True, "initials": "FT"}
    return get_personal_branding(db, personal)


@router.put("/me")
def update_my_branding(payload: BrandingUpdate, personal: User = Depends(require_personal), db: Session = Depends(get_db)):
    return save_branding(db, personal, payload)


@router.get("/personal/{personal_id}")
def owner_get_branding(personal_id: uuid.UUID, _: User = Depends(require_owner), db: Session = Depends(get_db)):
    return get_branding_for_owner(db, personal_id)


@router.put("/personal/{personal_id}")
def owner_update_branding(personal_id: uuid.UUID, payload: BrandingUpdate, _: User = Depends(require_owner), db: Session = Depends(get_db)):
    personal = db.scalar(select(User).where(User.id == personal_id, User.role == UserRole.PERSONAL))
    if not personal:
        raise HTTPException(status_code=404, detail="Personal não encontrado")
    return save_branding(db, personal, payload)


@router.post("/upload/{asset_type}")
async def upload_brand_asset(asset_type: str, request: Request, personal: User = Depends(require_personal), db: Session = Depends(get_db)):
    if asset_type not in {"logo", "profile", "icon"}:
        raise HTTPException(status_code=400, detail="Tipo de arquivo inválido")
    mime = request.headers.get("content-type", "").split(";", 1)[0]
    extension = ALLOWED_TYPES.get(mime)
    if not extension:
        raise HTTPException(status_code=415, detail="Envie uma imagem JPG, PNG ou WebP")
    content = await request.body()
    if not content or len(content) > 3 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="A imagem deve ter até 3 MB")
    filename = f"{personal.id}-{asset_type}-{uuid.uuid4().hex}{extension}"
    (UPLOAD_DIR / filename).write_bytes(content)
    url = str(request.url_for("uploads", path=f"branding/{filename}"))
    branding = db.scalar(select(PersonalBranding).where(PersonalBranding.personal_id == personal.id))
    if not branding:
        branding = PersonalBranding(personal_id=personal.id, display_name=personal.name)
        db.add(branding)
    setattr(branding, {"logo": "logo_url", "profile": "profile_image_url", "icon": "icon_url"}[asset_type], url)
    db.commit()
    return {"url": url, "branding": get_personal_branding(db, personal)}


@router.post("/personal/{personal_id}/upload/{asset_type}")
async def owner_upload_brand_asset(personal_id: uuid.UUID, asset_type: str, request: Request, _: User = Depends(require_owner), db: Session = Depends(get_db)):
    personal = db.scalar(select(User).where(User.id == personal_id, User.role == UserRole.PERSONAL))
    if not personal:
        raise HTTPException(status_code=404, detail="Personal não encontrado")
    if asset_type not in {"logo", "profile", "icon"}:
        raise HTTPException(status_code=400, detail="Tipo de arquivo inválido")
    mime = request.headers.get("content-type", "").split(";", 1)[0]
    extension = ALLOWED_TYPES.get(mime)
    if not extension:
        raise HTTPException(status_code=415, detail="Envie uma imagem JPG, PNG ou WebP")
    content = await request.body()
    if not content or len(content) > 3 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="A imagem deve ter até 3 MB")
    filename = f"{personal.id}-{asset_type}-{uuid.uuid4().hex}{extension}"
    (UPLOAD_DIR / filename).write_bytes(content)
    url = str(request.url_for("uploads", path=f"branding/{filename}"))
    branding = db.scalar(select(PersonalBranding).where(PersonalBranding.personal_id == personal.id))
    if not branding:
        raise HTTPException(status_code=409, detail="Salve a personalização antes de enviar arquivos")
    setattr(branding, {"logo": "logo_url", "profile": "profile_image_url", "icon": "icon_url"}[asset_type], url)
    db.commit()
    return {"url": url, "branding": get_personal_branding(db, personal)}
