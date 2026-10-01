import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user
from app.db.session import Base, get_db
from app.main import app
from app.models.meal_plan import MealPlan, MealPlanStatus
from app.models.personal_branding import PersonalBranding
from app.models.student import Student
from app.models.user import User, UserRole


def make_user(role):
    return User(id=uuid.uuid4(), name=role.value, email=f"{uuid.uuid4()}@test.dev", hashed_password="x", role=role, is_active=True, account_status="active")


@pytest.fixture()
def context():
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine); db = Session(engine)
    personal, other, student_user, foreign_user = make_user(UserRole.PERSONAL), make_user(UserRole.PERSONAL), make_user(UserRole.STUDENT), make_user(UserRole.STUDENT)
    db.add_all([personal, other, student_user, foreign_user]); db.flush()
    own = Student(personal_id=personal.id, user_id=student_user.id, name="Own", email=student_user.email, age=30, weight=80, height=1.7, objective="Saúde")
    foreign = Student(personal_id=other.id, user_id=foreign_user.id, name="Foreign", email=foreign_user.email, age=31, weight=70, height=1.8, objective="Força")
    db.add_all([own, foreign]); db.flush()
    db.add_all([PersonalBranding(personal_id=personal.id, display_name="A", slug="a", modules={"diet": True}), PersonalBranding(personal_id=other.id, display_name="B", slug="b", modules={"diet": True})]); db.commit()
    app.dependency_overrides[get_db] = lambda: db
    yield db, personal, other, student_user, own, foreign
    app.dependency_overrides.clear(); db.close()


def client(user):
    app.dependency_overrides[get_current_user] = lambda: user
    return TestClient(app)


def payload(student_id, name="Plano A"):
    return {"student_id": str(student_id), "name": name, "start_date": "2026-10-01", "notes": "Orientação real", "meals": [
        {"name": "Almoço", "time": "12:30", "items": [{"food_name": "Item B", "quantity": 100.5, "unit": "g"}, {"food_name": "Item A", "quantity": 1, "unit": "porção"}]},
        {"name": "Horário livre", "time": None, "items": []},
    ]}


def test_personal_crud_order_archive_and_history(context):
    db, personal, _, _, own, _ = context; api = client(personal)
    first = api.post("/api/meal-plans", json=payload(own.id)).json()
    assert first["status"] == "active" and first["meals"][0]["items"][0]["quantity"] == 100.5
    updated_payload = payload(own.id, "Plano editado"); updated_payload["meals"].reverse(); updated_payload["meals"][1]["items"].reverse()
    updated = api.put(f"/api/meal-plans/{first['id']}", json=updated_payload)
    assert updated.status_code == 200 and updated.json()["meals"][0]["name"] == "Horário livre"
    second = api.post("/api/meal-plans", json=payload(own.id, "Plano novo"))
    assert second.status_code == 201
    rows = api.get(f"/api/meal-plans?student_id={own.id}").json()
    assert len(rows) == 2 and sum(row["status"] == "active" for row in rows) == 1
    assert db.scalars(select(MealPlan).where(MealPlan.student_id == own.id, MealPlan.status == MealPlanStatus.ARCHIVED)).one()
    assert api.post(f"/api/meal-plans/{second.json()['id']}/archive").json()["status"] == "archived"


def test_tenant_isolation_student_read_only_and_active(context):
    _, personal, _, student_user, own, foreign = context; api = client(personal)
    assert api.post("/api/meal-plans", json=payload(foreign.id)).status_code == 403
    plan = api.post("/api/meal-plans", json=payload(own.id)).json()
    student = client(student_user)
    assert student.get("/api/meal-plans/active").json()["id"] == plan["id"]
    assert student.get(f"/api/meal-plans?student_id={foreign.id}").status_code == 403
    assert student.post("/api/meal-plans", json=payload(own.id)).status_code == 403
    assert student.put(f"/api/meal-plans/{plan['id']}", json=payload(own.id)).status_code == 403
    assert student.post(f"/api/meal-plans/{plan['id']}/archive").status_code == 403


def test_validation_and_feature_flag_preserve_data(context):
    db, personal, _, _, own, _ = context; api = client(personal)
    bad = payload(own.id); bad["meals"][0]["items"][0]["quantity"] = -1
    assert api.post("/api/meal-plans", json=bad).status_code == 422
    invalid_unit = payload(own.id); invalid_unit["meals"][0]["items"][0]["unit"] = "pacote"
    assert api.post("/api/meal-plans", json=invalid_unit).status_code == 422
    created = api.post("/api/meal-plans", json=payload(own.id)).json()
    branding = db.query(PersonalBranding).filter_by(personal_id=personal.id).one(); branding.modules = {"diet": False}; db.commit()
    response = api.get(f"/api/meal-plans?student_id={own.id}")
    assert response.status_code == 403 and response.json()["detail"] == {"code": "module_disabled", "module": "diet"}
    assert db.get(MealPlan, uuid.UUID(created["id"])) is not None
