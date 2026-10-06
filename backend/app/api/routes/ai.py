import json
import uuid

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_module, require_personal, require_student
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
    FoodVisionUnit,
    MealPhotoAnalysisModelResponse,
    MealPhotoAnalysisResponse,
)
from app.services.access import get_owned_student
from app.services.ai.context import PersonalSuggestionContextBuilder
from app.services.ai.errors import AIServiceError
from app.services.ai.service import AIService
from app.services.private_file_storage import read_validated_image_upload


router = APIRouter()

MEAL_PHOTO_DISCLAIMER = (
    "As quantidades são estimativas visuais e podem variar conforme tamanho do prato, "
    "ângulo, iluminação, preparo e alimentos não visíveis."
)
MEAL_PHOTO_INSTRUCTIONS = (
    "Você é um assistente de análise visual de refeições. Analise somente alimentos visíveis na imagem. "
    "Identifique os alimentos aparentes e estime porções aproximadas, nunca medições exatas. "
    "Use gramas ou mililitros arredondados, ou unidades/fatias quando fizer mais sentido. "
    "Quando houver incerteza, use confiança baixa e explique no campo note; se não puder estimar, "
    "deixe estimated_amount e unit nulos. Não invente alimentos, ingredientes invisíveis, óleo, sal, "
    "açúcar, molhos ou recheios sem evidência visual. Considere perspectiva, iluminação, tamanho "
    "desconhecido do prato, sobreposição e método de preparo. Não calcule calorias ou macronutrientes, "
    "não faça diagnóstico e não prescreva dieta. Retorne somente o schema solicitado."
)


def _normalize_visual_estimates(result: MealPhotoAnalysisModelResponse) -> MealPhotoAnalysisModelResponse:
    for food in result.foods:
        if food.unit in {FoodVisionUnit.GRAM, FoodVisionUnit.MILLILITER}:
            if food.estimated_amount is not None:
                food.estimated_amount = round(food.estimated_amount / 5) * 5
            if food.range_min is not None:
                food.range_min = round(food.range_min / 5) * 5
            if food.range_max is not None:
                food.range_max = round(food.range_max / 5) * 5
        else:
            if food.estimated_amount is not None:
                food.estimated_amount = round(food.estimated_amount, 1)
            if food.range_min is not None:
                food.range_min = round(food.range_min, 1)
            if food.range_max is not None:
                food.range_max = round(food.range_max, 1)
    return result


@router.get("/status", response_model=AIStatusResponse)
def status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return AIService(db).status()


@router.post(
    "/student/meal-photo-analysis",
    response_model=MealPhotoAnalysisResponse,
    dependencies=[Depends(require_module("diet"))],
)
async def meal_photo_analysis(
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
    student: User = Depends(require_student),
):
    image_bytes, mime_type = await read_validated_image_upload(photo)
    result = AIService(db).analyze_image_structured(
        user=student,
        operation=AIOperation.STUDENT_FOOD_VISION,
        instructions=MEAL_PHOTO_INSTRUCTIONS,
        image_bytes=image_bytes,
        mime_type=mime_type,
        response_model=MealPhotoAnalysisModelResponse,
        result_validator=_normalize_visual_estimates,
    )
    return MealPhotoAnalysisResponse(**result.model_dump(), disclaimer=MEAL_PHOTO_DISCLAIMER)


@router.post(
    "/personal/students/{student_id}/exercise-suggestions",
    response_model=ExerciseSuggestionResponse,
    dependencies=[Depends(require_module("workouts")), Depends(require_module("coach"))],
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
