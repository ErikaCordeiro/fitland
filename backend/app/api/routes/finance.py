import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import require_module, require_personal, require_student_or_personal
from app.db.session import get_db
from app.models.user import User
from app.schemas.finance import ChargeCreate, ChargeRead, FinanceSummary, PaymentCreate
from app.services.finance_service import add_payment, cancel_charge, create_charge, list_charges, summary


router = APIRouter(dependencies=[Depends(require_module("finance"))])

@router.get("/charges", response_model=list[ChargeRead])
def charges(student_id: uuid.UUID | None = None, status_filter: str | None = Query(default=None, alias="status"), db: Session = Depends(get_db), user: User = Depends(require_student_or_personal)):
    return list_charges(db, user, student_id, status_filter)

@router.get("/summary", response_model=FinanceSummary)
def totals(month: date | None = None, db: Session = Depends(get_db), personal: User = Depends(require_personal)):
    return summary(db, personal, month)

@router.post("/charges", response_model=ChargeRead, status_code=status.HTTP_201_CREATED)
def create(payload: ChargeCreate, db: Session = Depends(get_db), personal: User = Depends(require_personal)):
    return create_charge(db, personal, payload)

@router.post("/charges/{charge_id}/payments", response_model=ChargeRead)
def payment(charge_id: uuid.UUID, payload: PaymentCreate, db: Session = Depends(get_db), personal: User = Depends(require_personal)):
    return add_payment(db, personal, charge_id, payload)

@router.post("/charges/{charge_id}/cancel", response_model=ChargeRead)
def cancel(charge_id: uuid.UUID, db: Session = Depends(get_db), personal: User = Depends(require_personal)):
    return cancel_charge(db, personal, charge_id)
