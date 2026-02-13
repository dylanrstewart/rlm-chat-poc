from openai import AsyncOpenAI

from app.config import settings


def _get_client() -> AsyncOpenAI:
    if settings.llm_backend == "vllm" and settings.vllm_url:
        return AsyncOpenAI(base_url=settings.vllm_url, api_key="dummy")
    return AsyncOpenAI(api_key=settings.openai_api_key)


async def embed_text(text: str) -> list[float]:
    """Embed a single text string."""
    client = _get_client()
    response = await client.embeddings.create(
        model=settings.embedding_model,
        input=text,
    )
    return response.data[0].embedding


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed multiple texts in a single batch."""
    if not texts:
        return []
    client = _get_client()
    response = await client.embeddings.create(
        model=settings.embedding_model,
        input=texts,
    )
    return [item.embedding for item in sorted(response.data, key=lambda x: x.index)]
