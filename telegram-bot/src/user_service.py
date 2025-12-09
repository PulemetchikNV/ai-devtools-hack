"""Сервис для работы с данными пользователей (мок)."""
import logging
from typing import Optional
from dataclasses import dataclass
from datetime import datetime


logger = logging.getLogger(__name__)


@dataclass
class UserProfile:
    """Профиль пользователя."""
    telegram_id: int
    username: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    language_code: Optional[str]
    registered_at: str
    # Моковые бизнес-данные
    subscription_plan: str
    projects_count: int
    last_activity: str
    preferences: dict


# Моковая "база данных" пользователей
_mock_users_db: dict[int, UserProfile] = {}


def get_or_create_user(
    telegram_id: int,
    username: Optional[str] = None,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    language_code: Optional[str] = None,
) -> UserProfile:
    """
    Получает или создает профиль пользователя.

    В реальной реализации здесь будет запрос к БД.
    """
    if telegram_id in _mock_users_db:
        user = _mock_users_db[telegram_id]
        # Обновляем last_activity
        user.last_activity = datetime.now().isoformat()
        logger.info(f"Found existing user: {telegram_id}")
        return user

    # Создаем нового пользователя с моковыми данными
    user = UserProfile(
        telegram_id=telegram_id,
        username=username,
        first_name=first_name,
        last_name=last_name,
        language_code=language_code,
        registered_at=datetime.now().isoformat(),
        # Моковые бизнес-данные для демонстрации
        subscription_plan="free",
        projects_count=0,
        last_activity=datetime.now().isoformat(),
        preferences={
            "notifications": True,
            "theme": "light",
            "timezone": "Europe/Moscow",
        },
    )

    _mock_users_db[telegram_id] = user
    logger.info(f"Created new user: {telegram_id}")
    return user


def get_user_context(telegram_id: int) -> dict:
    """
    Получает контекст пользователя для передачи агенту.

    Возвращает словарь с данными, которые агент может использовать
    для персонализации ответов.
    """
    if telegram_id not in _mock_users_db:
        return {}

    user = _mock_users_db[telegram_id]
    return {
        "user_id": user.telegram_id,
        "имя": user.first_name or user.username or "Пользователь",
        "план_подписки": user.subscription_plan,
        "количество_проектов": user.projects_count,
        "язык": user.language_code or "ru",
        "часовой_пояс": user.preferences.get("timezone", "UTC"),
    }


def update_user_projects_count(telegram_id: int, count: int) -> None:
    """Обновляет количество проектов пользователя."""
    if telegram_id in _mock_users_db:
        _mock_users_db[telegram_id].projects_count = count
        logger.info(f"Updated projects count for user {telegram_id}: {count}")


def update_user_subscription(telegram_id: int, plan: str) -> None:
    """Обновляет план подписки пользователя."""
    if telegram_id in _mock_users_db:
        _mock_users_db[telegram_id].subscription_plan = plan
        logger.info(f"Updated subscription for user {telegram_id}: {plan}")
