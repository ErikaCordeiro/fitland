import uuid

import pytest
from sqlalchemy import create_engine, inspect, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db.session import Base
from app.models import *  # noqa: F401,F403
from app.models.exercise import Exercise
from app.models.student import Student
from app.models.user import User, UserRole
from app.models.workout import Workout, WorkoutExercise
from app.schemas.workout import WorkoutCreate, WorkoutRead, WorkoutUpdate
from app.services.workout_service import create_workout, list_workouts, update_workout


@pytest.fixture()
def db():
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


def records(db):
    personal = User(id=uuid.uuid4(), name="Personal", email="personal-workout@test.dev", hashed_password="x", role=UserRole.PERSONAL)
    user = User(id=uuid.uuid4(), name="Student", email="student-workout@test.dev", hashed_password="x", role=UserRole.STUDENT)
    student = Student(id=uuid.uuid4(), personal_id=personal.id, user_id=user.id, name="Student", email=user.email, age=30, weight=70, height=170, objective="Teste")
    exercise = Exercise(id=uuid.uuid4(), personal_id=personal.id, name="Supino", muscle_group="Peito")
    db.add_all([personal, user, student, exercise])
    db.commit()
    return personal, student, exercise


def test_technique_columns_belong_to_workout_exercises(db):
    schema = inspect(db.bind)
    assert "set_type" not in {column["name"] for column in schema.get_columns("workouts")}
    assert "technique_config" not in {column["name"] for column in schema.get_columns("workouts")}
    assert {"set_type", "technique_config"} <= {column["name"] for column in schema.get_columns("workout_exercises")}


@pytest.mark.parametrize("set_type,config", [
    ("standard", {}),
    ("biset", {"components": [{"exercise_id": "part-a"}, {"exercise_id": "part-b"}]}),
    ("drop_set", {"drops": [{"load": 30}, {"load": 20}]}),
])
def test_create_list_edit_and_serialize_technique(db, set_type, config):
    personal, student, exercise = records(db)
    payload = WorkoutCreate(student_id=student.id, name="Treino de teste", exercises=[{
        "exercise_id": exercise.id, "sets": 3, "repetitions": "12", "rest_seconds": 60,
        "set_type": set_type, "technique_config": config,
    }])
    created = create_workout(db, personal, payload)
    assert len(list_workouts(db, personal)) == 1
    link = db.scalar(select(WorkoutExercise).where(WorkoutExercise.workout_id == created.id))
    assert link.set_type == set_type
    assert link.technique_config == config
    edited = update_workout(db, personal, created.id, WorkoutUpdate(name="Treino editado"))
    assert edited.exercises[0].set_type == set_type
    assert edited.exercises[0].technique_config == config
    assert db.get(Workout, created.id).name == "Treino editado"


def test_update_replaces_exercises_and_persists_techniques(db):
    personal, student, exercise = records(db)
    created = create_workout(db, personal, WorkoutCreate(student_id=student.id, name="Treino original", exercises=[{
        "exercise_id": exercise.id, "sets": 3, "repetitions": "10", "rest_seconds": 60,
    }]))
    updated = update_workout(db, personal, created.id, WorkoutUpdate(name="Treino atualizado", exercises=[{
        "exercise_id": exercise.id, "sets": 4, "repetitions": "8", "rest_seconds": 90,
        "load": 42.5, "set_type": "drop_set",
        "technique_config": {"drop_count": 3, "drops": [{"prescribedLoad": "42.5"}, {"prescribedLoad": "35"}, {"prescribedLoad": "25"}]},
    }]))
    assert updated.name == "Treino atualizado"
    assert len(updated.exercises) == 1
    assert updated.exercises[0].sets == 4
    assert updated.exercises[0].repetitions == "8"
    assert updated.exercises[0].rest_seconds == 90
    assert float(updated.exercises[0].load) == 42.5
    assert updated.exercises[0].set_type == "drop_set"
    assert updated.exercises[0].technique_config["drop_count"] == 3


@pytest.mark.parametrize("set_type,config", [
    ("standard", {}),
    ("biset", {"components": [{"exerciseName": "Supino"}, {"exerciseName": "Crucifixo"}]}),
    ("drop_set", {"drops": [{"prescribedLoad": "40"}, {"prescribedLoad": "30"}]}),
])
def test_student_workout_payload_includes_owned_exercise_name_and_technique(db, set_type, config):
    personal, student, exercise = records(db)
    workout = create_workout(db, personal, WorkoutCreate(student_id=student.id, name="Treino autorizado", exercises=[{
        "exercise_id": exercise.id, "sets": 3, "repetitions": "10", "rest_seconds": 60,
        "set_type": set_type, "technique_config": config,
    }]))
    student_user = db.get(User, student.user_id)
    listed = list_workouts(db, student_user)
    assert [item.id for item in listed] == [workout.id]
    assert listed[0].exercises[0].name == "Supino"
    assert listed[0].exercises[0].set_type == set_type
    assert listed[0].exercises[0].technique_config == config
    serialized = WorkoutRead.model_validate(listed[0]).model_dump(mode="json")
    assert serialized["exercises"][0]["name"] == "Supino"
    assert serialized["exercises"][0]["set_type"] == set_type


def test_student_and_personal_workout_isolation(db):
    personal, student, exercise = records(db)
    other_personal = User(id=uuid.uuid4(), name="Other", email="other@test.dev", hashed_password="x", role=UserRole.PERSONAL)
    other_user = User(id=uuid.uuid4(), name="Other student", email="other-student@test.dev", hashed_password="x", role=UserRole.STUDENT)
    other_student = Student(
        id=uuid.uuid4(), personal_id=other_personal.id, user_id=other_user.id,
        name="Other student", email=other_user.email, age=31, weight=75,
        height=175, objective="Teste",
    )
    other_exercise = Exercise(id=uuid.uuid4(), personal_id=other_personal.id, name="Other exercise")
    db.add_all([other_personal, other_user, other_student, other_exercise])
    db.commit()
    own = create_workout(db, personal, WorkoutCreate(student_id=student.id, name="Own", exercises=[{"exercise_id": exercise.id, "sets": 3, "repetitions": "10", "rest_seconds": 60}]))
    foreign = create_workout(db, other_personal, WorkoutCreate(student_id=other_student.id, name="Foreign", exercises=[{"exercise_id": other_exercise.id, "sets": 3, "repetitions": "10", "rest_seconds": 60}]))
    assert [item.id for item in list_workouts(db, db.get(User, student.user_id))] == [own.id]
    assert [item.id for item in list_workouts(db, personal)] == [own.id]
    assert foreign.id not in {item.id for item in list_workouts(db, personal)}
