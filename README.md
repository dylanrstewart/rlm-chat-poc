# RLM Chat POC

A proof-of-concept Recursive Language Model (RLM) platform. Upload documents, organize into knowledge bases, and query using an RLM-powered chat where the LLM autonomously writes Python code to retrieve and process your data.

## Architecture

```
React UI  ──WS──►  FastAPI  ──►  RLM Engine (Python REPL)
                      │                   │
              PostgreSQL            Milvus (vectors)
              (files, users)        (embeddings)
```

- **Backend**: FastAPI + SQLAlchemy async + RLM REPL engine
- **Frontend**: React + Vite + Tailwind + Zustand
- **Vector DB**: Milvus (with etcd + MinIO)
- **Database**: PostgreSQL 16 with pg_trgm + FTS

## Quick Start

```bash
# 1. Copy and configure environment
cp .env.example .env
# Edit .env with your OPENAI_API_KEY

# 2. Start all services
docker compose up --build

# 3. Access
# UI:       http://localhost:3000
# API:      http://localhost:8000
# API Docs: http://localhost:8000/docs
```

## Development

### Backend

```bash
cd backend
uv venv .venv --python python3.12
source .venv/bin/activate
uv pip install -r requirements-dev.txt

# Run tests
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=app --cov-report=term-missing
```

### Frontend

```bash
cd frontend
npm install
npm run dev      # Dev server on :3000
npm run build    # Production build
npm test         # Run vitest
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/users` | Create user |
| GET | `/api/users` | List users |
| GET | `/api/users/{id}` | Get user |
| POST | `/api/knowledge-bases` | Create knowledge base |
| GET | `/api/knowledge-bases?user_id=` | List user's KBs |
| DELETE | `/api/knowledge-bases/{id}` | Delete KB + Milvus collection |
| POST | `/api/knowledge-bases/{kb_id}/files` | Upload files (triggers ingest) |
| GET | `/api/knowledge-bases/{kb_id}/files` | List files |
| DELETE | `/api/files/{id}` | Delete file |
| GET | `/api/files/{id}/content` | Get file text content |
| POST | `/api/knowledge-bases/{kb_id}/cluster` | Trigger BERTopic clustering |
| GET | `/api/knowledge-bases/{kb_id}/topics` | List topic clusters |
| POST | `/api/chat/sessions` | Create chat session |
| GET | `/api/chat/sessions?user_id=` | List sessions |
| GET | `/api/chat/sessions/{id}/messages` | Get messages |
| POST | `/api/chat/sessions/{id}/query` | Send query (REST) |
| WS | `/api/chat/sessions/{id}/ws` | Real-time REPL streaming |

## How the RLM Works

1. User sends a query
2. The LLM generates Python code to answer it
3. Code executes in a sandboxed REPL with closure-scoped tools:
   - `search_docs()` — semantic search across document chunks
   - `find_file()` — fuzzy filename matching
   - `get_file()` — retrieve full file content
   - `llm_query()` — recursive sub-LM calls
4. Output feeds back to the LLM for the next iteration
5. `SUBMIT("answer")` returns the final answer
6. Each iteration streams to the UI via WebSocket

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app + routers
│   ├── config.py            # Settings from env vars
│   ├── database.py          # Async SQLAlchemy
│   ├── models.py            # ORM models
│   ├── routers/             # API endpoints
│   ├── services/
│   │   ├── embedding.py     # OpenAI embeddings
│   │   ├── milvus_service.py
│   │   ├── ingest.py        # Document pipeline
│   │   ├── clustering.py    # BERTopic
│   │   └── rlm/             # RLM engine + tools
│   ├── repositories/        # Data access layer
│   ├── schemas/             # Pydantic schemas
│   └── utils/               # Chunking, text extraction
├── tests/                   # 104 tests, 80%+ coverage
└── init.sql                 # PostgreSQL schema

frontend/
├── src/
│   ├── components/          # React components
│   ├── hooks/               # useWebSocket, useApi
│   ├── store/               # Zustand state
│   ├── lib/api.ts           # Typed API client
│   └── types/               # TypeScript types
└── index.html
```
