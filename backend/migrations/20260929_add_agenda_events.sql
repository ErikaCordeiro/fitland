CREATE TABLE IF NOT EXISTS agenda_events (
    id UUID PRIMARY KEY,
    personal_id UUID NOT NULL REFERENCES users(id),
    student_id UUID NULL REFERENCES students(id),
    title VARCHAR(160) NOT NULL,
    event_date DATE NOT NULL,
    event_time TIME NOT NULL,
    notes TEXT NULL,
    visible_to_student BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_agenda_events_personal_id ON agenda_events(personal_id);
CREATE INDEX IF NOT EXISTS ix_agenda_events_student_id ON agenda_events(student_id);
CREATE INDEX IF NOT EXISTS ix_agenda_events_event_date ON agenda_events(event_date);
