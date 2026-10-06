ALTER TABLE students ALTER COLUMN age DROP NOT NULL;
ALTER TABLE students ALTER COLUMN weight DROP NOT NULL;
ALTER TABLE students ALTER COLUMN height DROP NOT NULL;
ALTER TABLE students ALTER COLUMN objective DROP NOT NULL;

CREATE TABLE IF NOT EXISTS student_access_requests (
    id UUID PRIMARY KEY,
    personal_id UUID NOT NULL REFERENCES users(id),
    student_id UUID NULL REFERENCES students(id),
    first_name VARCHAR(80) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    rejection_reason TEXT NULL,
    reviewed_at TIMESTAMPTZ NULL,
    reviewed_by_id UUID NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_student_access_requests_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
);

CREATE INDEX IF NOT EXISTS ix_student_access_requests_personal_id ON student_access_requests(personal_id);
CREATE INDEX IF NOT EXISTS ix_student_access_requests_tenant_status_created ON student_access_requests(personal_id, status, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_student_access_requests_pending_email ON student_access_requests(personal_id, email) WHERE status = 'PENDING';
