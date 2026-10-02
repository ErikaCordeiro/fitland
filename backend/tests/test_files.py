import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import Base, get_db
from app.main import app
from app.models.audit_log import AuditLog
from app.models.personal_branding import PersonalBranding
from app.models.student import Student
from app.models.student_file import StudentFile
from app.models.user import User, UserRole
from app.services.private_file_storage import MAX_PRIVATE_FILE_BYTES, resolve_storage_key, validate_original_filename


def make_user(role, name):
    return User(id=uuid.uuid4(), name=name, email=f"{uuid.uuid4()}@test.dev", hashed_password="x", role=role, is_active=True, account_status="active")


@pytest.fixture()
def context(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "UPLOADS_DIR", tmp_path)
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine); db = Session(engine)
    personal, other = make_user(UserRole.PERSONAL, "Personal"), make_user(UserRole.PERSONAL, "Other")
    student_user, foreign_user = make_user(UserRole.STUDENT, "Student"), make_user(UserRole.STUDENT, "Foreign")
    db.add_all([personal, other, student_user, foreign_user]); db.flush()
    student = Student(personal_id=personal.id, user_id=student_user.id, name="Ana", email=student_user.email, age=30, weight=70, height=1.7, objective="Saúde")
    foreign = Student(personal_id=other.id, user_id=foreign_user.id, name="Bia", email=foreign_user.email, age=31, weight=71, height=1.7, objective="Força")
    db.add_all([student, foreign]); db.flush()
    db.add_all([PersonalBranding(personal_id=personal.id, display_name="P", slug="p", modules={"files": True}), PersonalBranding(personal_id=other.id, display_name="O", slug="o", modules={"files": True})]); db.commit()
    app.dependency_overrides[get_db] = lambda: db
    yield db, personal, other, student_user, foreign_user, student, foreign, tmp_path
    app.dependency_overrides.clear(); db.close(); engine.dispose()


def client(actor):
    app.dependency_overrides[get_current_user] = lambda: actor
    return TestClient(app)


def png():
    return b"\x89PNG\r\n\x1a\n" + b"safe-image"


def upload(api, student_id, content=None, filename="documento.png", content_type="image/png", **fields):
    data = {"student_id": str(student_id), "category": "document", "visible_to_student": "false", **fields}
    return api.post("/api/files", data=data, files={"file": (filename, content if content is not None else png(), content_type)})


def test_upload_persists_private_metadata_and_never_public_path(context):
    db, personal, _, _, _, student, _, root = context
    response = upload(client(personal), student.id, title="Documento", visible_to_student="true")
    assert response.status_code == 201
    row = db.scalar(select(StudentFile))
    assert row.personal_id == personal.id and row.student_id == student.id
    assert row.storage_key.startswith(f"private/{personal.id}/{student.id}/")
    assert str(root) not in row.storage_key and resolve_storage_key(row.storage_key).read_bytes() == png()
    audit = db.scalar(select(AuditLog).where(AuditLog.action == "student_file_uploaded"))
    assert row.original_filename not in str(audit.details) and row.storage_key not in str(audit.details)
    assert client(personal).get(f"/uploads/{row.storage_key}").status_code == 404


def test_student_only_lists_and_downloads_explicitly_visible_own_files(context):
    _, personal, _, student_user, foreign_user, student, _, _ = context
    api = client(personal)
    hidden = upload(api, student.id).json()
    visible = upload(api, student.id, filename="visivel.pdf", content=b"%PDF-1.7\ncontent", content_type="application/pdf", visible_to_student="true").json()
    student_api = client(student_user)
    assert [item["id"] for item in student_api.get("/api/files").json()] == [visible["id"]]
    downloaded = student_api.get(f"/api/files/{visible['id']}/download")
    assert downloaded.status_code == 200 and downloaded.content.startswith(b"%PDF-")
    assert downloaded.headers["cache-control"] == "private, no-store"
    assert student_api.get(f"/api/files/{hidden['id']}/download").status_code == 403
    assert client(foreign_user).get(f"/api/files/{visible['id']}/download").status_code == 403


def test_cross_tenant_write_and_student_mutation_are_blocked(context):
    _, personal, other, student_user, _, student, foreign, _ = context
    own = upload(client(personal), student.id).json()
    assert upload(client(personal), foreign.id).status_code == 403
    assert client(other).patch(f"/api/files/{own['id']}", json={"visible_to_student": True}).status_code == 403
    assert client(student_user).delete(f"/api/files/{own['id']}").status_code == 403


