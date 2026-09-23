import json
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_module, require_personal
from app.db.session import get_db
from app.models.exercise import Exercise
from app.models.user import User
from app.schemas.ai import (
    AIOperation,
    AIErrorCode,
    AIStatusResponse,
    ExerciseSuggestionModelResponse,
    ExerciseSuggestionRead,
    ExerciseSuggestionRequest,
    ExerciseSuggestionResponse,
)
from app.services.access import get_owned_student
from app.services.ai.context import PersonalSuggestionContextBuilder
from app.services.ai.errors import AIServiceError
from app.services.ai.service import AIService


router = APIRouter()


@router.get("/status", response_model=AIStatusResponse)
def status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return AIService(db).status()


@router.post(
    "/personal/students/{student_id}/exercise-suggestions",
    response_model=ExerciseSuggestionResponse,
    dependencies=[Depends(require_module("workouts"))],
)
def exercise_suggestions(
    student_id: uuid.UUID,
    payload: ExerciseSuggestionRequest,
    db: Session = Depends(get_db),
    personal: User = Depends(require_personal),
):
    student = get_owned_student(db, student_id, personal)
    catalog = list(db.scalars(
        select(Exercise).where(Exercise.personal_id == personal.id).order_by(Exercise.name)
    ))
    if not catalog:
        raise AIServiceError(AIErrorCode.INVALID_RESPONSE, "Cadastre exercícios no catálogo antes de solicitar sugestões")

    context = PersonalSuggestionContextBuilder.build(student, catalog)
    request_context = {
        "student_context": context["student"],
        "exercise_candidates": context["exercise_candidates"],
        "requested_quantity": min(payload.quantity, len(catalog)),
        "focus": payload.focus,
        "additional_context": payload.additional_context,
    }
    instructions = (
        "Você auxilia um Personal Trainer sem substituir sua decisão profissional. "
        "Escolha somente exercise_id presentes em exercise_candidates; nunca invente IDs. "
        "Não diagnostique, não prescreva medicamentos, não crie treino e não defina séries, "
        "repetições, carga ou descanso. Seja conservador se o contexto for insuficiente."
    )
    catalog_by_id = {exercise.id: exercise for exercise in catalog}
    allowed_ids = set(catalog_by_id)

    def validate_selection(result):
        seen = set()
        for suggestion in result.suggestions:
            exercise = catalog_by_id.get(suggestion.exercise_id)
            if suggestion.exercise_id not in allowed_ids or suggestion.exercise_id in seen:
                raise AIServiceError(AIErrorCode.INVALID_RESPONSE, "AI provider returned an invalid exercise selection")
            if not exercise or exercise.personal_id != personal.id:
                raise AIServiceError(AIErrorCode.INVALID_RESPONSE, "AI provider returned an invalid exercise selection")
            seen.add(suggestion.exercise_id)
        return result

    result = AIService(db).generate_structured(
        user=personal,
        operation=AIOperation.PERSONAL_EXERCISE_SUGGESTION,
        instructions=instructions,
        input_text=json.dumps(request_context, ensure_ascii=False),
        response_model=ExerciseSuggestionModelResponse,
        student_id=student.id,
        result_validator=validate_selection,
    )

    suggestions = []
    for suggestion in result.suggestions:
        exercise = catalog_by_id[suggestion.exercise_id]
        suggestions.append(ExerciseSuggestionRead(
            exercise_id=exercise.id,
            name=exercise.name,
            muscle_group=exercise.muscle_group,
            reason=suggestion.reason,
        ))
    return ExerciseSuggestionResponse(suggestions=suggestions[:payload.quantity])
