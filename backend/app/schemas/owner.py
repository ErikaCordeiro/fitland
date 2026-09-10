import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field
from app.schemas.branding import BrandingUpdate


class OwnerPersonalCreate(BaseModel):
    name: str = Field(min_length=2, max_length=140)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=32)
    password: str = Field(min_length=10, max_length=128)
    status: str = Field(default="active", pattern="^(active|suspended|blocked)$")
    branding: BrandingUpdate | None = None


class OwnerPersonalUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=140)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=32)


class OwnerStatusChange(BaseModel):
    reason: str | None = Field(default=None, max_length=300)


class OwnerPasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=10, max_length=128)


class OwnerSettingsUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=140)
    email: EmailStr | None = None
    theme_preference: str | None = Field(default=None, pattern="^(light|dark|auto)$")
    avatar_url: str | None = Field(default=None, max_length=500)


class PersonalAdminRead(BaseModel):
    id: uuid.UUID
    name: str
    email: EmailStr
    phone: str | None
    avatar_url: str | None
    status: str
    student_count: int
    workout_count: int = 0
    created_at: datetime
    last_login_at: datetime | None


class AuditLogRead(BaseModel):
    id: uuid.UUID
    actor_name: str | None
    action: str
    entity_type: str
    entity_id: str | None
    result: str
    details: dict
    created_at: datetime
