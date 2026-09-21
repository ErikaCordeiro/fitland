import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.exercise import Exercise
from app.models.student import Student
from app.models.user import User, UserRole
from app.models.workout import Workout, WorkoutExercise
from app.schemas.workout import WorkoutCreate, WorkoutUpdate
from app.services.access import get_owned_student, get_owned_workout


def list_workouts(db: Session, current_user: User) -> list[Workout]:
    query = select(Workout).options(
        selectinload(Workout.exercises).selectinload(WorkoutExercise.exercise)
    ).order_by(Workout.created_at.desc())
    if current_user.role == UserRole.PERSONAL:
        query = query.where(Workout.personal_id == current_user.id)
    else:
        query = query.join(Student, Student.id == Workout.student_id).where(Student.user_id == current_user.id)
    return list(db.scalars(query))


def _validate_owned_exercises(db: Session, personal: User, exercise_ids: list[uuid.UUID]) -> None:
    if not exercise_ids:
        return
    owned_ids = set(db.scalars(select(Exercise.id).where(
        Exercise.personal_id == personal.id,
        Exercise.id.in_(exercise_ids),
    )))
    if owned_ids != set(exercise_ids):
        from app.core.errors import DomainError
        from starlette import status

        raise DomainError("Forbidden exercise", status.HTTP_403_FORBIDDEN)


def create_workout(db: Session, personal: User, payload: WorkoutCreate) -> Workout:
    get_owned_student(db, payload.student_id, personal)
    _validate_owned_exercises(db, personal, [item.exercise_id for item in payload.exercises])
    workout = Workout(
        personal_id=personal.id,
        student_id=payload.student_id,
        name=payload.name.strip(),
        focus=payload.focus,
        duration_minutes=payload.duration_minutes,
        notes=payload.notes,
    )
    db.add(workout)
    db.flush()
    for item in payload.exercises:
        db.add(WorkoutExercise(workout_id=workout.id, **item.model_dump()))
    db.commit()
    db.refresh(workout)
    return get_owned_workout(db, workout.id, personal)


def update_workout(db: Session, personal: User, workout_id: uuid.UUID, payload: WorkoutUpdate) -> Workout:
    workout = get_owned_workout(db, workout_id, personal)
    values = payload.model_dump(exclude_unset=True)
    exercises = values.pop("exercises", None)
    for field, value in values.items():
        setattr(workout, field, value)
    if exercises is not None:
        _validate_owned_exercises(db, personal, [item["exercise_id"] for item in exercises])
        workout.exercises.clear()
        db.flush()
        workout.exercises.extend(WorkoutExercise(workout_id=workout.id, **item) for item in exercises)
    db.commit()
    db.refresh(workout)
    return get_owned_workout(db, workout.id, personal)
