import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user
from app.db.session import Base, get_db
from app.main import app
from app.models import audit_log, user  # noqa: F401
from app.models.audit_log import AuditLog
from app.models.user import User, UserRole


def make_user(role: UserRole) -> User:
    return User(
        id=uuid.uuid4(), name=role.value.title(), email=f"{uuid.uuid4()}@example.com",
        hashed_password="test", role=role, is_active=True, account_status="active",
    )


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def request_as(db: Session, user: User | None):
    app.dependency_overrides[get_db] = lambda: db
    if user:
        app.dependency_overrides[get_current_user] = lambda: user
    return TestClient(app)


def test_owner_exports_utf8_csv_attachment_without_sensitive_details(db):
    owner = make_user(UserRole.OWNER)
    db.add(owner)
    db.flush()
    db.add(AuditLog(
        actor_user_id=owner.id,
        action="personal_updated",
        entity_type="user",
        entity_id=str(uuid.uuid4()),
        result="success",
        details={"request_id": "request-safe", "password": "never-export", "token": "never-export-token"},
    ))
    db.commit()
    try:
        response = request_as(db, owner).get("/api/owner/audit-logs/export")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert response.headers["content-disposition"].startswith('attachment; filename="fitland-logs-')
    assert response.content.startswith(b"\xef\xbb\xbf")
    assert b"personal_updated" in response.content
    assert b"request-safe" in response.content
    assert b"never-export" not in response.content
    assert b"password" not in response.content.lower()
    assert b"token" not in response.content.lower()


@pytest.mark.parametrize("role", [UserRole.PERSONAL, UserRole.STUDENT])
def test_non_owner_cannot_export_logs(db, role):
    profile = make_user(role)
    db.add(profile)
    db.commit()
    try:
        response = request_as(db, profile).get("/api/owner/audit-logs/export")
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 403


def test_unauthenticated_user_cannot_export_logs(db):
    try:
        response = request_as(db, None).get("/api/owner/audit-logs/export")
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 401
