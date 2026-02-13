from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ChatMessage, ChatSession
from app.repositories.base import BaseRepository


class ChatSessionRepository(BaseRepository[ChatSession]):
    def __init__(self, db: AsyncSession):
        super().__init__(ChatSession, db)

    async def find_by_user(self, user_id: UUID) -> list[ChatSession]:
        stmt = (
            select(ChatSession)
            .where(ChatSession.user_id == user_id)
            .order_by(ChatSession.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())


class ChatMessageRepository(BaseRepository[ChatMessage]):
    def __init__(self, db: AsyncSession):
        super().__init__(ChatMessage, db)

    async def find_by_session(self, session_id: UUID) -> list[ChatMessage]:
        stmt = (
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.asc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
