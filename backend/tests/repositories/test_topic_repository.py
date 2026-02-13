import pytest

from app.models import KnowledgeBase, User
from app.repositories.topic_repository import TopicRepository


@pytest.fixture
async def setup(db_session):
    user = User(username="topicrepouser")
    db_session.add(user)
    await db_session.flush()

    kb = KnowledgeBase(
        user_id=user.id,
        name="Topic KB",
        milvus_collection="kb_topicrepo",
    )
    db_session.add(kb)
    await db_session.flush()

    return user, kb


@pytest.mark.asyncio
async def test_create_topic(db_session, setup):
    _, kb = setup
    repo = TopicRepository(db_session)
    topic = await repo.create(
        knowledge_base_id=kb.id,
        topic_level=1,
        topic_label="0_ai_ml_deep",
        topic_id=0,
        doc_count=5,
        sample_keywords=["ai", "ml", "deep"],
    )
    assert topic.topic_label == "0_ai_ml_deep"
    assert topic.doc_count == 5


@pytest.mark.asyncio
async def test_find_by_knowledge_base(db_session, setup):
    _, kb = setup
    repo = TopicRepository(db_session)
    await repo.create(
        knowledge_base_id=kb.id,
        topic_level=1,
        topic_label="0_a_b",
        topic_id=0,
    )
    await repo.create(
        knowledge_base_id=kb.id,
        topic_level=1,
        topic_label="1_c_d",
        topic_id=1,
    )
    topics = await repo.find_by_knowledge_base(kb.id)
    assert len(topics) == 2


@pytest.mark.asyncio
async def test_delete_by_knowledge_base(db_session, setup):
    _, kb = setup
    repo = TopicRepository(db_session)
    await repo.create(
        knowledge_base_id=kb.id,
        topic_level=1,
        topic_label="0_x_y",
        topic_id=0,
    )
    count = await repo.delete_by_knowledge_base(kb.id)
    assert count == 1
    remaining = await repo.find_by_knowledge_base(kb.id)
    assert len(remaining) == 0
