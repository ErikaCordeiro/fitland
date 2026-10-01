import math
import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator


MONEY = Decimal("0.01")
PAYMENT_METHODS = {"pix", "cash", "card", "transfer", "other"}


class ChargeCreate(BaseModel):
    student_id: uuid.UUID
    description: str = Field(min_length=1, max_length=180)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    due_date: date
    notes: str | None = Field(default=None, max_length=3000)

    @field_validator("amount")
    @classmethod
    def finite_money(cls, value):
        if not value.is_finite(): raise ValueError("Amount must be finite")
        return value.quantize(MONEY)


class PaymentCreate(BaseModel):
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    paid_at: date
    payment_method: str | None = None
    notes: str | None = Field(default=None, max_length=3000)

    @field_validator("amount")
    @classmethod
    def finite_money(cls, value):
        if not value.is_finite(): raise ValueError("Amount must be finite")
        return value.quantize(MONEY)

    @field_validator("payment_method")
    @classmethod
    def valid_method(cls, value):
        if value is not None and value not in PAYMENT_METHODS: raise ValueError("Unsupported payment method")
        return value


class PaymentRead(BaseModel):
    id: uuid.UUID
    charge_id: uuid.UUID
    amount: Decimal
    paid_at: date
    payment_method: str | None
    notes: str | None
    created_at: datetime


class ChargeRead(BaseModel):
    id: uuid.UUID
    personal_id: uuid.UUID
    student_id: uuid.UUID
    description: str
    amount: Decimal
    paid_amount: Decimal
    balance: Decimal
    due_date: date
    notes: str | None
    status: str
    cancelled_at: datetime | None
    payments: list[PaymentRead]
    created_at: datetime
    updated_at: datetime


class FinanceSummary(BaseModel):
    receivable: Decimal
    received_month: Decimal
    overdue: Decimal
    pending_count: int
