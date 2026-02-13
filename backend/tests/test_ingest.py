from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.models import KnowledgeBase, User
from app.services.ingest import ingest_file
from tests.conftest import db_session  # noqa: F401


@pytest.fixture
async def setup(db_session):
    user = User(username="ingestuser")
    db_session.add(user)
    await db_session.flush()

    kb = KnowledgeBase(
        user_id=user.id,
        name="Ingest KB",
        milvus_collection="kb_ingest_test",
    )
    db_session.add(kb)
    await db_session.flush()

    return user, kb


@pytest.mark.asyncio
async def test_ingest_file_basic(db_session, setup):
    user, kb = setup

    mock_milvus = MagicMock()

    with patch("app.services.ingest.embed_texts", new_callable=AsyncMock) as mock_embed:
        mock_embed.return_value = [[0.1] * 1536]
        result = await ingest_file(
            content=b"Hello world test content for chunking",
            filename="test.txt",
            knowledge_base_id=kb.id,
            user_id=user.id,
            db=db_session,
            milvus=mock_milvus,
        )

    assert result.filename == "test.txt"
    assert result.file_type == "txt"
    assert result.content == "Hello world test content for chunking"


@pytest.mark.asyncio
async def test_ingest_empty_file(db_session, setup):
    user, kb = setup

    mock_milvus = MagicMock()

    result = await ingest_file(
        content=b"",
        filename="empty.txt",
        knowledge_base_id=kb.id,
        user_id=user.id,
        db=db_session,
        milvus=mock_milvus,
    )

    assert result.filename == "empty.txt"
    assert result.chunk_count == 0
