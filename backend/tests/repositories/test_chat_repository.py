import pytest

from app.models import User
from app.repositories.chat_repository import ChatMessageRepository, ChatSessionRepository
from tests.db_fixture import db_session  # noqa: F401


async def _create_user(db_session, username="chatuser"):
    user = User(username=username)
    db_session.add(user)
    await db_session.flush()
    return user


@pytest.mark.asyncio
async def test_create_session(db_session):
    user = await _create_user(db_session)
    repo = ChatSessionRepository(db_session)
    session = await repo.create(user_id=user.id, title="Test Chat")
    assert session.title == "Test Chat"


@pytest.mark.asyncio
async def test_find_sessions_by_user(db_session):
    user = await _create_user(db_session)
    repo = ChatSessionRepository(db_session)
    await repo.create(user_id=user.id, title="Chat 1")
    await repo.create(user_id=user.id, title="Chat 2")
    sessions = await repo.find_by_user(user.id)
    assert len(sessions) == 2


@pytest.mark.asyncio
async def test_create_and_find_messages(db_session):
    user = await _create_user(db_session)
    session_repo = ChatSessionRepository(db_session)
    session = await session_repo.create(user_id=user.id, title="Msg Test")

    msg_repo = ChatMessageRepository(db_session)
    await msg_repo.create(session_id=session.id, role="user", content="Hello")
    await msg_repo.create(session_id=session.id, role="assistant", content="Hi there!")

    messages = await msg_repo.find_by_session(session.id)
    assert len(messages) == 2
    assert messages[0].role == "user"
    assert messages[1].role == "assistant"
