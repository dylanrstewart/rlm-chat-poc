from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models import ChatMessage, ChatSession, User


@pytest.fixture
async def chat_setup(db_session):
    user = User(username="chatextuser")
    db_session.add(user)
    await db_session.flush()

    session = ChatSession(user_id=user.id, title="Test")
    db_session.add(session)
    await db_session.flush()

    msg1 = ChatMessage(session_id=session.id, role="user", content="Hello")
    msg2 = ChatMessage(session_id=session.id, role="assistant", content="Hi there!")
    db_session.add(msg1)
    db_session.add(msg2)
    await db_session.flush()
    await db_session.commit()

    return {"user": user, "session": session}


@pytest.mark.asyncio
async def test_get_messages(client, db_engine, chat_setup):
    data = chat_setup
    resp = await client.get(f"/api/chat/sessions/{data['session'].id}/messages")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert len(body["data"]) == 2
    assert body["data"][0]["role"] == "user"
    assert body["data"][1]["role"] == "assistant"


@pytest.mark.asyncio
async def test_query_session_not_found(client, db_engine):
    resp = await client.post(
        "/api/chat/sessions/00000000-0000-0000-0000-000000000000/query",
        json={"query": "test"},
    )
    body = resp.json()
    assert body["success"] is False
    assert "not found" in body["error"].lower()


@pytest.mark.asyncio
async def test_query_session_success(client, db_engine, chat_setup):
    data = chat_setup

    mock_engine = AsyncMock()
    mock_engine.run = AsyncMock(return_value="The answer is 42")

    with patch("app.routers.chat.MilvusService"), \
         patch("app.routers.chat.session_manager") as mock_sm, \
         patch("app.routers.chat.RLMEngine", return_value=mock_engine), \
         patch("app.routers.chat._get_openai_client"):
        mock_session = MagicMock()
        mock_session.tools = {}
        mock_session.tool_descriptions = ""
        mock_sm.get_or_create = AsyncMock(return_value=mock_session)

        resp = await client.post(
            f"/api/chat/sessions/{data['session'].id}/query",
            json={"query": "What is the meaning of life?"},
        )

    body = resp.json()
    assert body["success"] is True
    assert body["data"] == "The answer is 42"
