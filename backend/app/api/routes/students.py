import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_module, require_personal
from app.db.session import get_db
from app.models.user import User
from app.schemas.student import StudentCreate, StudentRead, StudentUpdate
from app.services.student_service import create_student, list_students, update_student

router = APIRouter(dependencies=[Depends(require_module("students"))])


@router.get("", response_model=list[StudentRead])
def index(db: Session = Depends(get_db), personal: User = Depends(require_personal)):
    return list_students(db, personal)


@router.post("", response_model=StudentRead, status_code=201)
def create(payload: StudentCreate, db: Session = Depends(get_db), personal: User = Depends(require_personal)):
    return create_student(db, personal, payload)


@router.patch("/{student_id}", response_model=StudentRead)
def update(student_id: uuid.UUID, payload: StudentUpdate, db: Session = Depends(get_db), personal: User = Depends(require_personal)):
    return update_student(db, personal, student_id, payload)
