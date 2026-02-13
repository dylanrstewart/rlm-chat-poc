from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ChatSessionCreate(BaseModel):
    user_id: UUID
    title: str | None = None


class ChatSessionRead(BaseModel):
    id: UUID
    user_id: UUID
    title: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatMessageRead(BaseModel):
    id: UUID
    session_id: UUID
    role: str
    content: str
    metadata: dict | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatQueryRequest(BaseModel):
    query: str = Field(min_length=1)
    knowledge_base_ids: list[UUID] | None = None
