CREATE TABLE IF NOT EXISTS ai_audit_logs (
    id UUID PRIMARY KEY,
    operation VARCHAR(80) NOT NULL,
    personal_id UUID NOT NULL REFERENCES users(id),
    student_id UUID NULL REFERENCES students(id),
    user_id UUID NOT NULL REFERENCES users(id),
    provider VARCHAR(40) NOT NULL,
    model VARCHAR(120) NOT NULL,
    status VARCHAR(32) NOT NULL,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    input_tokens INTEGER NULL,
    output_tokens INTEGER NULL,
    error_code VARCHAR(64) NULL,
    error_message TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_ai_audit_logs_operation ON ai_audit_logs (operation);
CREATE INDEX IF NOT EXISTS ix_ai_audit_logs_personal_id ON ai_audit_logs (personal_id);
CREATE INDEX IF NOT EXISTS ix_ai_audit_logs_student_id ON ai_audit_logs (student_id);
CREATE INDEX IF NOT EXISTS ix_ai_audit_logs_user_id ON ai_audit_logs (user_id);
CREATE INDEX IF NOT EXISTS ix_ai_audit_logs_status ON ai_audit_logs (status);
CREATE INDEX IF NOT EXISTS ix_ai_audit_logs_created_at ON ai_audit_logs (created_at);
