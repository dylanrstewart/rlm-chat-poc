from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    username: str = Field(min_length=1, max_length=100)


class UserRead(BaseModel):
    id: UUID
    username: str
    created_at: datetime

    model_config = {"from_attributes": True}
