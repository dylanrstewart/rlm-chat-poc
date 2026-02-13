from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import File
from app.repositories.base import BaseRepository


class FileRepository(BaseRepository[File]):
    def __init__(self, db: AsyncSession):
        super().__init__(File, db)

    async def find_by_knowledge_base(self, kb_id: UUID) -> list[File]:
        stmt = select(File).where(File.knowledge_base_id == kb_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def search_by_text(self, user_id: UUID, query: str, top_k: int = 5) -> list[dict]:
        """Full-text + trigram search across files."""
        sql = text("""
            SELECT
                f.id, f.filename, f.title, f.file_type,
                LEFT(f.content, 200) as content_preview,
                COALESCE(similarity(f.filename, :query), 0) * 3.0 +
                COALESCE(similarity(f.title, :query), 0) * 2.0 +
                COALESCE(ts_rank_cd(f.search_vector, plainto_tsquery('english', :query)), 0) AS relevance
            FROM files f
            WHERE f.user_id = :user_id
              AND (
                similarity(f.filename, :query) > 0.05
                OR similarity(f.title, :query) > 0.05
                OR f.search_vector @@ plainto_tsquery('english', :query)
              )
            ORDER BY relevance DESC
            LIMIT :top_k
        """)
        result = await self.db.execute(
            sql,
            {"user_id": str(user_id), "query": query, "top_k": top_k},
        )
        return [dict(r._mapping) for r in result.fetchall()]
