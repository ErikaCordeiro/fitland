import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_module, require_student_or_personal
from app.db.session import get_db
from app.models.user import User
from app.schemas.progress import ProgressLogCreate, ProgressLogRead
from app.services.progress_service import create_progress, list_progress

router = APIRouter(dependencies=[Depends(require_module("progress"))])


@router.get("/{student_id}", response_model=list[ProgressLogRead])
def index(student_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(require_student_or_personal)):
    return list_progress(db, current_user, student_id)


@router.post("", response_model=ProgressLogRead, status_code=201)
def create(payload: ProgressLogCreate, db: Session = Depends(get_db), current_user: User = Depends(require_student_or_personal)):
    return create_progress(db, current_user, payload)
