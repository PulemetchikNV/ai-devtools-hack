import logging
from aiogram import F, Router
from aiogram.filters import Command
from aiogram.types import Message
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from openai import AsyncOpenAI

from src.config import settings
from src.texts import START_MESSAGE, HELP_MESSAGE


logger = logging.getLogger(__name__)


class ConversationStates(StatesGroup):
    waiting_for_message = State()


router = Router()

openai_client = AsyncOpenAI(
    api_key=settings.ai_api_key,
    base_url=settings.ai_api_base_url
)


@router.message(Command("start"))
async def start_handler(message: Message, state: FSMContext):
    """Обработчик команды /start"""
    await state.set_state(ConversationStates.waiting_for_message)
    await message.answer(START_MESSAGE)
    logger.info(f"User {message.from_user.id} started the bot")


@router.message(ConversationStates.waiting_for_message, F.text)
async def process_user_message_handler(message: Message, state: FSMContext):
    """Обработчик сообщений пользователя"""
    user_text = message.text
    user_id = message.from_user.id

    logger.info(f"Received message from user {user_id}: {user_text[:50]}...")

    await message.bot.send_chat_action(chat_id=message.chat.id, action="typing")

    try:
        response = await openai_client.chat.completions.create(
            model=settings.ai_model,
            messages=[
                {
                    "role": "system",
                    "content": "Ты полезный AI-ассистент. Отвечай кратко и по делу на русском языке."
                },
                {
                    "role": "user",
                    "content": user_text
                }
            ],
            max_tokens=1000,
            temperature=0.7
        )

        ai_response = response.choices[0].message.content

        await message.answer(ai_response)
        logger.info(f"Sent AI response to user {user_id}")

    except Exception as e:
        logger.error(f"Error processing message for user {user_id}: {e}")
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