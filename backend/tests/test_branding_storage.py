import uuid

import pytest
from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.testclient import TestClient

from app.core.config import Settings, settings
from app.services.upload_storage import (
    MAX_IMAGE_BYTES,
    branding_upload_dir,
    public_asset_url,
    relative_upload_reference,
    store_branding_image,
)


def storage_app(root):
    app = FastAPI()
    app.mount("/uploads", StaticFiles(directory=root), name="uploads")

    @app.get("/resolve")
    def resolve(request: Request):
        return {"url": public_asset_url(request, "/uploads/branding/logo.png")}

    return app


def test_uploads_dir_accepts_environment_configuration(tmp_path):
    configured = Settings(_env_file=None, UPLOADS_DIR=str(tmp_path))
    assert configured.UPLOADS_DIR == tmp_path


def test_branding_upload_persists_relative_reference(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "UPLOADS_DIR", tmp_path)
    personal_id = uuid.uuid4()
    reference = store_branding_image(personal_id, "logo", "image/png", b"png-content")
    assert reference.startswith(f"/uploads/branding/{personal_id}-logo-")
    assert reference.endswith(".png")
    stored = branding_upload_dir() / reference.rsplit("/", 1)[-1]
    assert stored.read_bytes() == b"png-content"


def test_legacy_absolute_upload_url_becomes_environment_relative_reference():
    legacy = "http://localhost:8010/uploads/branding/tenant-logo.png"
    assert relative_upload_reference(legacy) == "/uploads/branding/tenant-logo.png"
    assert relative_upload_reference("https://cdn.example.com/logo.png") == "https://cdn.example.com/logo.png"


def test_public_url_uses_forwarded_https_and_host(tmp_path):
    (tmp_path / "branding").mkdir()
    client = TestClient(storage_app(tmp_path))
    response = client.get(
        "/resolve",
        headers={
            "host": "internal.railway:8000",
            "x-forwarded-proto": "https",
            "x-forwarded-host": "personal.example.up.railway.app",
        },
    )
    assert response.status_code == 200
    assert response.json()["url"] == "https://personal.example.up.railway.app/uploads/branding/logo.png"
    assert "localhost" not in response.json()["url"]
    assert "127.0.0.1" not in response.json()["url"]


def test_static_serving_returns_image_mime_and_blocks_traversal(tmp_path):
    branding = tmp_path / "branding"
    branding.mkdir()
    (branding / "logo.png").write_bytes(b"not-empty")
    client = TestClient(storage_app(tmp_path))
    image = client.get("/uploads/branding/logo.png")
    assert image.status_code == 200
    assert image.headers["content-type"] == "image/png"
    assert image.content == b"not-empty"
    assert client.get("/uploads/../pyproject.toml").status_code == 404


@pytest.mark.parametrize("mime,extension", [
    ("image/jpeg", ".jpg"),
    ("image/png", ".png"),
    ("image/webp", ".webp"),
])
def test_allowed_branding_formats(monkeypatch, tmp_path, mime, extension):
    monkeypatch.setattr(settings, "UPLOADS_DIR", tmp_path)
    assert store_branding_image(uuid.uuid4(), "icon", mime, b"image").endswith(extension)


def test_invalid_format_and_size_limit_are_preserved(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "UPLOADS_DIR", tmp_path)
    with pytest.raises(HTTPException) as invalid:
        store_branding_image(uuid.uuid4(), "logo", "image/svg+xml", b"svg")
    assert invalid.value.status_code == 415
    with pytest.raises(HTTPException) as oversized:
        store_branding_image(uuid.uuid4(), "logo", "image/png", b"x" * (MAX_IMAGE_BYTES + 1))
    assert oversized.value.status_code == 413
