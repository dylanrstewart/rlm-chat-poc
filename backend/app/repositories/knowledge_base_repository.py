from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import KnowledgeBase
from app.repositories.base import BaseRepository


class KnowledgeBaseRepository(BaseRepository[KnowledgeBase]):
    def __init__(self, db: AsyncSession):
        super().__init__(KnowledgeBase, db)

    async def find_by_user(self, user_id: UUID) -> list[KnowledgeBase]:
        stmt = select(KnowledgeBase).where(KnowledgeBase.user_id == user_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
