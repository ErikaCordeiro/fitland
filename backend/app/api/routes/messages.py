import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import require_module, require_student_or_personal
from app.db.session import get_db
from app.models.user import User
from app.schemas.message import ConversationCreate, ConversationRead, MessageCreate, MessagePage, MessageRead, UnreadCount
from app.services.message_service import ensure_conversation, list_conversations, list_messages, mark_read, send_message, unread_count


router = APIRouter(dependencies=[Depends(require_module("messages"))])


@router.get("/conversations", response_model=list[ConversationRead])
def conversations(db: Session = Depends(get_db), user: User = Depends(require_student_or_personal)):
    return list_conversations(db, user)


@router.post("/conversations", response_model=ConversationRead, status_code=status.HTTP_201_CREATED)
def create_conversation(payload: ConversationCreate, db: Session = Depends(get_db), user: User = Depends(require_student_or_personal)):
    row = ensure_conversation(db, user, payload)
    return next(item for item in list_conversations(db, user) if item["id"] == row.id)


@router.get("/conversations/{conversation_id}/messages", response_model=MessagePage)
def messages(conversation_id: uuid.UUID, before: str | None = None, limit: int = Query(default=50, ge=1, le=100), db: Session = Depends(get_db), user: User = Depends(require_student_or_personal)):
    return list_messages(db, user, conversation_id, before, limit)


@router.post("/conversations/{conversation_id}/messages", response_model=MessageRead, status_code=status.HTTP_201_CREATED)
def create_message(conversation_id: uuid.UUID, payload: MessageCreate, db: Session = Depends(get_db), user: User = Depends(require_student_or_personal)):
    return send_message(db, user, conversation_id, payload)


@router.post("/conversations/{conversation_id}/read")
def read(conversation_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require_student_or_personal)):
    return {"read": mark_read(db, user, conversation_id)}


@router.get("/unread-count", response_model=UnreadCount)
def unread(db: Session = Depends(get_db), user: User = Depends(require_student_or_personal)):
    return {"count": unread_count(db, user)}
