import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


MESSAGE_MAX_LENGTH = 4000


class ConversationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    student_id: uuid.UUID | None = None


class MessageCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    body: str = Field(min_length=1, max_length=MESSAGE_MAX_LENGTH)

    @field_validator("body")
    @classmethod
    def body_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Message cannot be blank")
        return value


class MessageRead(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_role: str
    body: str
    created_at: datetime
    read_at: datetime | None


class MessagePage(BaseModel):
    items: list[MessageRead]
    next_before: str | None = None


class ConversationRead(BaseModel):
    id: uuid.UUID | None
    student_id: uuid.UUID
    student_name: str
    student_avatar_url: str | None = None
    last_message: str | None = None
    last_message_at: datetime | None = None
    unread_count: int = 0


class UnreadCount(BaseModel):
    count: int
