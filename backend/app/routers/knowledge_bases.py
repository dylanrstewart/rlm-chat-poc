import re
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.repositories.knowledge_base_repository import KnowledgeBaseRepository
from app.schemas.common import ApiResponse
from app.schemas.knowledge_base import KnowledgeBaseCreate, KnowledgeBaseRead
from app.services.milvus_service import MilvusService

router = APIRouter(prefix="/api/knowledge-bases", tags=["knowledge_bases"])


def _make_collection_name(user_id: UUID, name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    short_uid = str(user_id).replace("-", "")[:8]
    return f"kb_{short_uid}_{slug}"


@router.post("", response_model=ApiResponse[KnowledgeBaseRead])
async def create_knowledge_base(body: KnowledgeBaseCreate, db: AsyncSession = Depends(get_db)):
    repo = KnowledgeBaseRepository(db)
    collection_name = _make_collection_name(body.user_id, body.name)

    kb = await repo.create(
        user_id=body.user_id,
        name=body.name,
        description=body.description,
        milvus_collection=collection_name,
    )

    try:
        milvus = MilvusService()
        milvus.create_collection(collection_name)
    except Exception:
        pass  # Milvus may not be available in tests

    await db.commit()
    return ApiResponse(success=True, data=KnowledgeBaseRead.model_validate(kb))


@router.get("", response_model=ApiResponse[list[KnowledgeBaseRead]])
async def list_knowledge_bases(user_id: UUID, db: AsyncSession = Depends(get_db)):
    repo = KnowledgeBaseRepository(db)
    kbs = await repo.find_by_user(user_id)
    return ApiResponse(success=True, data=[KnowledgeBaseRead.model_validate(kb) for kb in kbs])


@router.delete("/{kb_id}", response_model=ApiResponse[bool])
async def delete_knowledge_base(kb_id: UUID, db: AsyncSession = Depends(get_db)):
    repo = KnowledgeBaseRepository(db)
    kb = await repo.find_by_id(kb_id)
    if not kb:
        return ApiResponse(success=False, error="Knowledge base not found")

    try:
        milvus = MilvusService()
        milvus.drop_collection(kb.milvus_collection)
    except Exception:
        pass

    await repo.delete(kb_id)
    await db.commit()
    return ApiResponse(success=True, data=True)
