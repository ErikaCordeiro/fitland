import math
import uuid
from datetime import date, datetime, time as Time

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.meal_plan import MealPlanStatus


UNITS = {"g", "kg", "ml", "L", "unidade", "colher", "xícara", "fatia", "porção"}


class MealPlanItemInput(BaseModel):
    food_name: str = Field(min_length=1, max_length=180)
    quantity: float = Field(gt=0)
    unit: str
    notes: str | None = Field(default=None, max_length=1000)

    @field_validator("quantity")
    @classmethod
    def finite_quantity(cls, value):
        if not math.isfinite(value):
            raise ValueError("Quantity must be finite")
        return value

    @field_validator("unit")
    @classmethod
    def supported_unit(cls, value):
        if value not in UNITS:
            raise ValueError("Unsupported unit")
        return value


class MealPlanMealInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    time: Time | None = None
    notes: str | None = Field(default=None, max_length=1000)
    items: list[MealPlanItemInput] = Field(default_factory=list, max_length=100)


class MealPlanWrite(BaseModel):
    student_id: uuid.UUID
    name: str = Field(min_length=1, max_length=160)
    start_date: date
    end_date: date | None = None
    notes: str | None = Field(default=None, max_length=3000)
    meals: list[MealPlanMealInput] = Field(default_factory=list, max_length=30)

    @model_validator(mode="after")
    def valid_dates(self):
        if self.end_date and self.end_date < self.start_date:
            raise ValueError("End date cannot precede start date")
        return self


class MealPlanItemRead(MealPlanItemInput):
    id: uuid.UUID
    position: int


class MealPlanMealRead(BaseModel):
    id: uuid.UUID
    name: str
    time: Time | None
    notes: str | None
    position: int
    items: list[MealPlanItemRead]


class MealPlanRead(BaseModel):
    id: uuid.UUID
    personal_id: uuid.UUID
    student_id: uuid.UUID
    name: str
    start_date: date
    end_date: date | None
    notes: str | None
    status: MealPlanStatus
    meals: list[MealPlanMealRead]
    created_at: datetime
    updated_at: datetime
