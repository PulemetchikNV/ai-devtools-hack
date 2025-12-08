import logging
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)


class Settings(BaseSettings):
    telegram_bot_token: str
    ai_api_base_url: str
    ai_api_key: str
    ai_model: str = "gpt-oss-120b"
    admin_chat_id: Optional[int] = None

    model_config = SettingsConfigDict(
        env_file='.env',
        env_file_encoding='utf-8',
        case_sensitive=False
    )


settings = Settings()