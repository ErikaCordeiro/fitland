import uuid
from datetime import date, datetime
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.audit_log import AuditLog
from app.models.finance import FinancialCharge, FinancialPayment
from app.models.student import Student
from app.models.user import User, UserRole
from app.schemas.finance import ChargeCreate, PaymentCreate
from app.services.access import get_owned_student


ZERO = Decimal("0.00")


def _student(db: Session, user: User, student_id: uuid.UUID | None = None) -> Student:
    if user.role == UserRole.STUDENT:
        row = db.scalar(select(Student).where(Student.user_id == user.id))
        if not row: raise HTTPException(status_code=404, detail="Student profile not found")
        if student_id and student_id != row.id: raise HTTPException(status_code=403, detail="Forbidden resource")
        return row
    if student_id is None: raise HTTPException(status_code=422, detail="Student is required")
    return get_owned_student(db, student_id, user)


def _paid(charge: FinancialCharge) -> Decimal:
    return sum((payment.amount for payment in charge.payments), ZERO)


def _status(charge: FinancialCharge, today: date | None = None) -> str:
    if charge.cancelled_at: return "cancelled"
    paid = _paid(charge)
    if paid >= charge.amount: return "paid"
    if paid > ZERO: return "partial"
    return "overdue" if charge.due_date < (today or date.today()) else "pending"


def serialize(charge: FinancialCharge) -> dict:
    paid = _paid(charge); balance = max(ZERO, charge.amount - paid)
    return {"id": charge.id, "personal_id": charge.personal_id, "student_id": charge.student_id, "description": charge.description, "amount": charge.amount, "paid_amount": paid, "balance": balance, "due_date": charge.due_date, "notes": charge.notes, "status": _status(charge), "cancelled_at": charge.cancelled_at, "created_at": charge.created_at, "updated_at": charge.updated_at, "payments": [{"id": p.id, "charge_id": p.charge_id, "amount": p.amount, "paid_at": p.paid_at, "payment_method": p.payment_method, "notes": p.notes, "created_at": p.created_at} for p in charge.payments]}


def _query(): return select(FinancialCharge).options(selectinload(FinancialCharge.payments))


def list_charges(db: Session, user: User, student_id: uuid.UUID | None = None, status: str | None = None) -> list[dict]:
    student = _student(db, user, student_id) if user.role == UserRole.STUDENT or student_id else None
    personal_id = student.personal_id if student else user.id
    query = _query().where(FinancialCharge.personal_id == personal_id)
    if student: query = query.where(FinancialCharge.student_id == student.id)
    rows = [serialize(row) for row in db.scalars(query.order_by(FinancialCharge.due_date.desc(), FinancialCharge.created_at.desc())).all()]
    return [row for row in rows if not status or row["status"] == status]


def summary(db: Session, personal: User, month: date | None = None) -> dict:
    rows = list_charges(db, personal); selected = month or date.today()
    open_rows = [r for r in rows if r["status"] not in {"paid", "cancelled"}]
    received = sum((p["amount"] for row in rows for p in row["payments"] if p["paid_at"].year == selected.year and p["paid_at"].month == selected.month), ZERO)
    return {"receivable": sum((r["balance"] for r in open_rows), ZERO), "received_month": received, "overdue": sum((r["balance"] for r in open_rows if r["due_date"] < date.today()), ZERO), "pending_count": len(open_rows)}


def create_charge(db: Session, personal: User, payload: ChargeCreate) -> dict:
    student = get_owned_student(db, payload.student_id, personal)
    charge = FinancialCharge(personal_id=personal.id, student_id=student.id, description=payload.description.strip(), amount=payload.amount, due_date=payload.due_date, notes=payload.notes.strip() if payload.notes else None)
    db.add(charge); db.flush(); db.add(AuditLog(actor_user_id=personal.id, action="financial_charge_created", entity_type="financial_charge", entity_id=str(charge.id), details={"student_id": str(student.id)})); db.commit()
    return serialize(db.scalar(_query().where(FinancialCharge.id == charge.id)))


def _owned_charge(db: Session, personal: User, charge_id: uuid.UUID, lock: bool = False) -> FinancialCharge:
    query = _query().where(FinancialCharge.id == charge_id)
    if lock: query = query.with_for_update()
    charge = db.scalar(query)
    if not charge: raise HTTPException(status_code=404, detail="Cobrança não encontrada")
    get_owned_student(db, charge.student_id, personal)
    if charge.personal_id != personal.id: raise HTTPException(status_code=403, detail="Forbidden resource")
    return charge


def add_payment(db: Session, personal: User, charge_id: uuid.UUID, payload: PaymentCreate) -> dict:
    try:
        charge = _owned_charge(db, personal, charge_id, True)
        if charge.cancelled_at: raise HTTPException(status_code=409, detail="Cobrança cancelada")
        balance = charge.amount - _paid(charge)
        if payload.amount > balance: raise HTTPException(status_code=409, detail="Valor recebido excede o saldo da cobrança")
        payment = FinancialPayment(charge_id=charge.id, personal_id=charge.personal_id, student_id=charge.student_id, amount=payload.amount, paid_at=payload.paid_at, payment_method=payload.payment_method, notes=payload.notes.strip() if payload.notes else None)
        db.add(payment); db.flush(); db.add(AuditLog(actor_user_id=personal.id, action="financial_payment_recorded", entity_type="financial_payment", entity_id=str(payment.id), details={"charge_id": str(charge.id)})); db.commit()
        return serialize(db.scalar(_query().where(FinancialCharge.id == charge.id)))
    except Exception: db.rollback(); raise


def cancel_charge(db: Session, personal: User, charge_id: uuid.UUID) -> dict:
    charge = _owned_charge(db, personal, charge_id, True)
    if _paid(charge) > ZERO: raise HTTPException(status_code=409, detail="Cobrança com pagamento não pode ser cancelada")
    if not charge.cancelled_at: charge.cancelled_at = datetime.utcnow(); db.add(AuditLog(actor_user_id=personal.id, action="financial_charge_cancelled", entity_type="financial_charge", entity_id=str(charge.id)))
    db.commit(); return serialize(db.scalar(_query().where(FinancialCharge.id == charge.id)))
