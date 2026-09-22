from app.schemas.ai import AIErrorCode


class AIServiceError(Exception):
    def __init__(self, code: AIErrorCode, message: str):
        self.code = code
        self.message = message
        super().__init__(message)
