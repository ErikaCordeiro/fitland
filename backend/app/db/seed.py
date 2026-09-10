import secrets
from datetime import date

from sqlalchemy import func, select

from app.core.config import settings
from app.core.security import hash_password
from app.db.init_db import init_db
from app.db.session import SessionLocal
from app.models.exercise import Exercise
from app.models.progress import ProgressLog
from app.models.student import Student
from app.models.user import User, UserRole
from app.models.video import Video
from app.models.workout import Workout, WorkoutExercise


DEFAULT_PERSONAL_EMAIL = "thiago.iron.filippo@gmail.com"


def normalize_email(email: str | None) -> str | None:
    return email.strip().lower() if email else None


def normalize_password(password: str | None) -> str | None:
    return password.strip() if password else None


def seed() -> None:
    init_db()
    db = SessionLocal()
    try:
        from app.services.owner_service import ensure_owner
        ensure_owner(db)
        is_production = settings.ENVIRONMENT.lower() == "production"
        personal_email = normalize_email(settings.SEED_PERSONAL_EMAIL)
        personal_password = normalize_password(settings.SEED_PERSONAL_PASSWORD)
        student_email = normalize_email(settings.SEED_STUDENT_EMAIL)
        student_password = normalize_password(settings.SEED_STUDENT_PASSWORD)

        if personal_password and not personal_email:
            personal_email = DEFAULT_PERSONAL_EMAIL
            print("[seed] personal email fallback selected")

        print(
            "[seed] configuration "
            f"personal_configured={str(bool(personal_email and personal_password)).lower()} "
            f"student_configured={str(bool(student_email and student_password)).lower()}"
        )

        # Migrate branding for existing accounts without touching credentials.
        from app.services.branding_service import ensure_personal_branding
        ensure_personal_branding(db, personal_email or DEFAULT_PERSONAL_EMAIL)

        legacy_personal = db.scalar(select(User).where(User.email == "thiago@personal.com"))
        if is_production and legacy_personal and not personal_password:
            legacy_personal.hashed_password = hash_password(secrets.token_urlsafe(48))
            db.commit()
            return

        if not personal_email or not personal_password:
            print("[seed] personal seed skipped: missing SEED_PERSONAL_EMAIL or SEED_PERSONAL_PASSWORD")
            return

        existing = db.scalar(select(User).where(func.lower(func.trim(User.email)) == personal_email)) or legacy_personal
        if existing:
            existing.email = personal_email
            existing.name = "Thiago Fillipo"
            existing.role = UserRole.PERSONAL
            existing.is_active = True
            existing.account_status = "active"
            existing.deleted_at = None
            db.commit()
            personal = existing
            print("[seed] existing personal reactivated and reused without changing password")
        else:
            personal = User(
                name="Thiago Fillipo",
                email=personal_email,
                hashed_password=hash_password(personal_password),
                role=UserRole.PERSONAL,
            )
            db.add(personal)
            db.flush()
            print("[seed] personal user created")

        # New accounts only exist after the block above. Running this again is
        # idempotent and guarantees every seeded personal receives its brand.
        ensure_personal_branding(db, personal_email)

        student_user = None
        if student_email and student_password:
            student_user = db.scalar(select(User).where(func.lower(func.trim(User.email)) == student_email))
            if student_user:
                student_user.email = student_email
                student_user.name = "Erika Gomes Cordeiro"
                student_user.hashed_password = hash_password(student_password)
                student_user.role = UserRole.STUDENT
                student_user.is_active = True
                print("[seed] student user updated")
            else:
                student_user = User(
                    name="Erika Gomes Cordeiro",
                    email=student_email,
                    hashed_password=hash_password(student_password),
                    role=UserRole.STUDENT,
                )
                db.add(student_user)
                db.flush()
                print("[seed] student user created")

        existing_student = None
        if student_user:
            existing_student = db.scalar(select(Student).where(Student.user_id == student_user.id))
        if not existing_student:
            existing_student = db.scalar(select(Student).where(Student.personal_id == personal.id))
        if existing_student:
            existing_student.personal_id = personal.id
            existing_student.user_id = student_user.id if student_user else existing_student.user_id
            existing_student.name = student_user.name if student_user else existing_student.name
            existing_student.email = student_email or existing_student.email
            db.commit()
            print("[seed] existing student profile linked to seeded user")
            return

        student = Student(
            personal_id=personal.id,
            user_id=student_user.id if student_user else None,
            name=student_user.name if student_user else "Rafael Martins",
            email=student_email or "rafael@email.com",
            age=34,
            weight=86,
            height=1.82,
            objective="Hipertrofia limpa",
            notes="Histórico de lombalgia leve. Priorizar técnica e mobilidade.",
        )
        db.add(student)
        db.flush()
        print("[seed] student profile created")

        exercise = Exercise(
            personal_id=personal.id,
            name="Supino reto com barra",
            muscle_group="Peito",
            explanation="Escápulas retraídas, pés firmes e controle total na descida.",
        )
        db.add(exercise)
        db.flush()

        db.add(
            Video(
                exercise_id=exercise.id,
                title="Execução do supino reto",
                provider="youtube",
                url="https://www.youtube.com/watch?v=rT7DgCr-3pg",
                embed_url="https://www.youtube.com/embed/rT7DgCr-3pg",
            )
        )

        workout = Workout(
            personal_id=personal.id,
            student_id=student.id,
            name="Força Superior A",
            focus="Peito, costas e core",
            duration_minutes=58,
            notes="Priorizar cadência e técnica.",
        )
        db.add(workout)
        db.flush()

        db.add(
            WorkoutExercise(
                workout_id=workout.id,
                exercise_id=exercise.id,
                order_index=1,
                sets=4,
                repetitions="8-10",
                rest_seconds=90,
                load=82,
                notes="Aumentar carga apenas se a execução estiver limpa.",
            )
        )
        db.add(
            ProgressLog(
                student_id=student.id,
                workout_id=workout.id,
                exercise_id=exercise.id,
                log_date=date.today(),
                completed_exercises=1,
                load=82,
                body_weight=86,
                notes="Primeiro treino concluído com boa percepção de esforço.",
            )
        )
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
