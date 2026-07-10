from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ai_service_env: str = "development"
    ai_service_port: int = 8001
    openai_api_key: str | None = None
    openai_model: str = "gpt-4.1-mini"
    openai_max_output_tokens: int = 450
    openai_history_message_limit: int = 20
    openai_history_char_limit: int = 500
    openai_memory_item_limit: int = 5
    backend_base_url: str = "http://127.0.0.1:3000"
    backend_internal_api_key: str | None = None
    ai_service_shared_secret: str | None = None
    request_timeout_seconds: int = 30

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
