from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.embedding import embed_text, embed_texts


@pytest.mark.asyncio
async def test_embed_text_calls_openai():
    mock_embedding = MagicMock()
    mock_embedding.embedding = [0.1] * 1536

    mock_response = MagicMock()
    mock_response.data = [mock_embedding]

    mock_client = AsyncMock()
    mock_client.embeddings.create = AsyncMock(return_value=mock_response)

    with patch("app.services.embedding._get_client", return_value=mock_client):
        result = await embed_text("test text")
        assert len(result) == 1536
        mock_client.embeddings.create.assert_called_once()


@pytest.mark.asyncio
async def test_embed_texts_batch():
    mock_items = []
    for i in range(3):
        item = MagicMock()
        item.embedding = [0.1 * (i + 1)] * 1536
        item.index = i
        mock_items.append(item)

    mock_response = MagicMock()
    mock_response.data = mock_items

    mock_client = AsyncMock()
    mock_client.embeddings.create = AsyncMock(return_value=mock_response)

    with patch("app.services.embedding._get_client", return_value=mock_client):
        result = await embed_texts(["text1", "text2", "text3"])
        assert len(result) == 3


@pytest.mark.asyncio
async def test_embed_texts_empty():
    result = await embed_texts([])
    assert result == []
