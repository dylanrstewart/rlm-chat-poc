import pytest


@pytest.mark.asyncio
async def test_create_user(client):
    resp = await client.post("/api/users", json={"username": "alice"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["username"] == "alice"


@pytest.mark.asyncio
async def test_create_duplicate_user(client):
    await client.post("/api/users", json={"username": "bob"})
    resp = await client.post("/api/users", json={"username": "bob"})
    assert resp.json()["success"] is False
    assert "already exists" in resp.json()["error"]


@pytest.mark.asyncio
async def test_list_users(client):
    await client.post("/api/users", json={"username": "user1"})
    await client.post("/api/users", json={"username": "user2"})
    resp = await client.get("/api/users")
    assert resp.status_code == 200
    assert len(resp.json()["data"]) >= 2


@pytest.mark.asyncio
async def test_get_user_by_id(client):
    create_resp = await client.post("/api/users", json={"username": "findme"})
    user_id = create_resp.json()["data"]["id"]
    resp = await client.get(f"/api/users/{user_id}")
    assert resp.json()["success"] is True
    assert resp.json()["data"]["username"] == "findme"


@pytest.mark.asyncio
async def test_get_user_not_found(client):
    resp = await client.get("/api/users/00000000-0000-0000-0000-000000000000")
    assert resp.json()["success"] is False
