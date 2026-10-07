import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from app.api.deps import get_current_user
from app.db.session import Base, get_db
from app.main import app
from app.models.finance import FinancialCharge, FinancialPayment
from app.models.personal_branding import PersonalBranding
from app.models.student import Student
from app.models.student_assessment import StudentAssessment
from app.models.user import User, UserRole
from app.models.workout_session import WorkoutSession

def user(role, name):
    return User(id=uuid.uuid4(), name=name, email=f"{uuid.uuid4()}@test.dev", hashed_password="x", role=role, is_active=True, account_status="active")

@pytest.fixture()
def context():
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine); db = Session(engine)
    personal, other, student_user = user(UserRole.PERSONAL, "A"), user(UserRole.PERSONAL, "B"), user(UserRole.STUDENT, "Student")
    db.add_all([personal, other, student_user]); db.flush()
    own = Student(personal_id=personal.id, user_id=student_user.id, name="=Own", email=student_user.email, created_at=datetime.utcnow())
    foreign = Student(personal_id=other.id, name="Foreign", email="foreign@test.dev")
    db.add_all([own, foreign]); db.flush()
    db.add_all([PersonalBranding(personal_id=personal.id, display_name="A", slug="a", modules={"reports": True, "assessments": True, "finance": True}), PersonalBranding(personal_id=other.id, display_name="B", slug="b", modules={"reports": True, "assessments": True, "finance": True})]); db.flush()
    # SQLite stores this PostgreSQL timestamptz fixture without an offset.
    now = datetime.utcnow()
    db.add_all([
        WorkoutSession(client_session_id="done", student_id=own.id, personal_id=personal.id, workout_ref="w", workout_name="Real", status="concluido", completed_at=now, client_updated_at=now),
        WorkoutSession(client_session_id="open", student_id=own.id, personal_id=personal.id, workout_ref="w", workout_name="Open", status="em_andamento", client_updated_at=now),
        WorkoutSession(client_session_id="foreign", student_id=foreign.id, personal_id=other.id, workout_ref="w", workout_name="Foreign", status="concluido", completed_at=now, client_updated_at=now),
        StudentAssessment(personal_id=personal.id, student_id=own.id, assessment_date=date.today()),
    ])
    charge = FinancialCharge(personal_id=personal.id, student_id=own.id, description="Mensalidade", amount=Decimal("100.00"), due_date=date.today() - timedelta(days=1))
    db.add(charge); db.flush(); db.add(FinancialPayment(charge_id=charge.id, personal_id=personal.id, student_id=own.id, amount=Decimal("25.00"), paid_at=date.today())); db.commit()
    app.dependency_overrides[get_db] = lambda: db
    yield db, personal, other, student_user, own, foreign
    app.dependency_overrides.clear(); db.close()

def client(current):
    app.dependency_overrides[get_current_user] = lambda: current
    return TestClient(app)

def test_reports_use_only_completed_owned_data_and_real_finance(context):
    _, personal, _, _, own, _ = context
    response = client(personal).get("/api/reports/overview?days=30")
    assert response.status_code == 200
    body = response.json(); metrics = body["metrics"]
    assert metrics["students_total"] == 1 and metrics["completed_workouts"] == 1 and metrics["students_trained"] == 1
    assert metrics["assessments_completed"] == 1 and Decimal(metrics["received"]) == Decimal("25.00") and Decimal(metrics["overdue"]) == Decimal("75.00")
    assert body["student_activity"][0]["student_id"] == str(own.id)

def test_student_role_foreign_filter_invalid_period_and_module_off_are_blocked(context):
    db, personal, _, student_user, _, foreign = context
    assert client(student_user).get("/api/reports/overview").status_code == 403
    assert client(personal).get(f"/api/reports/overview?student_id={foreign.id}").status_code == 404
    assert client(personal).get("/api/reports/overview?days=999").status_code == 422
    branding = db.query(PersonalBranding).filter_by(personal_id=personal.id).one(); branding.modules = {"reports": False}; db.commit()
    response = client(personal).get("/api/reports/overview")
    assert response.status_code == 403 and response.json()["detail"] == {"code": "module_disabled", "module": "reports"}

def test_csv_has_bom_active_filters_no_secrets_and_blocks_formula_injection(context):
    _, personal, _, _, own, _ = context
    response = client(personal).get(f"/api/reports/export.csv?days=30&student_id={own.id}")
    assert response.status_code == 200 and response.content.startswith(b"\xef\xbb\xbf")
    text = response.content.decode("utf-8-sig")
    assert "'=Own" in text and "password" not in text.lower() and "token" not in text.lower()
