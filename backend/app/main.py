from pathlib import Path
import logging
import os
import socket
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.datastructures import Headers, MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.api.routes import auth, branding, exercises, owner, progress, students, users, videos, workouts, workout_sessions
from app.core.config import settings
from app.core.errors import register_error_handlers
from app.core.observability import build_identity, request_id_context
from app.core.owner_bootstrap import normalize_owner_email, normalize_owner_password
from app.core.security import verify_password
from app.db.session import SessionLocal
from app.models.user import User, UserRole
from sqlalchemy import func, select
from sqlalchemy.engine import make_url

logger = logging.getLogger("uvicorn.error")

class RequestObservabilityMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = Headers(scope=scope)
        correlation_id = headers.get("X-Request-ID") or str(uuid.uuid4())
        token = request_id_context.set(correlation_id)
        path = scope.get("path", "")
        method = scope.get("method", "")
        is_auth_request = path.startswith("/api/auth/")
        identity = build_identity()
        status_code = 500

        logger.info(
            "[asgi-request] request_id=%s method=%s path=%s build=%s pid=%s hostname=%s deployment=%s replica=%s",
            correlation_id, method, path, identity["version"], os.getpid(), socket.gethostname(),
            identity["deployment"], os.getenv("RAILWAY_REPLICA_ID", "unknown"),
        )
        if is_auth_request:
            logger.info(
                "[request] id=%s method=%s path=%s frontend_build=%s backend_build=%s deployment=%s",
                correlation_id, method, path, headers.get("X-Frontend-Build", "unknown"),
                identity["version"], identity["deployment"],
            )

        async def send_with_identity(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                response_headers = MutableHeaders(scope=message)
                response_headers["X-Request-ID"] = correlation_id
                response_headers["X-Backend-Build"] = identity["version"]
                response_headers["X-Backend-Deployment"] = identity["deployment"]
                response_headers["X-Fitland-Service"] = "backend"
                response_headers["X-Fitland-Build"] = identity["version"]
            await send(message)

        try:
            await self.app(scope, receive, send_with_identity)
        except Exception as exc:
            logger.exception(
                "[request] id=%s status=500 result=unhandled_error error_type=%s",
                correlation_id, type(exc).__name__,
            )
            response = JSONResponse(status_code=500, content={"detail": "Internal server error"})
            await response(scope, receive, send_with_identity)
        finally:
            if is_auth_request:
                logger.info("[request] id=%s status=%s", correlation_id, status_code)
            logger.info("[asgi-response] request_id=%s status=%s", correlation_id, status_code)
            request_id_context.reset(token)


app = FastAPI(title=settings.APP_NAME, version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID", "X-Frontend-Build", "X-Auth-Context"],
    expose_headers=[
        "X-Request-ID", "X-Backend-Build", "X-Backend-Deployment", "X-Fitland-Service", "X-Fitland-Build",
    ],
)
app.add_middleware(RequestObservabilityMiddleware)
register_error_handlers(app)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(students.router, prefix="/api/students", tags=["students"])
app.include_router(workouts.router, prefix="/api/workouts", tags=["workouts"])
app.include_router(workout_sessions.router, prefix="/api/workout-sessions", tags=["workout-sessions"])
app.include_router(exercises.router, prefix="/api/exercises", tags=["exercises"])
app.include_router(progress.router, prefix="/api/progress", tags=["progress"])
app.include_router(videos.router, prefix="/api/videos", tags=["videos"])
app.include_router(owner.router, prefix="/api/owner", tags=["owner"])
app.include_router(branding.router, prefix="/api/branding", tags=["branding"])


@app.on_event("startup")
def startup_diagnostics() -> None:
    login_registered = any(
        getattr(route, "path", None) == "/api/auth/login" and "POST" in getattr(route, "methods", set())
        for route in app.routes
    )
    owner_login_registered = any(
        getattr(route, "path", None) == "/api/auth/owner-login" and "POST" in getattr(route, "methods", set())
        for route in app.routes
    )
    database_url = make_url(settings.DATABASE_URL)
    identity = build_identity()
    print(f"[diagnostic] auth_login_route_registered={str(login_registered).lower()}", flush=True)
    print(f"[diagnostic] auth_owner_login_route_registered={str(owner_login_registered).lower()}", flush=True)
    print(
        "[diagnostic] build "
        f"environment={identity['environment']} version={identity['version']} deployment={identity['deployment']}"
    , flush=True)
    print(
        "[db] "
        f"engine={database_url.get_backend_name()} host={'configured' if database_url.host else 'missing'} "
        f"database={database_url.database or 'missing'}"
    , flush=True)

    owner_email = normalize_owner_email(settings.OWNER_INITIAL_EMAIL)
    owner_password = normalize_owner_password(settings.OWNER_INITIAL_PASSWORD)
    db = SessionLocal()
    try:
        owners = db.scalars(
            select(User).where(func.lower(func.trim(User.email)) == owner_email)
        ).all() if owner_email else []
        owner = owners[0] if len(owners) == 1 else None
        password_valid = bool(
            owner
            and owner_password
            and verify_password(owner_password, owner.hashed_password)
        )
        print(
            "[diagnostic] owner_runtime_check "
            f"configured={str(bool(owner_email and owner_password)).lower()} "
            f"user_count={len(owners)} role_owner={str(bool(owner and owner.role == UserRole.OWNER)).lower()} "
            f"active={str(bool(owner and owner.is_active)).lower()} "
            f"status={owner.account_status if owner else 'none'} "
            f"password_valid={str(password_valid).lower()} "
            f"configured_password_len={len(owner_password)}",
            flush=True,
        )
    except Exception as exc:
        # Diagnostics must never prevent the API from starting. This also keeps
        # HTTP tests isolated when their dependency override uses a fake DB.
        print(
            "[diagnostic] owner_runtime_check unavailable=true "
            f"error_type={type(exc).__name__}",
            flush=True,
        )
    finally:
        db.close()


@app.get("/health")
def health_check():
    return {"status": "ok", "service": settings.APP_NAME, **build_identity()}


@app.get("/api/diagnostic/ping", include_in_schema=False)
def diagnostic_ping():
    identity = build_identity()
    return {"ok": True, "service": "fitland-backend", "build": identity["version"]}


@app.post("/api/diagnostic/post", include_in_schema=False)
def diagnostic_post():
    identity = build_identity()
    logger.info(
        "[diagnostic-post] request_id=%s method=POST path=/api/diagnostic/post",
        request_id_context.get(),
    )
    return {"ok": True, "service": "fitland-backend", "build": identity["version"]}


FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
UPLOADS_DIR = Path(__file__).resolve().parents[1] / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

if FRONTEND_DIST.exists():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_frontend(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")

        requested_path = FRONTEND_DIST / full_path
        if requested_path.is_file():
            return FileResponse(requested_path)

        return FileResponse(FRONTEND_DIST / "index.html")
