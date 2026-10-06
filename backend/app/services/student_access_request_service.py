import time
import uuid
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.personal_branding import PersonalBranding
from app.models.student import Student
from app.models.student_access_request import StudentAccessRequest
from app.models.user import User, UserRole
from app.schemas.student_access_request import StudentAccessRequestCreate
from app.services.student_invite_service import access_status, create_invite

PUBLIC_ATTEMPTS: dict[str, list[float]] = defaultdict(list)
MAX_REQUESTS_PER_IP_HOUR = 10
MAX_REQUESTS_PER_EMAIL_DAY = 3


def _now():
    return datetime.now(timezone.utc)


def _normalize_email(value: str) -> str:
    return value.strip().lower()


def _rate_limit(key: str, limit: int, window: int) -> None:
    now_ts = time.time()
    PUBLIC_ATTEMPTS[key] = [attempt for attempt in PUBLIC_ATTEMPTS[key] if now_ts - attempt < window]
    if len(PUBLIC_ATTEMPTS[key]) >= limit:
        raise HTTPException(status_code=429, detail="Muitas solicitações. Aguarde antes de tentar novamente.")
    PUBLIC_ATTEMPTS[key].append(now_ts)


def _resolve_personal(db: Session, slug: str) -> tuple[User, PersonalBranding]:
    branding = db.scalar(select(PersonalBranding).where(PersonalBranding.slug == slug))
    personal = db.get(User, branding.personal_id) if branding else None
    if not personal or personal.role != UserRole.PERSONAL or not personal.is_active or personal.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Endereço de Personal não encontrado.")
    if branding.modules.get("students") is not True:
        raise HTTPException(status_code=403, detail="Este recurso não está disponível.")
    return personal, branding


def create_request(db: Session, slug: str, payload: StudentAccessRequestCreate, client_key: str) -> dict:
    personal, _ = _resolve_personal(db, slug)
    email = _normalize_email(str(payload.email))
    _rate_limit(f"ip:{client_key}", MAX_REQUESTS_PER_IP_HOUR, 3600)
    _rate_limit(f"email:{personal.id}:{email}", MAX_REQUESTS_PER_EMAIL_DAY, 86400)

    existing_student = db.scalar(select(Student).where(
        Student.personal_id == personal.id,
        func.lower(func.trim(Student.email)) == email,
    ))
    if existing_student:
        current, _ = access_status(db, existing_student)
        if current == "active":
            raise HTTPException(status_code=409, detail="Já existe um acesso para este e-mail. Entre na sua conta ou utilize a recuperação de senha.")
        raise HTTPException(status_code=409, detail="Este e-mail já está cadastrado com o Personal. Entre em contato para receber seu convite.")

    pending = db.scalar(select(StudentAccessRequest).where(
        StudentAccessRequest.personal_id == personal.id,
        StudentAccessRequest.email == email,
        StudentAccessRequest.status == "PENDING",
    ))
    if pending:
        raise HTTPException(status_code=409, detail="Já existe uma solicitação de acesso pendente para este e-mail.")

    request_row = StudentAccessRequest(
        personal_id=personal.id,
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=email,
    )
    db.add(request_row)
    db.flush()
    db.add(AuditLog(
        actor_user_id=None,
        action="student_access_request_created",
        entity_type="student_access_request",
        entity_id=str(request_row.id),
        details={"personal_id": str(personal.id)},
    ))
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Já existe uma solicitação de acesso pendente para este e-mail.") from exc
    return {"status": "PENDING", "detail": "Solicitação enviada. Seu Personal precisa aprovar seu acesso."}


def list_requests(db: Session, personal: User) -> list[StudentAccessRequest]:
    return list(db.scalars(select(StudentAccessRequest).where(
        StudentAccessRequest.personal_id == personal.id,
        StudentAccessRequest.status == "PENDING",
    ).order_by(StudentAccessRequest.created_at.desc())))


def _owned_pending(db: Session, personal: User, request_id: uuid.UUID) -> StudentAccessRequest:
    request_row = db.scalar(select(StudentAccessRequest).where(
        StudentAccessRequest.id == request_id,
        StudentAccessRequest.personal_id == personal.id,
    ).with_for_update())
    if not request_row:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada.")
    if request_row.status != "PENDING":
        raise HTTPException(status_code=409, detail="Esta solicitação já foi analisada.")
    return request_row


def approve_request(db: Session, personal: User, request_id: uuid.UUID) -> StudentAccessRequest:
    request_row = _owned_pending(db, personal, request_id)
    email = _normalize_email(request_row.email)
    student = db.scalar(select(Student).where(
        Student.personal_id == personal.id,
        func.lower(func.trim(Student.email)) == email,
    ).with_for_update())
    if student:
        current, _ = access_status(db, student)
        if current == "active":
            raise HTTPException(status_code=409, detail="Este aluno já possui acesso ativo.")
    else:
        student = Student(
            personal_id=personal.id,
            name=f"{request_row.first_name} {request_row.last_name}".strip(),
            email=email,
            age=None,
            weight=None,
            height=None,
            objective=None,
        )
        db.add(student)
        db.flush()

    now = _now()
    request_row.status = "APPROVED"
    request_row.student_id = student.id
    request_row.reviewed_at = now
    request_row.reviewed_by_id = personal.id
    create_invite(db, personal, student.id, commit=False)
    db.add(AuditLog(
        actor_user_id=personal.id,
        action="student_access_request_approved",
        entity_type="student_access_request",
        entity_id=str(request_row.id),
        details={"student_id": str(student.id)},
    ))
    db.commit()
    db.refresh(request_row)
    return request_row


def reject_request(db: Session, personal: User, request_id: uuid.UUID, reason: str | None) -> StudentAccessRequest:
    request_row = _owned_pending(db, personal, request_id)
    request_row.status = "REJECTED"
    request_row.rejection_reason = " ".join(reason.split()) if reason else None
    request_row.reviewed_at = _now()
    request_row.reviewed_by_id = personal.id
    db.add(AuditLog(
        actor_user_id=personal.id,
        action="student_access_request_rejected",
        entity_type="student_access_request",
        entity_id=str(request_row.id),
        details={},
    ))
    db.commit()
    db.refresh(request_row)
    return request_row
