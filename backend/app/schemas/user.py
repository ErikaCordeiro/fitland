import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=140)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = UserRole.STUDENT


class UserRead(BaseModel):
    id: uuid.UUID
    name: str
    email: EmailStr
    role: UserRole
    is_active: bool
    account_status: str = "active"
    must_change_password: bool = False
    avatar_url: str | None = None
    theme_preference: str = "auto"
    created_at: datetime
    onboarding_completed_at: datetime | None = None

    model_config = {"from_attributes": True}
