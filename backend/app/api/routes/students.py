import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_module, require_personal
from app.db.session import get_db
from app.models.user import User
from app.schemas.student import StudentCreate, StudentInviteStatus, StudentRead, StudentUpdate
from app.services.student_service import create_student, list_students, update_student
from app.services.student_invite_service import access_status, create_invite

router = APIRouter(dependencies=[Depends(require_module("students"))])


@router.get("", response_model=list[StudentRead])
def index(db: Session = Depends(get_db), personal: User = Depends(require_personal)):
    return [_read(db, student) for student in list_students(db, personal)]


def _read(db: Session, student):
    data = {column.name: getattr(student, column.name) for column in student.__table__.columns}
    data["access_status"], _ = access_status(db, student)
    return data


@router.post("", response_model=StudentRead, status_code=201)
def create(payload: StudentCreate, db: Session = Depends(get_db), personal: User = Depends(require_personal)):
    return _read(db, create_student(db, personal, payload))


@router.patch("/{student_id}", response_model=StudentRead)
def update(student_id: uuid.UUID, payload: StudentUpdate, db: Session = Depends(get_db), personal: User = Depends(require_personal)):
    return _read(db, update_student(db, personal, student_id, payload))


@router.post("/{student_id}/access-invite", response_model=StudentInviteStatus, status_code=202)
def invite(student_id: uuid.UUID, db: Session = Depends(get_db), personal: User = Depends(require_personal)):
    return create_invite(db, personal, student_id)
