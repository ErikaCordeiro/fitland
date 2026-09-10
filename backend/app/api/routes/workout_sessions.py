import uuid

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.api.deps import require_module, require_student_or_personal
from app.db.session import get_db
from app.models.user import User
from app.schemas.workout_session import ProgressionAlertRead, WorkoutSessionRead, WorkoutSessionUpsert
from app.services.workout_session_service import delete_active, get_active, latest_performance, list_history, progression_alerts, upsert_session

router = APIRouter(dependencies=[Depends(require_module("workouts"))])


@router.get("/active", response_model=WorkoutSessionRead | None)
def active(workout_ref: str | None = Query(default=None), db: Session = Depends(get_db), user: User = Depends(require_student_or_personal)):
    return get_active(db, user, workout_ref)


@router.put("/current", response_model=WorkoutSessionRead)
def save(payload: WorkoutSessionUpsert, db: Session = Depends(get_db), user: User = Depends(require_student_or_personal)):
    return upsert_session(db, user, payload)


@router.delete("/{session_id}", status_code=204)
def discard(session_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require_student_or_personal)):
    delete_active(db, user, session_id)
    return Response(status_code=204)


@router.get("/history", response_model=list[WorkoutSessionRead])
def history(db: Session = Depends(get_db), user: User = Depends(require_student_or_personal)):
    return list_history(db, user)


@router.get("/exercises/{exercise_ref}/latest")
def latest(exercise_ref: str, db: Session = Depends(get_db), user: User = Depends(require_student_or_personal)):
    return latest_performance(db, user, exercise_ref)


@router.get("/progression-alerts", response_model=list[ProgressionAlertRead])
def alerts(db: Session = Depends(get_db), user: User = Depends(require_student_or_personal)):
    return progression_alerts(db, user)
