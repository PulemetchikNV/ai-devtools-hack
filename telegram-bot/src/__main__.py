import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.fsm.storage.memory import MemoryStorage

from src.config import settings
from src.handlers import setup_routers


logger = logging.getLogger(__name__)


bot = Bot(token=settings.telegram_bot_token)
dp = Dispatcher(storage=MemoryStorage())

dp.include_router(setup_routers())


async def on_startup():
    """Действия при запуске бота"""
    logger.info("Bot is starting...")
    if settings.admin_chat_id:
        try:
            await bot.send_message(
                settings.admin_chat_id,
                "Бот запущен и готов к работе!"
            )
        except Exception as e:
            logger.warning(f"Could not send startup message to admin: {e}")


async def on_shutdown():
    """Действия при остановке бота"""
    logger.info("Bot is shutting down...")
    await bot.session.close()


async def main():
    """Главная функция запуска бота"""
    try:
        await on_startup()
        logger.info("Starting polling...")
        await dp.start_polling(bot)
    finally:
        await on_shutdown()


if __name__ == "__main__":
    asyncio.run(main())
