import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import require_module, require_student_or_personal
from app.db.session import get_db
from app.models.user import User
from app.schemas.progress import ProgressLogCreate, ProgressLogRead, ProgressOverview
from app.services.progress_service import create_progress, list_progress, progress_overview

router = APIRouter(dependencies=[Depends(require_module("progress"))])


@router.get("/overview", response_model=ProgressOverview)
def own_overview(period_days: int = Query(90, enum=[30, 90, 180, 365]), db: Session = Depends(get_db), current_user: User = Depends(require_student_or_personal)):
    return progress_overview(db, current_user, period_days=period_days)


@router.get("/overview/{student_id}", response_model=ProgressOverview)
def student_overview(student_id: uuid.UUID, period_days: int = Query(90, enum=[30, 90, 180, 365]), db: Session = Depends(get_db), current_user: User = Depends(require_student_or_personal)):
    return progress_overview(db, current_user, student_id=student_id, period_days=period_days)


@router.get("/{student_id}", response_model=list[ProgressLogRead])
def index(student_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(require_student_or_personal)):
    return list_progress(db, current_user, student_id)


@router.post("", response_model=ProgressLogRead, status_code=201)
def create(payload: ProgressLogCreate, db: Session = Depends(get_db), current_user: User = Depends(require_student_or_personal)):
    return create_progress(db, current_user, payload)
