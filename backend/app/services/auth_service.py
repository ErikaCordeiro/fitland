import hashlib
import time
import uuid
import secrets
import smtplib
from urllib.parse import urlencode
from datetime import datetime, timedelta, timezone
from collections import defaultdict

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session
from starlette import status

from app.core.config import settings
from app.core.errors import DomainError
from app.core.observability import request_id
from app.core.owner_bootstrap import normalize_owner_email, normalize_owner_password
from app.core.security import (
    create_access_token,
    create_password_reset_token,
    create_refresh_token,
    decode_password_reset_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)
from app.models.audit_log import AuditLog
from app.models.auth_state import RefreshTokenSession
from app.models.user import User, UserRole
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.user import UserCreate
from app.services.email_service import send_password_reset_email
from app.services.rate_limit_service import clear_attempts, is_limited, register_attempt

LOCKOUT_WINDOW_SECONDS = 15 * 60
MAX_FAILED_ATTEMPTS = 5
LOGIN_HISTORY: list[dict[str, str]] = []
# Compatibility state is used only by lightweight unit-test doubles that do
# not implement SQLAlchemy transactions. Runtime Sessions always use PostgreSQL.
FAILED_ATTEMPTS: dict[str, list[float]] = defaultdict(list)
REVOKED_REFRESH_JTIS: set[str] = set()


