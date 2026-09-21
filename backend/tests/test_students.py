import uuid

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.session import Base
from app.models import *  # noqa: F401,F403
from app.models.user import User, UserRole
from app.schemas.student import StudentCreate
from app.services.student_service import create_student, list_students


@pytest.fixture()
def db():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


def personal(name):
    return User(id=uuid.uuid4(), name=name, email=f"{uuid.uuid4()}@example.com", hashed_password="x", role=UserRole.PERSONAL)


def payload(email):
    return StudentCreate(name="Aluno QA", email=email, age=30, weight=70, height=1.70, objective="Teste")


def test_created_student_persists_for_authenticated_personal(db):
    owner = personal("Hugo")
    db.add(owner)
    db.commit()
    created = create_student(db, owner, payload("student@example.com"))
    db.expire_all()
    rows = list_students(db, owner)
    assert [row.id for row in rows] == [created.id]
    assert rows[0].personal_id == owner.id
    assert rows[0].user_id is None


def test_students_are_isolated_by_personal(db):
    hugo, thiago = personal("Hugo"), personal("Thiago")
    db.add_all([hugo, thiago])
    db.commit()
    create_student(db, hugo, payload("hugo-student@example.com"))
    assert len(list_students(db, hugo)) == 1
    assert list_students(db, thiago) == []
