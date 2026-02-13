from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CollectionTopic
from app.repositories.base import BaseRepository


class TopicRepository(BaseRepository[CollectionTopic]):
    def __init__(self, db: AsyncSession):
        super().__init__(CollectionTopic, db)

    async def find_by_knowledge_base(self, kb_id: UUID) -> list[CollectionTopic]:
        stmt = select(CollectionTopic).where(CollectionTopic.knowledge_base_id == kb_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def delete_by_knowledge_base(self, kb_id: UUID) -> int:
        stmt = delete(CollectionTopic).where(CollectionTopic.knowledge_base_id == kb_id)
        result = await self.db.execute(stmt)
        return result.rowcount
