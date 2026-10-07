from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.core.config import settings
from app.schemas.message import ConversationCreate, MessageCreate
from app.services.message_service import ensure_conversation, send_message


def escalation_token(user, message: str, reason: str) -> str:
    payload = {
        "sub": str(user.id), "type": "coach_escalation", "reason": reason,
        "message": message[:500], "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def send_escalation(db, user, token: str):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError as exc:
        raise ValueError("Invalid escalation token") from exc
    if payload.get("type") != "coach_escalation" or payload.get("sub") != str(user.id):
        raise ValueError("Invalid escalation token")
    reason = payload.get("reason")
    original = " ".join(str(payload.get("message") or "").split())
    if reason not in {"pain_or_injury", "change_workout_request", "unknown", "contact_personal"} or not original:
        raise ValueError("Invalid escalation token")
    conversation = ensure_conversation(db, user, ConversationCreate())
    label = {"pain_or_injury": "Relato de desconforto", "change_workout_request": "Solicitação de alteração", "unknown": "Pergunta não respondida", "contact_personal": "Contato solicitado"}[reason]
    return send_message(db, user, conversation.id, MessageCreate(body=f"Solicitação enviada pelo Coach Fitland — {label}: {original}"))
