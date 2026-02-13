import pytest


@pytest.fixture
async def user_id(client):
    resp = await client.post("/api/users", json={"username": "chatuser"})
    return resp.json()["data"]["id"]


@pytest.mark.asyncio
async def test_create_chat_session(client, user_id):
    resp = await client.post("/api/chat/sessions", json={
        "user_id": user_id,
        "title": "Test Chat",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["title"] == "Test Chat"


@pytest.mark.asyncio
async def test_list_chat_sessions(client, user_id):
    await client.post("/api/chat/sessions", json={"user_id": user_id, "title": "Chat 1"})
    await client.post("/api/chat/sessions", json={"user_id": user_id, "title": "Chat 2"})
    resp = await client.get(f"/api/chat/sessions?user_id={user_id}")
    assert resp.json()["success"] is True
    assert len(resp.json()["data"]) >= 2


@pytest.mark.asyncio
async def test_list_messages_empty(client, user_id):
    create_resp = await client.post("/api/chat/sessions", json={"user_id": user_id})
    session_id = create_resp.json()["data"]["id"]
    resp = await client.get(f"/api/chat/sessions/{session_id}/messages")
    assert resp.json()["success"] is True
    assert resp.json()["data"] == []
