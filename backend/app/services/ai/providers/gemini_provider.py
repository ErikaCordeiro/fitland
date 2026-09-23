from typing import Any

from pydantic import BaseModel, ValidationError

from app.schemas.ai import AIErrorCode, AIProviderResult
from app.services.ai.errors import AIServiceError
from app.services.ai.providers.base import AIProvider


class GeminiProvider(AIProvider):
    name = "gemini"

    def __init__(self, *, api_key: str | None, model: str, timeout_seconds: float):
        self._api_key = (api_key or "").strip()
        self.model = model
        self.timeout_seconds = timeout_seconds
        self._client = None
        self._types = None

    @property
    def configured(self) -> bool:
        return bool(self._api_key)

    def _load_sdk(self):
        if self._types is None:
            from google.genai import types

            self._types = types
        return self._types

    def _get_client(self):
        if not self.configured:
            raise AIServiceError(AIErrorCode.NOT_CONFIGURED, "AI provider is not configured")
        if self._client is None:
            from google import genai

            types = self._load_sdk()
            self._client = genai.Client(
                api_key=self._api_key,
                http_options=types.HttpOptions(
                    timeout=int(self.timeout_seconds * 1000),
                    retry_options=types.HttpRetryOptions(attempts=2),
                ),
            )
        return self._client

    def _generate(self, *, instructions: str, content: Any, response_model: type[BaseModel]) -> AIProviderResult:
        try:
            client = self._get_client()
            types = self._load_sdk()
            response = client.models.generate_content(
                model=self.model,
                contents=content,
                config=types.GenerateContentConfig(
                    system_instruction=instructions,
                    response_mime_type="application/json",
                    response_schema=response_model,
                ),
            )
            self._raise_if_safety_blocked(response)
            text = getattr(response, "text", None)
            if not text:
                raise AIServiceError(AIErrorCode.INVALID_RESPONSE, "AI provider returned an invalid response")
            parsed = response_model.model_validate_json(text)
            usage = getattr(response, "usage_metadata", None)
            return AIProviderResult(
                data=parsed,
                input_tokens=getattr(usage, "prompt_token_count", None),
                output_tokens=getattr(usage, "candidates_token_count", None),
            )
        except AIServiceError:
            raise
        except ValidationError as exc:
            raise AIServiceError(AIErrorCode.INVALID_RESPONSE, "AI provider returned an invalid response") from exc
        except TimeoutError as exc:
            raise AIServiceError(AIErrorCode.TIMEOUT, "AI provider timed out") from exc
        except Exception as exc:
            self._raise_mapped_error(exc)

    @staticmethod
    def _raise_if_safety_blocked(response: Any) -> None:
        feedback = getattr(response, "prompt_feedback", None)
        reasons = [getattr(feedback, "block_reason", None)]
        for candidate in getattr(response, "candidates", None) or []:
            reasons.append(getattr(candidate, "finish_reason", None))
        if any("SAFETY" in str(reason).upper() or "PROHIBITED" in str(reason).upper() for reason in reasons if reason):
            raise AIServiceError(AIErrorCode.SAFETY_BLOCKED, "AI request blocked by provider safety policy")

    @staticmethod
    def _raise_mapped_error(exc: Exception) -> None:
        error_name = type(exc).__name__
        code = getattr(exc, "code", None)
        if error_name in {"TimeoutException", "ReadTimeout", "ConnectTimeout"}:
            raise AIServiceError(AIErrorCode.TIMEOUT, "AI provider timed out") from exc
        if code == 429 or error_name == "RateLimitError":
            raise AIServiceError(AIErrorCode.RATE_LIMITED, "AI provider rate limit reached") from exc
        if code in {400, 422}:
            raise AIServiceError(AIErrorCode.INVALID_RESPONSE, "AI provider returned an invalid response") from exc
        raise AIServiceError(AIErrorCode.UNAVAILABLE, "AI provider is unavailable") from exc

    def generate_structured(
        self, *, instructions: str, input_text: str, response_model: type[BaseModel]
    ) -> AIProviderResult:
        return self._generate(instructions=instructions, content=input_text, response_model=response_model)

    def analyze_image(
        self, *, instructions: str, image_bytes: bytes, mime_type: str, response_model: type[BaseModel]
    ) -> AIProviderResult:
        types = self._load_sdk()
        content = [
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
            "Analyze the supplied image using only the requested schema.",
        ]
        return self._generate(instructions=instructions, content=content, response_model=response_model)
