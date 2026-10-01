DO $$ BEGIN
    CREATE TYPE mealplanstatus AS ENUM ('ACTIVE', 'ARCHIVED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS meal_plans (
    id UUID PRIMARY KEY, personal_id UUID NOT NULL REFERENCES users(id), student_id UUID NOT NULL REFERENCES students(id),
    name VARCHAR(160) NOT NULL, start_date DATE NOT NULL, end_date DATE NULL, notes TEXT NULL,
    status mealplanstatus NOT NULL DEFAULT 'ACTIVE', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS meal_plan_meals (
    id UUID PRIMARY KEY, meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL, time TIME NULL, position INTEGER NOT NULL, notes TEXT NULL
);
CREATE TABLE IF NOT EXISTS meal_plan_items (
    id UUID PRIMARY KEY, meal_id UUID NOT NULL REFERENCES meal_plan_meals(id) ON DELETE CASCADE,
    food_name VARCHAR(180) NOT NULL, quantity DOUBLE PRECISION NOT NULL CHECK (quantity > 0),
    unit VARCHAR(24) NOT NULL, notes TEXT NULL, position INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_meal_plans_personal_id ON meal_plans(personal_id);
CREATE INDEX IF NOT EXISTS ix_meal_plans_student_id ON meal_plans(student_id);
CREATE INDEX IF NOT EXISTS ix_meal_plans_start_date ON meal_plans(start_date);
CREATE INDEX IF NOT EXISTS ix_meal_plans_status ON meal_plans(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_meal_plans_active_student ON meal_plans(student_id) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS ix_meal_plan_meals_plan_id ON meal_plan_meals(meal_plan_id);
CREATE INDEX IF NOT EXISTS ix_meal_plan_items_meal_id ON meal_plan_items(meal_id);
