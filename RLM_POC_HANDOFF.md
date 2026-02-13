# RLM POC — Claude Code Handoff

## Project Overview

Build a proof-of-concept Recursive Language Model (RLM) platform that lets users upload documents, organize them into knowledge bases, and query across them using an RLM-powered chat interface. The RLM uses a Python REPL sandbox where the LLM autonomously writes retrieval strategies — deciding on its own whether to do semantic search, fuzzy file lookup, or recursive sub-LM calls to process results.

**Everything runs via Docker Compose. The backend is Python + FastAPI. This is a POC — pragmatism over perfection.**

---

## Architecture Summary

```
┌────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  React UI  │────▶│  FastAPI Gateway  │────▶│  RLM Engine         │
│            │ WS  │  Auth, Sessions   │     │  Per-user REPL      │
│            │◀────│  File Upload      │     │  Closure-scoped     │
│            │     │  KB Management    │     │  tools               │
└────────────┘     └──────┬───────────┘     └──────┬──────────────┘
                          │                        │
                  ┌───────┴────────┐        ┌──────┴───────┐
                  │  PostgreSQL    │        │  Milvus      │
                  │  Files, users  │        │  Vectors     │
                  │  Topics, meta  │        │  Embeddings  │
                  └────────────────┘        └──────────────┘
                                                   │
                                            ┌──────┴───────┐
                                            │  vLLM or     │
                                            │  OpenAI API  │
                                            └──────────────┘
```

For the POC, this is a **single FastAPI application** (not separate NestJS + Python services). The RLM engine runs in-process. vLLM is optional — the POC should support OpenAI API as a backend for simplicity, with vLLM as a configurable alternative.

---

## Docker Compose Services

```yaml
services:
  app:          # FastAPI backend + RLM engine
  ui:           # React frontend (Vite)
  postgres:     # PostgreSQL 16 with pg_trgm extension
  milvus:       # Milvus standalone (includes etcd + minio deps)
  etcd:         # Required by Milvus
  minio:        # Required by Milvus for storage
```

### Environment Variables (`.env` file)

```
OPENAI_API_KEY=sk-...           # or leave empty if using vLLM
VLLM_URL=http://localhost:8000  # optional, for local vLLM
LLM_BACKEND=openai              # "openai" or "vllm"
LLM_MODEL=gpt-4o-mini           # model name for the RLM root LM
LLM_SUB_MODEL=gpt-4o-mini       # model name for sub-LM calls
EMBEDDING_MODEL=text-embedding-3-small  # embedding model
POSTGRES_URL=postgresql://rlm:rlm@postgres:5432/rlm
MILVUS_URI=http://milvus:19530
```

---

## Database Schema (PostgreSQL)

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users (simple for POC — no real auth, just user identity)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Knowledge bases (collections)
CREATE TABLE knowledge_bases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR NOT NULL,
    description TEXT,
    milvus_collection VARCHAR UNIQUE NOT NULL,  -- maps to Milvus collection name
    created_at TIMESTAMP DEFAULT NOW()
);

-- Files
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id),
    filename VARCHAR NOT NULL,
    title VARCHAR,
    file_type VARCHAR,              -- pdf, docx, txt, md, etc.
    content TEXT,                    -- extracted full text
    metadata JSONB DEFAULT '{}',
    file_size_bytes BIGINT,
    chunk_count INT DEFAULT 0,      -- how many chunks in Milvus
    created_at TIMESTAMP DEFAULT NOW(),

    -- Full-text search
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(filename, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(content, '')), 'D')
    ) STORED
);

CREATE INDEX idx_files_filename_trgm ON files USING gin (filename gin_trgm_ops);
CREATE INDEX idx_files_title_trgm ON files USING gin (title gin_trgm_ops);
CREATE INDEX idx_files_search ON files USING gin (search_vector);

-- Topic clusters (populated by BERTopic pipeline)
CREATE TABLE collection_topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id),
    topic_level INT NOT NULL,           -- 1, 2, or 3
    topic_label VARCHAR NOT NULL,
    topic_id INT NOT NULL,              -- BERTopic's topic ID
    doc_count INT DEFAULT 0,
    sample_keywords TEXT[],
    parent_topic_id UUID REFERENCES collection_topics(id),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Chat sessions and messages (for the UI log)
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id),
    role VARCHAR NOT NULL,              -- "user", "assistant", "repl_log"
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',        -- for repl_log: {code, output, iteration}
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Milvus Collection Schema

