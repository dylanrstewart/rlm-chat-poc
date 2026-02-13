from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.repositories.topic_repository import TopicRepository
from app.schemas.common import ApiResponse
from app.schemas.topic import TopicRead
from app.services.clustering import cluster_knowledge_base
from app.services.milvus_service import MilvusService

router = APIRouter(prefix="/api/knowledge-bases", tags=["topics"])


@router.post("/{kb_id}/cluster", response_model=ApiResponse[list[TopicRead]])
async def trigger_clustering(kb_id: UUID, db: AsyncSession = Depends(get_db)):
    try:
        milvus = MilvusService()
        topics = await cluster_knowledge_base(kb_id, db, milvus)
        return ApiResponse(
            success=True,
            data=[TopicRead.model_validate(t) for t in topics],
        )
    except ValueError as e:
        return ApiResponse(success=False, error=str(e))
    except Exception as e:
        return ApiResponse(success=False, error=f"Clustering failed: {str(e)}")


@router.get("/{kb_id}/topics", response_model=ApiResponse[list[TopicRead]])
async def list_topics(kb_id: UUID, db: AsyncSession = Depends(get_db)):
    repo = TopicRepository(db)
    topics = await repo.find_by_knowledge_base(kb_id)
    return ApiResponse(success=True, data=[TopicRead.model_validate(t) for t in topics])
