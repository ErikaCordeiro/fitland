import csv
import io
import uuid
from collections import Counter
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.personal_branding import PersonalBranding
from app.models.student import Student
from app.models.student_assessment import StudentAssessment
from app.models.user import User
from app.models.workout_session import WorkoutSession
from app.services.finance_service import list_charges
from app.services.module_registry import resolve_modules

TZ = ZoneInfo("America/Sao_Paulo")
ALLOWED_PERIODS = {30, 90, 180, 365}
ZERO = Decimal("0.00")

def _period(days: int):
    if days not in ALLOWED_PERIODS:
        raise HTTPException(status_code=422, detail="Período inválido")
    end = datetime.now(TZ).date()
    start = end - timedelta(days=days - 1)
    return start, end, datetime.combine(start, time.min, TZ), datetime.combine(end + timedelta(days=1), time.min, TZ)

def _modules(db: Session, personal_id: uuid.UUID):
    branding = db.scalar(select(PersonalBranding).where(PersonalBranding.personal_id == personal_id))
    return resolve_modules((branding.modules if branding else None) or {})

def _local_date(value: datetime) -> date:
    aware = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return aware.astimezone(TZ).date()

def overview(db: Session, personal: User, days: int = 30, student_id: uuid.UUID | None = None):
    start, end, start_at, end_at = _period(days)
    students = list(db.scalars(select(Student).where(Student.personal_id == personal.id).order_by(Student.name)).all())
    if student_id and all(row.id != student_id for row in students):
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    selected = [row for row in students if not student_id or row.id == student_id]
    ids = [row.id for row in selected]
    session_query = select(WorkoutSession).where(
        WorkoutSession.personal_id == personal.id, WorkoutSession.student_id.in_(ids),
        WorkoutSession.status == "concluido", WorkoutSession.completed_at.is_not(None),
    )
    if db.get_bind().dialect.name != "sqlite":
        session_query = session_query.where(WorkoutSession.completed_at >= start_at, WorkoutSession.completed_at < end_at)
    sessions = [] if not ids else list(db.scalars(session_query).all())
    if db.get_bind().dialect.name == "sqlite":
        sessions = [row for row in sessions if start <= _local_date(row.completed_at) <= end]
    workout_counts = Counter(row.student_id for row in sessions)
    last_workouts = {}
    for row in sessions:
        if row.student_id not in last_workouts or row.completed_at > last_workouts[row.student_id]:
            last_workouts[row.student_id] = row.completed_at
    modules = _modules(db, personal.id)
    assessments = [] if not modules.get("assessments") or not ids else list(db.scalars(select(StudentAssessment).where(
        StudentAssessment.personal_id == personal.id, StudentAssessment.student_id.in_(ids),
        StudentAssessment.assessment_date >= start, StudentAssessment.assessment_date <= end,
    )).all())
    last_assessments = {}
    for row in assessments:
        last_assessments[row.student_id] = max(row.assessment_date, last_assessments.get(row.student_id, row.assessment_date))
    received = pending = overdue = None
    if modules.get("finance"):
        charges = list_charges(db, personal, student_id)
        received = sum((payment["amount"] for row in charges for payment in row["payments"] if start <= payment["paid_at"] <= end), ZERO)
        open_rows = [row for row in charges if row["status"] not in {"paid", "cancelled"}]
        pending = sum((row["balance"] for row in open_rows if row["due_date"] >= date.today()), ZERO)
        overdue = sum((row["balance"] for row in open_rows if row["due_date"] < date.today()), ZERO)
    daily = Counter(_local_date(row.completed_at) for row in sessions)
    return {
        "period": {"start": start, "end": end, "days": days},
        "modules": {"assessments": modules.get("assessments", False), "finance": modules.get("finance", False)},
        "metrics": {"students_total": len(selected), "new_students": sum(start_at.replace(tzinfo=None) <= row.created_at < end_at.replace(tzinfo=None) for row in selected), "students_trained": len(workout_counts), "students_without_training": len(selected) - len(workout_counts), "completed_workouts": len(sessions), "assessments_completed": len(assessments) if modules.get("assessments") else None, "students_assessed": len({row.student_id for row in assessments}) if modules.get("assessments") else None, "received": received, "pending": pending, "overdue": overdue},
        "workout_series": [{"date": start + timedelta(days=offset), "value": daily[start + timedelta(days=offset)]} for offset in range(days)],
        "student_activity": [{"student_id": row.id, "name": row.name, "completed_workouts": workout_counts[row.id], "last_workout_at": last_workouts.get(row.id), "last_assessment_date": last_assessments.get(row.id), "status": "trained" if workout_counts[row.id] else "no_training"} for row in selected],
    }

def _csv_safe(value):
    text = "" if value is None else str(value)
    return "'" + text if text.startswith(("=", "+", "-", "@")) else text

def export_csv(report: dict) -> bytes:
    output = io.StringIO(newline="")
    writer = csv.writer(output, delimiter=";")
    writer.writerow(["Aluno", "Treinos concluídos", "Último treino", "Última avaliação", "Status"])
    for row in report["student_activity"]:
        writer.writerow([_csv_safe(row["name"]), row["completed_workouts"], row["last_workout_at"] or "", row["last_assessment_date"] or "", "Treinou no período" if row["status"] == "trained" else "Sem treino registrado no período"])
    return b"\xef\xbb\xbf" + output.getvalue().encode("utf-8")