Each knowledge base gets its own Milvus collection. The collection name is stored in `knowledge_bases.milvus_collection`.

```python
from pymilvus import CollectionSchema, FieldSchema, DataType

fields = [
    FieldSchema(name="id", dtype=DataType.VARCHAR, is_primary=True, max_length=36),
    FieldSchema(name="vector", dtype=DataType.FLOAT_VECTOR, dim=1536),  # matches embedding model dim
    FieldSchema(name="text", dtype=DataType.VARCHAR, max_length=8192),
    FieldSchema(name="file_id", dtype=DataType.VARCHAR, max_length=36),
    FieldSchema(name="chunk_index", dtype=DataType.INT64),
    FieldSchema(name="user_id", dtype=DataType.VARCHAR, max_length=36),
    FieldSchema(name="topic_l1", dtype=DataType.VARCHAR, max_length=256),
    FieldSchema(name="topic_l2", dtype=DataType.VARCHAR, max_length=256),
    FieldSchema(name="topic_keywords", dtype=DataType.VARCHAR, max_length=1024),
]

schema = CollectionSchema(fields=fields, enable_dynamic_field=True)
```

Index type: `IVF_FLAT` or `HNSW` — for POC either is fine.

---

## FastAPI Application Structure

```
app/
├── main.py                  # FastAPI app, CORS, lifespan
├── config.py                # Settings from env vars
├── database.py              # SQLAlchemy async engine + session
├── models.py                # SQLAlchemy ORM models
│
├── routers/
│   ├── users.py             # Simple user creation/selection
│   ├── knowledge_bases.py   # CRUD for knowledge bases
│   ├── files.py             # Upload, list, delete files
│   ├── chat.py              # Chat sessions, query endpoint + WebSocket
│   └── topics.py            # View/trigger topic clustering
│
├── services/
│   ├── ingest.py            # Document parsing, chunking, embedding, Milvus insert
│   ├── embedding.py         # Embedding service (OpenAI or local)
│   ├── clustering.py        # BERTopic pipeline for topic extraction
│   ├── milvus_service.py    # Milvus client wrapper
│   └── rlm/
│       ├── engine.py        # RLM REPL loop implementation
│       ├── tools.py         # Tool factory (create_user_tools)
│       ├── session.py       # Session manager (per-user REPL state)
│       └── prompts.py       # System prompts for the RLM
│
├── utils/
│   ├── text_extraction.py   # PDF/DOCX/TXT text extraction
│   └── chunking.py          # Text chunking strategies
│
└── requirements.txt
```

---

## Core Implementation Details

### 1. Document Ingest Pipeline (`services/ingest.py`)

When a file is uploaded:
1. Extract text from the file (PDF via `pymupdf`/`pdfplumber`, DOCX via `python-docx`, TXT/MD directly)
2. Store the full text in `files.content` in Postgres
3. Chunk the text (simple recursive character splitter, ~500-1000 tokens per chunk with overlap)
4. Embed each chunk using the configured embedding model
5. Insert vectors + metadata into the Milvus collection for that knowledge base
6. Update `files.chunk_count`

```python
async def ingest_file(file: UploadFile, knowledge_base_id: UUID, user_id: UUID):
    # 1. Extract text
    content = extract_text(file)

    # 2. Save to Postgres
    db_file = File(
        user_id=user_id,
        knowledge_base_id=knowledge_base_id,
        filename=file.filename,
        content=content,
        file_size_bytes=file.size,
    )
    db.add(db_file)
    await db.flush()

    # 3. Chunk
    chunks = chunk_text(content, chunk_size=800, overlap=100)

    # 4. Embed
    embeddings = await embed_texts([c.text for c in chunks])

    # 5. Insert into Milvus
    kb = await get_knowledge_base(knowledge_base_id)
    milvus_data = [
        {
            "id": str(uuid4()),
            "vector": emb,
            "text": chunk.text,
            "file_id": str(db_file.id),
            "chunk_index": i,
            "user_id": str(user_id),
            "topic_l1": "",   # populated later by clustering
            "topic_l2": "",
            "topic_keywords": "",
        }
        for i, (chunk, emb) in enumerate(zip(chunks, embeddings))
    ]
    milvus_client.insert(kb.milvus_collection, milvus_data)

    db_file.chunk_count = len(chunks)
    await db.commit()
```

