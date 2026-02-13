from unittest.mock import AsyncMock, MagicMock

from app.services.rlm.tools import create_user_tools


def test_list_knowledge_bases():
    kb1 = MagicMock()
    kb1.name = "KB1"
    kb1.description = "First KB"
    kb1.milvus_collection = "kb_001"

    kb2 = MagicMock()
    kb2.name = "KB2"
    kb2.description = None
    kb2.milvus_collection = "kb_002"

    tools, descriptions = create_user_tools(
        user_id="user123",
        db_session=MagicMock(),
        milvus_client=MagicMock(),
        embed_fn=AsyncMock(),
        knowledge_bases=[kb1, kb2],
    )

    result = tools["list_knowledge_bases"]()
    assert len(result) == 2
    assert result[0]["name"] == "KB1"
    assert result[1]["name"] == "KB2"


def test_tool_descriptions_contain_all_tools():
    tools, descriptions = create_user_tools(
        user_id="user123",
        db_session=MagicMock(),
        milvus_client=MagicMock(),
        embed_fn=AsyncMock(),
        knowledge_bases=[],
    )

    assert "list_knowledge_bases" in descriptions
    assert "search_docs" in descriptions
    assert "find_file" in descriptions
    assert "get_file" in descriptions

    assert "list_knowledge_bases" in tools
    assert "search_docs" in tools
    assert "find_file" in tools
    assert "get_file" in tools


def test_tools_closures_isolate_user_id():
    tools1, _ = create_user_tools(
        user_id="user1",
        db_session=MagicMock(),
        milvus_client=MagicMock(),
        embed_fn=AsyncMock(),
        knowledge_bases=[],
    )

    tools2, _ = create_user_tools(
        user_id="user2",
        db_session=MagicMock(),
        milvus_client=MagicMock(),
        embed_fn=AsyncMock(),
        knowledge_bases=[],
    )

    # They should be different function objects (different closures)
    assert tools1["list_knowledge_bases"] is not tools2["list_knowledge_bases"]
