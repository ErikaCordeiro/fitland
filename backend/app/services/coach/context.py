import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.core.config import settings


CONTEXT_TTL_MINUTES = 30
CONTEXT_KEYS = {
    "last_intent", "last_topic", "previous_topic", "last_workout_id",
    "previous_workout_id", "last_exercise_id", "last_meal_id",
    "last_date_reference", "last_entity_type", "last_entity_id",
    "pending_clarification", "pending_confirmation", "pending_intent",
    "candidate_exercise_ids",
}


def encode_context(user_id: uuid.UUID, values: dict) -> str:
    safe = {}
    for key, value in values.items():
        if value is None or key not in CONTEXT_KEYS:
            continue
        safe[key] = [str(item) for item in value[:6]] if isinstance(value, list) else str(value)
    payload = {"sub": str(user_id), "type": "coach_context", "exp": datetime.now(timezone.utc) + timedelta(minutes=CONTEXT_TTL_MINUTES), **safe}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_context(token: str | None, user_id: uuid.UUID) -> dict:
    if not token:
        return {}
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return {}
    if payload.get("type") != "coach_context" or payload.get("sub") != str(user_id):
        return {}
    return {key: payload.get(key) for key in CONTEXT_KEYS if payload.get(key) is not None}
