import os

import uvicorn

from app.core.config import get_settings


if __name__ == "__main__":
    settings = get_settings()
    enable_reload = settings.ai_service_env == "development"
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.ai_service_port,
        reload=enable_reload,
    )
