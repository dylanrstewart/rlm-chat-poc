from unittest.mock import MagicMock

from app.services.milvus_service import MilvusService


def test_create_collection():
    mock_client = MagicMock()
    mock_client.prepare_index_params.return_value = MagicMock()
    service = MilvusService(client=mock_client)
    service.create_collection("test_collection")
    mock_client.create_collection.assert_called_once()
    mock_client.create_index.assert_called_once()


def test_insert():
    mock_client = MagicMock()
    service = MilvusService(client=mock_client)
    data = [{"id": "1", "vector": [0.1] * 1536, "text": "hello"}]
    service.insert("test_collection", data)
    mock_client.insert.assert_called_once_with(collection_name="test_collection", data=data)


def test_search():
    mock_client = MagicMock()
    mock_client.search.return_value = [
        [
            {"entity": {"text": "result", "file_id": "f1", "topic_l1": "", "topic_keywords": ""}, "distance": 0.95},
        ]
    ]
    service = MilvusService(client=mock_client)
    results = service.search("test_collection", [0.1] * 1536, top_k=5)
    assert len(results) == 1
    assert results[0]["text"] == "result"
    assert results[0]["score"] == 0.95


def test_delete_by_file_id():
    mock_client = MagicMock()
    service = MilvusService(client=mock_client)
    service.delete_by_file_id("test_collection", "file123")
    mock_client.delete.assert_called_once_with(
        collection_name="test_collection", filter='file_id == "file123"'
    )


def test_drop_collection():
    mock_client = MagicMock()
    service = MilvusService(client=mock_client)
    service.drop_collection("test_collection")
    mock_client.drop_collection.assert_called_once_with(collection_name="test_collection")


def test_upsert():
    mock_client = MagicMock()
    service = MilvusService(client=mock_client)
    data = [{"id": "1", "topic_l1": "ai"}]
    service.upsert("test_collection", data)
    mock_client.upsert.assert_called_once_with(collection_name="test_collection", data=data)
