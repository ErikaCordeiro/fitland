from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "Fitland API"
    ENVIRONMENT: str = "development"
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/personal_thiago_filippo"
    SECRET_KEY: str = Field(default="dev-change-this-secret-key-before-production", min_length=32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    REFRESH_COOKIE_NAME: str = "fitland_refresh_token"
    CORS_ORIGINS: str = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:4173,http://127.0.0.1:4173"
    )
    SEED_PERSONAL_EMAIL: str | None = None
    SEED_PERSONAL_PASSWORD: str | None = None
    SEED_STUDENT_EMAIL: str | None = None
    SEED_STUDENT_PASSWORD: str | None = None
    OWNER_INITIAL_NAME: str | None = None
    OWNER_INITIAL_EMAIL: str | None = None
    OWNER_INITIAL_PASSWORD: str | None = None
    OWNER_FORCE_PASSWORD_RESET: bool = False
    PASSWORD_RESET_EXPIRE_MINUTES: int = 30
    FRONTEND_URL: str = "http://localhost:4173"
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM_EMAIL: str | None = None
    SMTP_USE_TLS: bool = True
    UPLOADS_DIR: Path = Path(__file__).resolve().parents[2] / "uploads"
    AI_PROVIDER: str = "openai"
    OPENAI_API_KEY: str | None = None
    OPENAI_MODEL: str = "gpt-5.6-luna"
    GEMINI_API_KEY: str | None = None
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"
    AI_TIMEOUT_SECONDS: float = Field(default=20.0, ge=1.0, le=120.0)
    AI_DAILY_LIMIT: int = Field(default=50, ge=1, le=10000)

    @field_validator("DATABASE_URL")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
