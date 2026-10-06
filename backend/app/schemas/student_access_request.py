import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


def _clean_name(value: str) -> str:
    cleaned = " ".join(value.split())
    if any(ord(char) < 32 or char in "<>{}" for char in cleaned):
        raise ValueError("Nome contém caracteres inválidos")
    return cleaned


class StudentAccessRequestCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr

    @field_validator("first_name", "last_name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return _clean_name(value)


class StudentAccessRequestReject(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


class StudentAccessRequestRead(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    email: EmailStr
    status: str
    created_at: datetime
    reviewed_at: datetime | None = None
    rejection_reason: str | None = None

    model_config = {"from_attributes": True}


class StudentAccessRequestCreated(BaseModel):
    status: str = "PENDING"
    detail: str
