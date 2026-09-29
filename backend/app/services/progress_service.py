from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.progress import ProgressLog
from app.models.student import Student
from app.models.user import UserRole
from app.models.workout_session import WorkoutSession
from app.models.user import User
from app.schemas.progress import ProgressLogCreate
from app.services.access import get_owned_student


def list_progress(db: Session, current_user: User, student_id) -> list[ProgressLog]:
    get_owned_student(db, student_id, current_user)
    return list(db.scalars(select(ProgressLog).where(ProgressLog.student_id == student_id).order_by(ProgressLog.log_date.desc())))


def create_progress(db: Session, current_user: User, payload: ProgressLogCreate) -> ProgressLog:
    get_owned_student(db, payload.student_id, current_user)
    progress = ProgressLog(**payload.model_dump())
    db.add(progress)
    db.commit()
    db.refresh(progress)
    return progress


def _student_for_overview(db: Session, current_user: User, student_id=None) -> Student:
    if current_user.role == UserRole.STUDENT:
        student = db.scalar(select(Student).where(Student.user_id == current_user.id))
        if not student:
            from app.core.errors import DomainError
            raise DomainError("Student profile not found", 404)
        if student_id is not None and student.id != student_id:
            from app.core.errors import DomainError
            raise DomainError("Forbidden resource", 403)
        return student
    if student_id is None:
        from app.core.errors import DomainError
        raise DomainError("Student is required", 422)
    return get_owned_student(db, student_id, current_user)


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def progress_overview(db: Session, current_user: User, student_id=None, period_days: int = 90) -> dict:
    student = _student_for_overview(db, current_user, student_id)
    cutoff = datetime.now(timezone.utc) - timedelta(days=period_days)
    sessions = list(db.scalars(
        select(WorkoutSession).where(
            WorkoutSession.student_id == student.id,
            WorkoutSession.personal_id == student.personal_id,
            WorkoutSession.status == "concluido",
            WorkoutSession.completed_at.is_not(None),
        ).order_by(WorkoutSession.completed_at.asc())
    ))
    sessions = [session for session in sessions if _as_utc(session.completed_at) >= cutoff]

    daily = Counter(_as_utc(session.completed_at).date() for session in sessions)
    active_weeks = len({_as_utc(session.completed_at).date().isocalendar()[:2] for session in sessions})
    exercise_samples = defaultdict(list)
    volume = 0.0
    volume_samples = 0
    for session in sessions:
        for exercise in session.exercises or []:
            completed_sets = [item for item in exercise.get("sets", []) if item.get("status") == "concluida"]
            loads = [float(item["used_load"]) for item in completed_sets if item.get("used_load") is not None]
            if loads:
                exercise_samples[str(exercise.get("exercise_id"))].append({
                    "date": session.completed_at,
                    "value": max(loads),
                    "name": exercise.get("exercise_name") or "Exercício",
                })
            for item in completed_sets:
                if item.get("used_load") is not None and item.get("completed_reps") is not None:
                    volume += float(item["used_load"]) * int(item["completed_reps"])
                    volume_samples += 1

    exercise_progress = [{
        "exercise_id": exercise_id,
        "exercise_name": samples[-1]["name"],
        "best_load": max(sample["value"] for sample in samples),
        "points": [{"date": sample["date"], "value": sample["value"]} for sample in samples],
    } for exercise_id, samples in exercise_samples.items()]
    exercise_progress.sort(key=lambda item: item["exercise_name"].lower())

    weight_logs = list(db.scalars(select(ProgressLog).where(
        ProgressLog.student_id == student.id,
        ProgressLog.body_weight.is_not(None),
    ).order_by(ProgressLog.log_date.asc(), ProgressLog.created_at.asc())))
    weight_history = [{
        "date": datetime.combine(item.log_date, datetime.min.time(), tzinfo=timezone.utc),
        "value": float(item.body_weight),
    } for item in weight_logs]
    current_weight = weight_history[-1]["value"] if weight_history else float(student.weight) if student.weight else None

    highlights = []
    if sessions:
        highlights.append(f"{len(sessions)} treino(s) concluído(s) nos últimos {period_days} dias.")
        highlights.append(f"Atividade registrada em {active_weeks} semana(s) no período.")
    improved = [item for item in exercise_progress if len(item["points"]) > 1 and item["best_load"] > item["points"][0]["value"]]
    if improved:
        highlights.append(f"Maior carga registrada em {len(improved)} exercício(s) no período.")

    return {
        "student_id": student.id,
        "student_name": student.name,
        "period_days": period_days,
        "completed_workouts": len(sessions),
        "active_weeks": active_weeks,
        "last_workout_at": sessions[-1].completed_at if sessions else None,
        "workout_frequency": [{"date": day, "count": daily[day]} for day in sorted(daily)],
        "exercise_progress": exercise_progress,
        "current_weight": current_weight,
        "weight_history": weight_history,
        "measurements_supported": False,
        "measurements": [],
        "real_volume": round(volume, 2) if volume_samples else None,
        "highlights": highlights,
    }
