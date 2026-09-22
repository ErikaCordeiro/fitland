from abc import ABC, abstractmethod
from typing import Any

from pydantic import BaseModel

from app.schemas.ai import AIProviderResult


class AIProvider(ABC):
    name: str
    model: str

    @property
    @abstractmethod
    def configured(self) -> bool: ...

    @abstractmethod
    def generate_structured(
        self, *, instructions: str, input_text: str, response_model: type[BaseModel]
    ) -> AIProviderResult: ...

    @abstractmethod
    def analyze_image(
        self, *, instructions: str, image_bytes: bytes, mime_type: str, response_model: type[BaseModel]
    ) -> AIProviderResult: ...

    def status(self) -> dict[str, Any]:
        return {"provider": self.name, "model": self.model, "configured": self.configured, "available": self.configured}
