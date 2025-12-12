import asyncio
import sys
import unittest
from pathlib import Path
from typing import Optional
from unittest.mock import AsyncMock, patch

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from src.a2a_client import AgentClient  # noqa: E402


class FakeTextPart:
    def __init__(self, text: str):
        self.root = self
        self.text = text


class FakeMessage:
    def __init__(self, role: str, text: str):
        self.role = role
        self.parts = [FakeTextPart(text)]


class FakeResult:
    def __init__(self, text: Optional[str]):
        # history c сообщением агента
        self.history = [FakeMessage("agent", text)] if text is not None else []
        self.context_id = "ctx-123"
        self.artifacts = []


class FakeResponse:
    def __init__(self, text: Optional[str]):
        self.root = self
        self.result = FakeResult(text)


class FakeClient:
    def __init__(self, text: Optional[str]):
        self.send_message = AsyncMock(return_value=FakeResponse(text))


class A2AClientTests(unittest.TestCase):
    def test_send_message_reads_history(self):
        client = AgentClient()

        async def run():
            with patch.object(client, "_get_client", AsyncMock(return_value=FakeClient("hello"))):
                text, ctx = await client.send_message("msg", {"first_name": "Ivan"})
                return text, ctx

        text, ctx = asyncio.run(run())
        self.assertEqual(text, "hello")
        self.assertEqual(ctx, "ctx-123")

    def test_send_message_empty_history_returns_fallback(self):
        client = AgentClient()

        async def run():
            with patch.object(client, "_get_client", AsyncMock(return_value=FakeClient(None))):
                text, ctx = await client.send_message("msg", {"first_name": "Ivan"})
                return text, ctx

        text, ctx = asyncio.run(run())
        self.assertEqual(text, "Агент не вернул ответ")
        self.assertEqual(ctx, "ctx-123")


if __name__ == "__main__":
    unittest.main()
