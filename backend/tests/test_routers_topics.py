import pytest

from app.models import CollectionTopic, KnowledgeBase, User


@pytest.fixture
async def setup(db_session):
    user = User(username="topicuser")
    db_session.add(user)
    await db_session.flush()

    kb = KnowledgeBase(
        user_id=user.id,
        name="Topics KB",
        milvus_collection="kb_topics_test",
    )
    db_session.add(kb)
    await db_session.flush()

    topic = CollectionTopic(
        knowledge_base_id=kb.id,
        topic_level=1,
        topic_label="0_ai_ml",
        topic_id=0,
        doc_count=5,
        sample_keywords=["ai", "ml"],
    )
    db_session.add(topic)
    await db_session.flush()
    await db_session.commit()

    return {"user": user, "kb": kb, "topic": topic}


@pytest.mark.asyncio
async def test_list_topics(client, db_engine, setup):
    data = setup
    resp = await client.get(f"/api/knowledge-bases/{data['kb'].id}/topics")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert len(body["data"]) >= 1
    assert body["data"][0]["topic_label"] == "0_ai_ml"
