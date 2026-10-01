import math
import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field, field_validator


MEASURE_FIELDS = (
    "weight", "height", "neck", "shoulders", "chest", "right_arm", "left_arm",
    "waist", "abdomen", "hips", "right_thigh", "left_thigh", "right_calf", "left_calf",
)


class AssessmentValues(BaseModel):
    assessment_date: date
    weight: float | None = Field(default=None, ge=0)
    height: float | None = Field(default=None, ge=0)
    neck: float | None = Field(default=None, ge=0)
    shoulders: float | None = Field(default=None, ge=0)
    chest: float | None = Field(default=None, ge=0)
    right_arm: float | None = Field(default=None, ge=0)
    left_arm: float | None = Field(default=None, ge=0)
    waist: float | None = Field(default=None, ge=0)
    abdomen: float | None = Field(default=None, ge=0)
    hips: float | None = Field(default=None, ge=0)
    right_thigh: float | None = Field(default=None, ge=0)
    left_thigh: float | None = Field(default=None, ge=0)
    right_calf: float | None = Field(default=None, ge=0)
    left_calf: float | None = Field(default=None, ge=0)
    body_fat_percentage: float | None = Field(default=None, ge=0, le=100)
    notes: str | None = Field(default=None, max_length=3000)

    @field_validator(*MEASURE_FIELDS, "body_fat_percentage")
    @classmethod
    def finite_numbers(cls, value):
        if value is not None and not math.isfinite(value):
            raise ValueError("Value must be finite")
        return value


class AssessmentCreate(AssessmentValues):
    student_id: uuid.UUID


class AssessmentUpdate(BaseModel):
    assessment_date: date | None = None
    weight: float | None = Field(default=None, ge=0)
    height: float | None = Field(default=None, ge=0)
    neck: float | None = Field(default=None, ge=0)
    shoulders: float | None = Field(default=None, ge=0)
    chest: float | None = Field(default=None, ge=0)
    right_arm: float | None = Field(default=None, ge=0)
    left_arm: float | None = Field(default=None, ge=0)
    waist: float | None = Field(default=None, ge=0)
    abdomen: float | None = Field(default=None, ge=0)
    hips: float | None = Field(default=None, ge=0)
    right_thigh: float | None = Field(default=None, ge=0)
    left_thigh: float | None = Field(default=None, ge=0)
    right_calf: float | None = Field(default=None, ge=0)
    left_calf: float | None = Field(default=None, ge=0)
    body_fat_percentage: float | None = Field(default=None, ge=0, le=100)
    notes: str | None = Field(default=None, max_length=3000)

    @field_validator("assessment_date")
    @classmethod
    def required_date_when_present(cls, value):
        if value is None:
            raise ValueError("Assessment date cannot be null")
        return value

    @field_validator(*MEASURE_FIELDS, "body_fat_percentage")
    @classmethod
    def finite_numbers(cls, value):
        if value is not None and not math.isfinite(value):
            raise ValueError("Value must be finite")
        return value


class AssessmentRead(AssessmentValues):
    id: uuid.UUID
    personal_id: uuid.UUID
    student_id: uuid.UUID
    bmi: float | None = None
    created_at: datetime
    updated_at: datetime


class AssessmentDetail(AssessmentRead):
    previous: AssessmentRead | None = None
    differences: dict[str, float] = Field(default_factory=dict)
