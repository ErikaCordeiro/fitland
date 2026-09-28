import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

WorkoutDay = Literal["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]


class WorkoutExerciseCreate(BaseModel):
    exercise_id: uuid.UUID
    order_index: int = Field(default=0, ge=0)
    sets: int = Field(ge=1, le=20)
    repetitions: str = Field(min_length=1, max_length=40)
    rest_seconds: int = Field(ge=0, le=600)
    load: float | None = Field(default=None, ge=0, le=2000)
    notes: str | None = Field(default=None, max_length=2000)
    set_type: str = Field(default="standard", pattern="^(standard|biset|drop_set)$")
    technique_config: dict = Field(default_factory=dict)


class WorkoutExerciseRead(WorkoutExerciseCreate):
    id: uuid.UUID
    name: str
    explanation: str | None = None
    video_url: str | None = None
    video_provider: str | None = None
    video_title: str | None = None

    model_config = {"from_attributes": True}


class WorkoutCreate(BaseModel):
    student_id: uuid.UUID
    name: str = Field(min_length=2, max_length=160)
    focus: str | None = Field(default=None, max_length=255)
    duration_minutes: int | None = Field(default=None, ge=1, le=360)
    day_of_week: WorkoutDay | None = None
    notes: str | None = Field(default=None, max_length=3000)
    exercises: list[WorkoutExerciseCreate] = Field(default_factory=list)


class WorkoutUpdate(BaseModel):
    student_id: uuid.UUID | None = None
    name: str | None = Field(default=None, min_length=2, max_length=160)
    focus: str | None = Field(default=None, max_length=255)
    duration_minutes: int | None = Field(default=None, ge=1, le=360)
    day_of_week: WorkoutDay | None = None
    status: str | None = Field(default=None, max_length=40)
    notes: str | None = Field(default=None, max_length=3000)
    exercises: list[WorkoutExerciseCreate] | None = None


class WorkoutRead(BaseModel):
    id: uuid.UUID
    personal_id: uuid.UUID
    student_id: uuid.UUID
    name: str
    focus: str | None
    duration_minutes: int | None
    day_of_week: WorkoutDay | None
    status: str
    notes: str | None
    exercises: list[WorkoutExerciseRead] = []
    created_at: datetime

    model_config = {"from_attributes": True}
