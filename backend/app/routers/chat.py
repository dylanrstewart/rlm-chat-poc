import json
from uuid import UUID

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.repositories.chat_repository import ChatMessageRepository, ChatSessionRepository
from app.schemas.chat import ChatMessageRead, ChatQueryRequest, ChatSessionCreate, ChatSessionRead
from app.schemas.common import ApiResponse
from app.services.milvus_service import MilvusService
from app.services.rlm.engine import RLMEngine
from app.services.rlm.session import session_manager

router = APIRouter(prefix="/api/chat", tags=["chat"])


def _get_openai_client() -> AsyncOpenAI:
    if settings.llm_backend == "vllm" and settings.vllm_url:
        return AsyncOpenAI(base_url=settings.vllm_url, api_key="dummy")
    return AsyncOpenAI(api_key=settings.openai_api_key)


@router.post("/sessions", response_model=ApiResponse[ChatSessionRead])
async def create_session(body: ChatSessionCreate, db: AsyncSession = Depends(get_db)):
    repo = ChatSessionRepository(db)
    session = await repo.create(user_id=body.user_id, title=body.title)
    await db.commit()
    return ApiResponse(success=True, data=ChatSessionRead.model_validate(session))


@router.get("/sessions", response_model=ApiResponse[list[ChatSessionRead]])
async def list_sessions(user_id: UUID, db: AsyncSession = Depends(get_db)):
    repo = ChatSessionRepository(db)
    sessions = await repo.find_by_user(user_id)
    return ApiResponse(success=True, data=[ChatSessionRead.model_validate(s) for s in sessions])


@router.get("/sessions/{session_id}/messages", response_model=ApiResponse[list[ChatMessageRead]])
async def list_messages(session_id: UUID, db: AsyncSession = Depends(get_db)):
    repo = ChatMessageRepository(db)
    messages = await repo.find_by_session(session_id)
    return ApiResponse(success=True, data=[
        ChatMessageRead(
            id=m.id,
            session_id=m.session_id,
            role=m.role,
            content=m.content,
            metadata=m.metadata_,
            created_at=m.created_at,
        )
        for m in messages
    ])


@router.post("/sessions/{session_id}/query", response_model=ApiResponse[str])
async def query_session(
    session_id: UUID,
    body: ChatQueryRequest,
    db: AsyncSession = Depends(get_db),
):
    """REST endpoint: send a query, get the final answer (no streaming)."""
    session_repo = ChatSessionRepository(db)
    msg_repo = ChatMessageRepository(db)

    session = await session_repo.find_by_id(session_id)
    if not session:
        return ApiResponse(success=False, error="Session not found")

    # Save user message
    await msg_repo.create(session_id=session_id, role="user", content=body.query)

    # Get or create RLM session
    milvus = MilvusService()
    rlm_session = await session_manager.get_or_create(
        str(session.user_id), db, milvus
    )

    # Run RLM
    client = _get_openai_client()
    engine = RLMEngine(
        client=client,
        model=settings.llm_model,
        sub_model=settings.llm_sub_model,
    )

    repl_logs = []

    async def on_step(step):
        repl_logs.append(step)
        await msg_repo.create(
            session_id=session_id,
            role="repl_log",
            content=step["code"],
            metadata_=step,
        )

    answer = await engine.run(
        query=body.query,
        context="",
        tools=rlm_session.tools,
        tool_prompt=rlm_session.tool_descriptions,
        on_repl_step=on_step,
    )

    # Save assistant message
    await msg_repo.create(session_id=session_id, role="assistant", content=answer)
    await db.commit()

    return ApiResponse(success=True, data=answer)


@router.websocket("/sessions/{session_id}/ws")
async def websocket_chat(websocket: WebSocket, session_id: UUID):
    """WebSocket endpoint for real-time REPL log streaming."""
    await websocket.accept()

    try:
        while True:
            data = await websocket.receive_json()
            query = data.get("query", "")
            user_id = data.get("user_id", "")

            if not query or not user_id:
                await websocket.send_json({"type": "error", "content": "Missing query or user_id"})
                continue

            async with get_db_session() as db:
                msg_repo = ChatMessageRepository(db)
                await msg_repo.create(session_id=session_id, role="user", content=query)

                milvus = MilvusService()
                rlm_session = await session_manager.get_or_create(user_id, db, milvus)

                client = _get_openai_client()
                engine = RLMEngine(
                    client=client,
                    model=settings.llm_model,
                    sub_model=settings.llm_sub_model,
                )

                async def on_step(step):
                    await websocket.send_json({"type": "repl_step", **step})

                answer = await engine.run(
                    query=query,
                    context="",
                    tools=rlm_session.tools,
                    tool_prompt=rlm_session.tool_descriptions,
                    on_repl_step=on_step,
                )

                await msg_repo.create(session_id=session_id, role="assistant", content=answer)
                await db.commit()

                await websocket.send_json({"type": "answer", "content": answer})

    except WebSocketDisconnect:
        pass


async def get_db_session():
    """Helper to get a DB session outside of dependency injection."""
    from app.database import async_session
    return async_session()
