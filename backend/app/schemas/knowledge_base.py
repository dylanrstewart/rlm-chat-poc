from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class KnowledgeBaseCreate(BaseModel):
    user_id: UUID
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None


class KnowledgeBaseRead(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    description: str | None
    milvus_collection: str
    created_at: datetime

    model_config = {"from_attributes": True}
