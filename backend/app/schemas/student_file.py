import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


FILE_CATEGORIES = {"document", "assessment", "workout", "nutrition", "other"}


class StudentFileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str | None = Field(default=None, max_length=180)
    description: str | None = Field(default=None, max_length=2000)
    category: str | None = None
    visible_to_student: bool | None = None

    @field_validator("title", "description")
    @classmethod
    def clean_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None

    @field_validator("category")
    @classmethod
    def valid_category(cls, value: str | None) -> str | None:
        if value is not None and value not in FILE_CATEGORIES:
            raise ValueError("Invalid file category")
        return value


class StudentFileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    student_id: uuid.UUID
    original_filename: str
    mime_type: str
    size_bytes: int
    title: str | None
    description: str | None
    category: str
    visible_to_student: bool
    resource_type: str | None
    resource_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
