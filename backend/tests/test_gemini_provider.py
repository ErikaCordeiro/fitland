from types import SimpleNamespace

import pytest
from pydantic import BaseModel

from app.core.config import Settings
from app.schemas.ai import AIErrorCode
from app.services.ai.errors import AIServiceError
from app.services.ai.providers.gemini_provider import GeminiProvider
from app.services.ai.providers.openai_provider import OpenAIProvider
from app.services.ai.service import build_provider


class ResultSchema(BaseModel):
    answer: str


class FakeTypes:
    class GenerateContentConfig:
        def __init__(self, **kwargs):
            self.options = kwargs

    class Part:
        @staticmethod
        def from_bytes(*, data, mime_type):
            return {"data": data, "mime_type": mime_type}


class FakeModels:
    def __init__(self, result=None, error=None):
        self.result = result
        self.error = error
        self.call = None

    def generate_content(self, **kwargs):
        self.call = kwargs
        if self.error:
            raise self.error
        return self.result


def provider_with(*, result=None, error=None, key="gemini-test-secret"):
    provider = GeminiProvider(api_key=key, model="gemini-test-model", timeout_seconds=5)
    provider._types = FakeTypes
    provider._client = SimpleNamespace(models=FakeModels(result=result, error=error))
    return provider


def response(text='{"answer":"ok"}', *, input_tokens=11, output_tokens=4, candidates=None, feedback=None):
    return SimpleNamespace(
        text=text,
        usage_metadata=SimpleNamespace(
            prompt_token_count=input_tokens,
            candidates_token_count=output_tokens,
        ),
        candidates=candidates or [],
        prompt_feedback=feedback,
    )


def config(**overrides):
    values = {
        "DATABASE_URL": "sqlite+pysqlite:///:memory:",
        "SECRET_KEY": "x" * 32,
        "AI_PROVIDER": "gemini",
        "GEMINI_API_KEY": "gemini-test-secret",
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_provider_selection_is_explicit_and_preserves_openai():
    gemini = build_provider(config(AI_PROVIDER=" GeMiNi "))
    openai = build_provider(config(AI_PROVIDER="openai", OPENAI_API_KEY="openai-test-secret"))
    assert isinstance(gemini, GeminiProvider)
    assert isinstance(openai, OpenAIProvider)
    with pytest.raises(AIServiceError) as error:
        build_provider(config(AI_PROVIDER="unsupported"))
    assert error.value.code == AIErrorCode.NOT_CONFIGURED


def test_gemini_without_key_is_safe_and_not_configured():
    provider = build_provider(config(GEMINI_API_KEY=None))
    assert provider.status() == {
        "provider": "gemini",
        "model": "gemini-3.5-flash-lite",
        "configured": False,
        "available": False,
    }
    with pytest.raises(AIServiceError) as error:
        provider.generate_structured(instructions="rules", input_text="input", response_model=ResultSchema)
    assert error.value.code == AIErrorCode.NOT_CONFIGURED


def test_structured_output_is_validated_and_usage_is_captured():
    provider = provider_with(result=response())
    result = provider.generate_structured(instructions="rules", input_text="input", response_model=ResultSchema)
    assert result.data == ResultSchema(answer="ok")
    assert (result.input_tokens, result.output_tokens) == (11, 4)
    call = provider._client.models.call
    assert call["model"] == "gemini-test-model"
    assert call["config"].options == {
        "system_instruction": "rules",
        "response_mime_type": "application/json",
        "response_schema": ResultSchema,
    }


def test_image_input_uses_inline_bytes_and_same_structured_contract():
    provider = provider_with(result=response())
    result = provider.analyze_image(
        instructions="rules",
        image_bytes=b"image-bytes",
        mime_type="image/png",
        response_model=ResultSchema,
    )
    assert result.data.answer == "ok"
    assert provider._client.models.call["contents"][0] == {
        "data": b"image-bytes",
        "mime_type": "image/png",
    }


@pytest.mark.parametrize("text", [None, "not-json", '{"unexpected":true}'])
def test_invalid_response_is_rejected(text):
    provider = provider_with(result=response(text))
    with pytest.raises(AIServiceError) as error:
        provider.generate_structured(instructions="rules", input_text="input", response_model=ResultSchema)
    assert error.value.code == AIErrorCode.INVALID_RESPONSE


@pytest.mark.parametrize(
    "exception,expected",
    [
        (TimeoutError("gemini-test-secret"), AIErrorCode.TIMEOUT),
        (type("ClientError", (Exception,), {"code": 429})("gemini-test-secret"), AIErrorCode.RATE_LIMITED),
        (RuntimeError("gemini-test-secret"), AIErrorCode.UNAVAILABLE),
    ],
)
def test_provider_errors_are_mapped_and_sanitized(exception, expected):
    provider = provider_with(error=exception)
    with pytest.raises(AIServiceError) as error:
        provider.generate_structured(instructions="rules", input_text="input", response_model=ResultSchema)
    assert error.value.code == expected
    assert "gemini-test-secret" not in error.value.message


@pytest.mark.parametrize("reason", ["SAFETY", "PROHIBITED_CONTENT"])
def test_provider_safety_blocks_are_mapped(reason):
    blocked = response(text=None, candidates=[SimpleNamespace(finish_reason=reason)])
    provider = provider_with(result=blocked)
    with pytest.raises(AIServiceError) as error:
        provider.generate_structured(instructions="rules", input_text="input", response_model=ResultSchema)
    assert error.value.code == AIErrorCode.SAFETY_BLOCKED


def test_status_and_errors_never_expose_secret():
    secret = "gemini-sensitive-key"
    provider = GeminiProvider(api_key=secret, model="gemini-test-model", timeout_seconds=5)
    assert secret not in str(provider.status())
    provider._types = FakeTypes
    provider._client = SimpleNamespace(models=FakeModels(error=RuntimeError(secret)))
    with pytest.raises(AIServiceError) as error:
        provider.generate_structured(instructions="rules", input_text="input", response_model=ResultSchema)
    assert secret not in str(error.value)