### 2. BERTopic Clustering (`services/clustering.py`)

Runs on-demand or triggered after uploads. Clusters all chunks in a knowledge base and writes topic labels back to Milvus metadata and the Postgres `collection_topics` table.

```python
from bertopic import BERTopic
import numpy as np

async def cluster_knowledge_base(knowledge_base_id: UUID):
    kb = await get_knowledge_base(knowledge_base_id)

    # Pull all vectors + text from Milvus
    all_data = milvus_client.query(
        kb.milvus_collection,
        filter="",
        output_fields=["id", "text", "vector"],
        limit=100000,
    )

    texts = [d["text"] for d in all_data]
    embeddings = np.array([d["vector"] for d in all_data])

    # Run BERTopic (use precomputed embeddings)
    topic_model = BERTopic(
        embedding_model=None,   # we provide embeddings
        nr_topics="auto",
        min_topic_size=5,       # lower threshold for POC
        verbose=True,
    )
    topics, probs = topic_model.fit_transform(texts, embeddings)

    # Get topic info
    topic_info = topic_model.get_topic_info()

    # Update Milvus metadata with topic labels
    for doc_data, topic_id in zip(all_data, topics):
        if topic_id == -1:
            continue  # outlier, skip
        info = topic_info[topic_info["Topic"] == topic_id].iloc[0]
        label = info["Name"]  # BERTopic auto-generates labels

        # Parse the label into levels (BERTopic format: "0_keyword1_keyword2_keyword3")
        keywords = label.split("_")[1:4]

        milvus_client.upsert(kb.milvus_collection, [{
            "id": doc_data["id"],
            "topic_l1": keywords[0] if keywords else "",
            "topic_l2": "_".join(keywords[:2]) if len(keywords) > 1 else "",
            "topic_keywords": ", ".join(keywords),
        }])

    # Update Postgres topic registry
    # Clear old topics for this KB
    await db.execute(
        delete(CollectionTopic).where(CollectionTopic.knowledge_base_id == knowledge_base_id)
    )

    for _, row in topic_info.iterrows():
        if row["Topic"] == -1:
            continue
        topic = CollectionTopic(
            knowledge_base_id=knowledge_base_id,
            topic_level=1,
            topic_label=row["Name"],
            topic_id=row["Topic"],
            doc_count=row["Count"],
            sample_keywords=row["Name"].split("_")[1:6],
        )
        db.add(topic)

    await db.commit()
```

Note: BERTopic's auto-labeling produces labels like `"0_robotics_autonomous_navigation"`. For a more polished POC, you can use an LLM to generate better labels from the top keywords, but the default works fine to start.

### 3. RLM Engine (`services/rlm/engine.py`)

This is the core REPL loop. It's a simplified implementation based on the RLM paper — not using the official toolkit directly, but implementing the same pattern so we have full control.

