from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine
from app.routers import chat, files, knowledge_bases, topics, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await engine.dispose()


app = FastAPI(title="RLM Chat POC", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(knowledge_bases.router)
app.include_router(files.router)
app.include_router(topics.router)
app.include_router(chat.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
