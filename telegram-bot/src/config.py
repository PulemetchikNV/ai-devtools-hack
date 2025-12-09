import logging
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)


class Settings(BaseSettings):
    telegram_bot_token: str
    admin_chat_id: Optional[int] = None

    # A2A Agent configuration
    a2a_agent_url: Optional[str] = None  # URL агента (например: http://localhost:10000)

    model_config = SettingsConfigDict(
        env_file='.env',
        env_file_encoding='utf-8',
        case_sensitive=False
    )


settings = Settings()