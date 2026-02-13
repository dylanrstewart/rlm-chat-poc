from uuid import UUID

from fastapi import APIRouter, Depends, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.repositories.file_repository import FileRepository
from app.schemas.common import ApiResponse
from app.schemas.file import FileContentRead, FileRead
from app.services.ingest import ingest_file
from app.services.milvus_service import MilvusService

router = APIRouter(tags=["files"])


@router.post(
    "/api/knowledge-bases/{kb_id}/files",
    response_model=ApiResponse[list[FileRead]],
)
async def upload_files(
    kb_id: UUID,
    user_id: UUID,
    files: list[UploadFile],
    db: AsyncSession = Depends(get_db),
):
    milvus = MilvusService()
    results = []
    for upload in files:
        content = await upload.read()
        db_file = await ingest_file(
            content=content,
            filename=upload.filename or "unnamed",
            knowledge_base_id=kb_id,
            user_id=user_id,
            db=db,
            milvus=milvus,
        )
        results.append(FileRead.model_validate(db_file))
    return ApiResponse(success=True, data=results)


@router.get(
    "/api/knowledge-bases/{kb_id}/files",
    response_model=ApiResponse[list[FileRead]],
)
async def list_files(kb_id: UUID, db: AsyncSession = Depends(get_db)):
    repo = FileRepository(db)
    files = await repo.find_by_knowledge_base(kb_id)
    return ApiResponse(success=True, data=[FileRead.model_validate(f) for f in files])


@router.delete("/api/files/{file_id}", response_model=ApiResponse[bool])
async def delete_file(file_id: UUID, db: AsyncSession = Depends(get_db)):
    repo = FileRepository(db)
    f = await repo.find_by_id(file_id)
    if not f:
        return ApiResponse(success=False, error="File not found")

    try:
        milvus = MilvusService()
        from app.repositories.knowledge_base_repository import KnowledgeBaseRepository
        kb_repo = KnowledgeBaseRepository(db)
        kb = await kb_repo.find_by_id(f.knowledge_base_id)
        if kb:
            milvus.delete_by_file_id(kb.milvus_collection, str(file_id))
    except Exception:
        pass

    await repo.delete(file_id)
    await db.commit()
    return ApiResponse(success=True, data=True)


@router.get("/api/files/{file_id}/content", response_model=ApiResponse[FileContentRead])
async def get_file_content(file_id: UUID, db: AsyncSession = Depends(get_db)):
    repo = FileRepository(db)
    f = await repo.find_by_id(file_id)
    if not f:
        return ApiResponse(success=False, error="File not found")
    return ApiResponse(
        success=True,
        data=FileContentRead(
            id=f.id,
            filename=f.filename,
            title=f.title,
            content=f.content,
            metadata=f.metadata_,
        ),
    )
