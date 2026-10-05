import uuid
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import Base, get_db
from app.main import app
from app.models.personal_branding import PersonalBranding
from app.models.progress import ProgressLog
from app.models.student import Student
from app.models.student_file import StudentFile
from app.models.user import User, UserRole
from app.services.private_file_storage import MAX_PRIVATE_FILE_BYTES, resolve_storage_key


def user(role):
    return User(id=uuid.uuid4(), name=role.value, email=f"{uuid.uuid4()}@test.dev", hashed_password="x", role=role, is_active=True, account_status="active")


@pytest.fixture()
def context(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "UPLOADS_DIR", tmp_path)
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = Session(engine)
    personal, other, student_user, other_student_user = user(UserRole.PERSONAL), user(UserRole.PERSONAL), user(UserRole.STUDENT), user(UserRole.STUDENT)
    db.add_all([personal, other, student_user, other_student_user]); db.flush()
    own = Student(personal_id=personal.id, user_id=student_user.id, name="Own", email=student_user.email, age=30, weight=80, height=1.7, objective="Saúde")
    foreign = Student(personal_id=other.id, user_id=other_student_user.id, name="Foreign", email=other_student_user.email, age=31, weight=75, height=1.8, objective="Força")
    db.add_all([own, foreign]); db.flush()
    db.add_all([
        PersonalBranding(personal_id=personal.id, display_name="A", slug="a", modules={"assessments": True, "progress": True, "workouts": True}),
        PersonalBranding(personal_id=other.id, display_name="B", slug="b", modules={"assessments": True, "progress": True, "workouts": True}),
    ]); db.commit()
    app.dependency_overrides[get_db] = lambda: db
    yield db, personal, other, student_user, own, foreign
    app.dependency_overrides.clear(); db.close()


def client(user_row):
    app.dependency_overrides[get_current_user] = lambda: user_row
    return TestClient(app)


def payload(student_id, day="2026-09-01", weight=80):
    return {"student_id": str(student_id), "assessment_date": day, "weight": weight, "height": 170, "waist": 90, "body_fat_percentage": 25}


def image_upload(api, assessment_id, *, content=None, filename="frente.png", content_type="image/png", photo_type="front", visible="false"):
    content = content if content is not None else b"\x89PNG\r\n\x1a\nprivate-photo"
    return api.post(f"/api/assessments/{assessment_id}/photos", data={"photo_type": photo_type, "description": "Evolução", "visible_to_student": visible}, files={"file": (filename, content, content_type)})


def test_personal_crud_preserves_history_and_comparison(context):
    _, personal, _, _, own, _ = context; api = client(personal)
    first = api.post("/api/assessments", json=payload(own.id)).json()
    second_response = api.post("/api/assessments", json=payload(own.id, "2026-10-01", 78))
    assert second_response.status_code == 201
    second = second_response.json()
    rows = api.get(f"/api/assessments?student_id={own.id}").json()
    assert [row["id"] for row in rows] == [second["id"], first["id"]]
    detail = api.get(f"/api/assessments/{second['id']}").json()
    assert detail["previous"]["id"] == first["id"] and detail["differences"]["weight"] == -2
    updated = api.patch(f"/api/assessments/{second['id']}", json={"waist": 87}).json()
    assert updated["waist"] == 87 and len(api.get(f"/api/assessments?student_id={own.id}").json()) == 2
    assert api.delete(f"/api/assessments/{first['id']}").status_code == 204
    assert len(api.get(f"/api/assessments?student_id={own.id}").json()) == 1


def test_forearms_and_glutes_persist_edit_and_reach_progress(context):
    _, personal, _, student_user, own, _ = context; api = client(personal)
    data = payload(own.id); data.update(right_forearm=28, left_forearm=27.5, glutes=101)
    created = api.post("/api/assessments", json=data).json()
    assert created["right_forearm"] == 28 and created["left_forearm"] == 27.5 and created["glutes"] == 101
    updated = api.patch(f"/api/assessments/{created['id']}", json={"glutes": 100}).json()
    assert updated["glutes"] == 100
    assert client(student_user).get(f"/api/assessments/{created['id']}").json()["right_forearm"] == 28
    progress = client(personal).get(f"/api/progress/overview/{own.id}").json()
    keys = {item["key"] for item in progress["measurements"]}
    assert {"right_forearm", "left_forearm", "glutes"}.issubset(keys)


def test_cross_tenant_and_student_read_only(context):
    _, personal, _, student_user, own, foreign = context
    assert client(personal).post("/api/assessments", json=payload(foreign.id)).status_code == 403
    created = client(personal).post("/api/assessments", json=payload(own.id)).json()
    student_api = client(student_user)
    assert len(student_api.get("/api/assessments").json()) == 1
    assert student_api.get(f"/api/assessments/{created['id']}").status_code == 200
    assert student_api.get(f"/api/assessments?student_id={foreign.id}").status_code == 403
    assert student_api.post("/api/assessments", json=payload(own.id)).status_code == 403
    assert student_api.patch(f"/api/assessments/{created['id']}", json={"weight": 50}).status_code == 403
    assert student_api.delete(f"/api/assessments/{created['id']}").status_code == 403


