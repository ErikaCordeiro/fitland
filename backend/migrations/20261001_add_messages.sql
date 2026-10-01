CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY,
    personal_id UUID NOT NULL REFERENCES users(id),
    student_id UUID NOT NULL REFERENCES students(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_conversation_personal_student UNIQUE (personal_id, student_id),
    CONSTRAINT uq_conversation_tenant_student UNIQUE (id, personal_id, student_id)
);
CREATE INDEX IF NOT EXISTS ix_conversations_personal_id ON conversations(personal_id);
CREATE INDEX IF NOT EXISTS ix_conversations_student_id ON conversations(student_id);
CREATE INDEX IF NOT EXISTS ix_conversations_personal_updated ON conversations(personal_id, updated_at);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL,
    personal_id UUID NOT NULL,
    student_id UUID NOT NULL,
    sender_role VARCHAR(16) NOT NULL,
    sender_user_id UUID NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    read_at TIMESTAMPTZ NULL,
    CONSTRAINT ck_messages_body_not_blank CHECK (length(trim(body)) > 0),
    CONSTRAINT fk_message_conversation_tenant_student FOREIGN KEY (conversation_id, personal_id, student_id)
        REFERENCES conversations(id, personal_id, student_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS ix_messages_personal_id ON messages(personal_id);
CREATE INDEX IF NOT EXISTS ix_messages_student_id ON messages(student_id);
CREATE INDEX IF NOT EXISTS ix_messages_conversation_created ON messages(conversation_id, created_at, id);
CREATE INDEX IF NOT EXISTS ix_messages_tenant_unread ON messages(personal_id, student_id, read_at);
