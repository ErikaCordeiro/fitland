import hashlib
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.auth_state import RateLimitBucket


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _bucket_hash(scope: str, key: str) -> str:
    return hashlib.sha256(f"{scope}:{key}".encode("utf-8")).hexdigest()


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def is_limited(db: Session, scope: str, key: str, limit: int) -> bool:
    now = _now()
    bucket = db.get(RateLimitBucket, _bucket_hash(scope, key))
    return bool(bucket and _aware(bucket.expires_at) > now and bucket.attempts >= limit)


def register_attempt(db: Session, scope: str, key: str, window_seconds: int, *, commit: bool = True) -> int:
    now = _now()
    digest = _bucket_hash(scope, key)
    db.execute(
        delete(RateLimitBucket)
        .where(RateLimitBucket.expires_at <= now)
        .execution_options(synchronize_session=False)
    )
    bucket = db.scalar(select(RateLimitBucket).where(RateLimitBucket.bucket_hash == digest).with_for_update())
    if bucket:
        bucket.attempts += 1
        bucket.updated_at = now
    else:
        bucket = RateLimitBucket(
            bucket_hash=digest,
            scope=scope,
            attempts=1,
            expires_at=now + timedelta(seconds=window_seconds),
            updated_at=now,
        )
        db.add(bucket)
    try:
        db.commit() if commit else db.flush()
    except IntegrityError:
        db.rollback()
        bucket = db.scalar(select(RateLimitBucket).where(RateLimitBucket.bucket_hash == digest).with_for_update())
        if not bucket:
            raise
        bucket.attempts += 1
        bucket.updated_at = now
        db.commit() if commit else db.flush()
    return bucket.attempts


def clear_attempts(db: Session, scope: str, key: str) -> None:
    db.execute(delete(RateLimitBucket).where(RateLimitBucket.bucket_hash == _bucket_hash(scope, key)))
    db.commit()
