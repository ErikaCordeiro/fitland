import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

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
from app.models.user import User, UserRole
from app.services.student_invite_service import INVITE_ATTEMPTS, MAX_TOKEN_ATTEMPTS, TOKEN_ATTEMPTS


def actor(role, name):
    return User(id=uuid.uuid4(), name=name, email=f"{uuid.uuid4()}@test.dev", hashed_password="existing-hash", role=role, is_active=True, account_status="active")


@pytest.fixture()
def context(monkeypatch):
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine); db = Session(engine); INVITE_ATTEMPTS.clear(); TOKEN_ATTEMPTS.clear()
    personal, other = actor(UserRole.PERSONAL, "Personal"), actor(UserRole.PERSONAL, "Other")
    db.add_all([personal, other]); db.flush()
    student = Student(personal_id=personal.id, name="Ana da Silva", email="ana@example.com", age=30, weight=70, height=1.7, objective="Saúde")
    foreign = Student(personal_id=other.id, name="Bia Souza", email="bia@example.com", age=29, weight=65, height=1.65, objective="Força")
    db.add_all([student, foreign]); db.flush()
    db.add_all([PersonalBranding(personal_id=personal.id, display_name="Personal A", slug="personal-a", modules={"students": True}), PersonalBranding(personal_id=other.id, display_name="Personal B", slug="personal-b", modules={"students": True})]); db.commit()
    sent = []
    monkeypatch.setattr("app.services.student_invite_service.send_student_access_invite_email", lambda email, url, name: sent.append((email, url, name)))
    app.dependency_overrides[get_db] = lambda: db
    yield db, personal, other, student, foreign, sent
    app.dependency_overrides.clear(); db.close(); engine.dispose(); INVITE_ATTEMPTS.clear()


def client(user=None):
    if user is not None: app.dependency_overrides[get_current_user] = lambda: user
    return TestClient(app)


def token_from(sent): return parse_qs(urlparse(sent[-1][1]).query)["token"][0]


def test_invite_hash_tenant_and_resend_revocation(context):
    db, personal, other, student, foreign, sent = context
    response = client(personal).post(f"/api/students/{student.id}/access-invite")
    assert response.status_code == 202 and response.json()["status"] == "pending"
    token = token_from(sent); row = db.scalar(select(StudentAccessInvite))
    assert row.token_hash != token and token not in str(row.__dict__) and "token" not in response.text
    assert f"/personal/personal-a/aluno/primeiro-acesso" in sent[-1][1]
    assert client(other).post(f"/api/students/{student.id}/access-invite").status_code == 403
    assert client(personal).post(f"/api/students/{foreign.id}/access-invite").status_code == 403
    assert client(personal).post(f"/api/students/{student.id}/access-invite").status_code == 202
    db.refresh(row); assert row.revoked_at is not None
    assert client().get(f"/api/auth/student-invites/validate?token={token}&slug=personal-a").status_code == 400


def test_valid_invite_activates_once_and_creates_only_hashed_password(context):
    db, personal, _, student, _, sent = context
    assert client(personal).post(f"/api/students/{student.id}/access-invite").status_code == 202
    token = token_from(sent)
    assert client().get(f"/api/auth/student-invites/validate?token={token}&slug=wrong-slug").status_code == 400
    payload = {"token": token, "slug": "personal-a", "first_name": " ana ", "last_name": "SÍLVA", "new_password": "SenhaSegura123", "confirm_password": "SenhaSegura123"}
    activated = client().post("/api/auth/student-invites/activate", json=payload)
    assert activated.status_code == 200 and activated.json()["login_path"] == "/personal/personal-a/aluno/login"
    db.refresh(student); user = db.get(User, student.user_id)
    assert user.role == UserRole.STUDENT and user.hashed_password != payload["new_password"] and "SenhaSegura123" not in user.hashed_password
    assert student.access_activated_at is not None and user.onboarding_completed_at is None
    assert client().post("/api/auth/student-invites/activate", json=payload).status_code == 400
    login = client().post("/api/auth/login", json={"email": student.email, "password": payload["new_password"], "keep_connected": False})
    assert login.status_code == 200 and login.json()["user"]["role"] == "student"


def test_expired_invalid_identity_password_and_existing_access_are_safe(context):
    db, personal, _, student, _, sent = context
    client(personal).post(f"/api/students/{student.id}/access-invite"); token = token_from(sent)
    invite = db.scalar(select(StudentAccessInvite)); invite.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1); db.commit()
    assert client().get(f"/api/auth/student-invites/validate?token={token}&slug=personal-a").status_code == 410
    invite.expires_at = datetime.now(timezone.utc) + timedelta(hours=1); db.commit()
    base = {"token": token, "slug": "personal-a", "first_name": "Wrong", "last_name": "Name", "new_password": "SenhaSegura123", "confirm_password": "SenhaSegura123"}
    assert client().post("/api/auth/student-invites/activate", json=base).status_code == 422
    base.update(first_name="Ana", last_name="Silva", confirm_password="different123")
    assert client().post("/api/auth/student-invites/activate", json=base).status_code == 422
    existing = actor(UserRole.STUDENT, "Existing"); existing.email = student.email; db.add(existing); db.flush(); student.user_id = existing.id; db.commit()
    old_hash = existing.hashed_password
    assert client(personal).post(f"/api/students/{student.id}/access-invite").status_code == 409
    assert existing.hashed_password == old_hash


def test_onboarding_completion_is_student_only_and_idempotent(context):
    db, personal, _, student, _, _ = context
    user = actor(UserRole.STUDENT, "Ana"); db.add(user); db.flush(); student.user_id = user.id; db.commit()
    response = client(user).patch("/api/users/me/onboarding")
    assert response.status_code == 200 and response.json()["onboarding_completed_at"] is not None
    first = response.json()["onboarding_completed_at"]
    assert client(user).patch("/api/users/me/onboarding").json()["onboarding_completed_at"] == first
    assert client(personal).patch("/api/users/me/onboarding").status_code == 403


def test_invite_validation_is_rate_limited_without_storing_plain_token(context):
    token = "invalid-token-for-rate-limit"
    for _ in range(MAX_TOKEN_ATTEMPTS):
        assert client().get(f"/api/auth/student-invites/validate?token={token}&slug=personal-a").status_code == 400
    response = client().get(f"/api/auth/student-invites/validate?token={token}&slug=personal-a")
    assert response.status_code == 429
    assert token not in TOKEN_ATTEMPTS
    assert token not in response.text
