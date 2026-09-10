import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_module, require_personal, require_student_or_personal
from app.db.session import get_db
from app.models.user import User
from app.schemas.workout import WorkoutCreate, WorkoutRead, WorkoutUpdate
from app.services.workout_service import create_workout, list_workouts, update_workout

router = APIRouter(dependencies=[Depends(require_module("workouts"))])


@router.get("", response_model=list[WorkoutRead])
def index(db: Session = Depends(get_db), current_user: User = Depends(require_student_or_personal)):
    return list_workouts(db, current_user)


@router.post("", response_model=WorkoutRead, status_code=201)
def create(payload: WorkoutCreate, db: Session = Depends(get_db), personal: User = Depends(require_personal)):
    return create_workout(db, personal, payload)


@router.patch("/{workout_id}", response_model=WorkoutRead)
def update(workout_id: uuid.UUID, payload: WorkoutUpdate, db: Session = Depends(get_db), personal: User = Depends(require_personal)):
    return update_workout(db, personal, workout_id, payload)
