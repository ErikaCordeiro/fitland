import re
import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.student import Student
from app.models.user import User, UserRole
from app.core.errors import DomainError
from app.schemas.ai import AIOperation, AIErrorCode, SafetyCategory, SafetyResponse
from app.services.ai.errors import AIServiceError
from app.services.access import get_owned_student


PERSONAL_ACTIONS = {AIOperation.PERSONAL_EXERCISE_SUGGESTION}
STUDENT_ACTIONS = {
    AIOperation.STUDENT_EXERCISE_EXPLANATION,
    AIOperation.STUDENT_EXERCISE_ALTERNATIVE,
    AIOperation.STUDENT_MEAL_SUBSTITUTION,
    AIOperation.STUDENT_FOOD_VISION,
}


@dataclass(frozen=True)
class AIScope:
    user_id: uuid.UUID
    role: UserRole
    personal_id: uuid.UUID
    student_id: uuid.UUID | None


def resolve_ai_scope(
    db: Session, *, user: User, operation: AIOperation, student_id: uuid.UUID | None = None
) -> AIScope:
    if operation in PERSONAL_ACTIONS and user.role != UserRole.PERSONAL:
        raise AIServiceError(AIErrorCode.FORBIDDEN, "AI operation is not allowed for this role")
    if operation in STUDENT_ACTIONS and user.role != UserRole.STUDENT:
        raise AIServiceError(AIErrorCode.FORBIDDEN, "AI operation is not allowed for this role")

    if user.role == UserRole.PERSONAL:
        try:
            owned_student = get_owned_student(db, student_id, user) if student_id else None
        except DomainError as exc:
            raise AIServiceError(AIErrorCode.FORBIDDEN, "AI resource is outside the authenticated scope") from exc
        return AIScope(user.id, user.role, user.id, owned_student.id if owned_student else None)

    if user.role == UserRole.STUDENT:
        profile = db.scalar(select(Student).where(Student.user_id == user.id))
        if not profile:
            raise AIServiceError(AIErrorCode.FORBIDDEN, "Student profile is required")
        if student_id and student_id != profile.id:
            raise AIServiceError(AIErrorCode.FORBIDDEN, "AI resource is outside the authenticated scope")
        return AIScope(user.id, user.role, profile.personal_id, profile.id)

    raise AIServiceError(AIErrorCode.FORBIDDEN, "AI operation is not allowed for this role")


SAFETY_PATTERNS = {
    SafetyCategory.PAIN: r"\b(dor|doendo|pain|hurts?)\b",
    SafetyCategory.INJURY: r"\b(les[aã]o|lesionado|injury|injured)\b",
    SafetyCategory.MEDICAL: r"\b(m[eé]dico|medical|doen[cç]a|disease)\b",
    SafetyCategory.MEDICATION: r"\b(rem[eé]dio|medicamento|medication|dose|dosagem)\b",
    SafetyCategory.DIAGNOSIS: r"\b(diagn[oó]stico|diagnose|diagnosis)\b",
}


def evaluate_safety(text: str) -> SafetyResponse:
    categories = [category for category, pattern in SAFETY_PATTERNS.items() if re.search(pattern, text, re.IGNORECASE)]
    if not categories:
        return SafetyResponse(allowed=True)
    return SafetyResponse(
        allowed=False,
        categories=categories,
        action="stop_and_escalate",
        message="Interrompa a atividade que provoca sintomas e procure orientação profissional adequada.",
    )
