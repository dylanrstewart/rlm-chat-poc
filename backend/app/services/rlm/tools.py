import asyncio
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.milvus_service import MilvusService


def _run_async(coro):
    """Run an async coroutine from sync context (inside exec())."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        new_loop = asyncio.new_event_loop()
        try:
            return new_loop.run_until_complete(coro)
        finally:
            new_loop.close()
    else:
        return asyncio.run(coro)


def create_user_tools(
    user_id: str,
    db_session: AsyncSession,
    milvus_client: MilvusService,
    embed_fn,
    knowledge_bases: list,
):
    """Factory that returns REPL-safe tool functions with credentials bound in closures."""
    _user_id = user_id
    _db = db_session
    _milvus = milvus_client
    _embed = embed_fn
    _kb_map = {kb.name: kb for kb in knowledge_bases}
    _kb_collections = {kb.name: kb.milvus_collection for kb in knowledge_bases}

    def list_knowledge_bases() -> list[dict]:
        """List all your knowledge bases and their descriptions."""
        return [
            {
                "name": kb.name,
                "description": kb.description,
                "collection": kb.milvus_collection,
            }
            for kb in knowledge_bases
        ]

    def search_docs(
        query: str,
        knowledge_base: str = "all",
        topic_filter: str | None = None,
        top_k: int = 5,
    ) -> list[dict]:
        """Semantic search across your documents. Returns matching text chunks."""
        top_k = min(top_k, 20)

        filter_parts = [f'user_id == "{_user_id}"']
        if topic_filter:
            filter_parts.append(
                f'(topic_l1 == "{topic_filter}" or topic_l2 == "{topic_filter}")'
            )
        filter_expr = " and ".join(filter_parts)

        query_vector = _run_async(_embed(query))

        collections = (
            list(_kb_collections.values())
            if knowledge_base == "all"
            else [_kb_collections.get(knowledge_base, knowledge_base)]
        )

        all_results = []
        for coll in collections:
            try:
                results = _milvus.search(
                    collection_name=coll,
                    query_vector=query_vector,
                    top_k=top_k,
                    filter_expr=filter_expr,
                    output_fields=["text", "file_id", "topic_l1", "topic_keywords"],
                )
                for hit in results:
                    all_results.append({
                        "text": hit["text"][:500],
                        "file_id": hit["file_id"],
                        "topic": hit.get("topic_l1", ""),
                        "score": hit.get("score", 0),
                        "collection": coll,
                    })
            except Exception as e:
                all_results.append({"error": f"Search failed on {coll}: {str(e)}"})

        all_results.sort(key=lambda r: r.get("score", 0), reverse=True)
        return all_results[:top_k]

    def find_file(query: str, file_type: str | None = None, top_k: int = 5) -> list[dict]:
        """Find specific files by name using fuzzy matching."""

        async def _query():
            type_clause = "AND f.file_type = :file_type" if file_type else ""
            params = {"user_id": str(_user_id), "query": query, "top_k": top_k}
            if file_type:
                params["file_type"] = file_type

            sql = f"""
                SELECT f.id, f.filename, f.title, f.file_type,
                       LEFT(f.content, 200) as content_preview
                FROM files f
                WHERE f.user_id = :user_id {type_clause}
                ORDER BY f.filename
                LIMIT :top_k
            """
            result = await _db.execute(text(sql), params)
            return [dict(r._mapping) for r in result.fetchall()]

        return _run_async(_query())

    def get_file(file_id: str) -> dict:
        """Retrieve the full text content of a file by its ID."""

        async def _query():
            result = await _db.execute(
                text("SELECT id, filename, title, content, metadata FROM files WHERE id = :id AND user_id = :uid"),
                {"id": file_id, "uid": str(_user_id)},
            )
            row = result.fetchone()
            if not row:
                return {"error": "File not found or access denied"}
            return {
                "file_id": str(row.id),
                "filename": row.filename,
                "title": row.title,
                "content": row.content,
                "metadata": row.metadata,
            }

        return _run_async(_query())

    tools = {
        "list_knowledge_bases": list_knowledge_bases,
        "search_docs": search_docs,
        "find_file": find_file,
        "get_file": get_file,
    }

    tool_descriptions = """
- list_knowledge_bases() -> list[dict]
  List all available knowledge bases with their descriptions.

- search_docs(query: str, knowledge_base: str = "all", topic_filter: str = None, top_k: int = 5) -> list[dict]
  Semantic search across document chunks. Use for conceptual queries.
  Returns: text snippet, file_id, topic, relevance score.

- find_file(query: str, file_type: str = None, top_k: int = 5) -> list[dict]
  Fuzzy filename/title matching. Use when looking for a SPECIFIC document by name.
  Returns: file_id, filename, title, relevance score.

- get_file(file_id: str) -> dict
  Retrieve the full text of a file by its ID.
"""

    return tools, tool_descriptions
