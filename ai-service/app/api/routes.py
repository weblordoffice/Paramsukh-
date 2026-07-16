import json
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse

from app.core.config import get_settings

from app.models.chat import ChatRequest, ChatResponse
from app.services.orchestrator import ChatOrchestrator
from app.services.stream_orchestrator import StreamingChatOrchestrator
from app.api.recommendations import router as recommendations_router

router = APIRouter()
settings = get_settings()

router.include_router(recommendations_router)


def verify_internal_secret(x_ai_service_secret: str | None) -> None:
    configured_secret = settings.ai_service_shared_secret
    if not configured_secret:
        return
    if x_ai_service_secret != configured_secret:
        raise HTTPException(status_code=401, detail="Invalid AI service secret.")


@router.get("/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok", "service": "ai-service"}


@router.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    x_ai_service_secret: str | None = Header(default=None),
) -> ChatResponse:
    verify_internal_secret(x_ai_service_secret)
    orchestrator = ChatOrchestrator()
    return await orchestrator.handle_message(payload)


@router.post("/chat/stream")
async def chat_stream(
    payload: ChatRequest,
    x_ai_service_secret: str | None = Header(default=None),
) -> StreamingResponse:
    verify_internal_secret(x_ai_service_secret)
    orchestrator = StreamingChatOrchestrator()

    async def event_generator():
        async for event in orchestrator.stream_chat(payload):
            # Send SSE event
            event_data = {
                "event": event.event,
                "data": event.data
            }
            yield f"data: {json.dumps(event_data)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
