import uuid
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user
from app.db.session import Base, get_db
from app.main import app
from app.models.personal_branding import PersonalBranding
from app.models.progress import ProgressLog
from app.models.student import Student
from app.models.user import User, UserRole


def user(role):
    return User(id=uuid.uuid4(), name=role.value, email=f"{uuid.uuid4()}@test.dev", hashed_password="x", role=role, is_active=True, account_status="active")


@pytest.fixture()
def context():
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = Session(engine)
    personal, other, student_user, other_student_user = user(UserRole.PERSONAL), user(UserRole.PERSONAL), user(UserRole.STUDENT), user(UserRole.STUDENT)
    db.add_all([personal, other, student_user, other_student_user]); db.flush()
    own = Student(personal_id=personal.id, user_id=student_user.id, name="Own", email=student_user.email, age=30, weight=80, height=1.7, objective="Saúde")
    foreign = Student(personal_id=other.id, user_id=other_student_user.id, name="Foreign", email=other_student_user.email, age=31, weight=75, height=1.8, objective="Força")
    db.add_all([own, foreign]); db.flush()
    db.add_all([
        PersonalBranding(personal_id=personal.id, display_name="A", slug="a", modules={"assessments": True, "progress": True, "workouts": True}),
        PersonalBranding(personal_id=other.id, display_name="B", slug="b", modules={"assessments": True, "progress": True, "workouts": True}),
    ]); db.commit()
    app.dependency_overrides[get_db] = lambda: db
    yield db, personal, other, student_user, own, foreign
    app.dependency_overrides.clear(); db.close()


def client(user_row):
    app.dependency_overrides[get_current_user] = lambda: user_row
    return TestClient(app)


def payload(student_id, day="2026-09-01", weight=80):
    return {"student_id": str(student_id), "assessment_date": day, "weight": weight, "height": 170, "waist": 90, "body_fat_percentage": 25}


def test_personal_crud_preserves_history_and_comparison(context):
    _, personal, _, _, own, _ = context; api = client(personal)
    first = api.post("/api/assessments", json=payload(own.id)).json()
    second_response = api.post("/api/assessments", json=payload(own.id, "2026-10-01", 78))
    assert second_response.status_code == 201
    second = second_response.json()
    rows = api.get(f"/api/assessments?student_id={own.id}").json()
    assert [row["id"] for row in rows] == [second["id"], first["id"]]
    detail = api.get(f"/api/assessments/{second['id']}").json()
    assert detail["previous"]["id"] == first["id"] and detail["differences"]["weight"] == -2
    updated = api.patch(f"/api/assessments/{second['id']}", json={"waist": 87}).json()
    assert updated["waist"] == 87 and len(api.get(f"/api/assessments?student_id={own.id}").json()) == 2
    assert api.delete(f"/api/assessments/{first['id']}").status_code == 204
    assert len(api.get(f"/api/assessments?student_id={own.id}").json()) == 1


def test_cross_tenant_and_student_read_only(context):
    _, personal, _, student_user, own, foreign = context
    assert client(personal).post("/api/assessments", json=payload(foreign.id)).status_code == 403
    created = client(personal).post("/api/assessments", json=payload(own.id)).json()
    student_api = client(student_user)
    assert len(student_api.get("/api/assessments").json()) == 1
    assert student_api.get(f"/api/assessments/{created['id']}").status_code == 200
    assert student_api.get(f"/api/assessments?student_id={foreign.id}").status_code == 403
    assert student_api.post("/api/assessments", json=payload(own.id)).status_code == 403
    assert student_api.patch(f"/api/assessments/{created['id']}", json={"weight": 50}).status_code == 403
    assert student_api.delete(f"/api/assessments/{created['id']}").status_code == 403


def test_optional_fields_validation_and_module_flag(context):
    db, personal, _, _, own, _ = context; api = client(personal)
    minimal = api.post("/api/assessments", json={"student_id": str(own.id), "assessment_date": "2026-10-01"})
    assert minimal.status_code == 201 and minimal.json()["bmi"] is None
    assert api.post("/api/assessments", json=payload(own.id, weight=-1)).status_code == 422
    invalid_fat = payload(own.id); invalid_fat["body_fat_percentage"] = 101
    assert api.post("/api/assessments", json=invalid_fat).status_code == 422
    branding = db.query(PersonalBranding).filter_by(personal_id=personal.id).one()
    branding.modules = {"assessments": False, "progress": True, "workouts": True}; db.commit()
    response = api.get(f"/api/assessments?student_id={own.id}")
    assert response.status_code == 403 and response.json()["detail"] == {"code": "module_disabled", "module": "assessments"}


def test_progress_combines_weight_and_measurements_without_zero_filling(context):
    db, personal, _, _, own, _ = context; api = client(personal)
    db.add(ProgressLog(student_id=own.id, log_date=date(2026, 9, 1), body_weight=81, completed_exercises=0)); db.commit()
    api.post("/api/assessments", json=payload(own.id, "2026-09-01", 80))
    third = payload(own.id, "2026-10-01", 78); third["waist"] = None
    api.post("/api/assessments", json=third)
    data = api.get(f"/api/progress/overview/{own.id}").json()
    assert [point["value"] for point in data["weight_history"]] == [80, 78]
    assert data["current_weight"] == 78 and data["measurements_supported"] is True
    waist = next(item for item in data["measurements"] if item["key"] == "waist")
    assert [point["value"] for point in waist["points"]] == [90]


def test_progress_omits_assessment_data_when_module_disabled(context):
    db, personal, _, _, own, _ = context; api = client(personal)
    api.post("/api/assessments", json=payload(own.id))
    branding = db.query(PersonalBranding).filter_by(personal_id=personal.id).one()
    branding.modules = {"assessments": False, "progress": True, "workouts": True}; db.commit()
    data = api.get(f"/api/progress/overview/{own.id}").json()
    assert data["measurements_supported"] is False and data["measurements"] == []
    assert data["weight_history"] == []
