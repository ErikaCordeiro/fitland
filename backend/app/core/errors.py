from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette import status

from app.services.ai.errors import AIServiceError


class DomainError(Exception):
    def __init__(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        self.message = message
        self.status_code = status_code


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AIServiceError)
    async def ai_service_error_handler(_: Request, exc: AIServiceError):
        status_code = {
            "AI_FORBIDDEN": 403,
            "AI_RATE_LIMITED": 429,
            "AI_SAFETY_BLOCKED": 422,
            "AI_NOT_CONFIGURED": 503,
            "AI_TIMEOUT": 504,
        }.get(exc.code.value, 503)
        return JSONResponse(status_code=status_code, content={"code": exc.code.value, "message": exc.message})

    @app.exception_handler(DomainError)
    async def domain_error_handler(_: Request, exc: DomainError):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})

    @app.exception_handler(Exception)
    async def generic_error_handler(_: Request, exc: Exception):
        if app.debug:
            return JSONResponse(status_code=500, content={"detail": str(exc)})
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})
