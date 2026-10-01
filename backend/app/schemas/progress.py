import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


class ProgressLogCreate(BaseModel):
    student_id: uuid.UUID
    workout_id: uuid.UUID | None = None
    exercise_id: uuid.UUID | None = None
    log_date: date
    completed_exercises: int = Field(default=0, ge=0)
    load: float | None = Field(default=None, ge=0)
    body_weight: float | None = Field(default=None, gt=30, lt=300)
    notes: str | None = Field(default=None, max_length=3000)


class ProgressLogRead(ProgressLogCreate):
    id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class ProgressPoint(BaseModel):
    date: datetime
    value: float


class ExerciseProgress(BaseModel):
    exercise_id: str
    exercise_name: str
    best_load: float
    points: list[ProgressPoint]


class WorkoutFrequencyPoint(BaseModel):
    date: date
    count: int


class MeasurementProgress(BaseModel):
    key: str
    label: str
    unit: str
    points: list[ProgressPoint]


class ProgressOverview(BaseModel):
    student_id: uuid.UUID
    student_name: str
    period_days: Literal[30, 90, 180, 365]
    completed_workouts: int
    active_weeks: int
    last_workout_at: datetime | None
    workout_frequency: list[WorkoutFrequencyPoint]
    exercise_progress: list[ExerciseProgress]
    current_weight: float | None
    weight_history: list[ProgressPoint]
    measurements_supported: bool = False
    measurements: list[MeasurementProgress] = Field(default_factory=list)
    real_volume: float | None
    highlights: list[str]
