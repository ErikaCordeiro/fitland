from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CoachIntent(StrEnum):
    GREETING = "greeting"
    HELP = "help"
    TODAY_WORKOUT = "today_workout"
    WORKOUT_EXERCISES = "workout_exercises"
    EXERCISE_SETS = "exercise_sets"
    EXERCISE_REPS = "exercise_reps"
    EXERCISE_LOAD = "exercise_load"
    EXERCISE_REST = "exercise_rest"
    LAST_EXERCISE_PERFORMANCE = "last_exercise_performance"
    RECENT_WORKOUTS = "recent_workouts"
    NEXT_WORKOUT = "next_workout"
    TODAY_SCHEDULE = "today_schedule"
    PROGRESS_SUMMARY = "progress_summary"
    CURRENT_WEIGHT = "current_weight"
    DIET_TODAY = "diet_today"
    MEAL_PLAN = "meal_plan"
    CONTACT_PERSONAL = "contact_personal"
    PAIN_OR_INJURY = "pain_or_injury"
    CHANGE_WORKOUT_REQUEST = "change_workout_request"
    UNKNOWN = "unknown"


class CoachMessageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    message: str = Field(min_length=1, max_length=500)
    context_token: str | None = Field(default=None, max_length=3000)

    @field_validator("message")
    @classmethod
    def clean_message(cls, value: str) -> str:
        value = " ".join(value.strip().split())
        if not value:
            raise ValueError("Message cannot be blank")
        return value


class CoachOption(BaseModel):
    label: str
    message: str


class CoachEscalation(BaseModel):
    available: bool
    reason: str
    token: str | None = None


class CoachMessageResponse(BaseModel):
    intent: CoachIntent
    confidence: str
    message: str
    context_token: str
    options: list[CoachOption] = Field(default_factory=list)
    escalation: CoachEscalation | None = None


class CoachEscalationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    token: str = Field(min_length=20, max_length=3000)


class CoachEscalationResponse(BaseModel):
    sent: bool
    message: str
