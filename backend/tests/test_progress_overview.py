import uuid
from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user
from app.db.session import Base, get_db
from app.main import app
from app.models import progress, student, user, workout_session  # noqa: F401
from app.models.personal_branding import PersonalBranding
from app.models.progress import ProgressLog
from app.models.student import Student
from app.models.user import User, UserRole
from app.models.workout_session import WorkoutSession


def make_user(role):
    return User(id=uuid.uuid4(), name=str(role.value), email=f"{uuid.uuid4()}@test.dev", hashed_password="test", role=role, is_active=True, account_status="active")


@pytest.fixture()
def context():
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = Session(engine)
    personal, other, student_user = make_user(UserRole.PERSONAL), make_user(UserRole.PERSONAL), make_user(UserRole.STUDENT)
    db.add_all([personal, other, student_user]); db.flush()
    own = Student(personal_id=personal.id, user_id=student_user.id, name="Aluno", email=student_user.email, age=30, weight=70, height=1.7, objective="Força")
    foreign = Student(personal_id=other.id, name="Outro", email="other@test.dev", age=31, weight=75, height=1.8, objective="Força")
    db.add_all([own, foreign]); db.flush()
    db.add_all([
        PersonalBranding(personal_id=personal.id, display_name="A", slug="a", modules={"workouts": True, "progress": True}),
        PersonalBranding(personal_id=other.id, display_name="B", slug="b", modules={"workouts": True, "progress": True}),
    ]); db.commit()
    app.dependency_overrides[get_db] = lambda: db
    yield db, personal, student_user, own, foreign
    app.dependency_overrides.clear(); db.close()


def client_for(user):
    app.dependency_overrides[get_current_user] = lambda: user
    return TestClient(app)


def add_session(db, student_row, status, days_ago=1, load=80):
    when = datetime.now(timezone.utc) - timedelta(days=days_ago)
    session = WorkoutSession(
        client_session_id=str(uuid.uuid4()), student_id=student_row.id, personal_id=student_row.personal_id,
        workout_ref="workout-a", workout_name="Treino", status=status, started_at=when - timedelta(hours=1),
        completed_at=when, duration_seconds=3600, progress={}, exercises=[{"exercise_id": "bench", "exercise_name": "Supino", "sets": [{"set_number": 1, "status": "concluida", "used_load": load, "completed_reps": 10}]}],
        client_updated_at=when,
    )
    db.add(session); db.commit()


def test_personal_reads_only_owned_student_and_real_completed_data(context):
    db, personal, _, own, foreign = context
    add_session(db, own, "concluido", load=80)
    add_session(db, own, "em_andamento", load=999)
    db.add(ProgressLog(student_id=own.id, log_date=date.today(), body_weight=69, completed_exercises=0)); db.commit()
    client = client_for(personal)
    response = client.get(f"/api/progress/overview/{own.id}?period_days=30")
    assert response.status_code == 200
    data = response.json()
    assert data["completed_workouts"] == 1
    assert data["exercise_progress"][0]["best_load"] == 80
    assert data["real_volume"] == 800
    assert data["current_weight"] == 69
    assert client.get(f"/api/progress/overview/{foreign.id}").status_code == 403


def test_student_reads_self_but_cannot_request_another_student(context):
    _, _, student_user, own, foreign = context
    client = client_for(student_user)
    assert client.get("/api/progress/overview").status_code == 200
    assert client.get(f"/api/progress/overview/{own.id}").status_code == 200
    assert client.get(f"/api/progress/overview/{foreign.id}").status_code == 403


def test_empty_history_is_valid_and_uses_current_weight_only(context):
    _, personal, _, own, _ = context
    data = client_for(personal).get(f"/api/progress/overview/{own.id}").json()
    assert data["completed_workouts"] == 0
    assert data["exercise_progress"] == []
    assert data["weight_history"] == []
    assert data["current_weight"] == 70
    assert data["real_volume"] is None
    assert data["highlights"] == []


def test_progress_module_disabled_returns_structured_403(context):
    db, personal, _, own, _ = context
    branding = db.query(PersonalBranding).filter_by(personal_id=personal.id).one()
    branding.modules = {"workouts": True, "progress": False}; db.commit()
    response = client_for(personal).get(f"/api/progress/overview/{own.id}")
    assert response.status_code == 403
    assert response.json()["detail"] == {"code": "module_disabled", "module": "progress"}
