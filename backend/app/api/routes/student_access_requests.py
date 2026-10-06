import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.deps import require_module, require_personal
from app.db.session import get_db
from app.models.user import User
from app.schemas.student_access_request import (
    StudentAccessRequestCreate,
    StudentAccessRequestCreated,
    StudentAccessRequestRead,
    StudentAccessRequestReject,
)
from app.services.student_access_request_service import approve_request, create_request, list_requests, reject_request

router = APIRouter()


@router.post("/public/{slug}", response_model=StudentAccessRequestCreated, status_code=202)
def public_create(slug: str, payload: StudentAccessRequestCreate, request: Request, db: Session = Depends(get_db)):
    client_key = request.client.host if request.client else "unknown"
    return create_request(db, slug, payload, client_key)


@router.get("", response_model=list[StudentAccessRequestRead], dependencies=[Depends(require_module("students"))])
def index(db: Session = Depends(get_db), personal: User = Depends(require_personal)):
    return list_requests(db, personal)


@router.post("/{request_id}/approve", response_model=StudentAccessRequestRead, dependencies=[Depends(require_module("students"))])
def approve(request_id: uuid.UUID, db: Session = Depends(get_db), personal: User = Depends(require_personal)):
    return approve_request(db, personal, request_id)


@router.post("/{request_id}/reject", response_model=StudentAccessRequestRead, dependencies=[Depends(require_module("students"))])
def reject(request_id: uuid.UUID, payload: StudentAccessRequestReject, db: Session = Depends(get_db), personal: User = Depends(require_personal)):
    return reject_request(db, personal, request_id, payload.reason)
