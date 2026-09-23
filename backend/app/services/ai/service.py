import time
from typing import Any, Callable

from pydantic import BaseModel, ValidationError
from sqlalchemy.orm import Session

from app.core.config import Settings, settings
from app.models.ai_audit import AIAuditLog
from app.models.user import User
from app.schemas.ai import AIOperation, AIErrorCode, AIProviderResult
from app.services.ai.errors import AIServiceError
from app.services.ai.guardrails import AIScope, evaluate_safety, resolve_ai_scope
from app.services.ai.providers.base import AIProvider
from app.services.ai.providers.gemini_provider import GeminiProvider
from app.services.ai.providers.openai_provider import OpenAIProvider
from app.services.ai.quota import enforce_daily_quota


def build_provider(config: Settings) -> AIProvider:
    provider_name = config.AI_PROVIDER.strip().lower()
    if provider_name == "openai":
        return OpenAIProvider(
            api_key=config.OPENAI_API_KEY,
            model=config.OPENAI_MODEL,
            timeout_seconds=config.AI_TIMEOUT_SECONDS,
        )
    if provider_name == "gemini":
        return GeminiProvider(
            api_key=config.GEMINI_API_KEY,
            model=config.GEMINI_MODEL,
            timeout_seconds=config.AI_TIMEOUT_SECONDS,
        )
    raise AIServiceError(AIErrorCode.NOT_CONFIGURED, "Configured AI provider is not supported")


class AIService:
    def __init__(self, db: Session, *, provider: AIProvider | None = None, config: Settings = settings):
        self.db = db
        self.config = config
        self.provider = provider or build_provider(config)

    def status(self) -> dict[str, Any]:
        return self.provider.status()

    def generate_structured(
        self,
        *,
        user: User,
        operation: AIOperation,
        instructions: str,
        input_text: str,
        response_model: type[BaseModel],
        student_id=None,
        result_validator: Callable[[BaseModel], BaseModel] | None = None,
    ) -> BaseModel:
        scope = resolve_ai_scope(self.db, user=user, operation=operation, student_id=student_id)
        safety = evaluate_safety(input_text)
        if not safety.allowed:
            self._audit(scope, operation, "safety_blocked", 0, error_code=AIErrorCode.SAFETY_BLOCKED)
            raise AIServiceError(AIErrorCode.SAFETY_BLOCKED, safety.message or "AI request blocked by safety policy")
        enforce_daily_quota(self.db, scope=scope, operation=operation, limit=self.config.AI_DAILY_LIMIT)
        if not self.provider.configured:
            self._audit(scope, operation, "not_configured", 0, error_code=AIErrorCode.NOT_CONFIGURED)
            raise AIServiceError(AIErrorCode.NOT_CONFIGURED, "AI provider is not configured")

        started = time.monotonic()
        try:
            result = self.provider.generate_structured(
                instructions=instructions,
                input_text=input_text,
                response_model=response_model,
            )
            parsed = self._validate_result(result, response_model)
            if result_validator:
                parsed = result_validator(parsed)
            self._audit(scope, operation, "success", self._elapsed(started), result=result)
            return parsed
        except AIServiceError as exc:
            self._audit(scope, operation, self._status_for_error(exc.code), self._elapsed(started), error_code=exc.code)
            raise
        except TimeoutError as exc:
            error = AIServiceError(AIErrorCode.TIMEOUT, "AI provider timed out")
            self._audit(scope, operation, "timeout", self._elapsed(started), error_code=error.code)
            raise error from exc
        except Exception as exc:
            error = AIServiceError(AIErrorCode.UNAVAILABLE, "AI provider is unavailable")
            self._audit(scope, operation, "unavailable", self._elapsed(started), error_code=error.code)
            raise error from exc

    @staticmethod
    def _validate_result(result: AIProviderResult, response_model: type[BaseModel]) -> BaseModel:
        try:
            if isinstance(result.data, response_model):
                return result.data
            return response_model.model_validate(result.data)
        except ValidationError as exc:
            raise AIServiceError(AIErrorCode.INVALID_RESPONSE, "AI provider returned an invalid response") from exc

    @staticmethod
    def _elapsed(started: float) -> int:
        return max(0, round((time.monotonic() - started) * 1000))

    @staticmethod
    def _status_for_error(code: AIErrorCode) -> str:
        return {
            AIErrorCode.TIMEOUT: "timeout",
            AIErrorCode.INVALID_RESPONSE: "invalid_response",
            AIErrorCode.RATE_LIMITED: "rate_limited",
            AIErrorCode.SAFETY_BLOCKED: "safety_blocked",
        }.get(code, "unavailable")

    def _audit(
        self,
        scope: AIScope,
        operation: AIOperation,
        status: str,
        duration_ms: int,
        *,
        result: AIProviderResult | None = None,
        error_code: AIErrorCode | None = None,
    ) -> None:
        self.db.add(AIAuditLog(
            operation=operation.value,
            personal_id=scope.personal_id,
            student_id=scope.student_id,
            user_id=scope.user_id,
            provider=self.provider.name,
            model=self.provider.model,
            status=status,
            duration_ms=duration_ms,
            input_tokens=result.input_tokens if result else None,
            output_tokens=result.output_tokens if result else None,
            error_code=error_code.value if error_code else None,
            error_message=None,
        ))
        self.db.commit()
