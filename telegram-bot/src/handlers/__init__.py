from aiogram import Router
from .users import router as users_router


def setup_routers() -> Router:
    """Настройка и объединение всех роутеров"""
    main_router = Router()
    main_router.include_router(users_router)
    return main_router