```python
import io
import contextlib
import re
from openai import OpenAI

class RLMEngine:
    def __init__(self, client: OpenAI, model: str, sub_model: str, max_iterations: int = 15):
        self.client = client
        self.model = model
        self.sub_model = sub_model
        self.max_iterations = max_iterations

    async def run(
        self,
        query: str,
        context: str,
        tools: dict,              # closure-scoped tool functions
        tool_prompt: str,         # tool descriptions for system prompt
        on_repl_step: callable,   # callback for streaming REPL logs to UI
    ) -> str:
        # Build the REPL namespace
        repl_globals = {"__builtins__": __builtins__}
        final_answer = {"value": None}

        def submit(answer):
            final_answer["value"] = str(answer)

        def llm_query(prompt: str, ctx: str = "") -> str:
            """Sub-LM call available inside the REPL."""
            messages = [{"role": "user", "content": f"{prompt}\n\nContext:\n{ctx}" if ctx else prompt}]
            response = self.client.chat.completions.create(
                model=self.sub_model,
                messages=messages,
                max_tokens=2000,
            )
            return response.choices[0].message.content

        # Inject everything into namespace
        repl_globals["context"] = context
        repl_globals["llm_query"] = llm_query
        repl_globals["SUBMIT"] = submit
        repl_globals.update(tools)  # user's closure-scoped tools

        # System prompt
        system_prompt = self._build_system_prompt(context, tool_prompt)

        # Conversation history for the agentic loop
        history = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Query: {query}"},
        ]

        for iteration in range(self.max_iterations):
            # Get LLM response
            response = self.client.chat.completions.create(
                model=self.model,
                messages=history,
                max_tokens=4000,
            )
            assistant_msg = response.choices[0].message.content
            history.append({"role": "assistant", "content": assistant_msg})

            # Check if there's code to execute
            code = self._extract_code(assistant_msg)

            if code:
                # Execute in the sandboxed namespace
                stdout_capture = io.StringIO()
                stderr_capture = io.StringIO()

                try:
                    with contextlib.redirect_stdout(stdout_capture), \
                         contextlib.redirect_stderr(stderr_capture):
                        exec(code, repl_globals, repl_globals)
                except Exception as e:
                    stderr_capture.write(f"Error: {type(e).__name__}: {str(e)}")

                stdout = stdout_capture.getvalue()[:8192]  # limit output size
                stderr = stderr_capture.getvalue()[:2000]

                repl_output = ""
                if stdout:
                    repl_output += f"stdout:\n{stdout}\n"
                if stderr:
                    repl_output += f"stderr:\n{stderr}\n"
                if not repl_output:
                    repl_output = "(no output)"

                # Stream the REPL step to the UI
                await on_repl_step({
                    "iteration": iteration + 1,
                    "code": code,
                    "output": repl_output,
                    "has_answer": final_answer["value"] is not None,
                })

                # Feed output back to the LLM
                history.append({
                    "role": "user",
                    "content": f"REPL output:\n{repl_output}",
                })

                # Check if SUBMIT was called
                if final_answer["value"] is not None:
                    return final_answer["value"]
            else:
                # No code block — check if the model wants to submit directly
                if "SUBMIT" in assistant_msg:
                    # Try to parse inline SUBMIT
                    match = re.search(r'SUBMIT\(["\']?(.*?)["\']?\)', assistant_msg, re.DOTALL)
                    if match:
                        return match.group(1)

                # Model responded without code and without SUBMIT — treat as final answer
                return assistant_msg

        return "Max iterations reached without a final answer."

    def _extract_code(self, response: str) -> str | None:
        """Extract Python code from markdown code blocks."""
        # Match ```python or ```repl blocks
        match = re.search(r'```(?:python|repl)\n(.*?)```', response, re.DOTALL)
        return match.group(1).strip() if match else None

    def _build_system_prompt(self, context: str, tool_prompt: str) -> str:
        context_preview = context[:200] + "..." if len(context) > 200 else context
        return f"""You are an RLM (Recursive Language Model) operating in a Python REPL environment.

You have a variable `context` available containing the user's input data ({len(context)} characters).
Preview: {context_preview}

You can write Python code in ```python blocks to:
- Examine and process the context programmatically
- Call retrieval tools to find additional information
- Use llm_query(prompt, context) for recursive sub-LM calls on text
- Use print() to see intermediate results

When you have your final answer, call SUBMIT("your answer here").

Available tools in the REPL namespace:
{tool_prompt}

Built-in functions:
- llm_query(prompt: str, ctx: str = "") -> str
  Call a sub-LM to process or analyze text. Useful for summarizing
  retrieved documents or extracting specific information.

- SUBMIT(answer: str)
  Call this when you have your final answer.

Strategy:
1. First understand what the user is asking
2. If you need specific files, use find_file() for fuzzy matching
3. If you need conceptual search, use list_knowledge_bases() then search_docs()
4. Process retrieved content with llm_query() if needed
5. SUBMIT your final answer

