import uuid

from app.services.coach.context import decode_context, encode_context
from app.services.coach.escalation import escalation_token


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
