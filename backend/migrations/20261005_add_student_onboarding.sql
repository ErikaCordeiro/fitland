ALTER TABLE student_assessments ADD COLUMN IF NOT EXISTS right_forearm DOUBLE PRECISION NULL;
ALTER TABLE student_assessments ADD COLUMN IF NOT EXISTS left_forearm DOUBLE PRECISION NULL;
ALTER TABLE student_assessments ADD COLUMN IF NOT EXISTS glutes DOUBLE PRECISION NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS access_activated_at TIMESTAMPTZ NULL;

CREATE TABLE IF NOT EXISTS student_access_invites (
    id UUID PRIMARY KEY,
    personal_id UUID NOT NULL REFERENCES users(id),
    student_id UUID NOT NULL REFERENCES students(id),
    created_by_id UUID NOT NULL REFERENCES users(id),
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ NULL,
    revoked_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_student_access_invites_personal_id ON student_access_invites(personal_id);
CREATE INDEX IF NOT EXISTS ix_student_access_invites_student_id ON student_access_invites(student_id);
CREATE INDEX IF NOT EXISTS ix_student_access_invites_student_active ON student_access_invites(student_id, expires_at, used_at, revoked_at);

-- Existing authenticated students retain their current access and skip first-login onboarding.
UPDATE students SET access_activated_at = COALESCE(access_activated_at, CURRENT_TIMESTAMP) WHERE user_id IS NOT NULL;
UPDATE users SET onboarding_completed_at = COALESCE(onboarding_completed_at, CURRENT_TIMESTAMP) WHERE role = 'STUDENT';