Write code to solve the problem step by step. You will see the output of each code block before deciding your next step."""
```

### 4. Tool Factory (`services/rlm/tools.py`)

Creates closure-scoped tools for each user session. Credentials are bound in the closure — never exposed in the REPL namespace.

```python
from pymilvus import MilvusClient

def create_user_tools(
    user_id: str,
    db_session,           # async SQLAlchemy session
    milvus_client: MilvusClient,
    embed_fn: callable,   # async function to embed text
    knowledge_bases: list, # user's KB records from Postgres
):
    """
    Factory that returns REPL-safe tool functions with credentials
    bound in the closure. The LLM cannot access the underlying
    connections or user identity.
    """
    _user_id = user_id
    _db = db_session
    _milvus = milvus_client
    _embed = embed_fn
    _kb_map = {kb.name: kb for kb in knowledge_bases}
    _kb_collections = {kb.name: kb.milvus_collection for kb in knowledge_bases}

    def list_knowledge_bases() -> list[dict]:
        """List all your knowledge bases and their topic clusters."""
        # This needs to be sync since it runs inside exec()
        # Use a pre-fetched snapshot instead of live DB query
        return [
            {
                "name": kb.name,
                "description": kb.description,
                "collection": kb.milvus_collection,
            }
            for kb in knowledge_bases
        ]

    def search_docs(query: str, knowledge_base: str = "all", topic_filter: str = None, top_k: int = 5) -> list[dict]:
        """
        Semantic search across your documents. Returns matching text chunks.

        Args:
            query: Natural language search query
            knowledge_base: KB name, or "all" to search everywhere
            topic_filter: Optional topic label to narrow results
            top_k: Number of results (max 20)
        """
        import asyncio

        top_k = min(top_k, 20)

        # Build filter
        filter_parts = [f'user_id == "{_user_id}"']
        if topic_filter:
            filter_parts.append(
                f'(topic_l1 == "{topic_filter}" or topic_l2 == "{topic_filter}")'
            )
        filter_expr = " and ".join(filter_parts)

        # Get embedding synchronously (we're inside exec)
        # Use a thread-safe approach
        loop = asyncio.new_event_loop()
        query_vector = loop.run_until_complete(_embed(query))
        loop.close()

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
                    data=[query_vector],
                    filter=filter_expr,
                    limit=top_k,
                    output_fields=["text", "file_id", "topic_l1", "topic_keywords"],
                )
                for hit in results[0]:
                    all_results.append({
                        "text": hit["entity"]["text"][:500],
                        "file_id": hit["entity"]["file_id"],
                        "topic": hit["entity"].get("topic_l1", ""),
                        "score": round(hit["distance"], 4),
                        "collection": coll,
                    })
            except Exception as e:
                all_results.append({"error": f"Search failed on {coll}: {str(e)}"})

        all_results.sort(key=lambda r: r.get("score", 0), reverse=True)
        return all_results[:top_k]

    def find_file(query: str, file_type: str = None, top_k: int = 5) -> list[dict]:
        """
        Find specific files by name, identifier, or description.
        Uses fuzzy matching — best for when you know a file's name or ID.

        Args:
            query: Filename, title, or identifier to match
            file_type: Optional filter (e.g., "pdf", "docx")
            top_k: Max results
        """
        import asyncio

        async def _query():
            type_clause = "AND f.file_type = :file_type" if file_type else ""
            params = {"user_id": _user_id, "query": query, "top_k": top_k}
            if file_type:
                params["file_type"] = file_type

            sql = f"""
                SELECT
                    f.id, f.filename, f.title, f.file_type,
                    LEFT(f.description, 200) as description,
                    COALESCE(similarity(f.filename, :query), 0) * 3.0 +
                    COALESCE(similarity(f.title, :query), 0) * 2.0 +
                    COALESCE(ts_rank_cd(f.search_vector, plainto_tsquery('english', :query)), 0) AS relevance
                FROM files f
                WHERE f.user_id = :user_id::uuid {type_clause}
                  AND (
                    similarity(f.filename, :query) > 0.05
                    OR similarity(f.title, :query) > 0.05
                    OR f.search_vector @@ plainto_tsquery('english', :query)
                  )
                ORDER BY relevance DESC
                LIMIT :top_k
            """
            result = await _db.execute(text(sql), params)
            return [dict(r._mapping) for r in result.fetchall()]

        loop = asyncio.new_event_loop()
        results = loop.run_until_complete(_query())
        loop.close()
        return results

    def get_file(file_id: str) -> dict:
        """
        Retrieve the full text content of a file by its ID.
        Use after find_file() or search_docs() gives you a file_id.
        """
        import asyncio

        async def _query():
            result = await _db.execute(
                text("SELECT id, filename, title, content, metadata FROM files WHERE id = :id AND user_id = :uid"),
                {"id": file_id, "uid": _user_id},
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

        loop = asyncio.new_event_loop()
        result = loop.run_until_complete(_query())
        loop.close()
        return result

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
  Semantic search across document chunks. Use for conceptual queries like
  "proposals about sensor fusion" or "past performance in AI".
  Returns: text snippet, file_id, topic, relevance score.

- find_file(query: str, file_type: str = None, top_k: int = 5) -> list[dict]
  Fuzzy filename/title matching. Use when looking for a SPECIFIC document
  by name or identifier. E.g., "the A54x proposal", "DoW announcement".
  Returns: file_id, filename, title, relevance score.

- get_file(file_id: str) -> dict
  Retrieve the full text of a file by its ID. Use after find_file() or
  search_docs() returns a file_id you want to read in full.
"""

    return tools, tool_descriptions
