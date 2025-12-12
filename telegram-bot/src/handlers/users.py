import logging
from aiogram import F, Router
from aiogram.filters import Command
from aiogram.types import Message
from aiogram.utils.text_decorations import markdown_decoration as md

from src.config import settings
from src.texts import START_MESSAGE, HELP_MESSAGE, RESET_MESSAGE
from src.a2a_client import agent_client
from src.utils import split_long_message

logger = logging.getLogger(__name__)

router = Router()


@router.message(Command("start"))
async def start_handler(message: Message):
    """Обработчик команды /start"""
    await message.answer(START_MESSAGE)
    logger.info(f"User {message.from_user.id} (chat {message.chat.id}) started the bot")


@router.message(Command("help"))
async def cmd_help(message: Message):
    """Обработчик команды /help"""
    await message.answer(HELP_MESSAGE)


@router.message(Command("reset"))
async def reset_handler(message: Message):
    """Обработчик команды /reset - сброс контекста диалога"""
    await message.answer(RESET_MESSAGE)
    logger.info(f"User {message.from_user.id} (chat {message.chat.id}) requested context reset")


@router.message(F.text)
async def process_user_message_handler(message: Message):
    """Обработчик сообщений пользователя - отправляет в A2A агент"""
    user_text = message.text
    user_id = message.from_user.id
    chat_id = message.chat.id

    logger.info(f"Received message from user {user_id} in chat {chat_id}: {user_text[:50]}...")

    await message.bot.send_chat_action(chat_id=chat_id, action="typing")

    try:
        # Используем chat_id как context_id - одна сессия на чат
        context_id = str(chat_id)

        # Формируем информацию о пользователе для агента
        user_info = {
            "telegram_id": user_id,
            "username": message.from_user.username,
            "first_name": message.from_user.first_name,
            "last_name": message.from_user.last_name,
        }

        # Отправляем сообщение агенту через A2A
        if settings.a2a_agent_url:
            ai_response, _ = await agent_client.send_message(
                message=user_text,
                user_info=user_info,
                context_id=context_id,
            )
        else:
            # Fallback если A2A не настроен
            ai_response = (
                f"⚠️ A2A агент не настроен (A2A_AGENT_URL не задан)\n\n"
                f"Данные которые были бы отправлены агенту:\n"
                f"• Сообщение: {user_text}\n"
                f"• Context ID: {context_id}\n"
                f"• Пользователь: {user_info.get('first_name') or user_info.get('username', 'Unknown')}"
            )

        # Разбиваем длинные сообщения на части для соблюдения лимита Telegram
        message_chunks = split_long_message(ai_response)

        if len(message_chunks) > 1:
            logger.info(f"Splitting response into {len(message_chunks)} messages for user {user_id}")

        for chunk in message_chunks:
            try:
                safe_chunk = md.quote(chunk)
                # Пытаемся отправить с Markdown и без превью ссылок
                await message.answer(
                    safe_chunk, parse_mode="MarkdownV2", disable_web_page_preview=True
                )
            except Exception as e:
                logger.warning(f"Failed to send with Markdown, sending as plain text: {e}")
                # Если не получилось - отправляем как plain text
                await message.answer(chunk, disable_web_page_preview=True)

        logger.info(f"Sent AI response to user {user_id} ({len(message_chunks)} message(s))")

    except Exception as e:
        logger.error(f"Error processing message for user {user_id}: {e}", exc_info=True)
        await message.answer(
            "Произошла ошибка при обработке вашего сообщения. Попробуйте еще раз."
        )
