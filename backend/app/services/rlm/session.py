from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.knowledge_base_repository import KnowledgeBaseRepository
from app.services.embedding import embed_text
from app.services.milvus_service import MilvusService
from app.services.rlm.tools import create_user_tools


@dataclass
class RLMSession:
    user_id: str
    tools: dict
    tool_descriptions: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    last_used: datetime = field(default_factory=datetime.utcnow)


class SessionManager:
    def __init__(self):
        self.sessions: dict[str, RLMSession] = {}

    async def get_or_create(
        self,
        user_id: str,
        db: AsyncSession,
        milvus: MilvusService,
    ) -> RLMSession:
        # Always recreate tools with the current DB session —
        # cached sessions hold a stale/closed session from a previous request.
        kb_repo = KnowledgeBaseRepository(db)
        kbs = await kb_repo.find_by_user(user_id)

        tools, descriptions = create_user_tools(
            user_id=user_id,
            db_session=db,
            milvus_client=milvus,
            embed_fn=embed_text,
            knowledge_bases=kbs,
        )

        session = RLMSession(
            user_id=user_id,
            tools=tools,
            tool_descriptions=descriptions,
        )
        self.sessions[user_id] = session
        return session

    def invalidate(self, user_id: str):
        """Call when user's KBs change (new upload, new KB, etc.)"""
        self.sessions.pop(user_id, None)


session_manager = SessionManager()
