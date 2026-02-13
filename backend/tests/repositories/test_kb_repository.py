import pytest

from app.models import User
from app.repositories.knowledge_base_repository import KnowledgeBaseRepository
from tests.db_fixture import db_session  # noqa: F401


async def _create_user(db_session, username="testuser"):
    user = User(username=username)
    db_session.add(user)
    await db_session.flush()
    return user


@pytest.mark.asyncio
async def test_create_kb(db_session):
    user = await _create_user(db_session)
    repo = KnowledgeBaseRepository(db_session)
    kb = await repo.create(
        user_id=user.id,
        name="My KB",
        description="Test",
        milvus_collection="kb_001",
    )
    assert kb.name == "My KB"
    assert kb.milvus_collection == "kb_001"


@pytest.mark.asyncio
async def test_find_by_user(db_session):
    user = await _create_user(db_session)
    repo = KnowledgeBaseRepository(db_session)
    await repo.create(user_id=user.id, name="KB1", milvus_collection="kb_a")
    await repo.create(user_id=user.id, name="KB2", milvus_collection="kb_b")

    kbs = await repo.find_by_user(user.id)
    assert len(kbs) == 2


@pytest.mark.asyncio
async def test_delete_kb(db_session):
    user = await _create_user(db_session)
    repo = KnowledgeBaseRepository(db_session)
    kb = await repo.create(user_id=user.id, name="Del KB", milvus_collection="kb_del")
    deleted = await repo.delete(kb.id)
    assert deleted is True
    assert await repo.find_by_id(kb.id) is None
