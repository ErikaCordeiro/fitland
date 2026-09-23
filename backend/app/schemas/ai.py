import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class AIOperation(StrEnum):
    PERSONAL_EXERCISE_SUGGESTION = "personal_exercise_suggestion"
    STUDENT_EXERCISE_EXPLANATION = "student_exercise_explanation"
    STUDENT_EXERCISE_ALTERNATIVE = "student_exercise_alternative"
    STUDENT_MEAL_SUBSTITUTION = "student_meal_substitution"
    STUDENT_FOOD_VISION = "student_food_vision"


class AIErrorCode(StrEnum):
    NOT_CONFIGURED = "AI_NOT_CONFIGURED"
    UNAVAILABLE = "AI_UNAVAILABLE"
    TIMEOUT = "AI_TIMEOUT"
    RATE_LIMITED = "AI_RATE_LIMITED"
    INVALID_RESPONSE = "AI_INVALID_RESPONSE"
    FORBIDDEN = "AI_FORBIDDEN"
    SAFETY_BLOCKED = "AI_SAFETY_BLOCKED"


class AIErrorResponse(BaseModel):
    code: AIErrorCode
    message: str


class AIUsageRecord(BaseModel):
    operation: AIOperation
    personal_id: uuid.UUID
    student_id: uuid.UUID | None = None
    user_id: uuid.UUID
    provider: str
    model: str
    status: str
    duration_ms: int = Field(ge=0)
    input_tokens: int | None = Field(default=None, ge=0)
    output_tokens: int | None = Field(default=None, ge=0)
    created_at: datetime


class SafetyCategory(StrEnum):
    PAIN = "pain"
    INJURY = "injury"
    MEDICAL = "medical"
    MEDICATION = "medication"
    DIAGNOSIS = "diagnosis"


class SafetyResponse(BaseModel):
    allowed: bool
    categories: list[SafetyCategory] = Field(default_factory=list)
    action: str = "continue"
    message: str | None = None


class AIProviderResult(BaseModel):
    data: Any
    input_tokens: int | None = None
    output_tokens: int | None = None


class AIStatusResponse(BaseModel):
    provider: str
    model: str
    configured: bool
    available: bool


class StructuredAIResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ExerciseSuggestionRequest(BaseModel):
    quantity: int = Field(default=4, ge=1, le=10)
    focus: str | None = Field(default=None, max_length=120)
    additional_context: str | None = Field(default=None, max_length=300)


class ExerciseSuggestionSelection(StructuredAIResponse):
    exercise_id: uuid.UUID
    reason: str = Field(min_length=1, max_length=500)


class ExerciseSuggestionModelResponse(StructuredAIResponse):
    suggestions: list[ExerciseSuggestionSelection] = Field(default_factory=list, max_length=10)


class ExerciseSuggestionRead(BaseModel):
    exercise_id: uuid.UUID
    name: str
    muscle_group: str | None = None
    reason: str


class ExerciseSuggestionResponse(BaseModel):
    suggestions: list[ExerciseSuggestionRead]
    requires_professional_review: bool = False
    warnings: list[str] = Field(default_factory=list)
