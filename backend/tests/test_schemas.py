import pytest
from pydantic import ValidationError

from app.schemas.common import ApiResponse
from app.schemas.user import UserCreate, UserRead
from app.schemas.knowledge_base import KnowledgeBaseCreate, KnowledgeBaseRead
from app.schemas.chat import ChatQueryRequest


def test_user_create_valid():
    user = UserCreate(username="alice")
    assert user.username == "alice"


def test_user_create_empty_username():
    with pytest.raises(ValidationError):
        UserCreate(username="")


def test_api_response_success():
    resp = ApiResponse(success=True, data={"id": "123"})
    assert resp.success is True
    assert resp.error is None


def test_api_response_error():
    resp = ApiResponse(success=False, error="Not found")
    assert resp.data is None
    assert resp.error == "Not found"


def test_kb_create_valid():
    kb = KnowledgeBaseCreate(
        user_id="550e8400-e29b-41d4-a716-446655440000",
        name="Test KB",
        description="desc",
    )
    assert kb.name == "Test KB"


def test_kb_create_empty_name():
    with pytest.raises(ValidationError):
        KnowledgeBaseCreate(
            user_id="550e8400-e29b-41d4-a716-446655440000",
            name="",
        )


def test_chat_query_request_valid():
    req = ChatQueryRequest(query="What is AI?")
    assert req.knowledge_base_ids is None


def test_chat_query_request_empty_query():
    with pytest.raises(ValidationError):
        ChatQueryRequest(query="")
