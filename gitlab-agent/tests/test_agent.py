import asyncio
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

import agent  # noqa: E402  # isort: skip


class FakeMCPClient:
    """Простой фейковый клиент MCP для юнит-тестов."""

    async def call_tool(self, name, arguments):
        return f"{name}:{arguments}"


class AgentTests(unittest.TestCase):
    def test_create_langchain_tool_from_mcp_structured(self):
        tool = agent.create_langchain_tool_from_mcp(
            FakeMCPClient(),
            {
                "name": "demo",
                "description": "demo tool",
                "inputSchema": {
                    "properties": {"count": {"type": "integer", "description": "amount"}},
                    "required": ["count"],
                },
            },
        )

        result = tool.invoke({"count": 2})

        self.assertEqual(result, "demo:{'count': 2}")
        self.assertEqual(tool.name, "demo")
        self.assertTrue(hasattr(tool, "args_schema"))

    def test_create_langchain_tool_from_mcp_simple(self):
        tool = agent.create_langchain_tool_from_mcp(
            FakeMCPClient(),
            {
                "name": "simple",
                "description": "simple tool",
                "inputSchema": {},
            },
        )

        result = tool.invoke("ping")

        self.assertEqual(result, "simple:{'input': 'ping'}")
        self.assertEqual(tool.name, "simple")

    def test_get_mcp_tools_async_collects_from_urls(self):
        class FakeClientForList(FakeMCPClient):
            def __init__(self, url: str):
                self.url = url

            async def list_tools(self):
                return [
                    {"name": f"tool-{self.url}", "description": "", "inputSchema": {}},
                ]

        with patch("agent.MCPClient", FakeClientForList):
            tools = asyncio.run(agent.get_mcp_tools_async("http://one, http://two"))

        tool_names = [tool.name for tool in tools]
        self.assertIn("tool-http://one", tool_names)
        self.assertIn("tool-http://two", tool_names)
        self.assertEqual(len(tool_names), 2)

    def test_create_langchain_agent_smoke(self):
        fake_llm = object()
        fake_core_agent = object()
        fake_executor = object()

        with patch("agent.ChatOpenAI", return_value=fake_llm) as chat_cls, \
             patch("agent.get_mcp_tools", return_value=["tool-a"]) as get_tools, \
             patch("agent.create_openai_tools_agent", return_value=fake_core_agent) as create_agent, \
             patch("agent.AgentExecutor", return_value=fake_executor) as executor_cls:

            result = agent.create_langchain_agent("http://dummy")

        self.assertIs(result, fake_executor)
        get_tools.assert_called_once_with("http://dummy")
        create_agent.assert_called_once()
        executor_cls.assert_called_once()
        chat_cls.assert_called_once()


if __name__ == "__main__":
    unittest.main()
