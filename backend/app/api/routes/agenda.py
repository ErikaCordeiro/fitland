import uuid
from datetime import date

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import require_module, require_personal, require_student_or_personal
from app.db.session import get_db
from app.models.user import User
from app.schemas.agenda import AgendaEventCreate, AgendaEventUpdate, AgendaRangeRead
from app.services.agenda_service import create_event, delete_event, list_agenda, update_event


router = APIRouter(dependencies=[Depends(require_module("calendar"))])


@router.get("", response_model=AgendaRangeRead)
def agenda_range(start: date, end: date, db: Session = Depends(get_db), user: User = Depends(require_student_or_personal)):
    return list_agenda(db, user, start, end)


@router.post("/events", status_code=status.HTTP_201_CREATED)
def add_event(payload: AgendaEventCreate, db: Session = Depends(get_db), personal: User = Depends(require_personal)):
    return create_event(db, personal, payload)


@router.patch("/events/{event_id}")
def edit_event(event_id: uuid.UUID, payload: AgendaEventUpdate, db: Session = Depends(get_db), personal: User = Depends(require_personal)):
    return update_event(db, personal, event_id, payload)


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_event(event_id: uuid.UUID, db: Session = Depends(get_db), personal: User = Depends(require_personal)):
    delete_event(db, personal, event_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
