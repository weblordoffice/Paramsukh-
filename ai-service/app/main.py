from fastapi import FastAPI

from app.api.routes import router
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title="ParamSukh AI Service",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)
app.include_router(router)


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "service": "paramsukh-ai-service",
        "environment": settings.ai_service_env,
        "docs": "/docs",
    }
