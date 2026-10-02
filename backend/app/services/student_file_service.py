import os
import uuid

from fastapi import HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.student import Student
from app.models.student_file import StudentFile
from app.models.user import User, UserRole
from app.schemas.student_file import FILE_CATEGORIES, StudentFileUpdate
from app.services.access import get_owned_student
from app.services.private_file_storage import resolve_storage_key, store_private_upload


def _student_for_user(db: Session, user: User) -> Student:
    student = db.scalar(select(Student).where(Student.user_id == user.id))
    if not student:
        raise HTTPException(status_code=403, detail="Student profile required")
    return student


def list_student_files(db: Session, user: User, student_id: uuid.UUID | None) -> list[StudentFile]:
    if user.role == UserRole.PERSONAL:
        if not student_id:
            raise HTTPException(status_code=422, detail="Selecione um aluno")
        student = get_owned_student(db, student_id, user)
        conditions = [StudentFile.personal_id == user.id, StudentFile.student_id == student.id]
    else:
        student = _student_for_user(db, user)
        conditions = [
            StudentFile.personal_id == student.personal_id,
            StudentFile.student_id == student.id,
            StudentFile.visible_to_student.is_(True),
        ]
    return list(db.scalars(select(StudentFile).where(*conditions).order_by(StudentFile.created_at.desc())).all())


def get_accessible_file(db: Session, user: User, file_id: uuid.UUID, *, write: bool = False) -> StudentFile:
    row = db.get(StudentFile, file_id)
    if not row:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    if user.role == UserRole.PERSONAL:
        if row.personal_id != user.id:
            raise HTTPException(status_code=403, detail="Forbidden resource")
        return row
    if write:
        raise HTTPException(status_code=403, detail="Somente o Personal pode alterar arquivos")
    student = _student_for_user(db, user)
    if row.personal_id != student.personal_id or row.student_id != student.id or not row.visible_to_student:
        raise HTTPException(status_code=403, detail="Forbidden resource")
    return row


async def create_student_file(
    db: Session,
    personal: User,
    student_id: uuid.UUID,
    upload: UploadFile,
    title: str | None,
    description: str | None,
    category: str,
    visible_to_student: bool,
) -> StudentFile:
    student = get_owned_student(db, student_id, personal)
    if category not in FILE_CATEGORIES:
        raise HTTPException(status_code=422, detail="Categoria de arquivo inválida")
    stored = await store_private_upload(upload, personal.id, student.id)
    row = StudentFile(
        personal_id=personal.id, student_id=student.id, uploaded_by_id=personal.id,
        uploaded_by_role="personal", title=(title or "").strip() or None,
        description=(description or "").strip() or None, category=category,
        visible_to_student=visible_to_student,
        **{key: stored[key] for key in ("original_filename", "storage_key", "mime_type", "size_bytes", "sha256")},
    )
    try:
        db.add(row)
        db.flush()
        db.add(AuditLog(actor_user_id=personal.id, action="student_file_uploaded", entity_type="student_file", entity_id=str(row.id), details={"student_id": str(student.id), "visible_to_student": visible_to_student, "category": category}))
        db.commit()
        db.refresh(row)
        return row
    except Exception:
        db.rollback()
        stored["path"].unlink(missing_ok=True)
        raise


def update_student_file(db: Session, personal: User, file_id: uuid.UUID, payload: StudentFileUpdate) -> StudentFile:
    row = get_accessible_file(db, personal, file_id, write=True)
    changes = payload.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(row, key, value)
    db.add(AuditLog(actor_user_id=personal.id, action="student_file_updated", entity_type="student_file", entity_id=str(row.id), details={"fields": sorted(changes)}))
    db.commit()
    db.refresh(row)
    return row


def delete_student_file(db: Session, personal: User, file_id: uuid.UUID) -> None:
    row = get_accessible_file(db, personal, file_id, write=True)
    path = resolve_storage_key(row.storage_key)
    if not path.is_file():
        raise HTTPException(status_code=409, detail="Arquivo físico indisponível; os metadados foram preservados")
    quarantine = path.with_name(f".{path.name}.deleting-{uuid.uuid4().hex}")
    os.replace(path, quarantine)
    try:
        db.add(AuditLog(actor_user_id=personal.id, action="student_file_deleted", entity_type="student_file", entity_id=str(row.id), details={"student_id": str(row.student_id)}))
        db.delete(row)
        db.commit()
    except Exception:
        db.rollback()
        os.replace(quarantine, path)
        raise
    quarantine.unlink(missing_ok=True)
