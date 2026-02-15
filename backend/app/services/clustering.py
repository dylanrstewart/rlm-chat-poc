from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CollectionTopic
from app.repositories.knowledge_base_repository import KnowledgeBaseRepository
from app.repositories.topic_repository import TopicRepository
from app.config import settings
from app.services.milvus_service import MilvusService


async def cluster_knowledge_base(
    knowledge_base_id: UUID,
    db: AsyncSession,
    milvus: MilvusService,
) -> list[CollectionTopic]:
    """Run BERTopic clustering on all chunks in a knowledge base, with GPT-powered topic labels."""
    import numpy as np
    import openai
    from bertopic import BERTopic

    kb_repo = KnowledgeBaseRepository(db)
    topic_repo = TopicRepository(db)

    kb = await kb_repo.find_by_id(knowledge_base_id)
    if not kb:
        raise ValueError("Knowledge base not found")

    # Pull all vectors + text from Milvus (include all fields to preserve on upsert)
    all_data = milvus.query_all(
        kb.milvus_collection,
        output_fields=["id", "text", "vector", "file_id", "chunk_index", "user_id"],
    )

    if len(all_data) < 5:
        raise ValueError("Not enough documents for clustering (need at least 5)")

    texts = [d["text"] for d in all_data]
    embeddings = np.array([d["vector"] for d in all_data])

    # Run BERTopic with precomputed embeddings (default keyword representation)
    topic_model = BERTopic(
        embedding_model=None,
        nr_topics="auto",
        min_topic_size=5,
        verbose=False,
    )
    topics, _probs = topic_model.fit_transform(texts, embeddings)
    topic_info = topic_model.get_topic_info()

    # Use GPT to generate human-readable labels from the keyword representations
    client = openai.OpenAI(api_key=settings.openai_api_key)
    topic_labels = {}
    for _, row in topic_info.iterrows():
        if row["Topic"] == -1:
            continue
        keywords = row["Name"]
        # Get representative docs for this topic
        rep_docs = topic_model.get_representative_docs(row["Topic"])
        doc_snippets = "\n".join(d[:200] for d in (rep_docs or [])[:3])

        response = client.chat.completions.create(
            model=settings.llm_sub_model,
            messages=[{
                "role": "user",
                "content": (
                    f"I have a topic with these keywords: {keywords}\n\n"
                    f"Representative documents:\n{doc_snippets}\n\n"
                    "Give me a short, descriptive label for this topic (3-6 words max). "
                    "Return ONLY the label, nothing else."
                ),
            }],
            max_completion_tokens=1000,
        )
        label = response.choices[0].message.content.strip().strip('"')
        topic_labels[row["Topic"]] = label

    # Update Milvus metadata with topic labels
    for doc_data, topic_id in zip(all_data, topics):
        if topic_id == -1:
            continue
        label = topic_labels.get(topic_id, "")

        milvus.upsert(kb.milvus_collection, [{
            "id": doc_data["id"],
            "vector": doc_data["vector"],
            "text": doc_data["text"],
            "file_id": doc_data.get("file_id", ""),
            "chunk_index": doc_data.get("chunk_index", 0),
            "user_id": doc_data.get("user_id", ""),
            "topic_l1": label,
            "topic_l2": "",
            "topic_keywords": label,
        }])

    # Clear old topics and insert new ones
    await topic_repo.delete_by_knowledge_base(knowledge_base_id)

    new_topics = []
    for _, row in topic_info.iterrows():
        if row["Topic"] == -1:
            continue
        label = topic_labels.get(row["Topic"], row["Name"])
        # Extract keywords from the default Name column for sample_keywords
        raw_keywords = row["Name"].split("_")[1:6]
        topic = await topic_repo.create(
            knowledge_base_id=knowledge_base_id,
            topic_level=1,
            topic_label=label,
            topic_id=row["Topic"],
            doc_count=row["Count"],
            sample_keywords=raw_keywords,
        )
        new_topics.append(topic)

    await db.commit()
    return new_topics
