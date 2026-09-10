import uuid

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.api.deps import require_module
from app.db.session import Base
from app.models import audit_log, personal_branding, student, user  # noqa: F401
from app.models.personal_branding import PersonalBranding
from app.models.student import Student
from app.models.user import User, UserRole
from app.schemas.branding import BrandingUpdate
from app.services.branding_service import DEFAULT_MODULES, get_personal_branding, personal_for_user


def make_user(name, role):
    return User(id=uuid.uuid4(), name=name, email=f"{uuid.uuid4()}@example.com", hashed_password="test", role=role)


@pytest.fixture()
def db():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def make_brand(personal, slug, modules=None):
    return PersonalBranding(
        personal_id=personal.id, display_name=f"Personal {personal.name}", slug=slug,
        primary_color="#050505", secondary_color="#C0C0C0", modules=modules or {},
    )


def test_branding_defaults_without_saved_configuration(db):
    personal = make_user("Sem Marca", UserRole.PERSONAL)
    db.add(personal)
    db.commit()
    result = get_personal_branding(db, personal)
    assert result["is_fallback"] is True
    assert result["modules"] == DEFAULT_MODULES
    assert result["font_family"] == "Inter"


def test_personal_and_student_resolve_only_their_branding(db):
    personal_a = make_user("Alpha", UserRole.PERSONAL)
    personal_b = make_user("Beta", UserRole.PERSONAL)
    student_user = make_user("Aluno Alpha", UserRole.STUDENT)
    db.add_all([personal_a, personal_b, student_user])
    db.flush()
    db.add_all([make_brand(personal_a, "alpha"), make_brand(personal_b, "beta")])
    db.add(Student(personal_id=personal_a.id, user_id=student_user.id, name="Aluno Alpha", email=student_user.email, age=30, weight=70, height=1.7, objective="Saúde"))
    db.commit()
    assert personal_for_user(db, student_user).id == personal_a.id
    assert get_personal_branding(db, personal_for_user(db, student_user))["slug"] == "alpha"
    assert get_personal_branding(db, personal_b)["slug"] == "beta"


def test_disabled_module_is_blocked_for_personal_and_student(db):
    personal = make_user("Alpha", UserRole.PERSONAL)
    student_user = make_user("Aluno Alpha", UserRole.STUDENT)
    db.add_all([personal, student_user])
    db.flush()
    db.add(make_brand(personal, "alpha", {"workouts": False}))
    db.add(Student(personal_id=personal.id, user_id=student_user.id, name="Aluno Alpha", email=student_user.email, age=30, weight=70, height=1.7, objective="Saúde"))
    db.commit()
    guard = require_module("workouts")
    for current in (personal, student_user):
        with pytest.raises(HTTPException) as error:
            guard(current_user=current, db=db)
        assert error.value.status_code == 403


def test_enabled_module_for_personal_b_is_not_affected_by_personal_a(db):
    personal_a = make_user("Alpha", UserRole.PERSONAL)
    personal_b = make_user("Beta", UserRole.PERSONAL)
    db.add_all([personal_a, personal_b])
    db.flush()
    db.add_all([make_brand(personal_a, "alpha", {"progress": False}), make_brand(personal_b, "beta", {"progress": True})])
    db.commit()
    assert require_module("progress")(current_user=personal_b, db=db).id == personal_b.id


def test_branding_rejects_unsafe_contrast_and_unknown_modules():
    base = dict(display_name="Personal Teste", slug="teste")
    with pytest.raises(ValidationError):
        BrandingUpdate(**base, background_color="#FFFFFF", text_color="#FFFFFF")
    with pytest.raises(ValidationError):
        BrandingUpdate(**base, modules={"invented": True})
