CREATE TABLE IF NOT EXISTS financial_charges (
 id UUID PRIMARY KEY, personal_id UUID NOT NULL REFERENCES users(id), student_id UUID NOT NULL REFERENCES students(id),
 description VARCHAR(180) NOT NULL, amount NUMERIC(12,2) NOT NULL CONSTRAINT ck_financial_charges_amount_positive CHECK (amount > 0),
 due_date DATE NOT NULL, notes TEXT NULL, cancelled_at TIMESTAMP NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT uq_financial_charge_tenant_student UNIQUE(id,personal_id,student_id)
);
CREATE TABLE IF NOT EXISTS financial_payments (
 id UUID PRIMARY KEY, charge_id UUID NOT NULL, personal_id UUID NOT NULL, student_id UUID NOT NULL,
 amount NUMERIC(12,2) NOT NULL CONSTRAINT ck_financial_payments_amount_positive CHECK (amount > 0), paid_at DATE NOT NULL,
 payment_method VARCHAR(32) NULL, notes TEXT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_financial_payment_charge_tenant_student FOREIGN KEY(charge_id,personal_id,student_id) REFERENCES financial_charges(id,personal_id,student_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_financial_charges_personal_id ON financial_charges(personal_id);
CREATE INDEX IF NOT EXISTS ix_financial_charges_student_id ON financial_charges(student_id);
CREATE INDEX IF NOT EXISTS ix_financial_charges_due_date ON financial_charges(due_date);
CREATE INDEX IF NOT EXISTS ix_financial_charges_tenant_due ON financial_charges(personal_id,due_date);
CREATE INDEX IF NOT EXISTS ix_financial_payments_charge_id ON financial_payments(charge_id);
CREATE INDEX IF NOT EXISTS ix_financial_payments_personal_id ON financial_payments(personal_id);
CREATE INDEX IF NOT EXISTS ix_financial_payments_student_id ON financial_payments(student_id);
CREATE INDEX IF NOT EXISTS ix_financial_payments_paid_at ON financial_payments(paid_at);
CREATE INDEX IF NOT EXISTS ix_financial_payments_tenant_paid ON financial_payments(personal_id,paid_at);
