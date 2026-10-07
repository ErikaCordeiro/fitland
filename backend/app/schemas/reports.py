import uuid
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel

class ReportPeriod(BaseModel):
    start: date
    end: date
    days: int

class ReportMetrics(BaseModel):
    students_total: int
    new_students: int
    students_trained: int
    students_without_training: int
    completed_workouts: int
    assessments_completed: int | None = None
    students_assessed: int | None = None
    received: Decimal | None = None
    pending: Decimal | None = None
    overdue: Decimal | None = None

class ReportPoint(BaseModel):
    date: date
    value: int

class StudentActivity(BaseModel):
    student_id: uuid.UUID
    name: str
    completed_workouts: int
    last_workout_at: datetime | None
    last_assessment_date: date | None
    status: str

class ReportsOverview(BaseModel):
    period: ReportPeriod
    modules: dict[str, bool]
    metrics: ReportMetrics
    workout_series: list[ReportPoint]
    student_activity: list[StudentActivity]
