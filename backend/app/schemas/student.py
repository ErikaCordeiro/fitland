import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class StudentBase(BaseModel):
    name: str = Field(min_length=2, max_length=140)
    email: EmailStr
    age: int = Field(ge=12, le=100)
    weight: float = Field(gt=30, lt=300)
    height: float = Field(gt=1.0, lt=2.5)
    objective: str = Field(min_length=2, max_length=255)
    notes: str | None = Field(default=None, max_length=3000)


class StudentCreate(StudentBase):
    user_id: uuid.UUID | None = None


class StudentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=140)
    email: EmailStr | None = None
    age: int | None = Field(default=None, ge=12, le=100)
    weight: float | None = Field(default=None, gt=30, lt=300)
    height: float | None = Field(default=None, gt=1.0, lt=2.5)
    objective: str | None = Field(default=None, min_length=2, max_length=255)
    notes: str | None = Field(default=None, max_length=3000)


class StudentRead(BaseModel):
    id: uuid.UUID
    personal_id: uuid.UUID
    user_id: uuid.UUID | None
    name: str
    email: EmailStr
    age: int | None = None
    weight: float | None = None
    height: float | None = None
    objective: str | None = None
    notes: str | None = None
    created_at: datetime
    access_status: str = "no_access"
    access_activated_at: datetime | None = None

    model_config = {"from_attributes": True}


class StudentInviteStatus(BaseModel):
    status: str
    expires_at: datetime | None = None
    delivery: str | None = None


class StudentInviteValidation(BaseModel):
    valid: bool
    status: str
    expires_at: datetime | None = None


class StudentAccessActivation(BaseModel):
    token: str = Field(min_length=32, max_length=256)
    slug: str = Field(min_length=1, max_length=120)
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(default="", max_length=100)
    new_password: str = Field(min_length=10, max_length=128)
    confirm_password: str = Field(min_length=10, max_length=128)
