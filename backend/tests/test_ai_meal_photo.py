import io
import uuid

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user
from app.core.config import Settings
from app.db.session import Base, get_db
from app.main import app
from app.models.ai_audit import AIAuditLog
from app.models.personal_branding import PersonalBranding
from app.models.student import Student
from app.models.user import User, UserRole
from app.schemas.ai import AIErrorCode, AIProviderResult
from app.services.ai.errors import AIServiceError
from app.services.ai.providers.base import AIProvider
from app.services.ai.service import AIService


class VisionProvider(AIProvider):
    name = "fake-vision"
    model = "fake-model"

    def __init__(self):
        self.response = {
            "foods": [
                {"name": "Arroz", "estimated_amount": 138, "unit": "g", "confidence": "high"},
                {"name": "Feijão", "range_min": 75, "range_max": 115, "unit": "g", "confidence": "medium", "note": "Parte coberta."},
            ],
            "overall_confidence": "medium",
            "limitations": ["O tamanho do prato não é conhecido."],
        }
        self.error = None
        self.calls = []

    @property
    def configured(self):
        return True

    def generate_structured(self, **kwargs):
        raise AssertionError("text generation is not used")

    def analyze_image(self, *, instructions, image_bytes, mime_type, response_model):
        self.calls.append({"instructions": instructions, "image_bytes": image_bytes, "mime_type": mime_type})
        if self.error:
            raise self.error
        return AIProviderResult(data=self.response, input_tokens=3, output_tokens=2)


def image_bytes(image_format="PNG"):
    buffer = io.BytesIO()
    Image.new("RGB", (24, 24), (210, 150, 80)).save(buffer, format=image_format)
    return buffer.getvalue()


@pytest.fixture()
def context(monkeypatch):
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = Session(engine)
    personal = User(id=uuid.uuid4(), name="Personal", email="personal@example.test", hashed_password="x", role=UserRole.PERSONAL)
    owner = User(id=uuid.uuid4(), name="Owner", email="owner@example.test", hashed_password="x", role=UserRole.OWNER)
    student_user = User(id=uuid.uuid4(), name="Student Private Name", email="private.student@example.test", hashed_password="x", role=UserRole.STUDENT)
    other_personal = User(id=uuid.uuid4(), name="Other", email="other@example.test", hashed_password="x", role=UserRole.PERSONAL)
    db.add_all([personal, owner, student_user, other_personal]); db.flush()
    student = Student(personal_id=personal.id, user_id=student_user.id, name="Student Private Name", email="private.student@example.test")
    db.add_all([
        student,
        PersonalBranding(personal_id=personal.id, display_name="Tenant A", slug="tenant-a", modules={"diet": True}),
        PersonalBranding(personal_id=other_personal.id, display_name="Tenant B", slug="tenant-b", modules={"diet": True}),
    ]); db.commit()
    provider = VisionProvider()
    config = Settings(_env_file=None, DATABASE_URL="sqlite+pysqlite:///:memory:", SECRET_KEY="x" * 32, AI_DAILY_LIMIT=10)
    monkeypatch.setattr("app.api.routes.ai.AIService", lambda session: AIService(session, provider=provider, config=config))
    current = {"user": student_user}
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: current["user"]
    yield TestClient(app), db, current, personal, owner, student_user, student, provider, config
    app.dependency_overrides.clear()
    db.close()


def post_photo(client, data=None, filename="meal.png", mime="image/png"):
    return client.post("/api/ai/student/meal-photo-analysis", files={"photo": (filename, data or image_bytes(), mime)})


def test_valid_ephemeral_analysis_is_scoped_sanitized_and_approximate(context, caplog):
    client, db, _current, personal, _owner, student_user, student, provider, _config = context
    with caplog.at_level("INFO", logger="app.services.ai.service"):
        response = post_photo(client)
    assert response.status_code == 200
    body = response.json()
    assert body["foods"][0]["estimated_amount"] == 140
    assert body["foods"][1]["range_min"] == 75 and body["foods"][1]["range_max"] == 115
    assert "estimativas visuais" in body["disclaimer"]
    assert "calorie" not in response.text.lower() and "macro" not in response.text.lower()
    assert len(provider.calls) == 1 and provider.calls[0]["mime_type"] == "image/png"
    serialized_call = str(provider.calls[0])
    assert student_user.email not in serialized_call and student.name not in serialized_call
    audit = db.scalar(select(AIAuditLog))
    assert (audit.personal_id, audit.student_id, audit.user_id) == (personal.id, student.id, student_user.id)
    assert not hasattr(audit, "image_bytes")
    logs = caplog.text
    assert "meal_photo_ai_requested" in logs and "meal_photo_ai_completed" in logs and "item_count=2" in logs
    assert student_user.email not in logs and student.name not in logs and "image_bytes" not in logs


