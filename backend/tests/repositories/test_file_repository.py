import pytest

from app.models import KnowledgeBase, User
from app.repositories.file_repository import FileRepository


@pytest.fixture
async def setup(db_session):
    user = User(username="filerepouser")
    db_session.add(user)
    await db_session.flush()

    kb = KnowledgeBase(
        user_id=user.id,
        name="File Repo KB",
        milvus_collection="kb_filerepo",
    )
    db_session.add(kb)
    await db_session.flush()

    return user, kb


@pytest.mark.asyncio
async def test_create_file(db_session, setup):
    user, kb = setup
    repo = FileRepository(db_session)
    f = await repo.create(
        user_id=user.id,
        knowledge_base_id=kb.id,
        filename="doc.pdf",
        file_type="pdf",
        content="PDF content",
        file_size_bytes=5000,
    )
    assert f.filename == "doc.pdf"
    assert f.chunk_count == 0


@pytest.mark.asyncio
async def test_find_by_knowledge_base(db_session, setup):
    user, kb = setup
    repo = FileRepository(db_session)
    await repo.create(
        user_id=user.id,
        knowledge_base_id=kb.id,
        filename="a.txt",
    )
    await repo.create(
        user_id=user.id,
        knowledge_base_id=kb.id,
        filename="b.txt",
    )
    files = await repo.find_by_knowledge_base(kb.id)
    assert len(files) == 2


@pytest.mark.asyncio
async def test_update_chunk_count(db_session, setup):
    user, kb = setup
    repo = FileRepository(db_session)
    f = await repo.create(
        user_id=user.id,
        knowledge_base_id=kb.id,
        filename="c.txt",
    )
    updated = await repo.update(f.id, chunk_count=10)
    assert updated.chunk_count == 10
