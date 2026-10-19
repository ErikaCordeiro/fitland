import uuid

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.security import decode_refresh_token, hash_password
from app.db.session import Base
from app.main import apply_security_headers
from app.models.auth_state import RateLimitBucket, RefreshTokenSession
from app.models.user import User, UserRole
from app.services.auth_service import build_refresh_token, refresh_session, revoke_refresh_token
from app.services.rate_limit_service import is_limited, register_attempt


def database():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return engine


def user():
    return User(
        id=uuid.uuid4(), name="Personal Teste", email="personal@test.dev",
        hashed_password=hash_password("ValidPass123!"), role=UserRole.PERSONAL,
        is_active=True, account_status="active", token_version=0,
    )


def test_refresh_rotation_and_revocation_survive_new_database_sessions():
    engine = database()
    with Session(engine) as db:
        actor = user()
        db.add(actor); db.flush()
        original = build_refresh_token(db, actor, True)
        db.commit()
        actor_id = actor.id

    with Session(engine) as db:
        response, rotated = refresh_session(db, original, "personal")
        assert response.user.id == actor_id
        assert decode_refresh_token(rotated)["persistent"] is True

    with Session(engine) as db:
        try:
            refresh_session(db, original, "personal")
            assert False, "a consumed refresh token must not be reusable"
        except Exception as exc:
            assert getattr(exc, "status_code", None) == 401
        revoke_refresh_token(db, rotated)

    with Session(engine) as db:
        try:
            refresh_session(db, rotated, "personal")
            assert False, "a revoked refresh token must remain revoked"
        except Exception as exc:
            assert getattr(exc, "status_code", None) == 401
        rows = list(db.scalars(select(RefreshTokenSession)))
        assert len(rows) == 2
        assert all(row.jti_hash not in {original, rotated} for row in rows)


def test_rate_limit_bucket_is_shared_between_database_sessions_and_hides_key():
    engine = database()
    sensitive_key = "person@example.com"
    with Session(engine) as db:
        register_attempt(db, "auth_login", sensitive_key, 900)
    with Session(engine) as db:
        register_attempt(db, "auth_login", sensitive_key, 900)
    with Session(engine) as db:
        assert is_limited(db, "auth_login", sensitive_key, 2)
        bucket = db.scalar(select(RateLimitBucket))
        assert bucket.attempts == 2
        assert sensitive_key not in bucket.bucket_hash


def test_security_headers_are_added_without_exposing_credentials():
    from starlette.datastructures import MutableHeaders

    raw = []
    apply_security_headers(MutableHeaders(raw=raw))
    headers = {key.decode().lower(): value.decode() for key, value in raw}
    assert headers["x-content-type-options"] == "nosniff"
    assert headers["x-frame-options"] == "DENY"
    assert "frame-ancestors 'none'" in headers["content-security-policy"]
    assert set(headers).isdisjoint({"authorization", "cookie", "set-cookie"})
