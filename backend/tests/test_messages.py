import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user
from app.db.session import Base, get_db
from app.main import app
from app.models.audit_log import AuditLog
from app.models.message import Message
from app.models.personal_branding import PersonalBranding
from app.models.student import Student
from app.models.user import User, UserRole


def user(role, name):
    return User(id=uuid.uuid4(), name=name, email=f"{uuid.uuid4()}@test.dev", hashed_password="x", role=role, is_active=True, account_status="active")


@pytest.fixture()
def context():
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine); db = Session(engine)
    p1, p2 = user(UserRole.PERSONAL, "P1"), user(UserRole.PERSONAL, "P2")
    s1u, s2u, foreign_u = user(UserRole.STUDENT, "S1"), user(UserRole.STUDENT, "S2"), user(UserRole.STUDENT, "Foreign")
    db.add_all([p1, p2, s1u, s2u, foreign_u]); db.flush()
    s1 = Student(personal_id=p1.id, user_id=s1u.id, name="Ana", email=s1u.email, age=30, weight=70, height=1.7, objective="Saúde")
    s2 = Student(personal_id=p1.id, user_id=s2u.id, name="Bia", email=s2u.email, age=31, weight=71, height=1.7, objective="Força")
    foreign = Student(personal_id=p2.id, user_id=foreign_u.id, name="Cris", email=foreign_u.email, age=32, weight=72, height=1.7, objective="Mobilidade")
    db.add_all([s1, s2, foreign]); db.flush()
    db.add_all([PersonalBranding(personal_id=p1.id, display_name="P1", slug="p1", modules={"messages": True}), PersonalBranding(personal_id=p2.id, display_name="P2", slug="p2", modules={"messages": True})]); db.commit()
    app.dependency_overrides[get_db] = lambda: db
    yield db, p1, p2, s1u, s2u, foreign_u, s1, s2, foreign
    app.dependency_overrides.clear(); db.close(); engine.dispose()


def client(actor):
    app.dependency_overrides[get_current_user] = lambda: actor
    return TestClient(app)


def create_conversation(api, student_id=None):
    payload = {} if student_id is None else {"student_id": str(student_id)}
    return api.post("/api/messages/conversations", json=payload)


def test_personal_lists_students_and_conversation_is_unique(context):
    _, p1, _, _, _, _, s1, _, _ = context; api = client(p1)
    rows = api.get("/api/messages/conversations").json()
    assert [row["student_name"] for row in rows] == ["Ana", "Bia"]
    first = create_conversation(api, s1.id); second = create_conversation(api, s1.id)
    assert first.status_code == 201 and first.json()["id"] == second.json()["id"]


def test_send_sender_session_xss_and_log_privacy(context):
    db, p1, _, _, _, _, s1, _, _ = context; api = client(p1)
    conversation = create_conversation(api, s1.id).json()
    body = "<script>alert('x')</script>"
    sent = api.post(f"/api/messages/conversations/{conversation['id']}/messages", json={"body": body})
    assert sent.status_code == 201 and sent.json()["sender_role"] == "personal" and sent.json()["body"] == body
    assert api.post(f"/api/messages/conversations/{conversation['id']}/messages", json={"body": "x", "sender_id": str(uuid.uuid4())}).status_code == 422
    row = db.scalar(select(Message)); assert row.sender_user_id == p1.id
    audit = db.scalar(select(AuditLog).where(AuditLog.action == "message_sent")); assert body not in str(audit.details)


def test_validation_limits(context):
    _, p1, _, _, _, _, s1, _, _ = context; api = client(p1)
    conversation = create_conversation(api, s1.id).json()
    endpoint = f"/api/messages/conversations/{conversation['id']}/messages"
    assert api.post(endpoint, json={"body": "   "}).status_code == 422
    assert api.post(endpoint, json={"body": "a" * 4001}).status_code == 422


def test_student_personal_exchange_unread_and_read(context):
    _, p1, _, s1u, _, _, s1, _, _ = context
    personal = client(p1); conversation = create_conversation(personal, s1.id).json()
    personal.post(f"/api/messages/conversations/{conversation['id']}/messages", json={"body": "Olá"})
    student = client(s1u)
    assert student.get("/api/messages/unread-count").json()["count"] == 1
    student.post(f"/api/messages/conversations/{conversation['id']}/read")
    assert student.get("/api/messages/unread-count").json()["count"] == 0
    student.post(f"/api/messages/conversations/{conversation['id']}/messages", json={"body": "Resposta"})
    assert student.get("/api/messages/unread-count").json()["count"] == 0
    assert client(p1).get("/api/messages/unread-count").json()["count"] == 1


def test_cross_tenant_and_other_student_blocked(context):
    _, p1, p2, s1u, s2u, foreign_u, s1, _, foreign = context
    own = create_conversation(client(p1), s1.id).json()
    foreign_conversation = create_conversation(client(p2), foreign.id).json()
    assert create_conversation(client(p1), foreign.id).status_code == 403
    assert client(s1u).get(f"/api/messages/conversations/{foreign_conversation['id']}/messages").status_code == 403
    assert client(s2u).get(f"/api/messages/conversations/{own['id']}/messages").status_code == 403
    assert create_conversation(client(foreign_u), s1.id).status_code == 403


def test_pagination_order_and_feature_flag_preserves_data(context):
    db, p1, _, _, _, _, s1, _, _ = context; api = client(p1)
    conversation = create_conversation(api, s1.id).json(); endpoint = f"/api/messages/conversations/{conversation['id']}/messages"
    for index in range(4): api.post(endpoint, json={"body": f"m{index}"})
    first = api.get(endpoint + "?limit=2").json(); second = api.get(endpoint + f"?limit=2&before={first['next_before']}").json()
    assert [item["body"] for item in first["items"]] == ["m2", "m3"]
    assert [item["body"] for item in second["items"]] == ["m0", "m1"]
    branding = db.scalar(select(PersonalBranding).where(PersonalBranding.personal_id == p1.id)); branding.modules = {"messages": False}; db.commit()
    response = api.get("/api/messages/conversations")
    assert response.status_code == 403 and response.json()["detail"] == {"code": "module_disabled", "module": "messages"}
    assert db.scalar(select(Message).where(Message.body == "m0")) is not None