```

**Important note on async/sync bridging:** The REPL runs `exec()` synchronously, but our DB and embedding calls are async. The tool functions above use `asyncio.new_event_loop()` as a workaround. A cleaner approach for the POC is to use synchronous database drivers (`psycopg2` instead of `asyncpg`) for the tools only, or pre-fetch data where possible. Choose whatever gets the POC working fastest.

### 5. Session Manager (`services/rlm/session.py`)

Manages per-user REPL sessions with their tool closures.

```python
from dataclasses import dataclass, field
from datetime import datetime

@dataclass
class RLMSession:
    user_id: str
    tools: dict
    tool_descriptions: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    last_used: datetime = field(default_factory=datetime.utcnow)

class SessionManager:
    def __init__(self):
        self.sessions: dict[str, RLMSession] = {}

    async def get_or_create(self, user_id: str, db, milvus, embed_fn) -> RLMSession:
        if user_id in self.sessions:
            self.sessions[user_id].last_used = datetime.utcnow()
            return self.sessions[user_id]

        # Fetch user's knowledge bases
        kbs = await get_user_knowledge_bases(user_id, db)

        tools, descriptions = create_user_tools(
            user_id=user_id,
            db_session=db,
            milvus_client=milvus,
            embed_fn=embed_fn,
            knowledge_bases=kbs,
        )

        session = RLMSession(
            user_id=user_id,
            tools=tools,
            tool_descriptions=descriptions,
        )
        self.sessions[user_id] = session
        return session

    def invalidate(self, user_id: str):
        """Call when user's KBs change (new upload, new KB, etc.)"""
        self.sessions.pop(user_id, None)
```

---

## API Endpoints

### Users
- `POST /api/users` — Create user (just username for POC)
- `GET /api/users` — List users
- `GET /api/users/{id}` — Get user

### Knowledge Bases
- `POST /api/knowledge-bases` — Create KB (name, description, user_id)
- `GET /api/knowledge-bases?user_id=` — List user's KBs
- `DELETE /api/knowledge-bases/{id}` — Delete KB + its Milvus collection

### Files
- `POST /api/knowledge-bases/{kb_id}/files` — Upload file(s), triggers ingest pipeline
- `GET /api/knowledge-bases/{kb_id}/files` — List files in KB
- `DELETE /api/files/{id}` — Delete file + its chunks from Milvus
- `GET /api/files/{id}/content` — Get file content

### Topics
- `POST /api/knowledge-bases/{kb_id}/cluster` — Trigger BERTopic clustering
- `GET /api/knowledge-bases/{kb_id}/topics` — Get topic clusters for a KB

### Chat
- `POST /api/chat/sessions` — Create chat session
- `GET /api/chat/sessions?user_id=` — List sessions
- `POST /api/chat/sessions/{id}/query` — Send query (returns final answer)
- `WebSocket /api/chat/sessions/{id}/ws` — Real-time REPL log streaming

The WebSocket endpoint is important for the UI. As the RLM executes code in the REPL, each iteration streams back:
```json
{
    "type": "repl_step",
    "iteration": 1,
    "code": "results = search_docs('autonomous navigation')\nprint(results)",
    "output": "[{\"text\": \"...\", \"score\": 0.89}]",
    "has_answer": false
}
```

And the final answer:
```json
{
    "type": "answer",
    "content": "Based on the documents found..."
}
```

---

## React UI

Simple, functional UI with three main views. Use Vite + React + Tailwind. Nothing fancy — this is a POC.

### 1. Sidebar — Knowledge Base Manager
- List of user's knowledge bases
- Create new KB (name + description)
- Click KB to see files
- Upload button (drag-and-drop or file picker, multi-file)
- File list with name, size, chunk count, upload date
- "Cluster Topics" button per KB
- Show topic tags when clustering is done

### 2. Main Area — Chat Interface
- Chat message list (user messages + assistant responses)
- Input bar at bottom
- Message bubbles with markdown rendering

### 3. REPL Log Panel (right side or collapsible drawer)
- Shows the RLM's internal reasoning in real time
- Each iteration shows:
  - Iteration number
  - The Python code the LLM generated
  - The output from executing that code
  - Whether a SUBMIT was called
- Syntax highlighting for code blocks
- Auto-scroll as new iterations come in
- Collapsible so it doesn't overwhelm, but visible by default

### Layout
```
┌────────────────────────────────────────────────────────────────┐
│  RLM POC                                        [User: Dylan] │
├──────────┬─────────────────────────────┬───────────────────────┤
│          │                             │                       │
│  KBs     │   Chat                      │   REPL Log            │
│          │                             │                       │
│ ┌──────┐ │   User: Summarize the DoW   │  Iteration 1          │
│ │Props │ │   announcement A54x on AI   │  ```python            │
│ │  12  │ │                             │  matches = find_file( │
│ │files │ │   Assistant: Based on the   │    "DoW A54x AI")     │
│ └──────┘ │   A54x document...          │  print(matches)       │
│ ┌──────┐ │                             │  ```                  │
│ │CPARs │ │                             │  Output: [{"file_id": │
│ │  8   │ │                             │  "abc", "filename":   │
│ │files │ │                             │  "DoW-A54x-AI.pdf",  │
│ └──────┘ │                             │  "relevance": 2.8}]  │
│          │                             │                       │
│ [+New KB]│   [Type a message...]       │  Iteration 2          │
│          │                             │  ...                  │
└──────────┴─────────────────────────────┴───────────────────────┘
```

---

## Docker Compose

```yaml
version: "3.8"

