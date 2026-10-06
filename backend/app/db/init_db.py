from sqlalchemy import text

from app.db.session import Base, engine
from app.models import agenda_event, ai_audit, audit_log, exercise, finance, meal_plan, message, personal_branding, progress, student, student_access_invite, student_access_request, student_assessment, student_file, user, video, workout, workout_session  # noqa: F401


def init_db() -> None:
    if engine.dialect.name == "postgresql":
        with engine.begin() as connection:
            connection.execute(text("""
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userrole') THEN
                        ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'OWNER';
                    END IF;
                END $$;
            """))
            upgrades = [
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(32)",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500)",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(24) NOT NULL DEFAULT 'active'",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_preference VARCHAR(16) NOT NULL DEFAULT 'auto'",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP NULL",
                "ALTER TABLE workout_exercises ADD COLUMN IF NOT EXISTS set_type VARCHAR(24) NOT NULL DEFAULT 'standard'",
                "ALTER TABLE workout_exercises ADD COLUMN IF NOT EXISTS technique_config JSON NOT NULL DEFAULT '{}'",
                "ALTER TABLE workouts ADD COLUMN IF NOT EXISTS day_of_week VARCHAR(16)",
            ]
            for statement in upgrades:
                connection.execute(text(statement))
    Base.metadata.create_all(bind=engine)
