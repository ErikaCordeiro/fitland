import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import require_owner
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.owner import OwnerPersonalCreate, OwnerPersonalUpdate, OwnerSettingsUpdate, OwnerStatusChange
from app.services.auth_service import request_password_reset
from app.services.owner_service import (audit, change_status, create_personal, dashboard_summary,
    get_personal, list_personals, personal_to_dict, soft_delete, update_personal)

router = APIRouter()
AVATAR_DIR = Path(__file__).resolve().parents[3] / "uploads" / "owners"
AVATAR_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_AVATAR_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


@router.get("/dashboard/summary")
def summary(_: User = Depends(require_owner), db: Session = Depends(get_db)):
    return dashboard_summary(db)


@router.get("/personals")
def personals(search: str = "", account_status: str | None = None, sort: str = "name", order: str = "asc",
              page: int = Query(1, ge=1), size: int = Query(10, ge=1, le=50),
              _: User = Depends(require_owner), db: Session = Depends(get_db)):
    total, items = list_personals(db, search, account_status, sort, order, page, size)
    return {"items": items, "total": total, "page": page, "size": size}


@router.post("/personals", status_code=201)
def add_personal(payload: OwnerPersonalCreate, owner: User = Depends(require_owner), db: Session = Depends(get_db)):
    user = create_personal(db, owner, payload)
    return personal_to_dict(user)


@router.get("/personals/{personal_id}")
def personal_detail(personal_id: uuid.UUID, _: User = Depends(require_owner), db: Session = Depends(get_db)):
    user, students, workouts = get_personal(db, personal_id)
    return personal_to_dict(user, students, workouts)


@router.patch("/personals/{personal_id}")
def edit_personal(personal_id: uuid.UUID, payload: OwnerPersonalUpdate, owner: User = Depends(require_owner), db: Session = Depends(get_db)):
    user, students, workouts = get_personal(db, personal_id)
    return personal_to_dict(update_personal(db, owner, user, payload), students, workouts)


def _status(personal_id, value, payload, owner, db):
    user, students, workouts = get_personal(db, personal_id)
    return personal_to_dict(change_status(db, owner, user, value, payload.reason), students, workouts)


@router.post("/personals/{personal_id}/activate")
def activate(personal_id: uuid.UUID, payload: OwnerStatusChange, owner: User = Depends(require_owner), db: Session = Depends(get_db)):
    return _status(personal_id, "active", payload, owner, db)


@router.post("/personals/{personal_id}/suspend")
def suspend(personal_id: uuid.UUID, payload: OwnerStatusChange, owner: User = Depends(require_owner), db: Session = Depends(get_db)):
    return _status(personal_id, "suspended", payload, owner, db)


@router.post("/personals/{personal_id}/block")
def block(personal_id: uuid.UUID, payload: OwnerStatusChange, owner: User = Depends(require_owner), db: Session = Depends(get_db)):
    return _status(personal_id, "blocked", payload, owner, db)


@router.post("/personals/{personal_id}/reset-access")
def reset(personal_id: uuid.UUID, owner: User = Depends(require_owner), db: Session = Depends(get_db)):
    user, _, _ = get_personal(db, personal_id)
    request_password_reset(db, user.email)
    audit(db, owner, "personal_password_reset_requested", "user", user.id)
    db.commit()
    return {"detail": "Link de redefinicao enviado para o e-mail cadastrado."}


@router.delete("/personals/{personal_id}", status_code=204)
def remove(personal_id: uuid.UUID, owner: User = Depends(require_owner), db: Session = Depends(get_db)):
    user, _, _ = get_personal(db, personal_id); soft_delete(db, owner, user)


@router.get("/audit-logs")
def logs(action: str | None = None, result: str | None = None, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
         _: User = Depends(require_owner), db: Session = Depends(get_db)):
    query = select(AuditLog, User.name).outerjoin(User, User.id == AuditLog.actor_user_id)
    if action: query = query.where(AuditLog.action == action)
    if result: query = query.where(AuditLog.result == result)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.execute(query.order_by(AuditLog.created_at.desc()).offset((page - 1) * size).limit(size)).all()
    return {"items": [{"id": log.id, "actor_name": name, "action": log.action, "entity_type": log.entity_type,
                       "entity_id": log.entity_id, "result": log.result, "details": log.details, "created_at": log.created_at}
                      for log, name in rows], "total": total, "page": page, "size": size}


@router.get("/settings")
def settings(owner: User = Depends(require_owner)):
    return {"name": owner.name, "email": owner.email, "avatar_url": owner.avatar_url, "theme_preference": owner.theme_preference,
            "must_change_password": owner.must_change_password}


@router.patch("/settings")
def save_settings(payload: OwnerSettingsUpdate, owner: User = Depends(require_owner), db: Session = Depends(get_db)):
    values = payload.model_dump(exclude_unset=True)
    for key, value in values.items(): setattr(owner, key, value)
    audit(db, owner, "owner_settings_updated", "user", owner.id, {"fields": sorted(values)}); db.commit(); db.refresh(owner)
    return settings(owner)


@router.post("/settings/avatar")
async def upload_avatar(request: Request, owner: User = Depends(require_owner), db: Session = Depends(get_db)):
    extension = ALLOWED_AVATAR_TYPES.get(request.headers.get("content-type", "").split(";", 1)[0])
    if not extension:
        raise HTTPException(status_code=415, detail="Envie uma imagem JPG, PNG ou WebP.")
    content = await request.body()
    if not content:
        raise HTTPException(status_code=400, detail="Selecione uma imagem para enviar.")
    if len(content) > 3 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="A imagem deve ter no máximo 3 MB.")
    filename = f"{owner.id}-{uuid.uuid4().hex}{extension}"
    (AVATAR_DIR / filename).write_bytes(content)
    owner.avatar_url = str(request.url_for("uploads", path=f"owners/{filename}"))
    audit(db, owner, "owner_avatar_updated", "user", owner.id)
    db.commit()
    db.refresh(owner)
    return {"avatar_url": owner.avatar_url}
