import re
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


HEX_COLOR = re.compile(r"^#[0-9A-Fa-f]{6}$")
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
SAFE_FONTS = {"Inter", "Poppins", "Montserrat", "Roboto", "Open Sans"}
MODULE_KEYS = {"workouts", "diet", "assessments", "progress", "finance", "agenda", "messages", "reports", "files", "coach", "calendar", "payments"}


def _luminance(color: str) -> float:
    channels = [int(color[index:index + 2], 16) / 255 for index in (1, 3, 5)]
    linear = [value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4 for value in channels]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def _contrast(first: str, second: str) -> float:
    lighter, darker = sorted((_luminance(first), _luminance(second)), reverse=True)
    return (lighter + 0.05) / (darker + 0.05)


class BrandingUpdate(BaseModel):
    display_name: str = Field(min_length=2, max_length=160)
    logo_url: str | None = Field(default=None, max_length=500)
    profile_image_url: str | None = Field(default=None, max_length=500)
    primary_color: str = "#050505"
    secondary_color: str = "#C0C0C0"
    icon_url: str | None = Field(default=None, max_length=500)
    login_subtitle: str | None = Field(default=None, max_length=180)
    slug: str = Field(min_length=2, max_length=100)
    banner_url: str | None = Field(default=None, max_length=500)
    background_color: str = "#050505"
    surface_color: str = "#121416"
    accent_color: str = "#C0C0C0"
    border_color: str = "#34373A"
    text_color: str = "#F5F5F5"
    muted_text_color: str = "#A7ABB0"
    font_family: str = "Inter"
    modules: dict[str, bool] = Field(default_factory=dict)

    @field_validator("primary_color", "secondary_color", "background_color", "surface_color", "accent_color", "border_color", "text_color", "muted_text_color")
    @classmethod
    def valid_color(cls, value: str) -> str:
        if not HEX_COLOR.match(value):
            raise ValueError("Use uma cor hexadecimal no formato #RRGGBB")
        return value.upper()

    @field_validator("slug")
    @classmethod
    def valid_slug(cls, value: str) -> str:
        value = value.strip().lower()
        if not SLUG.fullmatch(value):
            raise ValueError("Use apenas letras minúsculas, números e hífens no slug")
        return value

    @field_validator("font_family")
    @classmethod
    def valid_font(cls, value: str) -> str:
        if value not in SAFE_FONTS:
            raise ValueError("Fonte não permitida")
        return value

    @field_validator("modules")
    @classmethod
    def valid_modules(cls, value: dict[str, bool]) -> dict[str, bool]:
        if set(value) - MODULE_KEYS or any(type(enabled) is not bool for enabled in value.values()):
            raise ValueError("Configuração de módulos inválida")
        return value

    @model_validator(mode="after")
    def accessible_contrast(self):
        if _contrast(self.text_color, self.background_color) < 4.5 or _contrast(self.text_color, self.surface_color) < 4.5:
            raise ValueError("As cores de texto e fundo devem atender contraste WCAG AA")
        if _contrast(self.muted_text_color, self.background_color) < 4.5:
            raise ValueError("A cor de texto secundário deve atender contraste WCAG AA")
        return self


class BrandingRead(BrandingUpdate):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID | None = None
    personal_id: uuid.UUID
    is_fallback: bool = False
    created_at: datetime | None = None
    updated_at: datetime | None = None
