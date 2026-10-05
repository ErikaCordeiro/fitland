import os
import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.student import Student
from app.models.student_assessment import StudentAssessment
from app.models.student_file import StudentFile
from app.models.user import User, UserRole
from app.schemas.assessment import AssessmentCreate, AssessmentUpdate, MEASURE_FIELDS
from app.services.access import get_owned_student
from app.services.private_file_storage import resolve_storage_key


COMPARABLE_FIELDS = (*MEASURE_FIELDS, "body_fat_percentage")


def _bmi(item: StudentAssessment) -> float | None:
    if not item.weight or not item.height:
        return None
    height_m = item.height / 100 if item.height > 3 else item.height
    return round(item.weight / (height_m * height_m), 2) if height_m > 0 else None


def serialize(item: StudentAssessment) -> dict:
    data = {column.name: getattr(item, column.name) for column in item.__table__.columns}
    data["bmi"] = _bmi(item)
    return data


def _with_photo_count(db: Session, item: StudentAssessment, user: User) -> dict:
    data = serialize(item)
    conditions = [
        StudentFile.personal_id == item.personal_id,
        StudentFile.student_id == item.student_id,
        StudentFile.resource_id == item.id,
        StudentFile.resource_type.like("assessment_photo:%"),
    ]
    if user.role == UserRole.STUDENT:
        conditions.append(StudentFile.visible_to_student.is_(True))
    data["photo_count"] = len(db.scalars(select(StudentFile.id).where(*conditions)).all())
    return data


def _student_for_user(db: Session, user: User, student_id: uuid.UUID | None = None) -> Student:
    if user.role == UserRole.STUDENT:
        student = db.scalar(select(Student).where(Student.user_id == user.id))
        if not student:
            raise HTTPException(status_code=404, detail="Student profile not found")
        if student_id is not None and student.id != student_id:
            raise HTTPException(status_code=403, detail="Forbidden resource")
        return student
    if student_id is None:
        raise HTTPException(status_code=422, detail="Student is required")
    return get_owned_student(db, student_id, user)


def list_assessments(db: Session, user: User, student_id: uuid.UUID | None = None) -> list[dict]:
    student = _student_for_user(db, user, student_id)
    rows = db.scalars(select(StudentAssessment).where(
        StudentAssessment.student_id == student.id,
        StudentAssessment.personal_id == student.personal_id,
    ).order_by(StudentAssessment.assessment_date.desc(), StudentAssessment.created_at.desc())).all()
    return [_with_photo_count(db, row, user) for row in rows]


def get_assessment(db: Session, user: User, assessment_id: uuid.UUID) -> StudentAssessment:
    item = db.get(StudentAssessment, assessment_id)
    if not item:
        raise HTTPException(status_code=404, detail="Avaliação não encontrada")
    student = _student_for_user(db, user, item.student_id)
    if item.personal_id != student.personal_id:
        raise HTTPException(status_code=403, detail="Forbidden resource")
    return item


def assessment_detail(db: Session, user: User, assessment_id: uuid.UUID) -> dict:
    item = get_assessment(db, user, assessment_id)
    previous = db.scalar(select(StudentAssessment).where(
        StudentAssessment.student_id == item.student_id,
        StudentAssessment.personal_id == item.personal_id,
        StudentAssessment.assessment_date < item.assessment_date,
    ).order_by(StudentAssessment.assessment_date.desc(), StudentAssessment.created_at.desc()))
    data = _with_photo_count(db, item, user)
    data["previous"] = serialize(previous) if previous else None
    data["differences"] = {
        field: round(float(getattr(item, field)) - float(getattr(previous, field)), 2)
        for field in COMPARABLE_FIELDS
        if previous and getattr(item, field) is not None and getattr(previous, field) is not None
    }
    return data


def create_assessment(db: Session, personal: User, payload: AssessmentCreate) -> dict:
    student = get_owned_student(db, payload.student_id, personal)
    item = StudentAssessment(personal_id=student.personal_id, **payload.model_dump())
    db.add(item); db.commit(); db.refresh(item)
    return serialize(item)


def update_assessment(db: Session, personal: User, assessment_id: uuid.UUID, payload: AssessmentUpdate) -> dict:
    item = get_assessment(db, personal, assessment_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value.strip() if field == "notes" and value else value)
    db.commit(); db.refresh(item)
    return serialize(item)


def delete_assessment(db: Session, personal: User, assessment_id: uuid.UUID) -> None:
    item = get_assessment(db, personal, assessment_id)
    photos = list(db.scalars(select(StudentFile).where(
        StudentFile.personal_id == item.personal_id,
        StudentFile.student_id == item.student_id,
        StudentFile.resource_id == item.id,
        StudentFile.resource_type.like("assessment_photo:%"),
    )).all())
    paths = [(photo, resolve_storage_key(photo.storage_key)) for photo in photos]
    if any(not path.is_file() for _, path in paths):
        raise HTTPException(status_code=409, detail="Uma foto física está indisponível; a avaliação foi preservada")
    quarantined = []
    try:
        for photo, path in paths:
            quarantine = path.with_name(f".{path.name}.deleting-{uuid.uuid4().hex}")
            os.replace(path, quarantine); quarantined.append((path, quarantine))
            db.delete(photo)
        db.delete(item); db.commit()
    except Exception:
        db.rollback()
        for path, quarantine in quarantined:
            if quarantine.exists(): os.replace(quarantine, path)
        raise
    for _, quarantine in quarantined:
        quarantine.unlink(missing_ok=True)