def test_optional_fields_validation_and_module_flag(context):
    db, personal, _, _, own, _ = context; api = client(personal)
    minimal = api.post("/api/assessments", json={"student_id": str(own.id), "assessment_date": "2026-10-01"})
    assert minimal.status_code == 201 and minimal.json()["bmi"] is None
    assert api.post("/api/assessments", json=payload(own.id, weight=-1)).status_code == 422
    invalid_fat = payload(own.id); invalid_fat["body_fat_percentage"] = 101
    assert api.post("/api/assessments", json=invalid_fat).status_code == 422
    branding = db.query(PersonalBranding).filter_by(personal_id=personal.id).one()
    branding.modules = {"assessments": False, "progress": True, "workouts": True}; db.commit()
    response = api.get(f"/api/assessments?student_id={own.id}")
    assert response.status_code == 403 and response.json()["detail"] == {"code": "module_disabled", "module": "assessments"}


def test_progress_combines_weight_and_measurements_without_zero_filling(context):
    db, personal, _, _, own, _ = context; api = client(personal)
    db.add(ProgressLog(student_id=own.id, log_date=date(2026, 9, 1), body_weight=81, completed_exercises=0)); db.commit()
    api.post("/api/assessments", json=payload(own.id, "2026-09-01", 80))
    third = payload(own.id, "2026-10-01", 78); third["waist"] = None
    api.post("/api/assessments", json=third)
    data = api.get(f"/api/progress/overview/{own.id}").json()
    assert [point["value"] for point in data["weight_history"]] == [80, 78]
    assert data["current_weight"] == 78 and data["measurements_supported"] is True
    waist = next(item for item in data["measurements"] if item["key"] == "waist")
    assert [point["value"] for point in waist["points"]] == [90]


def test_progress_omits_assessment_data_when_module_disabled(context):
    db, personal, _, _, own, _ = context; api = client(personal)
    api.post("/api/assessments", json=payload(own.id))
    branding = db.query(PersonalBranding).filter_by(personal_id=personal.id).one()
    branding.modules = {"assessments": False, "progress": True, "workouts": True}; db.commit()
    data = api.get(f"/api/progress/overview/{own.id}").json()
    assert data["measurements_supported"] is False and data["measurements"] == []
    assert data["weight_history"] == []


def test_assessment_photos_use_private_storage_and_work_with_files_disabled(context):
    db, personal, _, _, own, _ = context; api = client(personal)
    assessment = api.post("/api/assessments", json=payload(own.id)).json()
    response = image_upload(api, assessment["id"], visible="true")
    assert response.status_code == 201
    body = response.json()
    assert body["assessment_id"] == assessment["id"] and body["photo_type"] == "front"
    assert "storage_key" not in body and "path" not in body
    row = db.get(StudentFile, uuid.UUID(body["id"]))
    assert row.resource_type == "assessment_photo:front" and row.resource_id == uuid.UUID(assessment["id"])
    assert row.storage_key.startswith(f"private/{personal.id}/{own.id}/")
    assert api.get(f"/uploads/{row.storage_key}").status_code == 404
    assert api.get(f"/api/assessments/{assessment['id']}/photos/{body['id']}/view").headers["cache-control"] == "private, no-store"


def test_student_visibility_read_only_and_cross_student_access(context):
    db, personal, _, student_user, own, foreign = context; api = client(personal)
    assessment = api.post("/api/assessments", json=payload(own.id)).json()
    hidden = image_upload(api, assessment["id"]).json()
    visible = image_upload(api, assessment["id"], photo_type="back", visible="true").json()
    student_api = client(student_user)
    assessment_list = student_api.get("/api/assessments").json()
    assert assessment_list[0]["photo_count"] == 1
    assert [row["id"] for row in student_api.get(f"/api/assessments/{assessment['id']}/photos").json()] == [visible["id"]]
    assert student_api.get(f"/api/assessments/{assessment['id']}/photos/{hidden['id']}/view").status_code == 403
    assert student_api.post(f"/api/assessments/{assessment['id']}/photos", data={"photo_type": "front"}, files={"file": ("x.png", b"\x89PNG\r\n\x1a\nx", "image/png")}).status_code == 403
    assert student_api.delete(f"/api/assessments/{assessment['id']}/photos/{visible['id']}").status_code == 403
    foreign_user = db.get(User, foreign.user_id)
    assert client(foreign_user).get(f"/api/assessments/{assessment['id']}/photos").status_code == 403


