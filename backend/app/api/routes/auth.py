from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    SessionResponse,
    TokenResponse,
)
from app.schemas.user import UserCreate, UserRead
from app.services.auth_service import (
    authenticate,
    authenticate_owner,
    confirm_password_reset,
    get_connected_devices,
    refresh_session,
    register_user,
    request_password_reset,
    revoke_refresh_token,
)

router = APIRouter()


def _cookie_secure() -> bool:
    return settings.ENVIRONMENT.lower() in {"production", "prod"}


def _refresh_cookie_name(context: str) -> str:
    return f"{settings.REFRESH_COOKIE_NAME}_{context}"


def _set_refresh_cookie(response: Response, refresh_token: str | None, context: str) -> None:
    cookie_name = _refresh_cookie_name(context)
    if not refresh_token:
        response.delete_cookie(cookie_name, path="/api/auth")
        return
    response.set_cookie(
        key=cookie_name,
        value=refresh_token,
        httponly=True,
        secure=_cookie_secure(),
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/api/auth",
    )


@router.post("/register", response_model=UserRead, status_code=201)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    return register_user(db, payload)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    token_response, refresh_token = authenticate(db, payload)
    _set_refresh_cookie(response, refresh_token, token_response.user.role.value)
    return token_response


@router.post("/owner-login", response_model=TokenResponse)
def owner_login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    token_response, refresh_token = authenticate_owner(db, payload)
    _set_refresh_cookie(response, refresh_token, "owner")
    return token_response


@router.post("/password-reset/request", status_code=202)
def password_reset_request(payload: PasswordResetRequest, db: Session = Depends(get_db)):
    request_password_reset(db, str(payload.email))
    return {"detail": "Se o e-mail estiver cadastrado, enviaremos um link de redefinicao."}


@router.post("/password-reset/confirm")
def password_reset_confirm(payload: PasswordResetConfirm, db: Session = Depends(get_db)):
    if payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=422, detail="As senhas nao coincidem.")
    context = confirm_password_reset(db, payload.token, payload.new_password)
    return {"context": context}


@router.post("/refresh", response_model=SessionResponse)
def refresh(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    auth_context: str | None = Header(default=None, alias="X-Auth-Context"),
):
    context = (auth_context or "").strip().lower()
    if context not in {"owner", "personal", "student"}:
        raise HTTPException(status_code=400, detail="Invalid auth context")
    refresh_token = request.cookies.get(_refresh_cookie_name(context), "")
    token_response, rotated_refresh = refresh_session(db, refresh_token, context)
    _set_refresh_cookie(response, rotated_refresh, context)
    return token_response


@router.post("/logout", status_code=204)
def logout(
    request: Request,
    response: Response,
    auth_context: str | None = Header(default=None, alias="X-Auth-Context"),
):
    context = (auth_context or "").strip().lower()
    refresh_token = request.cookies.get(_refresh_cookie_name(context)) if context else None
    revoke_refresh_token(refresh_token)
    if context in {"owner", "personal", "student"}:
        response.delete_cookie(_refresh_cookie_name(context), path="/api/auth")
    return None


@router.get("/session", response_model=UserRead)
def session(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/devices")
def devices(current_user: User = Depends(get_current_user)):
    return {"devices": get_connected_devices(current_user), "two_factor_admin_ready": current_user.role.value == "personal"}
