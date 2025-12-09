import logging
from aiogram import F, Router
from aiogram.filters import Command
from aiogram.types import Message
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

from src.config import settings
from src.texts import START_MESSAGE, HELP_MESSAGE
from src.a2a_client import agent_client
from src.user_service import get_or_create_user, get_user_context


logger = logging.getLogger(__name__)


class ConversationStates(StatesGroup):
    waiting_for_message = State()


router = Router()


@router.message(Command("start"))
async def start_handler(message: Message, state: FSMContext):
    """Обработчик команды /start"""
    # Создаем/обновляем профиль пользователя
    user = get_or_create_user(
        telegram_id=message.from_user.id,
        username=message.from_user.username,
        first_name=message.from_user.first_name,
        last_name=message.from_user.last_name,
        language_code=message.from_user.language_code,
    )

    # Сбрасываем context_id при старте нового диалога
    await state.update_data(context_id=None)
    await state.set_state(ConversationStates.waiting_for_message)

    await message.answer(START_MESSAGE)
    logger.info(f"User {message.from_user.id} started the bot, profile: {user.subscription_plan}")


@router.message(ConversationStates.waiting_for_message, F.text)
async def process_user_message_handler(message: Message, state: FSMContext):
    """Обработчик сообщений пользователя - отправляет в A2A агент"""
    user_text = message.text
    user_id = message.from_user.id

    logger.info(f"Received message from user {user_id}: {user_text[:50]}...")

    await message.bot.send_chat_action(chat_id=message.chat.id, action="typing")

    try:
        # Получаем данные из FSM state
        state_data = await state.get_data()
        context_id = state_data.get("context_id")  # None при первом сообщении

        # Получаем контекст пользователя (из "БД")
        user_context = get_user_context(user_id)

        # Отправляем сообщение агенту через A2A
        if settings.a2a_agent_url:
            ai_response, new_context_id = await agent_client.send_message(
                message=user_text,
                user_context=user_context,
                context_id=context_id,
            )
            # Сохраняем contextId для следующих сообщений
            if new_context_id:
                await state.update_data(context_id=new_context_id)
        else:
            # Fallback если A2A не настроен - показываем что передали бы агенту
            ai_response = (
                f"⚠️ A2A агент не настроен (A2A_AGENT_URL не задан)\n\n"
                f"Данные которые были бы отправлены агенту:\n"
                f"• Сообщение: {user_text}\n"
                f"• Context ID: {context_id}\n"
                f"• Контекст пользователя: {user_context}"
            )

        await message.answer(ai_response)
        logger.info(f"Sent AI response to user {user_id}")

    except Exception as e:
        logger.error(f"Error processing message for user {user_id}: {e}", exc_info=True)
        await message.answer(
            "Произошла ошибка при обработке вашего сообщения. Попробуйте еще раз или используйте /start для перезапуска."
        )


@router.message(Command("help"))
async def cmd_help(message: Message):
    """Обработчик команды /help"""
    await message.answer(HELP_MESSAGE)


@router.message()
async def handle_other_messages(message: Message):
    """Обработчик всех остальных сообщений"""
    await message.answer(
        "Пожалуйста, сначала используйте команду /start, чтобы начать диалог."
    )