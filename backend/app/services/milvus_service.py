from pymilvus import CollectionSchema, DataType, FieldSchema, MilvusClient

from app.config import settings

VECTOR_DIM = 1536


def get_milvus_client() -> MilvusClient:
    return MilvusClient(uri=settings.milvus_uri)


def get_collection_schema() -> CollectionSchema:
    fields = [
        FieldSchema(name="id", dtype=DataType.VARCHAR, is_primary=True, max_length=36),
        FieldSchema(name="vector", dtype=DataType.FLOAT_VECTOR, dim=VECTOR_DIM),
        FieldSchema(name="text", dtype=DataType.VARCHAR, max_length=8192),
        FieldSchema(name="file_id", dtype=DataType.VARCHAR, max_length=36),
        FieldSchema(name="chunk_index", dtype=DataType.INT64),
        FieldSchema(name="user_id", dtype=DataType.VARCHAR, max_length=36),
        FieldSchema(name="topic_l1", dtype=DataType.VARCHAR, max_length=256),
        FieldSchema(name="topic_l2", dtype=DataType.VARCHAR, max_length=256),
        FieldSchema(name="topic_keywords", dtype=DataType.VARCHAR, max_length=1024),
    ]
    return CollectionSchema(fields=fields, enable_dynamic_field=True)


class MilvusService:
    def __init__(self, client: MilvusClient | None = None):
        self.client = client or get_milvus_client()

    def create_collection(self, collection_name: str) -> None:
        schema = get_collection_schema()
        self.client.create_collection(
            collection_name=collection_name,
            schema=schema,
        )
        index_params = self.client.prepare_index_params()
        index_params.add_index(
            field_name="vector",
            index_type="HNSW",
            metric_type="COSINE",
            params={"M": 16, "efConstruction": 200},
        )
        self.client.create_index(collection_name, index_params)

    def insert(self, collection_name: str, data: list[dict]) -> None:
        self.client.insert(collection_name=collection_name, data=data)

    def upsert(self, collection_name: str, data: list[dict]) -> None:
        self.client.upsert(collection_name=collection_name, data=data)

    def search(
        self,
        collection_name: str,
        query_vector: list[float],
        top_k: int = 5,
        filter_expr: str = "",
        output_fields: list[str] | None = None,
    ) -> list[dict]:
        if output_fields is None:
            output_fields = ["text", "file_id", "topic_l1", "topic_keywords"]
        results = self.client.search(
            collection_name=collection_name,
            data=[query_vector],
            filter=filter_expr,
            limit=top_k,
            output_fields=output_fields,
        )
        return [
            {
                **hit["entity"],
                "score": round(hit["distance"], 4),
            }
            for hit in results[0]
        ]

    def load_collection(self, collection_name: str) -> None:
        self.client.load_collection(collection_name=collection_name)

    def query_all(
        self,
        collection_name: str,
        output_fields: list[str] | None = None,
        limit: int = 16384,
    ) -> list[dict]:
        if output_fields is None:
            output_fields = ["id", "text", "vector"]
        self.client.load_collection(collection_name=collection_name)
        return self.client.query(
            collection_name=collection_name,
            filter="",
            output_fields=output_fields,
            limit=limit,
        )

    def delete_by_file_id(self, collection_name: str, file_id: str) -> None:
        self.client.delete(
            collection_name=collection_name,
            filter=f'file_id == "{file_id}"',
        )

    def drop_collection(self, collection_name: str) -> None:
        self.client.drop_collection(collection_name=collection_name)
