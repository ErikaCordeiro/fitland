from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.ai_audit import AIAuditLog
from app.schemas.ai import AIOperation, AIErrorCode
from app.services.ai.errors import AIServiceError
from app.services.ai.guardrails import AIScope


def enforce_daily_quota(db: Session, *, scope: AIScope, operation: AIOperation, limit: int) -> None:
    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).replace(tzinfo=None)
    used = db.scalar(select(func.count(AIAuditLog.id)).where(
        AIAuditLog.user_id == scope.user_id,
        AIAuditLog.personal_id == scope.personal_id,
        AIAuditLog.operation == operation.value,
        AIAuditLog.created_at >= start,
        AIAuditLog.status.in_(("success", "invalid_response", "unavailable", "timeout")),
    )) or 0
    if used >= limit:
        raise AIServiceError(AIErrorCode.RATE_LIMITED, "Daily AI usage limit reached")
