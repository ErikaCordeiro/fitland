import uuid
from datetime import date, time
from typing import Literal

from pydantic import BaseModel, Field


class AgendaEventCreate(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    event_date: date
    event_time: time
    student_id: uuid.UUID | None = None
    notes: str | None = Field(default=None, max_length=2000)
    visible_to_student: bool = False


class AgendaEventUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=160)
    event_date: date | None = None
    event_time: time | None = None
    student_id: uuid.UUID | None = None
    notes: str | None = Field(default=None, max_length=2000)
    visible_to_student: bool | None = None


class AgendaItemRead(BaseModel):
    id: str
    kind: Literal["appointment", "workout"]
    title: str
    event_date: date
    event_time: time | None = None
    student_id: uuid.UUID | None = None
    student_name: str | None = None
    notes: str | None = None
    visible_to_student: bool = False
    status: str
    editable: bool


class AgendaRangeRead(BaseModel):
    timezone: str = "America/Sao_Paulo"
    start: date
    end: date
    items: list[AgendaItemRead]
