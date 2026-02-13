import pytest


@pytest.mark.asyncio
async def test_create_and_get_user(client):
    create_resp = await client.post("/api/users", json={"username": "fulltest"})
    assert create_resp.json()["success"] is True
    uid = create_resp.json()["data"]["id"]

    get_resp = await client.get(f"/api/users/{uid}")
    assert get_resp.json()["success"] is True
    assert get_resp.json()["data"]["username"] == "fulltest"


@pytest.mark.asyncio
async def test_list_multiple_users(client):
    await client.post("/api/users", json={"username": "alpha"})
    await client.post("/api/users", json={"username": "beta"})
    await client.post("/api/users", json={"username": "gamma"})

    resp = await client.get("/api/users")
    body = resp.json()
    assert body["success"] is True
    assert len(body["data"]) >= 3
