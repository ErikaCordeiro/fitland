import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user
from app.db.session import Base, get_db
from app.main import app
from app.models.personal_branding import PersonalBranding
from app.models.student import Student
from app.models.student_access_invite import StudentAccessInvite
from app.models.student_access_request import StudentAccessRequest
from app.models.user import User, UserRole
from app.services.student_access_request_service import PUBLIC_ATTEMPTS


def actor(role, name):
    return User(id=uuid.uuid4(), name=name, email=f"{uuid.uuid4()}@test.dev", hashed_password="existing-hash", role=role, is_active=True, account_status="active")


@pytest.fixture()
def context(monkeypatch):
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = Session(engine)
    PUBLIC_ATTEMPTS.clear()
    personal, other = actor(UserRole.PERSONAL, "Personal A"), actor(UserRole.PERSONAL, "Personal B")
    student_user, owner = actor(UserRole.STUDENT, "Student"), actor(UserRole.OWNER, "Owner")
    db.add_all([personal, other, student_user, owner]); db.flush()
    db.add_all([
        PersonalBranding(personal_id=personal.id, display_name="Personal A", slug="personal-a", modules={"students": True}),
        PersonalBranding(personal_id=other.id, display_name="Personal B", slug="personal-b", modules={"students": True}),
    ]); db.commit()
    sent = []
    monkeypatch.setattr("app.services.student_invite_service.send_student_access_invite_email", lambda email, url, brand: sent.append((email, url, brand)))

    def client(user=None):
        app.dependency_overrides[get_db] = lambda: db
        if user is None:
            app.dependency_overrides.pop(get_current_user, None)
        else:
            app.dependency_overrides[get_current_user] = lambda: user
        return TestClient(app)

    yield db, personal, other, student_user, owner, sent, client
    app.dependency_overrides.clear(); db.close()


def payload(email="new.student@example.com"):
    return {"first_name": " Ana ", "last_name": " da Silva ", "email": email}


def test_public_request_is_tenant_scoped_normalized_and_has_no_password(context):
    db, personal, other, _, _, _, client = context
    response = client().post("/api/student-access-requests/public/personal-a", json=payload("NEW.Student@Example.com"))
    assert response.status_code == 202 and response.json()["status"] == "PENDING"
    row = db.scalar(select(StudentAccessRequest))
    assert row.personal_id == personal.id and row.first_name == "Ana" and row.last_name == "da Silva"
    assert row.email == "new.student@example.com" and not hasattr(row, "password")
    assert "password" not in response.text and "token" not in response.text
    other_response = client().post("/api/student-access-requests/public/personal-b", json=payload("NEW.Student@Example.com"))
    assert other_response.status_code == 202
    assert db.scalar(select(StudentAccessRequest).where(StudentAccessRequest.personal_id == other.id)).email == "new.student@example.com"
    assert client().post("/api/student-access-requests/public/missing", json=payload("other@example.com")).status_code == 404


def test_public_validation_duplicate_existing_and_rate_limit(context):
    db, personal, _, student_user, _, _, client = context
    assert client().post("/api/student-access-requests/public/personal-a", json={"first_name": "", "last_name": "X", "email": "bad"}).status_code == 422
    assert client().post("/api/student-access-requests/public/personal-a", json={"first_name": "A" * 81, "last_name": "X", "email": "long@example.com"}).status_code == 422
    assert client().post("/api/student-access-requests/public/personal-a", json={"first_name": "<script>", "last_name": "X", "email": "x@example.com"}).status_code == 422
    assert client().post("/api/student-access-requests/public/personal-a", json=payload()).status_code == 202
    assert client().post("/api/student-access-requests/public/personal-a", json=payload()).status_code == 409
    active = Student(personal_id=personal.id, user_id=student_user.id, name="Active Student", email="active@example.com", age=30, weight=70, height=1.7, objective="Saúde")
    db.add(active); db.commit()
    assert client().post("/api/student-access-requests/public/personal-a", json=payload("active@example.com")).status_code == 409
    for index in range(7):
        client().post("/api/student-access-requests/public/personal-a", json=payload(f"rate-{index}@example.com"))
    assert client().post("/api/student-access-requests/public/personal-a", json=payload("rate-last@example.com")).status_code == 429


def test_personal_approval_reuses_invite_without_creating_password(context):
    db, personal, _, _, _, sent, client = context
    client().post("/api/student-access-requests/public/personal-a", json=payload())
    request_row = db.scalar(select(StudentAccessRequest))
    listed = client(personal).get("/api/student-access-requests")
    assert listed.status_code == 200 and listed.json()[0]["email"] == "new.student@example.com"
    response = client(personal).post(f"/api/student-access-requests/{request_row.id}/approve")
    assert response.status_code == 200 and response.json()["status"] == "APPROVED"
    db.refresh(request_row)
    student = db.get(Student, request_row.student_id)
    invite = db.scalar(select(StudentAccessInvite).where(StudentAccessInvite.student_id == student.id))
    assert student.user_id is None and student.age is None and student.weight is None and student.height is None and student.objective is None
    assert invite and len(invite.token_hash) == 64 and sent and "token=" in sent[0][1]
    assert db.scalar(select(User).where(User.email == student.email)) is None
    assert client(personal).post(f"/api/student-access-requests/{request_row.id}/approve").status_code == 409


def test_review_is_tenant_and_role_protected(context):
    db, personal, other, student_user, owner, _, client = context
    client().post("/api/student-access-requests/public/personal-a", json=payload())
    request_row = db.scalar(select(StudentAccessRequest))
    assert client().post(f"/api/student-access-requests/{request_row.id}/approve").status_code == 401
    assert client(student_user).post(f"/api/student-access-requests/{request_row.id}/approve").status_code == 403
    assert client(owner).post(f"/api/student-access-requests/{request_row.id}/approve").status_code == 403
    assert client(other).post(f"/api/student-access-requests/{request_row.id}/approve").status_code == 404
    assert client(personal).post(f"/api/student-access-requests/{request_row.id}/reject", json={"reason": "Sem vagas"}).status_code == 200
    assert client(personal).post(f"/api/student-access-requests/{request_row.id}/reject", json={"reason": None}).status_code == 409
    assert client(personal).post(f"/api/student-access-requests/{request_row.id}/approve").status_code == 409


def test_approval_rolls_back_when_invite_delivery_fails(context, monkeypatch):
    db, personal, _, _, _, _, client = context
    client().post("/api/student-access-requests/public/personal-a", json=payload())
    request_row = db.scalar(select(StudentAccessRequest))
    monkeypatch.setattr("app.services.student_invite_service.send_student_access_invite_email", lambda *_: (_ for _ in ()).throw(RuntimeError("provider unavailable")))
    response = client(personal).post(f"/api/student-access-requests/{request_row.id}/approve")
    assert response.status_code == 503
    db.expire_all(); request_row = db.get(StudentAccessRequest, request_row.id)
    assert request_row.status == "PENDING" and request_row.student_id is None
    assert db.scalar(select(Student).where(Student.email == "new.student@example.com")) is None
    assert db.scalar(select(StudentAccessInvite)) is None