services:
  app:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - POSTGRES_URL=postgresql+asyncpg://rlm:rlm@postgres:5432/rlm
      - MILVUS_URI=http://milvus:19530
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - LLM_BACKEND=${LLM_BACKEND:-openai}
      - LLM_MODEL=${LLM_MODEL:-gpt-4o-mini}
      - LLM_SUB_MODEL=${LLM_SUB_MODEL:-gpt-4o-mini}
      - EMBEDDING_MODEL=${EMBEDDING_MODEL:-text-embedding-3-small}
    volumes:
      - ./backend:/app
      - upload_data:/app/uploads
    depends_on:
      postgres:
        condition: service_healthy
      milvus:
        condition: service_healthy

  ui:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=http://localhost:8000

  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: rlm
      POSTGRES_PASSWORD: rlm
      POSTGRES_DB: rlm
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U rlm"]
      interval: 5s
      timeout: 5s
      retries: 5

  etcd:
    image: quay.io/coreos/etcd:v3.5.18
    environment:
      - ETCD_AUTO_COMPACTION_MODE=revision
      - ETCD_AUTO_COMPACTION_RETENTION=1000
      - ETCD_QUOTA_BACKEND_BYTES=4294967296
      - ETCD_SNAPSHOT_COUNT=50000
    volumes:
      - etcd_data:/etcd
    command: etcd -advertise-client-urls=http://127.0.0.1:2379 -listen-client-urls http://0.0.0.0:2379 --data-dir /etcd
    healthcheck:
      test: ["CMD", "etcdctl", "endpoint", "health"]
      interval: 30s
      timeout: 20s
      retries: 3

  minio:
    image: minio/minio:RELEASE.2023-03-20T20-16-18Z
    environment:
      MINIO_ACCESS_KEY: minioadmin
      MINIO_SECRET_KEY: minioadmin
    volumes:
      - minio_data:/minio_data
    command: minio server /minio_data --console-address ":9001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3

  milvus:
    image: milvusdb/milvus:v2.4.4
    command: ["milvus", "run", "standalone"]
    environment:
      ETCD_ENDPOINTS: etcd:2379
      MINIO_ADDRESS: minio:9000
    volumes:
      - milvus_data:/var/lib/milvus
    ports:
      - "19530:19530"
      - "9091:9091"
    depends_on:
      etcd:
        condition: service_healthy
      minio:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9091/healthz"]
      interval: 30s
      timeout: 20s
      retries: 3

volumes:
  postgres_data:
  etcd_data:
  minio_data:
  milvus_data:
  upload_data:
```

---

## Python Dependencies (`requirements.txt`)

```
# API
fastapi>=0.110
uvicorn[standard]>=0.27
python-multipart>=0.0.9
websockets>=12.0

# Database
sqlalchemy[asyncio]>=2.0
asyncpg>=0.29
psycopg2-binary>=2.9     # sync driver for REPL tools
alembic>=1.13

