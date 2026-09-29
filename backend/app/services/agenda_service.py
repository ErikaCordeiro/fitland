import uuid
from datetime import date, timedelta

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.agenda_event import AgendaEvent
from app.models.personal_branding import PersonalBranding
from app.models.student import Student
from app.models.user import User, UserRole
from app.models.workout import Workout
from app.schemas.agenda import AgendaEventCreate, AgendaEventUpdate
from app.services.access import get_owned_student
from app.services.module_registry import resolve_modules


WEEKDAY_INDEX = {"Segunda": 0, "Terça": 1, "Quarta": 2, "Quinta": 3, "Sexta": 4, "Sábado": 5, "Domingo": 6}


def _range(start: date, end: date) -> None:
    if end < start or (end - start).days > 62:
        raise HTTPException(status_code=422, detail="Intervalo de agenda inválido")


def _student_profile(db: Session, user: User) -> Student:
    student = db.scalar(select(Student).where(Student.user_id == user.id))
    if not student:
        raise HTTPException(status_code=403, detail="Student profile required")
    return student


def _workouts_enabled(db: Session, personal_id: uuid.UUID) -> bool:
    branding = db.scalar(select(PersonalBranding).where(PersonalBranding.personal_id == personal_id))
    return resolve_modules(branding.modules if branding else {}).get("workouts") is True


def _workout_dates(start: date, end: date, day_of_week: str):
    target = WEEKDAY_INDEX.get(day_of_week)
    if target is None:
        return []
    first = start + timedelta(days=(target - start.weekday()) % 7)
    values = []
    current = first
    while current <= end:
        values.append(current)
        current += timedelta(days=7)
    return values


def list_agenda(db: Session, user: User, start: date, end: date) -> dict:
    _range(start, end)
    if user.role == UserRole.STUDENT:
        profile = _student_profile(db, user)
        personal_id, student_id = profile.personal_id, profile.id
        event_query = select(AgendaEvent).options(selectinload(AgendaEvent.student)).where(
            AgendaEvent.personal_id == personal_id,
            AgendaEvent.student_id == student_id,
            AgendaEvent.visible_to_student.is_(True),
            AgendaEvent.event_date.between(start, end),
        )
        workout_query = select(Workout).options(selectinload(Workout.student)).where(
            Workout.personal_id == personal_id, Workout.student_id == student_id, Workout.day_of_week.is_not(None)
        )
    else:
        personal_id = user.id
        event_query = select(AgendaEvent).options(selectinload(AgendaEvent.student)).where(
            AgendaEvent.personal_id == personal_id, AgendaEvent.event_date.between(start, end)
        )
        workout_query = select(Workout).options(selectinload(Workout.student)).where(
            Workout.personal_id == personal_id, Workout.day_of_week.is_not(None)
        )

    items = [{
        "id": str(event.id), "kind": "appointment", "title": event.title,
        "event_date": event.event_date, "event_time": event.event_time,
        "student_id": event.student_id, "student_name": event.student.name if event.student else None,
        "notes": event.notes, "visible_to_student": event.visible_to_student,
        "status": "scheduled", "editable": user.role == UserRole.PERSONAL,
    } for event in db.scalars(event_query.order_by(AgendaEvent.event_date, AgendaEvent.event_time))]

    if _workouts_enabled(db, personal_id):
        for workout in db.scalars(workout_query):
            for workout_date in _workout_dates(start, end, workout.day_of_week):
                items.append({
                    "id": f"workout:{workout.id}:{workout_date.isoformat()}", "kind": "workout",
                    "title": workout.name, "event_date": workout_date, "event_time": None,
                    "student_id": workout.student_id, "student_name": workout.student.name,
                    "notes": workout.notes, "visible_to_student": True,
                    "status": workout.status, "editable": False,
                })
    items.sort(key=lambda item: (item["event_date"], item["event_time"] is None, item["event_time"] or "", item["title"].lower()))
    return {"timezone": "America/Sao_Paulo", "start": start, "end": end, "items": items}


def create_event(db: Session, personal: User, payload: AgendaEventCreate) -> AgendaEvent:
    if payload.student_id:
        get_owned_student(db, payload.student_id, personal)
    event = AgendaEvent(personal_id=personal.id, **payload.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def get_owned_event(db: Session, personal: User, event_id: uuid.UUID) -> AgendaEvent:
    event = db.scalar(select(AgendaEvent).where(AgendaEvent.id == event_id, AgendaEvent.personal_id == personal.id))
    if not event:
        raise HTTPException(status_code=404, detail="Compromisso não encontrado")
    return event


def update_event(db: Session, personal: User, event_id: uuid.UUID, payload: AgendaEventUpdate) -> AgendaEvent:
    event = get_owned_event(db, personal, event_id)
    values = payload.model_dump(exclude_unset=True)
    if values.get("student_id"):
        get_owned_student(db, values["student_id"], personal)
    for field, value in values.items():
        setattr(event, field, value.strip() if field in {"title", "notes"} and value else value)
    db.commit()
    db.refresh(event)
    return event


def delete_event(db: Session, personal: User, event_id: uuid.UUID) -> None:
    db.delete(get_owned_event(db, personal, event_id))
    db.commit()
