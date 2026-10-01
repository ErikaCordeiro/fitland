import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user
from app.db.session import Base, get_db
from app.main import app
from app.models.finance import FinancialCharge
from app.models.personal_branding import PersonalBranding
from app.models.student import Student
from app.models.user import User, UserRole


def make_user(role): return User(id=uuid.uuid4(), name=role.value, email=f"{uuid.uuid4()}@test.dev", hashed_password="x", role=role, is_active=True, account_status="active")

@pytest.fixture()
def context():
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine); db = Session(engine)
    personal, other, student_user, foreign_user = make_user(UserRole.PERSONAL), make_user(UserRole.PERSONAL), make_user(UserRole.STUDENT), make_user(UserRole.STUDENT)
    db.add_all([personal, other, student_user, foreign_user]); db.flush()
    own = Student(personal_id=personal.id, user_id=student_user.id, name="Own", email=student_user.email, age=30, weight=80, height=1.7, objective="Saúde")
    foreign = Student(personal_id=other.id, user_id=foreign_user.id, name="Foreign", email=foreign_user.email, age=30, weight=70, height=1.7, objective="Força")
    db.add_all([own, foreign]); db.flush(); db.add_all([PersonalBranding(personal_id=personal.id, display_name="A", slug="a", modules={"finance": True}), PersonalBranding(personal_id=other.id, display_name="B", slug="b", modules={"finance": True})]); db.commit()
    app.dependency_overrides[get_db] = lambda: db
    yield db, personal, other, student_user, own, foreign
    app.dependency_overrides.clear(); db.close()

def client(user): app.dependency_overrides[get_current_user] = lambda: user; return TestClient(app)
def charge(student_id, amount="200.00", due=None): return {"student_id": str(student_id), "description": "Mensalidade", "amount": amount, "due_date": str(due or date.today())}
def payment(amount, paid=None): return {"amount": amount, "paid_at": str(paid or date.today()), "payment_method": "pix"}

def test_partial_full_payment_precision_and_overpayment(context):
    _, personal, _, _, own, _ = context; api = client(personal)
    created = api.post("/api/finance/charges", json=charge(own.id, "199.90")).json()
    partial = api.post(f"/api/finance/charges/{created['id']}/payments", json=payment("99.95"))
    assert partial.status_code == 200 and partial.json()["status"] == "partial" and Decimal(partial.json()["balance"]) == Decimal("99.95")
    assert api.post(f"/api/finance/charges/{created['id']}/payments", json=payment("100.00")).status_code == 409
    completed = api.post(f"/api/finance/charges/{created['id']}/payments", json=payment("99.95")).json()
    assert completed["status"] == "paid" and Decimal(completed["balance"]) == Decimal("0.00")

def test_status_summary_cancel_and_received_month(context):
    _, personal, _, _, own, _ = context; api = client(personal)
    overdue = api.post("/api/finance/charges", json=charge(own.id, "100.00", date.today() - timedelta(days=1))).json()
    future = api.post("/api/finance/charges", json=charge(own.id, "50.00", date.today() + timedelta(days=3))).json()
    assert overdue["status"] == "overdue" and future["status"] == "pending"
    api.post(f"/api/finance/charges/{overdue['id']}/payments", json=payment("25.00"))
    totals = api.get("/api/finance/summary").json()
    assert Decimal(totals["receivable"]) == Decimal("125.00") and Decimal(totals["received_month"]) == Decimal("25.00") and Decimal(totals["overdue"]) == Decimal("75.00")
    cancelled = api.post(f"/api/finance/charges/{future['id']}/cancel").json()
    assert cancelled["status"] == "cancelled" and Decimal(api.get("/api/finance/summary").json()["receivable"]) == Decimal("75.00")
    assert api.post(f"/api/finance/charges/{overdue['id']}/cancel").status_code == 409

def test_tenant_isolation_student_read_only(context):
    _, personal, other, student_user, own, foreign = context; api = client(personal)
    assert api.post("/api/finance/charges", json=charge(foreign.id)).status_code == 403
    own_charge = api.post("/api/finance/charges", json=charge(own.id)).json()
    client(other).post("/api/finance/charges", json=charge(foreign.id))
    assert len(api.get("/api/finance/charges").json()) == 1
    student = client(student_user)
    assert student.get("/api/finance/charges").json()[0]["id"] == own_charge["id"]
    assert student.get(f"/api/finance/charges?student_id={foreign.id}").status_code == 403
    assert student.post("/api/finance/charges", json=charge(own.id)).status_code == 403
    assert student.post(f"/api/finance/charges/{own_charge['id']}/payments", json=payment("10")).status_code == 403

def test_validation_feature_flag_and_data_preservation(context):
    db, personal, _, _, own, _ = context; api = client(personal)
    assert api.post("/api/finance/charges", json=charge(own.id, "0")).status_code == 422
    created = api.post("/api/finance/charges", json=charge(own.id)).json()
    branding = db.query(PersonalBranding).filter_by(personal_id=personal.id).one(); branding.modules = {"finance": False}; db.commit()
    response = api.get("/api/finance/charges")
    assert response.status_code == 403 and response.json()["detail"] == {"code": "module_disabled", "module": "finance"}
    assert db.get(FinancialCharge, uuid.UUID(created["id"])) is not None
