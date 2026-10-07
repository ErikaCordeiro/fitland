import uuid
from datetime import datetime, timedelta, timezone

from jose import jwt

from app.core.config import settings
from app.services.coach.context import decode_context, encode_context
from app.services.coach.escalation import escalation_token
from app.services.coach import escalation as escalation_module
from app.models.audit_log import AuditLog


def test_context_token_cannot_be_replayed_by_another_student():
    student_a = uuid.uuid4()
    student_b = uuid.uuid4()
    token = encode_context(student_a, {"last_workout_id": uuid.uuid4(), "last_exercise_id": uuid.uuid4()})
    assert decode_context(token, student_a)
    assert decode_context(token, student_b) == {}


def test_context_token_ignores_unapproved_fields():
    student = uuid.uuid4()
    token = encode_context(student, {
        "last_workout_id": uuid.uuid4(),
        "email": "private@example.test",
        "assessment_photo": "/private/photo.jpg",
        "finance": "hidden",
    })
    decoded = decode_context(token, student)
    assert set(decoded) == {"last_workout_id"}
    assert "private" not in str(decoded)


def test_escalation_token_contains_no_credentials():
    student = type("StudentUser", (), {"id": uuid.uuid4()})()
    token = escalation_token(student, "Quero falar com meu Personal", "contact_personal")
    assert "password" not in token.lower()
    assert "authorization" not in token.lower()


def test_tampered_context_is_rejected():
    student = uuid.uuid4()
    token = encode_context(student, {"last_workout_id": uuid.uuid4()})
    header, payload, signature = token.split(".")
    index = len(payload) // 2
    replacement = "a" if payload[index] != "a" else "b"
    tampered = f"{header}.{payload[:index]}{replacement}{payload[index + 1:]}.{signature}"
    assert decode_context(tampered, student) == {}


def test_expired_context_is_rejected():
    student = uuid.uuid4()
    token = jwt.encode({
        "sub": str(student), "type": "coach_context", "last_intent": "today_workout",
        "exp": datetime.now(timezone.utc) - timedelta(seconds=1),
    }, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    assert decode_context(token, student) == {}


def test_escalation_replay_is_idempotent(monkeypatch):
    class DB:
        def __init__(self):
            self.audit = None

        def scalar(self, _query):
            return self.audit

    db = DB()
    user = type("StudentUser", (), {"id": uuid.uuid4()})()
    token = escalation_token(user, "Preciso falar com meu Personal", "contact_personal")
    monkeypatch.setattr(escalation_module, "ensure_conversation", lambda *_args: type("Conversation", (), {"id": uuid.uuid4()})())
    monkeypatch.setattr(escalation_module, "send_message", lambda *_args: type("Message", (), {"id": uuid.uuid4()})())
    row, fingerprint, duplicate = escalation_module.send_escalation(db, user, token)
    assert row is not None and duplicate is False
    db.audit = AuditLog(actor_user_id=user.id, action="coach_escalation_sent", entity_type="coach", entity_id=fingerprint)
    row, repeated_fingerprint, duplicate = escalation_module.send_escalation(db, user, token)
    assert row is None and duplicate is True
    assert repeated_fingerprint == fingerprint
