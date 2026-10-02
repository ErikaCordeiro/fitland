CREATE TABLE IF NOT EXISTS student_files (
    id UUID PRIMARY KEY,
    personal_id UUID NOT NULL REFERENCES users(id),
    student_id UUID NOT NULL REFERENCES students(id),
    uploaded_by_id UUID NOT NULL REFERENCES users(id),
    uploaded_by_role VARCHAR(16) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    storage_key VARCHAR(500) NOT NULL UNIQUE,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL CONSTRAINT ck_student_files_size_positive CHECK (size_bytes > 0),
    sha256 VARCHAR(64) NOT NULL,
    title VARCHAR(180),
    description TEXT,
    category VARCHAR(32) NOT NULL DEFAULT 'other',
    visible_to_student BOOLEAN NOT NULL DEFAULT FALSE,
    resource_type VARCHAR(40),
    resource_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_student_files_personal_id ON student_files(personal_id);
CREATE INDEX IF NOT EXISTS ix_student_files_student_id ON student_files(student_id);
CREATE INDEX IF NOT EXISTS ix_student_files_tenant_student_created ON student_files(personal_id, student_id, created_at);
CREATE INDEX IF NOT EXISTS ix_student_files_resource ON student_files(resource_type, resource_id);

-- Existing tenants must explicitly enable this newly implemented module.
UPDATE personal_brandings
SET modules = jsonb_set(COALESCE(modules::jsonb, '{}'::jsonb), '{files}', 'false'::jsonb, true)
WHERE COALESCE((modules::jsonb ->> 'files')::boolean, false) IS DISTINCT FROM false;
