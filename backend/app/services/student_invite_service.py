import hashlib
import secrets
import smtplib
import time
import unicodedata
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.models.audit_log import AuditLog
from app.models.personal_branding import PersonalBranding
from app.models.student import Student
from app.models.student_access_invite import StudentAccessInvite
from app.models.user import User, UserRole
from app.schemas.student import StudentAccessActivation
from app.services.access import get_owned_student
from app.services.email_service import send_student_access_invite_email

INVITE_HOURS = 24
INVITE_ATTEMPTS: dict[str, list[float]] = defaultdict(list)
MAX_INVITES_PER_HOUR = 3
TOKEN_ATTEMPTS: dict[str, list[float]] = defaultdict(list)
MAX_TOKEN_ATTEMPTS = 10
TOKEN_ATTEMPT_WINDOW = 15 * 60

def _now(): return datetime.now(timezone.utc)
def _digest(token: str) -> str: return hashlib.sha256(token.encode("utf-8")).hexdigest()
def _aware(value): return value if value.tzinfo else value.replace(tzinfo=timezone.utc)

def _check_token_rate_limit(token: str) -> None:
    key = _digest(token)
    now_ts = time.time()
    TOKEN_ATTEMPTS[key] = [item for item in TOKEN_ATTEMPTS[key] if now_ts - item < TOKEN_ATTEMPT_WINDOW]
    if len(TOKEN_ATTEMPTS[key]) >= MAX_TOKEN_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Muitas tentativas. Aguarde antes de tentar novamente.")
    TOKEN_ATTEMPTS[key].append(now_ts)

def _normalize_name(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.strip().casefold())
    return " ".join("".join(char for char in normalized if not unicodedata.combining(char)).split())

def access_status(db: Session, student: Student) -> tuple[str, datetime | None]:
    if student.user_id:
        user = db.get(User, student.user_id)
        if user and user.role == UserRole.STUDENT and user.is_active and user.deleted_at is None and user.account_status == "active":
            return "active", student.access_activated_at
    invite = db.scalar(select(StudentAccessInvite).where(StudentAccessInvite.student_id == student.id, StudentAccessInvite.used_at.is_(None), StudentAccessInvite.revoked_at.is_(None)).order_by(StudentAccessInvite.created_at.desc()))
    if invite and _aware(invite.expires_at) > _now(): return "pending", invite.expires_at
    if invite: return "expired", invite.expires_at
    return "no_access", None

def create_invite(db: Session, personal: User, student_id: uuid.UUID, *, commit: bool = True) -> dict:
    student = get_owned_student(db, student_id, personal)
    current, _ = access_status(db, student)
    if current == "active": raise HTTPException(status_code=409, detail="Este aluno já possui acesso ativo.")
    key = f"{personal.id}:{student.id}"; now_ts = time.time()
    INVITE_ATTEMPTS[key] = [item for item in INVITE_ATTEMPTS[key] if now_ts - item < 3600]
    if len(INVITE_ATTEMPTS[key]) >= MAX_INVITES_PER_HOUR: raise HTTPException(status_code=429, detail="Aguarde antes de reenviar outro convite.")
    branding = db.scalar(select(PersonalBranding).where(PersonalBranding.personal_id == personal.id))
    if not branding or not branding.slug: raise HTTPException(status_code=409, detail="O Personal precisa de um endereço de acesso configurado.")
    token = secrets.token_urlsafe(32); now = _now(); expires = now + timedelta(hours=INVITE_HOURS)
    pending = db.scalars(select(StudentAccessInvite).where(StudentAccessInvite.student_id == student.id, StudentAccessInvite.used_at.is_(None), StudentAccessInvite.revoked_at.is_(None))).all()
    for old in pending: old.revoked_at = now
    invite = StudentAccessInvite(personal_id=personal.id, student_id=student.id, created_by_id=personal.id, token_hash=_digest(token), expires_at=expires)
    db.add(invite); db.flush()
    url = f"{settings.FRONTEND_URL.rstrip('/')}/personal/{branding.slug}/aluno/primeiro-acesso?{urlencode({'token': token})}"
    try:
        send_student_access_invite_email(student.email, url, branding.display_name)
    except (OSError, RuntimeError, smtplib.SMTPException) as exc:
        db.rollback(); raise HTTPException(status_code=503, detail="O envio de e-mail ainda não está configurado.") from exc
    db.add(AuditLog(actor_user_id=personal.id, action="student_access_invite_resent" if pending else "student_access_invite_created", entity_type="student", entity_id=str(student.id), details={"expires_at": expires.isoformat()}))
    if commit:
        db.commit()
    else:
        db.flush()
    INVITE_ATTEMPTS[key].append(now_ts)
    return {"status": "pending", "expires_at": expires, "delivery": "email"}

def _find_invite(db: Session, token: str, slug: str) -> tuple[StudentAccessInvite, Student, PersonalBranding]:
    _check_token_rate_limit(token)
    invite = db.scalar(select(StudentAccessInvite).where(StudentAccessInvite.token_hash == _digest(token)))
    if not invite or invite.used_at is not None or invite.revoked_at is not None: raise HTTPException(status_code=400, detail="Este convite já foi utilizado ou não é mais válido.")
    if _aware(invite.expires_at) <= _now(): raise HTTPException(status_code=410, detail="Este convite expirou. Peça ao seu Personal um novo convite de acesso.")
    student = db.get(Student, invite.student_id); branding = db.scalar(select(PersonalBranding).where(PersonalBranding.personal_id == invite.personal_id, PersonalBranding.slug == slug))
    if not student or not branding or student.personal_id != invite.personal_id: raise HTTPException(status_code=400, detail="Convite inválido.")
    return invite, student, branding

def validate_invite(db: Session, token: str, slug: str) -> dict:
    invite, _, _ = _find_invite(db, token, slug)
    return {"valid": True, "status": "pending", "expires_at": invite.expires_at}

def activate_invite(db: Session, payload: StudentAccessActivation) -> str:
    invite, student, branding = _find_invite(db, payload.token, payload.slug)
    expected = _normalize_name(student.name).split(); supplied = _normalize_name(f"{payload.first_name} {payload.last_name}").split()
    if not expected or not supplied or expected[0] != supplied[0] or (len(expected) > 1 and expected[-1] != supplied[-1]): raise HTTPException(status_code=422, detail="Os dados informados não correspondem ao cadastro.")
    if payload.new_password != payload.confirm_password: raise HTTPException(status_code=422, detail="As senhas não coincidem.")
    if student.user_id: raise HTTPException(status_code=409, detail="Este aluno já possui acesso ativo.")
    if db.scalar(select(User).where(func.lower(func.trim(User.email)) == student.email.strip().lower())): raise HTTPException(status_code=409, detail="Este e-mail já possui uma conta.")
    now = _now(); user = User(name=student.name, email=student.email.strip().lower(), hashed_password=hash_password(payload.new_password), role=UserRole.STUDENT, is_active=True, account_status="active", must_change_password=False)
    db.add(user); db.flush(); student.user_id = user.id; student.access_activated_at = now; invite.used_at = now
    db.add(AuditLog(actor_user_id=user.id, action="student_access_activated", entity_type="student", entity_id=str(student.id), details={"personal_id": str(student.personal_id)}))
    db.commit(); return branding.slug
