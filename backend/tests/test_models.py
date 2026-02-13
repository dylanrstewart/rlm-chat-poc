import pytest
from sqlalchemy import select

from app.models import ChatMessage, ChatSession, File, KnowledgeBase, User
from tests.db_fixture import db_session  # noqa: F401


@pytest.mark.asyncio
async def test_create_user(db_session):
    user = User(username="testuser")
    db_session.add(user)
    await db_session.flush()
    assert user.id is not None
    assert user.username == "testuser"


@pytest.mark.asyncio
async def test_user_unique_username(db_session):
    db_session.add(User(username="dup"))
    await db_session.flush()
    db_session.add(User(username="dup"))
    with pytest.raises(Exception):
        await db_session.flush()


@pytest.mark.asyncio
async def test_knowledge_base_relationship(db_session):
    user = User(username="kbuser")
    db_session.add(user)
    await db_session.flush()

    kb = KnowledgeBase(
        user_id=user.id,
        name="Test KB",
        description="A test KB",
        milvus_collection="kb_test_001",
    )
    db_session.add(kb)
    await db_session.flush()
    assert kb.user_id == user.id


@pytest.mark.asyncio
async def test_file_belongs_to_kb(db_session):
    user = User(username="fileuser")
    db_session.add(user)
    await db_session.flush()

    kb = KnowledgeBase(user_id=user.id, name="Files KB", milvus_collection="kb_files_001")
    db_session.add(kb)
    await db_session.flush()

    f = File(
        user_id=user.id,
        knowledge_base_id=kb.id,
        filename="test.pdf",
        file_type="pdf",
        content="Some text content",
        file_size_bytes=1024,
    )
    db_session.add(f)
    await db_session.flush()
    assert f.knowledge_base_id == kb.id
    assert f.chunk_count == 0


@pytest.mark.asyncio
async def test_chat_message_chain(db_session):
    user = User(username="chatuser")
    db_session.add(user)
    await db_session.flush()

    session = ChatSession(user_id=user.id, title="Test chat")
    db_session.add(session)
    await db_session.flush()

    msg = ChatMessage(session_id=session.id, role="user", content="Hello")
    db_session.add(msg)
    await db_session.flush()
    assert msg.session_id == session.id
    assert msg.role == "user"