@pytest.mark.parametrize("filename,content_type,content", [
    ("evil.svg", "image/svg+xml", b"<svg/>"),
    ("fake.png", "image/png", b"not-png"),
    ("../escape.pdf", "application/pdf", b"%PDF-1.7"),
    ("empty.pdf", "application/pdf", b""),
])
def test_rejects_unsafe_type_spoof_traversal_and_empty(context, filename, content_type, content):
    _, personal, _, _, _, student, _, root = context
    response = upload(client(personal), student.id, filename=filename, content_type=content_type, content=content)
    assert response.status_code in {415, 422}
    assert not list((root / "private").rglob("*.tmp-*")) if (root / "private").exists() else True


def test_size_limit_and_module_flag(context):
    db, personal, _, _, _, student, _, root = context
    oversized = b"\x89PNG\r\n\x1a\n" + b"x" * MAX_PRIVATE_FILE_BYTES
    assert upload(client(personal), student.id, content=oversized).status_code == 413
    assert not list((root / "private").rglob("*.png")) if (root / "private").exists() else True
    branding = db.scalar(select(PersonalBranding).where(PersonalBranding.personal_id == personal.id)); branding.modules = {"files": False}; db.commit()
    disabled = client(personal).get(f"/api/files?student_id={student.id}")
    assert disabled.status_code == 403 and disabled.json()["detail"] == {"code": "module_disabled", "module": "files"}


def test_delete_missing_physical_file_preserves_metadata(context):
    db, personal, _, _, _, student, _, _ = context
    created = upload(client(personal), student.id).json(); row = db.get(StudentFile, uuid.UUID(created["id"])); resolve_storage_key(row.storage_key).unlink()
    response = client(personal).delete(f"/api/files/{row.id}")
    assert response.status_code == 409 and db.get(StudentFile, row.id) is not None


def test_duplicate_original_names_use_distinct_storage_keys_and_delete_consistently(context):
    db, personal, _, _, _, student, _, _ = context; api = client(personal)
    first = upload(api, student.id, filename="mesmo.png").json(); second = upload(api, student.id, filename="mesmo.png").json()
    rows = list(db.scalars(select(StudentFile).order_by(StudentFile.created_at)).all())
    assert len(rows) == 2 and rows[0].original_filename == rows[1].original_filename and rows[0].storage_key != rows[1].storage_key
    first_path = resolve_storage_key(rows[0].storage_key)
    assert api.delete(f"/api/files/{first['id']}").status_code == 204
    assert not first_path.exists() and db.get(StudentFile, uuid.UUID(first["id"])) is None and db.get(StudentFile, uuid.UUID(second["id"])) is not None


@pytest.mark.parametrize("filename,content_type,content,expected", [
    ("a" * 252 + ".pdf", "application/pdf", b"%PDF-1.7", 422),
    ("programa.exe.pdf", "application/pdf", b"MZ executable", 415),
    ("<script>alert(1)<script>.pdf", "application/pdf", b"%PDF-1.7", 201),
    ("orientação.pdf", "application/pdf", b"%PDF-1.7", 201),
])
def test_filename_security_unicode_double_extension_and_xss(context, filename, content_type, content, expected):
    _, personal, _, _, _, student, _, _ = context
    response = upload(client(personal), student.id, filename=filename, content_type=content_type, content=content)
    assert response.status_code == expected
    if expected == 201:
        downloaded = client(personal).get(f"/api/files/{response.json()['id']}/download")
        assert downloaded.status_code == 200 and "<script>" not in downloaded.headers["content-disposition"].split("filename*=", 1)[0]


@pytest.mark.parametrize("filename", ["C:\\Windows\\system.pdf", "/etc/passwd", "..\\escape.pdf", "../escape.pdf"])
def test_raw_absolute_and_traversal_filenames_are_rejected(filename):
    with pytest.raises(Exception) as error:
        validate_original_filename(filename)
    assert error.value.status_code == 422


def test_database_failure_removes_stored_file(context, monkeypatch):
    db, personal, _, _, _, student, _, root = context
    original_commit = db.commit
    monkeypatch.setattr(db, "commit", lambda: (_ for _ in ()).throw(RuntimeError("db unavailable")))
    api = TestClient(app, raise_server_exceptions=False)
    app.dependency_overrides[get_current_user] = lambda: personal
    response = upload(api, student.id)
    monkeypatch.setattr(db, "commit", original_commit)
    assert response.status_code == 500
    assert not list((root / "private").rglob("*.png"))
