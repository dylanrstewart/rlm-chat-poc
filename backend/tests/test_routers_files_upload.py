"""Test file upload endpoint with mocked ingest."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models import File


@pytest.fixture
async def user_and_kb(client):
    user_resp = await client.post("/api/users", json={"username": "uploaduser"})
    user_id = user_resp.json()["data"]["id"]

    with patch("app.routers.knowledge_bases.MilvusService"):
        kb_resp = await client.post("/api/knowledge-bases", json={
            "user_id": user_id,
            "name": "Upload KB",
        })
    kb_id = kb_resp.json()["data"]["id"]
    return user_id, kb_id


@pytest.mark.asyncio
async def test_upload_files_success(client, user_and_kb):
    user_id, kb_id = user_and_kb

    mock_file = MagicMock(spec=File)
    mock_file.id = "00000000-0000-0000-0000-000000000001"
    mock_file.user_id = user_id
    mock_file.knowledge_base_id = kb_id
    mock_file.filename = "test.txt"
    mock_file.title = "test"
    mock_file.file_type = "txt"
    mock_file.file_size_bytes = 100
    mock_file.chunk_count = 1
    mock_file.created_at = "2024-01-01T00:00:00"

    with patch("app.routers.files.ingest_file", new_callable=AsyncMock) as mock_ingest, \
         patch("app.routers.files.MilvusService"):
        mock_ingest.return_value = mock_file

        resp = await client.post(
            f"/api/knowledge-bases/{kb_id}/files?user_id={user_id}",
            files=[("files", ("test.txt", b"Hello world", "text/plain"))],
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert len(body["data"]) == 1
