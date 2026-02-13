from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class TopicRead(BaseModel):
    id: UUID
    knowledge_base_id: UUID
    topic_level: int
    topic_label: str
    topic_id: int
    doc_count: int
    sample_keywords: list[str] | None
    parent_topic_id: UUID | None
    updated_at: datetime

    model_config = {"from_attributes": True}
