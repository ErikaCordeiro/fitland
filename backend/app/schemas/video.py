import uuid
from datetime import datetime

from pydantic import BaseModel, Field, HttpUrl


class VideoCreate(BaseModel):
    exercise_id: uuid.UUID
    title: str = Field(min_length=2, max_length=160)
    provider: str = Field(default="youtube", max_length=40)
    url: HttpUrl
    embed_url: HttpUrl


class VideoUpsert(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    provider: str = Field(default="youtube", max_length=40)
    url: HttpUrl
    embed_url: HttpUrl


class VideoRead(BaseModel):
    id: uuid.UUID
    exercise_id: uuid.UUID
    title: str
    provider: str
    url: str
    embed_url: str
    created_at: datetime

    model_config = {"from_attributes": True}
