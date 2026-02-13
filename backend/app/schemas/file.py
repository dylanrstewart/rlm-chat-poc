from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class FileRead(BaseModel):
    id: UUID
    user_id: UUID
    knowledge_base_id: UUID
    filename: str
    title: str | None
    file_type: str | None
    file_size_bytes: int | None
    chunk_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class FileContentRead(BaseModel):
    id: UUID
    filename: str
    title: str | None
    content: str | None
    metadata: dict | None = None

    model_config = {"from_attributes": True}
