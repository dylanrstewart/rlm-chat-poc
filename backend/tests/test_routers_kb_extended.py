from unittest.mock import patch

import pytest

from app.models import KnowledgeBase, User


@pytest.fixture
async def setup(db_session):
    user = User(username="kbextuser")
    db_session.add(user)
    await db_session.flush()
    await db_session.commit()
    return user


@pytest.mark.asyncio
async def test_list_kbs_for_user(client, db_engine, setup):
    user = setup
    with patch("app.routers.knowledge_bases.MilvusService"):
        await client.post("/api/knowledge-bases", json={
            "user_id": str(user.id), "name": "KB1",
        })
        await client.post("/api/knowledge-bases", json={
            "user_id": str(user.id), "name": "KB2",
        })

    resp = await client.get(f"/api/knowledge-bases?user_id={user.id}")
    body = resp.json()
    assert body["success"] is True
    assert len(body["data"]) >= 2


@pytest.mark.asyncio
async def test_delete_kb_not_found(client, db_engine):
    resp = await client.delete("/api/knowledge-bases/00000000-0000-0000-0000-000000000000")
    body = resp.json()
    assert body["success"] is False
    assert "not found" in body["error"].lower()
