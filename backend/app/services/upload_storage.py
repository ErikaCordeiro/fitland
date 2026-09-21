import uuid
import re
from pathlib import Path
from urllib.parse import urlsplit

from fastapi import HTTPException, Request

from app.core.config import settings


ALLOWED_IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_IMAGE_BYTES = 3 * 1024 * 1024
UPLOAD_PREFIX = "/uploads/"
SAFE_HOST = re.compile(r"^[A-Za-z0-9.-]+(?::[0-9]{1,5})?$")


def branding_upload_dir() -> Path:
    directory = settings.UPLOADS_DIR / "branding"
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def relative_upload_reference(value: str | None) -> str | None:
    if not value:
        return value
    path = urlsplit(value).path
    if not path.startswith(UPLOAD_PREFIX):
        return value
    relative = Path(path.removeprefix(UPLOAD_PREFIX))
    if relative.is_absolute() or ".." in relative.parts:
        raise ValueError("Invalid upload reference")
    return f"{UPLOAD_PREFIX}{relative.as_posix()}"


def public_asset_url(request: Request, value: str | None) -> str | None:
    reference = relative_upload_reference(value)
    if not reference or not reference.startswith(UPLOAD_PREFIX):
        return reference
    asset_path = reference.removeprefix(UPLOAD_PREFIX)
    url = request.url_for("uploads", path=asset_path)
    forwarded_proto = request.headers.get("x-forwarded-proto", "").split(",", 1)[0].strip().lower()
    if forwarded_proto in {"http", "https"}:
        url = url.replace(scheme=forwarded_proto)
    forwarded_host = request.headers.get("x-forwarded-host", "").split(",", 1)[0].strip()
    if forwarded_host and SAFE_HOST.fullmatch(forwarded_host):
        url = url.replace(netloc=forwarded_host)
    return str(url)


def public_branding_assets(request: Request, branding: dict) -> dict:
    result = dict(branding)
    for field in ("logo_url", "profile_image_url", "icon_url", "banner_url"):
        result[field] = public_asset_url(request, result.get(field))
    return result


def store_branding_image(personal_id: uuid.UUID, asset_type: str, mime: str, content: bytes) -> str:
    extension = ALLOWED_IMAGE_TYPES.get(mime)
    if not extension:
        raise HTTPException(status_code=415, detail="Envie uma imagem JPG, PNG ou WebP")
    if not content or len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="A imagem deve ter até 3 MB")
    filename = f"{personal_id}-{asset_type}-{uuid.uuid4().hex}{extension}"
    (branding_upload_dir() / filename).write_bytes(content)
    return f"{UPLOAD_PREFIX}branding/{filename}"
