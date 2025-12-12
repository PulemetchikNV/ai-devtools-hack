import asyncio
import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from src.handlers.users import process_user_message_handler  # noqa: E402
from src.handlers import users  # noqa: E402


class DummyUser:
    def __init__(self, uid, username="user", first_name="Name", last_name="Last"):
        self.id = uid
        self.username = username
        self.first_name = first_name
        self.last_name = last_name


class DummyChat:
    def __init__(self, cid):
        self.id = cid


class DummyBot:
    def __init__(self):
        self.actions = []

    async def send_chat_action(self, chat_id, action):
        self.actions.append((chat_id, action))


class DummyMessage:
    def __init__(self, text="hi", uid=1, cid=2):
        self.text = text
        self.from_user = DummyUser(uid)
        self.chat = DummyChat(cid)
        self.bot = DummyBot()
        self.answers = []

    async def answer(self, text, **kwargs):
        self.answers.append((text, kwargs))


class HandlersTests(unittest.TestCase):
    def test_process_user_message_handler_fallback_without_a2a(self):
        msg = DummyMessage(text="привет", uid=42, cid=99)

        async def run():
            with patch.object(users.settings, "a2a_agent_url", None), \
                 patch.object(users.agent_client, "send_message", AsyncMock(side_effect=AssertionError("should not call agent"))):
                await process_user_message_handler(msg)

        asyncio.run(run())

        # Проверяем, что ответ отправлен и содержит фоллбек
        self.assertGreaterEqual(len(msg.answers), 1)
        reply_text, kwargs = msg.answers[0]
        self.assertIn("A2A агент не настроен", reply_text)
        self.assertIn("привет", reply_text)
        # Проверяем, что typing действие отправлялось
        self.assertIn((msg.chat.id, "typing"), msg.bot.actions)


if __name__ == "__main__":
    unittest.main()
