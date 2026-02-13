from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CollectionTopic
from app.repositories.knowledge_base_repository import KnowledgeBaseRepository
from app.repositories.topic_repository import TopicRepository
from app.services.milvus_service import MilvusService


async def cluster_knowledge_base(
    knowledge_base_id: UUID,
    db: AsyncSession,
    milvus: MilvusService,
) -> list[CollectionTopic]:
    """Run BERTopic clustering on all chunks in a knowledge base."""
    import numpy as np
    from bertopic import BERTopic

    kb_repo = KnowledgeBaseRepository(db)
    topic_repo = TopicRepository(db)

    kb = await kb_repo.find_by_id(knowledge_base_id)
    if not kb:
        raise ValueError("Knowledge base not found")

    # Pull all vectors + text from Milvus
    all_data = milvus.query_all(
        kb.milvus_collection,
        output_fields=["id", "text", "vector"],
    )

    if len(all_data) < 5:
        raise ValueError("Not enough documents for clustering (need at least 5)")

    texts = [d["text"] for d in all_data]
    embeddings = np.array([d["vector"] for d in all_data])

    # Run BERTopic with precomputed embeddings
    topic_model = BERTopic(
        embedding_model=None,
        nr_topics="auto",
        min_topic_size=5,
        verbose=False,
    )
    topics, _probs = topic_model.fit_transform(texts, embeddings)
    topic_info = topic_model.get_topic_info()

    # Update Milvus metadata with topic labels
    for doc_data, topic_id in zip(all_data, topics):
        if topic_id == -1:
            continue
        info = topic_info[topic_info["Topic"] == topic_id].iloc[0]
        label = info["Name"]
        keywords = label.split("_")[1:4]

        milvus.upsert(kb.milvus_collection, [{
            "id": doc_data["id"],
            "vector": doc_data["vector"],
            "text": doc_data["text"],
            "file_id": doc_data.get("file_id", ""),
            "chunk_index": doc_data.get("chunk_index", 0),
            "user_id": doc_data.get("user_id", ""),
            "topic_l1": keywords[0] if keywords else "",
            "topic_l2": "_".join(keywords[:2]) if len(keywords) > 1 else "",
            "topic_keywords": ", ".join(keywords),
        }])

    # Clear old topics and insert new ones
    await topic_repo.delete_by_knowledge_base(knowledge_base_id)

    new_topics = []
    for _, row in topic_info.iterrows():
        if row["Topic"] == -1:
            continue
        topic = await topic_repo.create(
            knowledge_base_id=knowledge_base_id,
            topic_level=1,
            topic_label=row["Name"],
            topic_id=row["Topic"],
            doc_count=row["Count"],
            sample_keywords=row["Name"].split("_")[1:6],
        )
        new_topics.append(topic)

    await db.commit()
    return new_topics
