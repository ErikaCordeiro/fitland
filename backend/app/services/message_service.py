import base64
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.message import Conversation, Message
from app.models.student import Student
from app.models.user import User, UserRole
from app.schemas.message import ConversationCreate, MessageCreate
from app.services.access import get_owned_student


def _student_profile(db: Session, user: User) -> Student:
    student = db.scalar(select(Student).where(Student.user_id == user.id))
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
    return student


def _identity(db: Session, user: User) -> tuple[uuid.UUID, uuid.UUID | None, str]:
    if user.role == UserRole.PERSONAL:
        return user.id, None, "personal"
    student = _student_profile(db, user)
    return student.personal_id, student.id, "student"


def _owned_conversation(db: Session, user: User, conversation_id: uuid.UUID) -> Conversation:
    conversation = db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    personal_id, student_id, _ = _identity(db, user)
    if conversation.personal_id != personal_id or (student_id and conversation.student_id != student_id):
        raise HTTPException(status_code=403, detail="Forbidden resource")
    return conversation


def ensure_conversation(db: Session, user: User, payload: ConversationCreate) -> Conversation:
    if user.role == UserRole.PERSONAL:
        if payload.student_id is None:
            raise HTTPException(status_code=422, detail="Student is required")
        student = get_owned_student(db, payload.student_id, user)
    else:
        student = _student_profile(db, user)
        if payload.student_id is not None and payload.student_id != student.id:
            raise HTTPException(status_code=403, detail="Forbidden resource")
    existing = db.scalar(select(Conversation).where(
        Conversation.personal_id == student.personal_id,
        Conversation.student_id == student.id,
    ))
    if existing:
        return existing
    conversation = Conversation(personal_id=student.personal_id, student_id=student.id)
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


def list_conversations(db: Session, user: User) -> list[dict]:
    personal_id, own_student_id, role = _identity(db, user)
    latest_body = select(Message.body).where(Message.conversation_id == Conversation.id).order_by(Message.created_at.desc(), Message.id.desc()).limit(1).scalar_subquery()
    latest_at = select(Message.created_at).where(Message.conversation_id == Conversation.id).order_by(Message.created_at.desc(), Message.id.desc()).limit(1).scalar_subquery()
    unread = select(func.count(Message.id)).where(
        Message.conversation_id == Conversation.id,
        Message.sender_role != role,
        Message.read_at.is_(None),
    ).correlate(Conversation).scalar_subquery()
    query = select(
        Conversation.id,
        Student.id,
        Student.name,
        User.avatar_url,
        latest_body.label("last_message"),
        latest_at.label("last_message_at"),
        unread.label("unread_count"),
    ).select_from(Student).join(User, User.id == Student.user_id, isouter=True).join(
        Conversation,
        and_(Conversation.personal_id == Student.personal_id, Conversation.student_id == Student.id),
        isouter=True,
    ).where(Student.personal_id == personal_id)
    if own_student_id:
        query = query.where(Student.id == own_student_id)
    rows = db.execute(query.order_by(latest_at.desc().nullslast(), Student.name.asc())).all()
    return [{
        "id": row[0], "student_id": row[1], "student_name": row[2], "student_avatar_url": row[3],
        "last_message": row[4], "last_message_at": row[5], "unread_count": int(row[6] or 0),
    } for row in rows]


def _cursor_encode(message: Message) -> str:
    raw = f"{message.created_at.isoformat()}|{message.id}"
    return base64.urlsafe_b64encode(raw.encode()).decode().rstrip("=")


def _cursor_decode(value: str) -> tuple[datetime, uuid.UUID]:
    try:
        padded = value + "=" * (-len(value) % 4)
        created, message_id = base64.urlsafe_b64decode(padded).decode().rsplit("|", 1)
        return datetime.fromisoformat(created), uuid.UUID(message_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=422, detail="Invalid message cursor")


def list_messages(db: Session, user: User, conversation_id: uuid.UUID, before: str | None, limit: int) -> dict:
    conversation = _owned_conversation(db, user, conversation_id)
    query = select(Message).where(Message.conversation_id == conversation.id)
    if before:
        created, message_id = _cursor_decode(before)
        query = query.where(or_(Message.created_at < created, and_(Message.created_at == created, Message.id < message_id)))
    rows = list(db.scalars(query.order_by(Message.created_at.desc(), Message.id.desc()).limit(limit + 1)).all())
    has_more = len(rows) > limit
    page = rows[:limit]
    return {"items": list(reversed(page)), "next_before": _cursor_encode(page[-1]) if has_more and page else None}


def send_message(db: Session, user: User, conversation_id: uuid.UUID, payload: MessageCreate) -> Message:
    conversation = _owned_conversation(db, user, conversation_id)
    _, _, role = _identity(db, user)
    message = Message(
        conversation_id=conversation.id, personal_id=conversation.personal_id, student_id=conversation.student_id,
        sender_role=role, sender_user_id=user.id, body=payload.body,
    )
    conversation.updated_at = datetime.now(timezone.utc)
    db.add(message)
    db.flush()
    db.add(AuditLog(actor_user_id=user.id, action="message_sent", entity_type="message", entity_id=str(message.id), details={"conversation_id": str(conversation.id)}))
    db.commit()
    db.refresh(message)
    return message


def mark_read(db: Session, user: User, conversation_id: uuid.UUID) -> int:
    conversation = _owned_conversation(db, user, conversation_id)
    _, _, role = _identity(db, user)
    rows = list(db.scalars(select(Message).where(
        Message.conversation_id == conversation.id,
        Message.sender_role != role,
        Message.read_at.is_(None),
    )).all())
    now = datetime.now(timezone.utc)
    for message in rows:
        message.read_at = now
    db.commit()
    return len(rows)


def unread_count(db: Session, user: User) -> int:
    personal_id, student_id, role = _identity(db, user)
    query = select(func.count(Message.id)).where(
        Message.personal_id == personal_id,
        Message.sender_role != role,
        Message.read_at.is_(None),
    )
    if student_id:
        query = query.where(Message.student_id == student_id)
    return int(db.scalar(query) or 0)
