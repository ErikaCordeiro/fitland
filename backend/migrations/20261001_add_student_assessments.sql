CREATE TABLE IF NOT EXISTS student_assessments (
    id UUID PRIMARY KEY,
    personal_id UUID NOT NULL REFERENCES users(id),
    student_id UUID NOT NULL REFERENCES students(id),
    assessment_date DATE NOT NULL,
    weight DOUBLE PRECISION NULL,
    height DOUBLE PRECISION NULL,
    neck DOUBLE PRECISION NULL,
    shoulders DOUBLE PRECISION NULL,
    chest DOUBLE PRECISION NULL,
    right_arm DOUBLE PRECISION NULL,
    left_arm DOUBLE PRECISION NULL,
    waist DOUBLE PRECISION NULL,
    abdomen DOUBLE PRECISION NULL,
    hips DOUBLE PRECISION NULL,
    right_thigh DOUBLE PRECISION NULL,
    left_thigh DOUBLE PRECISION NULL,
    right_calf DOUBLE PRECISION NULL,
    left_calf DOUBLE PRECISION NULL,
    body_fat_percentage DOUBLE PRECISION NULL,
    notes TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_student_assessments_personal_id ON student_assessments(personal_id);
CREATE INDEX IF NOT EXISTS ix_student_assessments_student_id ON student_assessments(student_id);
CREATE INDEX IF NOT EXISTS ix_student_assessments_assessment_date ON student_assessments(assessment_date);
