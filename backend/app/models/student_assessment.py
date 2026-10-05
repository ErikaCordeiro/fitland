import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class StudentAssessment(Base):
    __tablename__ = "student_assessments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    personal_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True, nullable=False)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id"), index=True, nullable=False)
    assessment_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    weight: Mapped[float | None] = mapped_column(Float)
    height: Mapped[float | None] = mapped_column(Float)
    neck: Mapped[float | None] = mapped_column(Float)
    shoulders: Mapped[float | None] = mapped_column(Float)
    chest: Mapped[float | None] = mapped_column(Float)
    right_arm: Mapped[float | None] = mapped_column(Float)
    left_arm: Mapped[float | None] = mapped_column(Float)
    right_forearm: Mapped[float | None] = mapped_column(Float)
    left_forearm: Mapped[float | None] = mapped_column(Float)
    waist: Mapped[float | None] = mapped_column(Float)
    abdomen: Mapped[float | None] = mapped_column(Float)
    hips: Mapped[float | None] = mapped_column(Float)
    glutes: Mapped[float | None] = mapped_column(Float)
    right_thigh: Mapped[float | None] = mapped_column(Float)
    left_thigh: Mapped[float | None] = mapped_column(Float)
    right_calf: Mapped[float | None] = mapped_column(Float)
    left_calf: Mapped[float | None] = mapped_column(Float)
    body_fat_percentage: Mapped[float | None] = mapped_column(Float)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    student = relationship("Student", back_populates="assessments")
