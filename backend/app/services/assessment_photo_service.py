import os
import re
import uuid
from urllib.parse import quote

from fastapi import HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.student_file import StudentFile
from app.models.user import User, UserRole
from app.services.assessment_service import get_assessment
from app.services.private_file_storage import resolve_storage_key, store_private_upload

PHOTO_TYPES = {"front", "back", "left", "right", "other"}
PHOTO_LABELS = {"front": "Frente", "back": "Costas", "left": "Lateral esquerda", "right": "Lateral direita", "other": "Outra"}
IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
RESOURCE_PREFIX = "assessment_photo:"

def _resource_type(kind: str) -> str:
    if kind not in PHOTO_TYPES:
        raise HTTPException(status_code=422, detail="Tipo de foto inválido")
    return f"{RESOURCE_PREFIX}{kind}"

def _kind(row: StudentFile) -> str:
    value = (row.resource_type or "").removeprefix(RESOURCE_PREFIX)
    return value if value in PHOTO_TYPES else "other"

def serialize_photo(row: StudentFile) -> dict:
    kind = _kind(row)
    return {"id": row.id, "assessment_id": row.resource_id, "student_id": row.student_id,
            "original_filename": row.original_filename, "mime_type": row.mime_type, "size_bytes": row.size_bytes,
            "photo_type": kind, "photo_type_label": PHOTO_LABELS[kind], "description": row.description,
            "visible_to_student": row.visible_to_student, "created_at": row.created_at}

def list_assessment_photos(db: Session, user: User, assessment_id: uuid.UUID) -> list[dict]:
    assessment = get_assessment(db, user, assessment_id)
    conditions = [StudentFile.personal_id == assessment.personal_id, StudentFile.student_id == assessment.student_id,
                  StudentFile.resource_id == assessment.id, StudentFile.resource_type.like(f"{RESOURCE_PREFIX}%")]
    if user.role == UserRole.STUDENT:
        conditions.append(StudentFile.visible_to_student.is_(True))
    rows = db.scalars(select(StudentFile).where(*conditions).order_by(StudentFile.created_at.asc())).all()
    return [serialize_photo(row) for row in rows]

def get_assessment_photo(db: Session, user: User, assessment_id: uuid.UUID, photo_id: uuid.UUID, *, write: bool = False) -> StudentFile:
    assessment = get_assessment(db, user, assessment_id)
    row = db.get(StudentFile, photo_id)
    if not row or not (row.resource_type or "").startswith(RESOURCE_PREFIX) or row.resource_id != assessment.id:
        raise HTTPException(status_code=404, detail="Foto não encontrada")
    if row.personal_id != assessment.personal_id or row.student_id != assessment.student_id:
        raise HTTPException(status_code=403, detail="Forbidden resource")
    if user.role == UserRole.STUDENT and (write or not row.visible_to_student):
        raise HTTPException(status_code=403, detail="Forbidden resource")
    return row

async def create_assessment_photo(db: Session, personal: User, assessment_id: uuid.UUID, upload: UploadFile, kind: str, description: str | None, visible: bool) -> dict:
    assessment = get_assessment(db, personal, assessment_id)
    stored = await store_private_upload(upload, assessment.personal_id, assessment.student_id, allowed_mime_types=IMAGE_MIME_TYPES)
    row = StudentFile(personal_id=assessment.personal_id, student_id=assessment.student_id, uploaded_by_id=personal.id,
                      uploaded_by_role="personal", description=(description or "").strip() or None, category="assessment",
                      visible_to_student=visible, resource_type=_resource_type(kind), resource_id=assessment.id,
                      **{key: stored[key] for key in ("original_filename", "storage_key", "mime_type", "size_bytes", "sha256")})
    try:
        db.add(row); db.flush()
        db.add(AuditLog(actor_user_id=personal.id, action="assessment_photo_uploaded", entity_type="student_file", entity_id=str(row.id), details={"assessment_id": str(assessment.id), "photo_type": kind, "visible_to_student": visible}))
        db.commit(); db.refresh(row); return serialize_photo(row)
    except Exception:
        db.rollback(); stored["path"].unlink(missing_ok=True); raise

def photo_response(db: Session, user: User, assessment_id: uuid.UUID, photo_id: uuid.UUID, *, inline: bool) -> FileResponse:
    row = get_assessment_photo(db, user, assessment_id, photo_id)
    path = resolve_storage_key(row.storage_key)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Foto indisponível")
    fallback = re.sub(r"[^A-Za-z0-9._-]", "_", row.original_filename) or "foto"
    disposition = "inline" if inline else "attachment"
    return FileResponse(path, media_type=row.mime_type, headers={"Content-Disposition": f"{disposition}; filename=\"{fallback}\"; filename*=UTF-8''{quote(row.original_filename, safe='')}", "Cache-Control": "private, no-store", "Pragma": "no-cache", "X-Content-Type-Options": "nosniff"})

def delete_assessment_photo(db: Session, personal: User, assessment_id: uuid.UUID, photo_id: uuid.UUID) -> None:
    row = get_assessment_photo(db, personal, assessment_id, photo_id, write=True)
    path = resolve_storage_key(row.storage_key)
    if not path.is_file():
        raise HTTPException(status_code=409, detail="Foto física indisponível; os metadados foram preservados")
    quarantine = path.with_name(f".{path.name}.deleting-{uuid.uuid4().hex}")
    os.replace(path, quarantine)
    try:
        db.add(AuditLog(actor_user_id=personal.id, action="assessment_photo_deleted", entity_type="student_file", entity_id=str(row.id), details={"assessment_id": str(assessment_id)}))
        db.delete(row); db.commit()
    except Exception:
        db.rollback(); os.replace(quarantine, path); raise
    quarantine.unlink(missing_ok=True)
