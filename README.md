# RLM Chat POC

A proof-of-concept Recursive Language Model (RLM) platform with a Fallout Pip-Boy terminal aesthetic. Upload documents, organize into knowledge bases, and query using an RLM-powered chat where the LLM autonomously writes Python code to retrieve and process your data.

## Architecture

```
React UI  ──WS──►  FastAPI  ──►  RLM Engine (Python REPL)
                      │                   │
              PostgreSQL            Milvus (vectors)
              (files, users)        (embeddings)
```

- **Backend**: FastAPI + SQLAlchemy async + RLM REPL engine
- **Frontend**: React + Vite + Tailwind + Zustand (RobCo terminal theme)
- **Vector DB**: Milvus (with etcd + MinIO)
- **Database**: PostgreSQL 16 with pg_trgm + FTS
- **Audio**: Pip-Boy sound effects via Web Audio API (Fallout 3/NV sound pack)

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

Note: BERTopic and its native dependencies (hdbscan, umap-learn) only install in Docker. Use `requirements-core.txt` for local development without clustering support.

### Frontend

```bash
cd frontend
npm install
npm run dev      # Dev server on :3000
npm run build    # Production build
npm test         # Run vitest
```

## UI Overview

The frontend uses a RobCo Unified Operating System / Pip-Boy CRT terminal theme with amber phosphor styling. Navigation is organized into five tabs:

- **Communications (Chat)** — Chat sessions with the RLM, real-time REPL step streaming via WebSocket
- **Data Storage (Files)** — Knowledge base management, file uploads, BERTopic clustering
- **System Logs (View)** — Live REPL execution log showing LLM-generated code and output
- **Terminal Hack (Game)** — Fallout-style terminal hacking minigame (see below)
- **Settings** — User profile, system info, audio toggle

### Audio

UI interactions are accompanied by authentic Fallout 3/New Vegas Pip-Boy sound effects loaded from `frontend/public/sounds/`. Sounds are decoded into `AudioBuffer`s on first user interaction and played through a `GainNode` chain via the Web Audio API.

| Action | Sound | Source |
|--------|-------|--------|
| Tab/vault/session switch | Navigation click | `deck_ui_navigation.wav` |
| Create user/vault, upload/cluster success | Confirmation | `deck_ui_default_activation.wav` |
| Send message, start upload/cluster | Transition | `deck_ui_into_game_detail.wav` |
| Receive AI response | Toast notification | `deck_ui_toast.wav` |
| Error, delete action | Warning bumper | `deck_ui_bumper_end_02.wav` |
| REPL step execution | Hacking terminal chars | `ui_hacking_charsingle_01-06.wav` (cycling) |

Audio can be toggled on/off in the Settings panel. Mute state persists across sessions via localStorage.

### Terminal Hacking Minigame

A playable recreation of the Fallout terminal hacking minigame, available as the "Terminal Hack" tab. Pure frontend — no backend required.

**How to play:**

1. Select a difficulty (Novice, Advanced, Expert, or Master)
2. A hex dump grid appears with words embedded among random ASCII garbage
3. Hover over characters to highlight words and bracket groups
4. Click a word to guess — feedback shows `Likeness=N` (letters matching the correct password at the exact same position)
5. You have 4 attempts. Use likeness feedback to narrow down the answer
6. Click matched bracket pairs (`()`, `[]`, `{}`, `<>`) in the garbage for a bonus: 60% chance to remove a dud word, 40% chance to reset attempts to 4
7. Correct guess = ACCESS GRANTED, out of attempts = TERMINAL LOCKED

**Difficulty levels:**

| Level | Word Length | Words on Screen |
|-------|-----------|-----------------|
| Novice | 4 letters | 14–18 |
| Advanced | 5–6 letters | 16–22 |
| Expert | 7–8 letters | 18–24 |
| Master | 9–12 letters | 16–22 |

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
│   ├── models.py            # ORM models (portable types for SQLite test compat)
│   ├── routers/             # API endpoints (users, KBs, files, chat, topics)
│   ├── services/
│   │   ├── embedding.py     # OpenAI embeddings
│   │   ├── milvus_service.py
│   │   ├── ingest.py        # Document ingest pipeline
│   │   ├── clustering.py    # BERTopic topic extraction
│   │   └── rlm/             # RLM engine, tools, session manager, prompts
│   ├── repositories/        # Data access layer (repository pattern)
│   ├── schemas/             # Pydantic request/response schemas
│   └── utils/               # Text extraction, chunking
├── tests/                   # 104 tests, 80%+ coverage (SQLite in-memory)
└── init.sql                 # PostgreSQL schema (extensions, FTS, trigram indexes)

frontend/
├── public/
│   └── sounds/              # Pip-Boy wav files (Fallout 3/NV sound pack)
├── src/
│   ├── audio/
│   │   ├── soundEngine.ts   # Web Audio API sample loader + playback
│   │   └── useSound.ts      # React hook + standalone playIfUnmuted helper
│   ├── components/
│   │   ├── AppLayout.tsx     # Main layout with nav tabs + AudioContext resume
│   │   ├── ChatPanel.tsx     # Chat sessions, messages, WebSocket integration
│   │   ├── FilePanel.tsx     # File explorer sidebar
│   │   ├── HackingPanel.tsx  # Terminal hacking minigame UI
│   │   ├── Header.tsx        # User selector + create
│   │   ├── KBSidebar.tsx     # Knowledge base CRUD, upload, clustering
│   │   ├── ReplLogPanel.tsx  # Live REPL execution viewer
│   │   └── SettingsPanel.tsx # Settings + audio mute toggle
│   ├── data/
│   │   └── hackingWords.ts   # Word lists + difficulty config for hacking game
│   ├── hooks/
│   │   ├── useHackingGame.ts # Game logic hook (reducer, puzzle gen, bracket tricks)
│   │   ├── useWebSocket.ts   # WebSocket connection for REPL streaming
│   │   └── useApi.ts         # API request hook
│   ├── store/appStore.ts     # Zustand state (users, KBs, files, chat, audio)
│   ├── lib/api.ts            # Typed API client
│   └── types/index.ts        # TypeScript type definitions
└── index.html

sounds/                       # Source Pip-Boy sound pack (Fallout 3/NV)
```
