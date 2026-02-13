from unittest.mock import patch

import pytest


@pytest.fixture
async def user_id(client):
    resp = await client.post("/api/users", json={"username": "kbuser"})
    return resp.json()["data"]["id"]


@pytest.mark.asyncio
async def test_create_knowledge_base(client, user_id):
    with patch("app.routers.knowledge_bases.MilvusService"):
        resp = await client.post("/api/knowledge-bases", json={
            "user_id": user_id,
            "name": "Test KB",
            "description": "A test knowledge base",
        })
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["name"] == "Test KB"
    assert "milvus_collection" in data["data"]


@pytest.mark.asyncio
async def test_list_knowledge_bases(client, user_id):
    with patch("app.routers.knowledge_bases.MilvusService"):
        await client.post("/api/knowledge-bases", json={
            "user_id": user_id, "name": "KB1",
        })
        await client.post("/api/knowledge-bases", json={
            "user_id": user_id, "name": "KB2",
        })
    resp = await client.get(f"/api/knowledge-bases?user_id={user_id}")
    assert resp.json()["success"] is True
    assert len(resp.json()["data"]) >= 2


@pytest.mark.asyncio
async def test_delete_knowledge_base(client, user_id):
    with patch("app.routers.knowledge_bases.MilvusService"):
        create_resp = await client.post("/api/knowledge-bases", json={
            "user_id": user_id, "name": "Delete Me",
        })
        kb_id = create_resp.json()["data"]["id"]
        resp = await client.delete(f"/api/knowledge-bases/{kb_id}")
    assert resp.json()["success"] is True