# Milvus
pymilvus>=2.4

# LLM
openai>=1.30

# Document processing
pymupdf>=1.24            # PDF text extraction (fitz)
python-docx>=1.1         # DOCX text extraction
tiktoken>=0.7            # Token counting for chunking

# Embeddings + Clustering
numpy>=1.26
bertopic>=0.16
scikit-learn>=1.4
hdbscan>=0.8
umap-learn>=0.5

# Utilities
python-dotenv>=1.0
pydantic>=2.0
pydantic-settings>=2.0
```

---

## Key Design Decisions for the POC

1. **Single FastAPI app** — No NestJS/Python split for the POC. The RLM engine runs in the same process. This eliminates the session routing complexity. In production, split these out.

2. **OpenAI as default backend** — Simpler than requiring vLLM for the POC. Just needs an API key. vLLM can be swapped in by changing `LLM_BACKEND` and `VLLM_URL`.

3. **Closure-scoped tools** — User credentials (user_id, DB session) are bound into closures at session creation time. The REPL namespace only exposes callable functions. The LLM cannot `print(user_id)` or access the DB directly.

4. **Sync tools inside async app** — The REPL `exec()` is synchronous. Tools that need DB/Milvus access use `asyncio.new_event_loop()` or sync drivers. This is fine for a POC. For production, run the REPL in a thread pool.

5. **BERTopic on-demand** — Clustering runs when the user clicks "Cluster Topics," not automatically on every upload. This keeps ingest fast and lets the user control when to re-cluster.

6. **Simple user model** — No real auth. Just a username selector. POC only.

7. **WebSocket for REPL logs** — The UI connects via WebSocket to stream REPL iterations in real time. This is the "wow factor" of the demo — watching the LLM write and execute its own retrieval strategy.

---

## What the LLM Does at Runtime (Example)

User query: *"Summarize the DoW announcement A54x on AI"*

The RLM generates and executes code like this:

```
Iteration 1:
    Code:   matches = find_file("DoW A54x AI")
            print(matches)
    Output: [{"file_id": "abc-123", "filename": "DoW-A54x-AI-Autonomous-Ops.pdf", "relevance": 2.847}]

Iteration 2:
    Code:   doc = get_file("abc-123")
            print(f"File: {doc['filename']}, Length: {len(doc['content'])} chars")
            print(doc['content'][:1000])
    Output: File: DoW-A54x-AI-Autonomous-Ops.pdf, Length: 45230 chars
            Department of the Army, Announcement A54x...

Iteration 3:
    Code:   # Doc is long, use sub-LM to summarize in chunks
            chunks = [doc['content'][i:i+6000] for i in range(0, len(doc['content']), 6000)]
            summaries = []
            for i, chunk in enumerate(chunks):
                s = llm_query(f"Summarize this section of DoW announcement A54x:\n{chunk}")
                summaries.append(s)
                print(f"Chunk {i+1}/{len(chunks)} summarized")
    Output: Chunk 1/8 summarized
            Chunk 2/8 summarized
            ...

Iteration 4:
    Code:   combined = "\n\n".join(summaries)
            final = llm_query(f"Combine these section summaries into one cohesive summary:\n{combined}")
            SUBMIT(final)
    Output: (SUBMIT called)

Final Answer: "The DoW announcement A54x outlines the Army's AI initiative for autonomous operations..."
```

The user sees the final answer in the chat, and the REPL log panel shows all four iterations with the code and outputs. The LLM decided on its own to use `find_file` (not semantic search), retrieve the full document, chunk it for sub-LM summarization, and combine the results. No retrieval chain was hardcoded.

---

## Getting Started

```bash
# Clone and set up
cp .env.example .env
# Edit .env with your OPENAI_API_KEY

# Start everything
docker compose up --build

# Access
# UI:  http://localhost:3000
# API: http://localhost:8000
# API docs: http://localhost:8000/docs
```

The `init.sql` file (mounted into Postgres) should contain the full schema above. Alembic migrations are optional for the POC — just use the init script.

---

## Stretch Goals (Not Required for POC)

- Streaming token output for the final answer (not just REPL steps)
- File preview in the UI (PDF viewer, etc.)
- Conversation memory across chat sessions
- Multi-user support with real auth
- Export chat sessions
- vLLM backend integration
- Hierarchical BERTopic with LLM-generated labels
- Cross-KB topic comparison view
