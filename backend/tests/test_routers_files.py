from unittest.mock import AsyncMock, patch

import pytest

from app.models import File, KnowledgeBase, User


@pytest.fixture
async def setup_data(db_session):
    user = User(username="fileuser")
    db_session.add(user)
    await db_session.flush()

    kb = KnowledgeBase(
        user_id=user.id,
        name="File KB",
        milvus_collection="kb_test_files",
    )
    db_session.add(kb)
    await db_session.flush()

    f = File(
        user_id=user.id,
        knowledge_base_id=kb.id,
        filename="test.txt",
        title="test",
        file_type="txt",
        content="Hello world content",
        file_size_bytes=100,
        chunk_count=1,
    )
    db_session.add(f)
    await db_session.flush()
    await db_session.commit()

    return {"user": user, "kb": kb, "file": f}


@pytest.mark.asyncio
async def test_list_files(client, db_engine, setup_data):
    data = setup_data
    resp = await client.get(f"/api/knowledge-bases/{data['kb'].id}/files")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert len(body["data"]) >= 1


@pytest.mark.asyncio
async def test_get_file_content(client, db_engine, setup_data):
    data = setup_data
    resp = await client.get(f"/api/files/{data['file'].id}/content")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["content"] == "Hello world content"


@pytest.mark.asyncio
async def test_get_file_not_found(client, db_engine):
    resp = await client.get("/api/files/00000000-0000-0000-0000-000000000000/content")
    assert resp.json()["success"] is False


@pytest.mark.asyncio
async def test_delete_file(client, db_engine, setup_data):
    data = setup_data
    with patch("app.routers.files.MilvusService"):
        resp = await client.delete(f"/api/files/{data['file'].id}")
    assert resp.json()["success"] is True


@pytest.mark.asyncio
async def test_delete_file_not_found(client, db_engine):
    resp = await client.delete("/api/files/00000000-0000-0000-0000-000000000000")
    assert resp.json()["success"] is False
