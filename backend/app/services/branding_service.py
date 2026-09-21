import re
import unicodedata
import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session
from starlette import status

from app.core.errors import DomainError
from app.models.personal_branding import PersonalBranding
from app.models.student import Student
from app.models.user import User, UserRole
from app.schemas.branding import BrandingUpdate
from app.services.upload_storage import relative_upload_reference


FITLAND_BRANDING = {
    "display_name": "Fitland",
    "logo_url": None,
    "profile_image_url": None,
    "primary_color": "#050505",
    "secondary_color": "#C0C0C0",
    "icon_url": None,
    "login_subtitle": "Performance, gestão e evolução em um só lugar.",
}
DEFAULT_MODULES = {key: True for key in ("workouts", "diet", "assessments", "progress", "finance", "agenda", "messages", "reports", "files", "coach", "calendar", "payments")}
THEME_DEFAULTS = {
    "background_color": "#050505", "surface_color": "#121416", "accent_color": "#C0C0C0",
    "border_color": "#34373A", "text_color": "#F5F5F5", "muted_text_color": "#A7ABB0",
    "font_family": "Inter", "banner_url": None,
}


def brand_slug(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii").lower()
    normalized = re.sub(r"^personal[\s-]+", "", normalized)
    return re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")


def fallback_branding(personal: User) -> dict:
    clean_name = (personal.name or "Personal").strip()
    display_name = clean_name if clean_name.lower().startswith("personal ") else f"Personal {clean_name}"
    initials = "".join(part[0] for part in clean_name.split()[:2]).upper() or "PT"
    return {
        "id": None,
        "personal_id": personal.id,
        "slug": brand_slug(clean_name),
        **FITLAND_BRANDING,
        "display_name": display_name,
        "login_subtitle": "Disciplina • Foco • Propósito",
        "initials": initials,
        "is_fallback": True,
        "modules": DEFAULT_MODULES.copy(),
        **THEME_DEFAULTS,
        "created_at": None,
        "updated_at": None,
    }


def branding_to_dict(branding: PersonalBranding | None, personal: User) -> dict:
    if not branding:
        return fallback_branding(personal)
    return {
        "id": branding.id,
        "personal_id": branding.personal_id,
        "display_name": branding.display_name,
        "logo_url": branding.logo_url,
        "profile_image_url": branding.profile_image_url,
        "primary_color": branding.primary_color,
        "secondary_color": branding.secondary_color,
        "icon_url": branding.icon_url,
        "login_subtitle": branding.login_subtitle,
        "slug": branding.slug,
        "banner_url": branding.banner_url,
        "background_color": branding.background_color,
        "surface_color": branding.surface_color,
        "accent_color": branding.accent_color,
        "border_color": branding.border_color,
        "text_color": branding.text_color,
        "muted_text_color": branding.muted_text_color,
        "font_family": branding.font_family,
        "modules": {**DEFAULT_MODULES, **(branding.modules or {})},
        "initials": "".join(part[0] for part in personal.name.split()[:2]).upper(),
        "is_fallback": False,
        "created_at": branding.created_at,
        "updated_at": branding.updated_at,
    }


def get_personal_branding(db: Session, personal: User) -> dict:
    branding = db.scalar(select(PersonalBranding).where(PersonalBranding.personal_id == personal.id))
    return branding_to_dict(branding, personal)


def personal_for_user(db: Session, user: User) -> User | None:
    if user.role == UserRole.PERSONAL:
        return user
    if user.role == UserRole.STUDENT:
        student = db.scalar(select(Student).where(Student.user_id == user.id))
        return db.get(User, student.personal_id) if student else None
    return None


def save_branding(db: Session, personal: User, payload: BrandingUpdate) -> dict:
    values = payload.model_dump()
    for field in ("logo_url", "profile_image_url", "icon_url", "banner_url"):
        values[field] = relative_upload_reference(values.get(field))
    branding = db.scalar(select(PersonalBranding).where(PersonalBranding.personal_id == personal.id))
    if not branding:
        branding = PersonalBranding(personal_id=personal.id, **values)
        db.add(branding)
    else:
        for key, value in values.items():
            setattr(branding, key, value)
    db.commit()
    db.refresh(branding)
    return branding_to_dict(branding, personal)


def get_branding_for_owner(db: Session, personal_id: uuid.UUID) -> dict:
    personal = db.scalar(select(User).where(User.id == personal_id, User.role == UserRole.PERSONAL))
    if not personal:
        raise DomainError("Personal não encontrado", status.HTTP_404_NOT_FOUND)
    return get_personal_branding(db, personal)


def ensure_personal_branding(db: Session, email: str | None) -> None:
    if not email:
        return
    personal = db.scalar(select(User).where(func.lower(User.email) == email.strip().lower(), User.role == UserRole.PERSONAL))
    if not personal:
        return
    existing = db.scalar(select(PersonalBranding).where(PersonalBranding.personal_id == personal.id))
    if existing:
        return
    db.add(PersonalBranding(
        personal_id=personal.id,
        display_name=f"Personal {personal.name}",
        slug=brand_slug(personal.name),
        logo_url=None,
        profile_image_url=personal.avatar_url,
        primary_color="#050505",
        secondary_color="#C0C0C0",
        icon_url=None,
        login_subtitle="Disciplina • Foco • Propósito",
        modules=DEFAULT_MODULES.copy(),
        **THEME_DEFAULTS,
    ))
    db.commit()
