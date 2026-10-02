import hashlib
import os
import re
import uuid
from pathlib import Path, PureWindowsPath

from fastapi import HTTPException, UploadFile

from app.core.config import settings


MAX_PRIVATE_FILE_BYTES = 10 * 1024 * 1024
CHUNK_SIZE = 256 * 1024
ALLOWED_TYPES = {
    "application/pdf": {"extensions": {".pdf"}, "signature": lambda data: data.startswith(b"%PDF-")},
    "image/jpeg": {"extensions": {".jpg", ".jpeg"}, "signature": lambda data: data.startswith(b"\xff\xd8\xff")},
    "image/png": {"extensions": {".png"}, "signature": lambda data: data.startswith(b"\x89PNG\r\n\x1a\n")},
    "image/webp": {"extensions": {".webp"}, "signature": lambda data: len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP"},
}
SAFE_KEY = re.compile(r"^private/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f]{32}\.(?:pdf|jpg|jpeg|png|webp)$")


def private_upload_root() -> Path:
    root = settings.UPLOADS_DIR / "private"
    root.mkdir(parents=True, exist_ok=True)
    return root


def validate_original_filename(filename: str | None) -> str:
    value = (filename or "").strip()
    if not value or len(value) > 255 or "\x00" in value or "\r" in value or "\n" in value:
        raise HTTPException(status_code=422, detail="Nome de arquivo inválido")
    if Path(value).is_absolute() or PureWindowsPath(value).is_absolute() or "/" in value or "\\" in value or ".." in Path(value).parts:
        raise HTTPException(status_code=422, detail="Nome de arquivo inválido")
    return value


def resolve_storage_key(storage_key: str) -> Path:
    if not SAFE_KEY.fullmatch(storage_key):
        raise HTTPException(status_code=500, detail="Referência de arquivo inválida")
    root = settings.UPLOADS_DIR.resolve()
    path = (settings.UPLOADS_DIR / storage_key).resolve()
    if root not in path.parents:
        raise HTTPException(status_code=500, detail="Referência de arquivo inválida")
    return path


async def store_private_upload(upload: UploadFile, personal_id: uuid.UUID, student_id: uuid.UUID) -> dict:
    original = validate_original_filename(upload.filename)
    declared = (upload.content_type or "").lower()
    allowed = ALLOWED_TYPES.get(declared)
    suffix = Path(original).suffix.lower()
    if not allowed or suffix not in allowed["extensions"]:
        raise HTTPException(status_code=415, detail="Envie um arquivo PDF, JPG, PNG ou WebP")

    storage_key = f"private/{personal_id}/{student_id}/{uuid.uuid4().hex}{suffix}"
    final_path = resolve_storage_key(storage_key)
    final_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = final_path.with_name(f".{final_path.name}.tmp-{uuid.uuid4().hex}")
    total = 0
    digest = hashlib.sha256()
    signature = b""
    try:
        with temp_path.open("xb") as handle:
            while chunk := await upload.read(CHUNK_SIZE):
                total += len(chunk)
                if total > MAX_PRIVATE_FILE_BYTES:
                    raise HTTPException(status_code=413, detail="O arquivo deve ter no máximo 10 MB")
                signature = (signature + chunk)[:16]
                digest.update(chunk)
                handle.write(chunk)
        if total == 0:
            raise HTTPException(status_code=422, detail="O arquivo está vazio")
        if not allowed["signature"](signature):
            raise HTTPException(status_code=415, detail="O conteúdo do arquivo não corresponde ao formato informado")
        os.replace(temp_path, final_path)
        return {"original_filename": original, "storage_key": storage_key, "mime_type": declared, "size_bytes": total, "sha256": digest.hexdigest(), "path": final_path}
    except Exception:
        temp_path.unlink(missing_ok=True)
        final_path.unlink(missing_ok=True)
        raise
