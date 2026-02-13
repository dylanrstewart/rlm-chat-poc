from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import File, KnowledgeBase
from app.repositories.file_repository import FileRepository
from app.repositories.knowledge_base_repository import KnowledgeBaseRepository
from app.services.embedding import embed_texts
from app.services.milvus_service import MilvusService
from app.utils.chunking import chunk_text
from app.utils.text_extraction import extract_text, get_file_type


async def ingest_file(
    content: bytes,
    filename: str,
    knowledge_base_id: UUID,
    user_id: UUID,
    db: AsyncSession,
    milvus: MilvusService,
) -> File:
    """Full ingest pipeline: extract → store → chunk → embed → Milvus insert."""
    file_repo = FileRepository(db)
    kb_repo = KnowledgeBaseRepository(db)

    # 1. Extract text
    text = extract_text(content, filename)
    file_type = get_file_type(filename)

    # 2. Save to Postgres
    db_file = await file_repo.create(
        user_id=user_id,
        knowledge_base_id=knowledge_base_id,
        filename=filename,
        title=filename.rsplit(".", 1)[0] if "." in filename else filename,
        file_type=file_type,
        content=text,
        file_size_bytes=len(content),
    )

    # 3. Chunk
    chunks = chunk_text(text, chunk_size=800, overlap=100)
    if not chunks:
        await db.commit()
        return db_file

    # 4. Embed
    embeddings = await embed_texts([c.text for c in chunks])

    # 5. Get KB for collection name
    kb = await kb_repo.find_by_id(knowledge_base_id)

    # 6. Insert into Milvus
    milvus_data = [
        {
            "id": str(uuid4()),
            "vector": emb,
            "text": chunk.text[:8192],
            "file_id": str(db_file.id),
            "chunk_index": chunk.index,
            "user_id": str(user_id),
            "topic_l1": "",
            "topic_l2": "",
            "topic_keywords": "",
        }
        for chunk, emb in zip(chunks, embeddings)
    ]
    milvus.insert(kb.milvus_collection, milvus_data)

    # 7. Update chunk count
    await file_repo.update(db_file.id, chunk_count=len(chunks))
    await db.commit()

    return db_file
