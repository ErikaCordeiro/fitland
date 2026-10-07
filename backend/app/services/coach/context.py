import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.core.config import settings


CONTEXT_TTL_MINUTES = 30


def encode_context(user_id: uuid.UUID, values: dict) -> str:
    safe = {key: str(value) for key, value in values.items() if value is not None and key in {"last_intent", "last_workout_id", "last_exercise_id"}}
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
    return {key: payload.get(key) for key in ("last_intent", "last_workout_id", "last_exercise_id") if payload.get(key)}