def test_assessment_photos_are_not_exposed_or_mutated_by_general_files_module(context):
    db, personal, _, _, own, _ = context; api = client(personal)
    branding = db.query(PersonalBranding).filter_by(personal_id=personal.id).one()
    branding.modules = {"assessments": True, "files": True}; db.commit()
    assessment = api.post("/api/assessments", json=payload(own.id)).json()
    photo = image_upload(api, assessment["id"]).json()
    assert client(personal).get(f"/api/files?student_id={own.id}").json() == []
    assert client(personal).get(f"/api/files/{photo['id']}/download").status_code == 404
    assert client(personal).delete(f"/api/files/{photo['id']}").status_code == 404


def test_other_tenant_cannot_upload_view_or_delete_assessment_photo(context):
    _, personal, other, _, own, foreign = context
    own_assessment = client(personal).post("/api/assessments", json=payload(own.id)).json()
    photo = image_upload(client(personal), own_assessment["id"]).json()
    assert image_upload(client(other), own_assessment["id"]).status_code == 403
    assert client(other).get(f"/api/assessments/{own_assessment['id']}/photos/{photo['id']}/view").status_code == 403
    assert client(other).delete(f"/api/assessments/{own_assessment['id']}/photos/{photo['id']}").status_code == 403
    foreign_assessment = client(other).post("/api/assessments", json=payload(foreign.id)).json()
    assert image_upload(client(personal), foreign_assessment["id"]).status_code == 403


@pytest.mark.parametrize("filename,content_type,content,expected", [
    ("photo.jpg", "image/jpeg", b"\xff\xd8\xffphoto", 201),
    ("photo.webp", "image/webp", b"RIFFxxxxWEBPphoto", 201),
    ("document.pdf", "application/pdf", b"%PDF-1.7", 415),
    ("fake.png", "image/png", b"MZ executable", 415),
    ("empty.png", "image/png", b"", 422),
    ("../escape.png", "image/png", b"\x89PNG\r\n\x1a\nphoto", 422),
])
def test_assessment_photo_formats_and_content_validation(context, filename, content_type, content, expected):
    _, personal, _, _, own, _ = context; api = client(personal)
    assessment = api.post("/api/assessments", json=payload(own.id)).json()
    assert image_upload(api, assessment["id"], filename=filename, content_type=content_type, content=content).status_code == expected


def test_assessment_photo_rejects_oversized_content(context):
    _, personal, _, _, own, _ = context; api = client(personal)
    assessment = api.post("/api/assessments", json=payload(own.id)).json()
    content = b"\x89PNG\r\n\x1a\n" + b"x" * MAX_PRIVATE_FILE_BYTES
    assert image_upload(api, assessment["id"], content=content).status_code == 413


def test_photo_and_assessment_deletion_remove_metadata_and_physical_files(context):
    db, personal, _, _, own, _ = context; api = client(personal)
    first = api.post("/api/assessments", json=payload(own.id)).json()
    first_photo = image_upload(api, first["id"]).json(); first_row = db.get(StudentFile, uuid.UUID(first_photo["id"]))
    first_path = resolve_storage_key(first_row.storage_key)
    assert api.delete(f"/api/assessments/{first['id']}/photos/{first_photo['id']}").status_code == 204
    assert not first_path.exists() and db.get(StudentFile, first_row.id) is None
    second = api.post("/api/assessments", json=payload(own.id, "2026-10-01")).json()
    second_photo = image_upload(api, second["id"]).json(); second_row = db.get(StudentFile, uuid.UUID(second_photo["id"])); second_path = resolve_storage_key(second_row.storage_key)
    assert api.delete(f"/api/assessments/{second['id']}").status_code == 204
    assert not second_path.exists() and db.get(StudentFile, second_row.id) is None


def test_missing_physical_photo_preserves_assessment_and_metadata(context):
    db, personal, _, _, own, _ = context; api = client(personal)
    assessment = api.post("/api/assessments", json=payload(own.id)).json()
    photo = image_upload(api, assessment["id"]).json(); row = db.get(StudentFile, uuid.UUID(photo["id"]))
    resolve_storage_key(row.storage_key).unlink()
    response = api.delete(f"/api/assessments/{assessment['id']}")
    assert response.status_code == 409
    assert db.get(StudentFile, row.id) is not None
    assert api.get(f"/api/assessments/{assessment['id']}").status_code == 200


def test_assessment_module_flag_controls_photos_independently_of_files(context):
    db, personal, _, _, own, _ = context; api = client(personal)
    assessment = api.post("/api/assessments", json=payload(own.id)).json()
    branding = db.query(PersonalBranding).filter_by(personal_id=personal.id).one()
    branding.modules = {"assessments": False, "files": True}; db.commit()
    response = api.get(f"/api/assessments/{assessment['id']}/photos")
    assert response.status_code == 403 and response.json()["detail"]["module"] == "assessments"
