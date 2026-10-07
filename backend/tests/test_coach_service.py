import uuid
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.schemas.coach import CoachMessageRequest
from app.services.coach import service as coach_module


class FakeDB:
    def __init__(self, count=0):
        self.count = count
        self.added = []
        self.commits = 0

    def scalar(self, _query):
        return self.count

    def add(self, row):
        self.added.append(row)

    def commit(self):
        self.commits += 1


class FakeResolver:
    def __init__(self, _db, _user, *, modules=None):
        self.student = SimpleNamespace(id=uuid.uuid4(), personal_id=uuid.uuid4())
        self.modules = {"coach": True, "workouts": True, "progress": True, "diet": True, "calendar": True, "messages": True}
        self.modules.update(modules or {})
        exercise = SimpleNamespace(name="Supino reto")
        self.link = SimpleNamespace(
            id=uuid.uuid4(), workout_id=uuid.uuid4(), exercise_id=uuid.uuid4(), exercise=exercise,
            sets=4, repetitions="8-10", rest_seconds=90, load=82,
        )
        self.workout = SimpleNamespace(id=self.link.workout_id, name="Força Superior A", exercises=[self.link])
        self.seen_context = None

    def module_enabled(self, key):
        return self.modules.get(key) is True

    def today_workout(self):
        return self.workout

    def workout_from_context(self, context):
        return self.workout if context.get("last_workout_id") == str(self.workout.id) else None

    def resolve_exercise(self, _text, context):
        self.seen_context = context
        return self.link, [self.link]

    def latest_performance(self, _exercise):
        return {"set": {"status": "concluida", "used_load": 78, "completed_reps": 9}}

    def recent_sessions(self, _limit=3):
        return []

    def next_workout(self):
        return self.workout, 2

    def today_schedule(self):
        return []

    def progress_summary(self):
        return {"completed": 3, "last": None, "weight": 67.5}

    def meal_plan(self):
        return None


@pytest.fixture
def coach(monkeypatch):
    resolver = FakeResolver(None, None)
    monkeypatch.setattr(coach_module, "CoachDataResolver", lambda _db, _user: resolver)
    db = FakeDB()
    user = SimpleNamespace(id=uuid.uuid4())
    return coach_module.CoachService(db, user), db, resolver


def test_uses_registered_prescription_and_keeps_short_lived_context(coach):
    service, _db, resolver = coach
    first = service.respond(CoachMessageRequest(message="Qual meu treino hoje?"))
    assert "Força Superior A" in first.message
    second = service.respond(CoachMessageRequest(message="qual carga", context_token=first.context_token))
    assert second.intent.value == "exercise_load"
    assert "82 kg" in second.message
    assert str(resolver.seen_context["last_workout_id"]) == str(resolver.workout.id)


def test_affirmative_follow_up_lists_exercises_from_the_current_workout(coach):
    service, _db, _resolver = coach
    first = service.respond(CoachMessageRequest(message="Qual meu treino hoje?"))
    second = service.respond(CoachMessageRequest(message="Sim", context_token=first.context_token))
    assert second.intent.value == "workout_exercises"
    assert "Supino reto" in second.message


def test_execution_is_reported_separately_from_prescription(coach):
    service, _db, _resolver = coach
    prescribed = service.respond(CoachMessageRequest(message="Qual carga do supino?"))
    executed = service.respond(CoachMessageRequest(message="Quanto fiz na última vez no supino?"))
    assert "82 kg" in prescribed.message
    assert "78 kg" in executed.message
    assert "9 repetições" in executed.message


def test_pain_is_safe_and_requires_explicit_escalation(coach):
    service, db, _resolver = coach
    response = service.respond(CoachMessageRequest(message="Estou com dor forte no joelho"))
    assert response.intent.value == "pain_or_injury"
    assert response.escalation.available is True
    assert response.escalation.token
    assert "diagnóstico" not in response.message.lower()
    assert any(row.action == "coach_escalation_requested" for row in db.added)


def test_disabled_messages_prevents_escalation(monkeypatch):
    resolver = FakeResolver(None, None, modules={"messages": False})
    monkeypatch.setattr(coach_module, "CoachDataResolver", lambda _db, _user: resolver)
    service = coach_module.CoachService(FakeDB(), SimpleNamespace(id=uuid.uuid4()))
    response = service.respond(CoachMessageRequest(message="Quero falar com meu personal"))
    assert response.escalation.available is False
    assert response.escalation.token is None


def test_audit_is_sanitized_and_does_not_store_message(coach):
    service, db, _resolver = coach
    secret_like_input = "meu texto privado não deve ir ao log"
    service.respond(CoachMessageRequest(message=secret_like_input))
    serialized = " ".join(str(row.details) for row in db.added)
    assert secret_like_input not in serialized
    assert "password" not in serialized.lower()
    assert "token" not in serialized.lower()


def test_rate_limit_blocks_without_calling_the_engine(monkeypatch):
    resolver = FakeResolver(None, None)
    monkeypatch.setattr(coach_module, "CoachDataResolver", lambda _db, _user: resolver)
    service = coach_module.CoachService(FakeDB(count=coach_module.RATE_LIMIT_PER_MINUTE), SimpleNamespace(id=uuid.uuid4()))
    with pytest.raises(HTTPException) as error:
        service.respond(CoachMessageRequest(message="Oi"))
    assert error.value.status_code == 429
