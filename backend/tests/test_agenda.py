import uuid
from datetime import date, time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user
from app.db.session import Base, get_db
from app.main import app
from app.models.agenda_event import AgendaEvent
from app.models.personal_branding import PersonalBranding
from app.models.student import Student
from app.models.user import User, UserRole
from app.models.workout import Workout
from app.schemas.agenda import AgendaEventCreate, AgendaEventUpdate
from app.services.agenda_service import create_event, delete_event, list_agenda, update_event


def user(role, name):
    return User(id=uuid.uuid4(), name=name, email=f"{uuid.uuid4()}@example.com", hashed_password="test", role=role, is_active=True, account_status="active")


@pytest.fixture()
def agenda_db():
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        alpha, beta = user(UserRole.PERSONAL, "Alpha"), user(UserRole.PERSONAL, "Beta")
        alpha_user, beta_user = user(UserRole.STUDENT, "Aluno Alpha"), user(UserRole.STUDENT, "Aluno Beta")
        db.add_all([alpha, beta, alpha_user, beta_user]); db.flush()
        alpha_student = Student(personal_id=alpha.id, user_id=alpha_user.id, name="Aluno Alpha", email=alpha_user.email, age=30, weight=70, height=1.7, objective="Saúde")
        beta_student = Student(personal_id=beta.id, user_id=beta_user.id, name="Aluno Beta", email=beta_user.email, age=31, weight=72, height=1.72, objective="Força")
        db.add_all([alpha_student, beta_student]); db.flush()
        db.add_all([
            PersonalBranding(personal_id=alpha.id, display_name="Alpha", slug="alpha", modules={"calendar": True, "workouts": True}),
            PersonalBranding(personal_id=beta.id, display_name="Beta", slug="beta", modules={"calendar": True, "workouts": True}),
        ]); db.commit()
        yield db, alpha, beta, alpha_user, beta_user, alpha_student, beta_student


def payload(student_id=None, visible=False, title="Avaliação"):
    return AgendaEventCreate(title=title, event_date=date(2026, 9, 30), event_time=time(9, 30), student_id=student_id, notes="Observação", visible_to_student=visible)


def test_personal_crud_and_optional_student(agenda_db):
    db, alpha, *_ = agenda_db
    event = create_event(db, alpha, payload())
    assert event.personal_id == alpha.id and event.student_id is None
    updated = update_event(db, alpha, event.id, AgendaEventUpdate(title="Reunião", event_time=time(10, 0)))
    assert updated.title == "Reunião" and updated.event_time == time(10, 0)
    assert len(list_agenda(db, alpha, date(2026, 9, 1), date(2026, 10, 31))["items"]) == 1
    delete_event(db, alpha, event.id)
    assert db.get(AgendaEvent, event.id) is None


def test_personal_cannot_use_or_mutate_other_tenant_data(agenda_db):
    db, alpha, beta, _, _, alpha_student, beta_student = agenda_db
    with pytest.raises(Exception) as wrong_student:
        create_event(db, alpha, payload(beta_student.id))
    assert wrong_student.value.status_code == 403
    beta_event = create_event(db, beta, payload(beta_student.id))
    with pytest.raises(Exception) as wrong_event:
        update_event(db, alpha, beta_event.id, AgendaEventUpdate(title="Inválido"))
    assert wrong_event.value.status_code == 404
    assert list_agenda(db, alpha, date(2026, 9, 1), date(2026, 10, 31))["items"] == []


def test_student_sees_only_own_visible_events(agenda_db):
    db, alpha, _, alpha_user, beta_user, alpha_student, beta_student = agenda_db
    visible = create_event(db, alpha, payload(alpha_student.id, True, "Retorno"))
    create_event(db, alpha, payload(alpha_student.id, False, "Privado"))
    result = list_agenda(db, alpha_user, date(2026, 9, 1), date(2026, 10, 31))
    assert [item["id"] for item in result["items"]] == [str(visible.id)]
    assert list_agenda(db, beta_user, date(2026, 9, 1), date(2026, 10, 31))["items"] == []


def test_scheduled_workout_occurs_on_real_weekday_and_is_read_only(agenda_db):
    db, alpha, _, alpha_user, _, alpha_student, _ = agenda_db
    workout = Workout(personal_id=alpha.id, student_id=alpha_student.id, name="Treino de quarta", day_of_week="Quarta", status="active")
    db.add(workout); db.commit()
    result = list_agenda(db, alpha_user, date(2026, 9, 28), date(2026, 10, 4))
    item = result["items"][0]
    assert item["kind"] == "workout" and item["event_date"] == date(2026, 9, 30)
    assert item["editable"] is False and item["student_id"] == alpha_student.id


def test_invalid_date_range_is_rejected(agenda_db):
    db, alpha, *_ = agenda_db
    with pytest.raises(Exception) as invalid:
        list_agenda(db, alpha, date(2026, 12, 1), date(2026, 9, 1))
    assert invalid.value.status_code == 422


def test_disabled_agenda_returns_module_disabled(agenda_db):
    db, alpha, *_ = agenda_db
    branding = db.scalar(select(PersonalBranding).where(PersonalBranding.personal_id == alpha.id))
    branding.modules = {"calendar": False, "workouts": True}; db.commit()
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: alpha
    try:
        response = TestClient(app).get("/api/agenda?start=2026-09-01&end=2026-09-30")
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 403
    assert response.json()["detail"] == {"code": "module_disabled", "module": "calendar"}


def test_agenda_does_not_require_workouts(agenda_db):
    db, alpha, *_ = agenda_db
    branding = db.scalar(select(PersonalBranding).where(PersonalBranding.personal_id == alpha.id))
    branding.modules = {"calendar": True, "workouts": False}; db.commit()
    created = create_event(db, alpha, payload(title="Curso"))
    result = list_agenda(db, alpha, date(2026, 9, 1), date(2026, 10, 31))
    assert [item["id"] for item in result["items"]] == [str(created.id)]
    assert result["timezone"] == "America/Sao_Paulo"
