import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Student(Base):
    __tablename__ = "students"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    personal_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True, nullable=False)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True)
    name: Mapped[str] = mapped_column(String(140), nullable=False)
    email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    age: Mapped[int] = mapped_column(Integer, nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False)
    height: Mapped[float] = mapped_column(Float, nullable=False)
    objective: Mapped[str] = mapped_column(String(255), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    access_activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    personal = relationship("User", foreign_keys=[personal_id], back_populates="personal_students")
    user = relationship("User", foreign_keys=[user_id], back_populates="student_profile")
    workouts = relationship("Workout", back_populates="student", cascade="all, delete-orphan")
    progress_logs = relationship("ProgressLog", back_populates="student", cascade="all, delete-orphan")
    assessments = relationship("StudentAssessment", back_populates="student", cascade="all, delete-orphan")
    meal_plans = relationship("MealPlan", back_populates="student", cascade="all, delete-orphan")
