import base64

from pydantic import BaseModel

from app.schemas.ai import AIErrorCode, AIProviderResult
from app.services.ai.errors import AIServiceError
from app.services.ai.providers.base import AIProvider


class OpenAIProvider(AIProvider):
    name = "openai"

    def __init__(self, *, api_key: str | None, model: str, timeout_seconds: float):
        self._api_key = (api_key or "").strip()
        self.model = model
        self.timeout_seconds = timeout_seconds
        self._client = None

    @property
    def configured(self) -> bool:
        return bool(self._api_key)

    def _get_client(self):
        if not self.configured:
            raise AIServiceError(AIErrorCode.NOT_CONFIGURED, "AI provider is not configured")
        if self._client is None:
            from openai import OpenAI
            self._client = OpenAI(api_key=self._api_key, timeout=self.timeout_seconds, max_retries=1)
        return self._client

    def _parse(self, *, instructions: str, content, response_model: type[BaseModel]) -> AIProviderResult:
        try:
            response = self._get_client().responses.parse(
                model=self.model,
                instructions=instructions,
                input=content,
                text_format=response_model,
            )
            parsed = response.output_parsed
            if parsed is None:
                raise AIServiceError(AIErrorCode.INVALID_RESPONSE, "AI provider returned an invalid response")
            usage = getattr(response, "usage", None)
            return AIProviderResult(
                data=parsed,
                input_tokens=getattr(usage, "input_tokens", None),
                output_tokens=getattr(usage, "output_tokens", None),
            )
        except AIServiceError:
            raise
        except TimeoutError as exc:
            raise AIServiceError(AIErrorCode.TIMEOUT, "AI provider timed out") from exc
        except Exception as exc:
            error_type = type(exc).__name__
            if error_type in {"APITimeoutError", "TimeoutException"}:
                raise AIServiceError(AIErrorCode.TIMEOUT, "AI provider timed out") from exc
            if error_type == "RateLimitError":
                raise AIServiceError(AIErrorCode.RATE_LIMITED, "AI provider rate limit reached") from exc
            raise AIServiceError(AIErrorCode.UNAVAILABLE, "AI provider is unavailable") from exc

    def generate_structured(self, *, instructions: str, input_text: str, response_model: type[BaseModel]) -> AIProviderResult:
        return self._parse(instructions=instructions, content=input_text, response_model=response_model)

    def analyze_image(self, *, instructions: str, image_bytes: bytes, mime_type: str, response_model: type[BaseModel]) -> AIProviderResult:
        encoded = base64.b64encode(image_bytes).decode("ascii")
        content = [{"role": "user", "content": [
            {"type": "input_text", "text": "Analyze the supplied image using only the requested schema."},
            {"type": "input_image", "image_url": f"data:{mime_type};base64,{encoded}"},
        ]}]
        return self._parse(instructions=instructions, content=content, response_model=response_model)
