import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator
from app.schemas.branding import BrandingUpdate
from app.services.module_registry import MODULE_KEYS


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


class OwnerModulesUpdate(BaseModel):
    modules: dict[str, bool]

    @field_validator("modules")
    @classmethod
    def valid_modules(cls, value: dict[str, bool]) -> dict[str, bool]:
        if set(value) - MODULE_KEYS or any(type(enabled) is not bool for enabled in value.values()):
            raise ValueError("Configuração de módulos inválida")
        return value


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
