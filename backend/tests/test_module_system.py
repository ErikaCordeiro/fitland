import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user, require_module
from app.db.session import Base, get_db
from app.main import app
from app.models import audit_log, exercise, personal_branding, student, user, workout, workout_session  # noqa: F401
from app.models.personal_branding import PersonalBranding
from app.models.student import Student
from app.models.user import User, UserRole
from app.models.workout import Workout
from app.services.branding_service import get_personal_branding, save_branding
from app.services.module_registry import module_catalog, resolve_modules, validate_module_configuration
from app.services.owner_service import update_personal_modules
from app.schemas.branding import BrandingUpdate


def make_user(name: str, role: UserRole) -> User:
    return User(
        id=uuid.uuid4(),
        name=name,
        email=f"{uuid.uuid4()}@example.com",
        hashed_password="test",
        role=role,
        is_active=True,
        account_status="active",
    )


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def add_brand(db: Session, personal: User, slug: str, modules: dict[str, bool]) -> PersonalBranding:
    branding = PersonalBranding(
        personal_id=personal.id,
        display_name=personal.name,
        slug=slug,
        modules=modules,
    )
    db.add(branding)
    return branding


def test_catalog_has_core_status_order_and_explicit_availability():
    catalog = module_catalog()
    assert [item["order"] for item in catalog] == sorted(item["order"] for item in catalog)
    dashboard = next(item for item in catalog if item["key"] == "dashboard")
    diets = next(item for item in catalog if item["key"] == "diet")
    progress = next(item for item in catalog if item["key"] == "progress")
    agenda = next(item for item in catalog if item["key"] == "calendar")
    finance = next(item for item in catalog if item["key"] == "finance")
    assert dashboard["core"] is True and dashboard["configurable"] is False
    assert diets["status"] == "implemented" and diets["available"] is True and diets["default_enabled"] is False
    assert progress["status"] == "implemented" and progress["dependencies"] == ["workouts"]
    assert agenda["name"] == "Agenda" and agenda["status"] == "implemented" and agenda["dependencies"] == []
    assert finance["status"] == "implemented" and finance["default_enabled"] is False
    assert not any(item["key"] == "payments" for item in catalog)
    assert not any(item["key"] == "agenda" for item in catalog)


def test_unavailable_and_core_modules_cannot_be_overridden():
    modules = resolve_modules({"dashboard": False, "settings": False, "diet": True})
    assert modules["dashboard"] is True
    assert modules["settings"] is True
    assert modules["diet"] is True


def test_impossible_dependency_configuration_is_rejected():
    with pytest.raises(ValueError, match="Progresso requer: Treinos"):
        validate_module_configuration({"workouts": False, "progress": True, "coach": False})
    with pytest.raises(ValueError, match="Coach Fitland requer: Alunos"):
        validate_module_configuration({"students": False, "workouts": True, "progress": False, "coach": True})


def test_owner_changes_are_isolated_and_workout_data_survives_toggle(db):
    owner = make_user("Owner", UserRole.OWNER)
    thiago = make_user("Tenant Alpha", UserRole.PERSONAL)
    hugo = make_user("Tenant Beta", UserRole.PERSONAL)
    db.add_all([owner, thiago, hugo])
    db.flush()
    alpha_brand = add_brand(db, thiago, "alpha", {"students": True, "workouts": True})
    beta_brand = add_brand(db, hugo, "beta", {"students": True, "workouts": False, "progress": False, "coach": False})
    student_user = make_user("Aluno Beta", UserRole.STUDENT)
    db.add(student_user)
    db.flush()
    beta_student = Student(
        personal_id=hugo.id, user_id=student_user.id, name="Aluno Beta", email=student_user.email,
        age=30, weight=70, height=1.7, objective="Saúde",
    )
    db.add(beta_student)
    db.flush()
    workout = Workout(personal_id=hugo.id, student_id=beta_student.id, name="Treino preservado", notes="Persistente")
    db.add(workout)
    db.commit()

    update_personal_modules(db, owner, hugo, {"students": True, "workouts": True, "progress": False, "coach": False})
    assert require_module("workouts")(current_user=hugo, db=db).id == hugo.id
    assert get_personal_branding(db, thiago)["modules"]["workouts"] is True

    update_personal_modules(db, owner, hugo, {"students": True, "workouts": False, "progress": False, "coach": False})
    with pytest.raises(Exception) as error:
        require_module("workouts")(current_user=hugo, db=db)
    assert error.value.status_code == 403
    assert error.value.detail == {"code": "module_disabled", "module": "workouts"}
    assert db.scalar(select(Workout).where(Workout.id == workout.id)) is not None
    db.refresh(alpha_brand)
    db.refresh(beta_brand)
    assert alpha_brand.modules["workouts"] is True
    assert beta_brand.modules["workouts"] is False


def test_personal_branding_update_cannot_change_own_modules(db):
    personal = make_user("Tenant", UserRole.PERSONAL)
    db.add(personal)
    db.flush()
    add_brand(db, personal, "tenant", {"students": True, "workouts": True})
    db.commit()

    save_branding(db, personal, BrandingUpdate(
        display_name="Nova marca",
        slug="tenant",
        modules={"students": False, "workouts": False, "progress": False, "coach": False},
    ))
    result = get_personal_branding(db, personal)
    assert result["display_name"] == "Nova marca"
    assert result["modules"]["students"] is True
    assert result["modules"]["workouts"] is True


def test_personal_cannot_call_owner_module_endpoint(db):
    personal = make_user("Tenant", UserRole.PERSONAL)
    db.add(personal)
    db.flush()
    add_brand(db, personal, "tenant", {"students": True, "workouts": True})
    db.commit()
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: personal
    try:
        response = TestClient(app).put(
            f"/api/owner/personals/{personal.id}/modules",
            json={"modules": {"students": False}},
        )
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 403
    assert get_personal_branding(db, personal)["modules"]["students"] is True
