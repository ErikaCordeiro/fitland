import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_module, require_personal
from app.db.session import get_db
from app.models.user import User
from app.schemas.exercise import ExerciseCreate, ExerciseRead, ExerciseUpdate
from app.services.exercise_service import create_exercise, list_exercises, update_exercise

router = APIRouter(dependencies=[Depends(require_module("workouts"))])


@router.get("", response_model=list[ExerciseRead])
def index(db: Session = Depends(get_db), personal: User = Depends(require_personal)):
    return list_exercises(db, personal)


@router.post("", response_model=ExerciseRead, status_code=201)
def create(payload: ExerciseCreate, db: Session = Depends(get_db), personal: User = Depends(require_personal)):
    return create_exercise(db, personal, payload)


@router.patch("/{exercise_id}", response_model=ExerciseRead)
def update(exercise_id: uuid.UUID, payload: ExerciseUpdate, db: Session = Depends(get_db), personal: User = Depends(require_personal)):
    return update_exercise(db, personal, exercise_id, payload)
