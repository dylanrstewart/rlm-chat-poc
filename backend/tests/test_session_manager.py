from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.rlm.session import SessionManager


@pytest.mark.asyncio
async def test_get_or_create_new_session():
    manager = SessionManager()
    mock_db = MagicMock()
    mock_milvus = MagicMock()

    with patch("app.services.rlm.session.KnowledgeBaseRepository") as MockRepo:
        mock_repo = AsyncMock()
        mock_repo.find_by_user.return_value = []
        MockRepo.return_value = mock_repo

        with patch("app.services.rlm.session.create_user_tools") as mock_tools:
            mock_tools.return_value = ({"tool": lambda: None}, "descriptions")

            session = await manager.get_or_create("user1", mock_db, mock_milvus)

    assert session.user_id == "user1"
    assert "tool" in session.tools


@pytest.mark.asyncio
async def test_get_or_create_returns_existing():
    manager = SessionManager()
    mock_db = MagicMock()
    mock_milvus = MagicMock()

    with patch("app.services.rlm.session.KnowledgeBaseRepository") as MockRepo:
        mock_repo = AsyncMock()
        mock_repo.find_by_user.return_value = []
        MockRepo.return_value = mock_repo

        with patch("app.services.rlm.session.create_user_tools") as mock_tools:
            mock_tools.return_value = ({"tool": lambda: None}, "descriptions")

            session1 = await manager.get_or_create("user1", mock_db, mock_milvus)
            session2 = await manager.get_or_create("user1", mock_db, mock_milvus)

    assert session1 is session2
    # create_user_tools should only be called once
    mock_tools.assert_called_once()


def test_invalidate():
    manager = SessionManager()
    from app.services.rlm.session import RLMSession

    manager.sessions["user1"] = RLMSession(
        user_id="user1", tools={}, tool_descriptions=""
    )
    assert "user1" in manager.sessions
    manager.invalidate("user1")
    assert "user1" not in manager.sessions


def test_invalidate_nonexistent():
    manager = SessionManager()
    manager.invalidate("nonexistent")  # should not raise
