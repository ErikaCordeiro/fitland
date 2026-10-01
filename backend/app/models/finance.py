import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, ForeignKeyConstraint, Index, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class FinancialCharge(Base):
    __tablename__ = "financial_charges"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_financial_charges_amount_positive"),
        UniqueConstraint("id", "personal_id", "student_id", name="uq_financial_charge_tenant_student"),
        Index("ix_financial_charges_tenant_due", "personal_id", "due_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    personal_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True, nullable=False)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id"), index=True, nullable=False)
    description: Mapped[str] = mapped_column(String(180), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    due_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    payments = relationship("FinancialPayment", back_populates="charge", cascade="all, delete-orphan", order_by="FinancialPayment.paid_at")


class FinancialPayment(Base):
    __tablename__ = "financial_payments"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_financial_payments_amount_positive"),
        ForeignKeyConstraint(
            ["charge_id", "personal_id", "student_id"],
            ["financial_charges.id", "financial_charges.personal_id", "financial_charges.student_id"],
            name="fk_financial_payment_charge_tenant_student", ondelete="CASCADE",
        ),
        Index("ix_financial_payments_tenant_paid", "personal_id", "paid_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    charge_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True, nullable=False)
    personal_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True, nullable=False)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    paid_at: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    payment_method: Mapped[str | None] = mapped_column(String(32))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    charge = relationship("FinancialCharge", back_populates="payments")
