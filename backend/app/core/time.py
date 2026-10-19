from datetime import datetime, timezone


def utc_now() -> datetime:
    """Return a naive UTC value for legacy database columns without utcnow()."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