def test_no_food_and_uncertain_food_are_valid(context):
    client, *_values, provider, _config = context
    provider.response = {"foods": [], "overall_confidence": "low", "limitations": ["Nenhum alimento visível."]}
    assert post_photo(client).json()["foods"] == []
    provider.response = {"foods": [{"name": "Alimento parcialmente visível", "estimated_amount": None, "unit": None, "confidence": "low", "note": "Sem escala visual."}], "overall_confidence": "low", "limitations": []}
    body = post_photo(client).json()
    assert body["foods"][0]["estimated_amount"] is None


@pytest.mark.parametrize("filename,mime,data,status", [
    ("meal.svg", "image/svg+xml", b"<svg></svg>", 415),
    ("meal.png", "image/png", b"<html>not an image</html>", 415),
    ("meal.png", "image/jpeg", image_bytes("PNG"), 415),
])
def test_upload_validation_blocks_unsafe_content(context, filename, mime, data, status):
    client, *_rest, provider, _config = context
    assert post_photo(client, data, filename, mime).status_code == status
    assert provider.calls == []


def test_upload_larger_than_five_megabytes_is_blocked(context):
    client, *_rest, provider, _config = context
    data = b"\x89PNG\r\n\x1a\n" + b"x" * (5 * 1024 * 1024)
    assert post_photo(client, data).status_code == 413
    assert provider.calls == []


def test_role_module_and_missing_profile_are_blocked(context):
    client, db, current, personal, owner, student_user, _student, provider, _config = context
    current["user"] = personal
    assert post_photo(client).status_code == 403
    current["user"] = owner
    assert post_photo(client).status_code == 403
    current["user"] = student_user
    branding = db.scalar(select(PersonalBranding).where(PersonalBranding.personal_id == personal.id))
    branding.modules = {"diet": False}; db.commit()
    response = post_photo(client)
    assert response.status_code == 403 and response.json()["detail"] == {"code": "module_disabled", "module": "diet"}
    assert provider.calls == []


@pytest.mark.parametrize("error,code,status", [
    (AIServiceError(AIErrorCode.TIMEOUT, "timeout"), AIErrorCode.TIMEOUT, 504),
    (AIServiceError(AIErrorCode.UNAVAILABLE, "unavailable"), AIErrorCode.UNAVAILABLE, 503),
    (AIServiceError(AIErrorCode.INVALID_RESPONSE, "invalid"), AIErrorCode.INVALID_RESPONSE, 503),
])
def test_provider_failures_are_sanitized(context, error, code, status):
    client, *_values, provider, _config = context
    provider.error = error
    response = post_photo(client)
    assert response.status_code == status and response.json()["code"] == code
    assert "private.student" not in response.text and "key" not in response.text.lower()


def test_invalid_schema_and_daily_quota_are_enforced(context):
    client, db, _current, _personal, _owner, _student_user, _student, provider, config = context
    provider.response = {"foods": [{"name": "Rice", "estimated_amount": 100, "confidence": "high"}], "overall_confidence": "high", "limitations": []}
    invalid = post_photo(client)
    assert invalid.status_code == 503 and invalid.json()["code"] == AIErrorCode.INVALID_RESPONSE
    assert db.scalar(select(func.count(AIAuditLog.id))) == 1
    provider.response = {"foods": [], "overall_confidence": "low", "limitations": []}
    config.AI_DAILY_LIMIT = 1
    limited = post_photo(client)
    assert limited.status_code == 429 and limited.json()["code"] == AIErrorCode.RATE_LIMITED


def test_endpoint_has_no_client_student_or_tenant_identifier(context):
    client, *_rest, provider, _config = context
    response = client.post(
        "/api/ai/student/meal-photo-analysis",
        data={"student_id": str(uuid.uuid4()), "personal_id": str(uuid.uuid4())},
        files={"photo": ("meal.png", image_bytes(), "image/png")},
    )
    assert response.status_code == 200 and len(provider.calls) == 1