def register_user(db: Session, payload: UserCreate) -> User:
    existing = db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing:
        raise DomainError("Email already registered", status.HTTP_409_CONFLICT)

    user = User(
        name=payload.name.strip(),
        email=payload.email.lower(),
        hashed_password=hash_password(payload.password),
        role=UserRole.STUDENT,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _is_locked(db: Session, email: str) -> bool:
    if not hasattr(db, "execute"):
        now = time.time()
        FAILED_ATTEMPTS[email] = [item for item in FAILED_ATTEMPTS[email] if now - item < LOCKOUT_WINDOW_SECONDS]
        return len(FAILED_ATTEMPTS[email]) >= MAX_FAILED_ATTEMPTS
    return is_limited(db, "auth_login", email, MAX_FAILED_ATTEMPTS)


def _register_failure(db: Session, email: str) -> None:
    if not hasattr(db, "execute"):
        FAILED_ATTEMPTS[email].append(time.time())
        if len(FAILED_ATTEMPTS[email]) > MAX_FAILED_ATTEMPTS:
            raise DomainError("Muitas tentativas. Aguarde alguns minutos e tente novamente.", status.HTTP_429_TOO_MANY_REQUESTS)
        return
    if register_attempt(db, "auth_login", email, LOCKOUT_WINDOW_SECONDS) > MAX_FAILED_ATTEMPTS:
        raise DomainError("Muitas tentativas. Aguarde alguns minutos e tente novamente.", status.HTTP_429_TOO_MANY_REQUESTS)


def _register_success(db: Session, email: str, user: User) -> None:
    if not hasattr(db, "execute"):
        FAILED_ATTEMPTS.pop(email, None)
    else:
        clear_attempts(db, "auth_login", email)
    LOGIN_HISTORY.append(
        {
            "user_id": str(user.id),
            "email": email,
            "role": user.role.value,
            "at": datetime.now(timezone.utc).isoformat(),
        }
    )
    del LOGIN_HISTORY[:-50]
    user.last_login_at = datetime.now(timezone.utc).replace(tzinfo=None)


def _token_payload(user: User) -> dict[str, str | int | bool]:
    return {
        "role": user.role.value,
        "token_version": int(user.token_version or 0),
        "password_change_required": bool(user.must_change_password),
    }


def build_token_response(user: User) -> TokenResponse:
    access_token = create_access_token(str(user.id), _token_payload(user))
    return TokenResponse(
        access_token=access_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=user,
    )


def _jti_hash(jti: str) -> str:
    return hashlib.sha256(jti.encode("utf-8")).hexdigest()


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def build_refresh_token(db: Session, user: User, persistent: bool) -> str:
    now = datetime.now(timezone.utc)
    jti = str(uuid.uuid4())
    token = create_refresh_token(
        str(user.id),
        {**_token_payload(user), "jti": jti, "persistent": persistent},
    )
    db.add(RefreshTokenSession(
        jti_hash=_jti_hash(jti),
        user_id=user.id,
        context=user.role.value,
        persistent=persistent,
        expires_at=now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        created_at=now,
    ))
    return token


def request_password_reset(db: Session, email_value: str) -> None:
    email = normalize_owner_email(email_value)
    user = db.scalar(select(User).where(func.lower(func.trim(User.email)) == email))
    if not user or not user.is_active or user.deleted_at is not None:
        return
    token = create_password_reset_token(str(user.id), int(user.token_version or 0))
    reset_url = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?{urlencode({'token': token})}"
    try:
        send_password_reset_email(user.email, reset_url)
    except (OSError, RuntimeError, smtplib.SMTPException):
        print("[auth] password_reset_delivery_failed", flush=True)


def confirm_password_reset(db: Session, token: str, new_password: str) -> str:
    try:
        payload = decode_password_reset_token(token)
        user_id = uuid.UUID(str(payload.get("sub")))
    except (ValueError, TypeError) as exc:
        raise DomainError("Token invalido ou expirado.", status.HTTP_400_BAD_REQUEST) from exc
    user = db.get(User, user_id)
    if not user or not user.is_active or user.deleted_at is not None:
        raise DomainError("Token invalido ou expirado.", status.HTTP_400_BAD_REQUEST)
    if int(payload.get("token_version", -1)) != int(user.token_version or 0):
        raise DomainError("Token invalido ou ja utilizado.", status.HTTP_400_BAD_REQUEST)
    user.hashed_password = hash_password(new_password)
    user.must_change_password = False
    user.token_version = int(user.token_version or 0) + 1
    db.add(AuditLog(
        actor_user_id=user.id,
        action="password_reset_by_email",
        entity_type="user",
        entity_id=str(user.id),
        details={},
    ))
    db.commit()
    return user.role.value


def authenticate(db: Session, payload: LoginRequest) -> tuple[TokenResponse, str | None]:
    email = normalize_owner_email(str(payload.email))
    password = payload.password
    correlation_id = request_id()
    users = db.scalars(
        select(User).where(func.lower(func.trim(User.email)) == email)
    ).all()
    user = users[0] if len(users) == 1 else None
    role = user.role.value if user else "none"
    print(
        "[auth] login_attempt "
        f"request_id={correlation_id} user_found={str(bool(user)).lower()} "
        f"user_count={len(users)} role={role} active={str(bool(user and user.is_active)).lower()} "
        f"account_status={user.account_status if user else 'none'} "
        f"password_hash_present={str(bool(user and user.hashed_password)).lower()}",
        flush=True,
    )

    if _is_locked(db, email):
        print(f"[auth] login_failed request_id={correlation_id} reason=blocked_account", flush=True)
        raise DomainError("Muitas tentativas. Aguarde alguns minutos e tente novamente.", status.HTTP_429_TOO_MANY_REQUESTS)

    if len(users) > 1:
        print(f"[auth] login_failed request_id={correlation_id} reason=internal_auth_error duplicate_accounts=true", flush=True)
        raise DomainError("Invalid email or password", status.HTTP_401_UNAUTHORIZED)
    if not user:
        _register_failure(db, email)
        print(f"[auth] login_failed request_id={correlation_id} reason=user_not_found", flush=True)
        raise DomainError("Invalid email or password", status.HTTP_401_UNAUTHORIZED)
    if user.role == UserRole.OWNER:
        _register_failure(db, email)
        print(f"[auth] login_failed request_id={correlation_id} reason=owner_context_required", flush=True)
        raise DomainError("Invalid email or password", status.HTTP_401_UNAUTHORIZED)

    try:
        password_valid = verify_password(password, user.hashed_password)
    except (TypeError, ValueError):
        password_valid = False
    print(
        f"[auth] password_verification request_id={correlation_id} "
        f"password_valid={str(password_valid).lower()}",
        flush=True,
    )
    if not password_valid:
        _register_failure(db, email)
        print(f"[auth] login_failed request_id={correlation_id} reason=invalid_credentials", flush=True)
        raise DomainError("Invalid email or password", status.HTTP_401_UNAUTHORIZED)
    if user.deleted_at is not None or not user.is_active:
        print(f"[auth] login_failed request_id={correlation_id} reason=inactive_account", flush=True)
        raise DomainError("Inactive user", status.HTTP_403_FORBIDDEN)
    if user.account_status != "active":
        print(f"[auth] login_failed request_id={correlation_id} reason=blocked_account", flush=True)
        raise DomainError("Inactive user", status.HTTP_403_FORBIDDEN)

    print(f"[auth] credentials_valid request_id={correlation_id} role={user.role.value}", flush=True)
    try:
        token_response = build_token_response(user)
        print(f"[auth] access_token_created request_id={correlation_id}", flush=True)
        refresh_token = build_refresh_token(db, user, payload.keep_connected)
        print(
            f"[auth] refresh_session_created request_id={correlation_id} "
            f"persistent={str(bool(payload.keep_connected)).lower()}",
            flush=True,
        )
        _register_success(db, email, user)
        db.commit()
    except Exception as exc:
        db.rollback()
        print(
            f"[auth] login_failed request_id={correlation_id} reason=session_creation_failed "
            f"error_type={type(exc).__name__}",
            flush=True,
        )
        raise DomainError("Unable to create session", status.HTTP_500_INTERNAL_SERVER_ERROR) from exc
    print(f"[auth] login_success request_id={correlation_id} role={user.role.value}", flush=True)
    return token_response, refresh_token


def authenticate_owner(db: Session, payload: LoginRequest) -> tuple[TokenResponse, str | None]:
    """Authenticate the platform owner through the dedicated Fitland entrypoint."""
    correlation_id = request_id()
    email = normalize_owner_email(str(payload.email))
    password = normalize_owner_password(payload.password)
    configured_email = normalize_owner_email(settings.OWNER_INITIAL_EMAIL)
    configured_password = normalize_owner_password(settings.OWNER_INITIAL_PASSWORD)

    # Compare bytes so the dedicated recovery path behaves identically across
    # Python/OS builds and never performs a Unicode-dependent comparison.
    email_matches = bool(configured_email) and secrets.compare_digest(
        email.encode("utf-8"), configured_email.encode("utf-8")
    )
    password_matches = bool(configured_password) and secrets.compare_digest(
        password.encode("utf-8"), configured_password.encode("utf-8")
    )
    owner_recovery_matches = settings.OWNER_FORCE_PASSWORD_RESET and email_matches and password_matches
    user = None
    password_valid = False
    owner_count = 0
    owner_lookup_complete = False

    def log_decision(result: str, *, locked: bool = False) -> None:
        def state(value):
            return "unknown" if value is None else str(bool(value)).lower()

        print(
            "[auth-owner] decision "
            f"request_id={correlation_id} result={result} "
            f"user_found={state(user is not None if owner_lookup_complete else None)} "
            f"role_owner={state(user.role == UserRole.OWNER if user else None)} "
            f"active={state(user.is_active if user else None)} "
            f"password_valid={state(password_valid if user else None)} "
            f"locked={state(locked)} "
            f"must_change_password={state(user.must_change_password if user else None)} "
            f"force_reset={state(settings.OWNER_FORCE_PASSWORD_RESET)}",
            flush=True,
        )

    if _is_locked(db, email) and not owner_recovery_matches:
        log_decision("rejected_rate_limit", locked=True)
        raise DomainError("Muitas tentativas. Aguarde alguns minutos e tente novamente.", status.HTTP_429_TOO_MANY_REQUESTS)

    if settings.OWNER_FORCE_PASSWORD_RESET:
        # Recovery is intentionally restricted to the exact credentials from
        # the environment. ``ensure_owner`` returns the row it has just
        # persisted and verified, so do not perform a second independent
        # lookup that can disagree because of stale ORM state or legacy email
        # artifacts.
        if not email_matches or not password_matches:
            log_decision("rejected_recovery_credentials")
            raise DomainError("Invalid email or password", status.HTTP_401_UNAUTHORIZED)

        from app.services.owner_service import ensure_owner

        try:
            user = ensure_owner(db)
        except RuntimeError as exc:
            log_decision("rejected_recovery_owner")
            raise DomainError("Invalid email or password", status.HTTP_401_UNAUTHORIZED) from exc
        password_valid = bool(user and user.role == UserRole.OWNER)
        owner_count = 1 if user else 0
        owner_lookup_complete = True
    else:
        owner_candidates = db.scalars(select(User).where(User.role == UserRole.OWNER)).all()
        matching_owners = [
            candidate
            for candidate in owner_candidates
            if normalize_owner_email(candidate.email) == email
        ]
        owner_count = len(matching_owners)
        user = matching_owners[0] if owner_count == 1 else None
        owner_lookup_complete = True
        if user:
            try:
                password_valid = verify_password(password, user.hashed_password)
            except (TypeError, ValueError):
                password_valid = False

    if not user or owner_count != 1 or not password_valid:
        _register_failure(db, email)
        reason = "owner_not_found" if not user or owner_count != 1 else "password_mismatch"
        log_decision(f"rejected_{reason}")
        raise DomainError("Invalid email or password", status.HTTP_401_UNAUTHORIZED)

    if user.deleted_at is not None or not user.is_active or user.account_status != "active":
        log_decision("rejected_inactive")
        raise DomainError("Inactive user", status.HTTP_403_FORBIDDEN)

    try:
        _register_success(db, email, user)
        db.add(AuditLog(
            actor_user_id=user.id,
            action="owner_login",
            entity_type="user",
            entity_id=str(user.id),
            details={"entrypoint": "fitland"},
        ))
        token_response = build_token_response(user)
        refresh_token = build_refresh_token(db, user, payload.keep_connected)
        db.commit()
    except Exception as exc:
        db.rollback()
        log_decision("failed_session_creation")
        raise DomainError("Unable to create session", status.HTTP_500_INTERNAL_SERVER_ERROR) from exc

    log_decision("accepted")
    return token_response, refresh_token


def change_required_owner_password(
    db: Session,
    owner: User,
    new_password: str,
) -> tuple[TokenResponse, str]:
    if owner.role != UserRole.OWNER or not owner.must_change_password:
        raise DomainError("Password change is not pending", status.HTTP_409_CONFLICT)
    if verify_password(new_password, owner.hashed_password):
        raise DomainError("A nova senha deve ser diferente da senha temporária.", status.HTTP_422_UNPROCESSABLE_ENTITY)
    owner.hashed_password = hash_password(new_password)
    owner.must_change_password = False
    owner.token_version = int(owner.token_version or 0) + 1
    db.add(AuditLog(
        actor_user_id=owner.id,
        action="owner_required_password_changed",
        entity_type="user",
        entity_id=str(owner.id),
        details={},
    ))
    try:
        db.commit()
        db.refresh(owner)
        token_response = build_token_response(owner)
        refresh_token = build_refresh_token(db, owner, True)
        return token_response, refresh_token
    except Exception as exc:
        db.rollback()
        raise DomainError("Unable to change password", status.HTTP_500_INTERNAL_SERVER_ERROR) from exc

def refresh_session(db: Session, refresh_token: str, expected_context: str | None = None) -> tuple[TokenResponse, str]:
    try:
        payload = decode_refresh_token(refresh_token)
        user_id = uuid.UUID(str(payload.get("sub")))
    except (ValueError, TypeError):
        raise DomainError("Sessão expirada. Entre novamente.", status.HTTP_401_UNAUTHORIZED)

    jti = str(payload.get("jti") or "")
    if not jti:
        raise DomainError("Sessão expirada. Entre novamente.", status.HTTP_401_UNAUTHORIZED)

    if not hasattr(db, "execute"):
        if jti in REVOKED_REFRESH_JTIS:
            raise DomainError("Sessão expirada. Entre novamente.", status.HTTP_401_UNAUTHORIZED)
        user = db.get(User, user_id)
        if not user or not user.is_active or int(payload.get("token_version", 0)) != int(user.token_version or 0):
            raise DomainError("Sessão expirada. Entre novamente.", status.HTTP_401_UNAUTHORIZED)
        expected_roles = {"owner": {UserRole.OWNER}, "personal": {UserRole.PERSONAL}, "student": {UserRole.STUDENT}}
        if expected_context and user.role not in expected_roles.get(expected_context, set()):
            raise DomainError("Sessão incompatível com este acesso.", status.HTTP_401_UNAUTHORIZED)
        REVOKED_REFRESH_JTIS.add(jti)
        return build_token_response(user), build_refresh_token(db, user, bool(payload.get("persistent", True)))

    now = datetime.now(timezone.utc)
    session = db.scalar(
        select(RefreshTokenSession)
        .where(RefreshTokenSession.jti_hash == _jti_hash(jti))
        .with_for_update()
    )
    if not session or session.consumed_at or session.revoked_at or _aware(session.expires_at) <= now:
        raise DomainError("Sessão expirada. Entre novamente.", status.HTTP_401_UNAUTHORIZED)

    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise DomainError("Sessão expirada. Entre novamente.", status.HTTP_401_UNAUTHORIZED)
    if int(payload.get("token_version", 0)) != int(user.token_version or 0):
        raise DomainError("Sessão expirada. Entre novamente.", status.HTTP_401_UNAUTHORIZED)
    expected_roles = {
        "owner": {UserRole.OWNER},
        "personal": {UserRole.PERSONAL},
        "student": {UserRole.STUDENT},
    }
    if expected_context and user.role not in expected_roles.get(expected_context, set()):
        raise DomainError("Sessão incompatível com este acesso.", status.HTTP_401_UNAUTHORIZED)
    if session.user_id != user.id or session.context != user.role.value:
        raise DomainError("Sessão incompatível com este acesso.", status.HTTP_401_UNAUTHORIZED)

    session.consumed_at = now
    rotated = build_refresh_token(db, user, bool(session.persistent))
    db.execute(
        delete(RefreshTokenSession)
        .where(RefreshTokenSession.expires_at <= now)
        .execution_options(synchronize_session=False)
    )
    db.commit()
    return build_token_response(user), rotated


def revoke_refresh_token(db: Session, refresh_token: str | None) -> None:
    if not refresh_token:
        return
    try:
        payload = decode_refresh_token(refresh_token)
    except ValueError:
        return
    jti = str(payload.get("jti") or "")
    if not jti:
        return
    session = db.scalar(
        select(RefreshTokenSession)
        .where(RefreshTokenSession.jti_hash == _jti_hash(jti))
        .with_for_update()
    )
    if session and session.revoked_at is None:
        session.revoked_at = datetime.now(timezone.utc)
        db.commit()


def get_connected_devices(user: User) -> list[dict[str, str | bool]]:
    latest = next((item for item in reversed(LOGIN_HISTORY) if item.get("user_id") == str(user.id)), None)
    return [
        {
            "device": "Sessão atual",
            "browser": "Navegador/PWA",
            "last_access": latest["at"] if latest else datetime.now(timezone.utc).isoformat(),
            "location": "Localização aproximada indisponivel",
            "current": True,
        }
    ]
