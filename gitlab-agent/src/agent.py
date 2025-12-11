import os
import json
import asyncio
import logging
from typing import List, Optional, Any
from uuid import uuid4
from datetime import timedelta
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_openai import ChatOpenAI
from langchain_core.tools import Tool, StructuredTool
from pydantic import BaseModel, Field, create_model
import httpx
from httpx_sse import aconnect_sse


def _parse_sse_like_body(body: str) -> Optional[dict]:
    """
    Сервер может вернуть SSE-формат в теле (даже с неверным Content-Type).
    Пытаемся вынуть первую data: строку и распарсить как JSON.
    """
    lines = [line.strip() for line in body.splitlines() if line.strip()]
    data_lines = []
    for line in lines:
        if line.startswith("data:"):
            data_lines.append(line[len("data:"):].strip())
    if not data_lines:
        return None
    try:
        return json.loads("".join(data_lines))
    except Exception:
        return None

"""Определение LangChain агента с поддержкой MCP инструментов."""
import os
import json
import asyncio
import logging
from typing import List, Optional, Any
from uuid import uuid4
from datetime import timedelta
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_openai import ChatOpenAI
from langchain_core.tools import Tool, StructuredTool
from pydantic import BaseModel, Field, create_model
import httpx
from httpx_sse import aconnect_sse

logger = logging.getLogger(__name__)


class MCPClient:
    """Простейший клиент MCP для Streamable HTTP (JSON-RPC over HTTP + optional SSE)."""

    def __init__(self, base_url: str, protocol_version: str = "2025-06-18"):
        self.base_url = base_url.rstrip('/')
        self._session_id: Optional[str] = None
        self._protocol_version = protocol_version
        self._initialized = False

    def _headers(self) -> dict:
        headers = {
            "Accept": "application/json, text/event-stream",
            "Content-Type": "application/json",
            "MCP-Protocol-Version": self._protocol_version,
        }
        if self._session_id:
            headers["Mcp-Session-Id"] = self._session_id
        return headers

    async def _send_request(self, payload: dict, timeout: float = 60.0) -> dict:
        """
        Отправляет JSON-RPC POST на MCP endpoint.
        Если сервер отвечает SSE, обрабатываем поток и возвращаем response для нашего id.
        """
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            # Пытаемся открыть SSE; если сервер отвечает application/json или 406, просто фоллбек на обычный POST
            try:
                async with aconnect_sse(
                    client,
                    method="POST",
                    url=self.base_url,
                    json=payload,
                    headers=self._headers(),
                    timeout=httpx.Timeout(timeout, read=timeout),
                ) as event_source:
                    sid = event_source.response.headers.get("Mcp-Session-Id")
                    print(f'GOD SID FROM MCP SERVER: {sid}')
                    if sid:
                        self._session_id = sid
                    async for sse in event_source.aiter_sse():
                        if not sse.data:
                            continue
                        try:
                            msg = json.loads(sse.data)
                        except Exception as exc:
                            logger.error(f"Failed to parse SSE JSON: {exc}")
                            continue
                        if msg.get("id") == payload.get("id"):
                            if "error" in msg:
                                raise Exception(f"MCP error: {msg['error']}")
                            return msg.get("result", {})
            except Exception as sse_exc:
                logger.info("SSE not available, falling back to JSON: %s", sse_exc)

            # Обычный POST, ожидаем JSON ответ
            response = await client.post(
                self.base_url,
                json=payload,
                headers=self._headers(),
            )
            sid = response.headers.get("Mcp-Session-Id")
            if sid:
                self._session_id = sid
            if response.status_code >= 400:
                logger.error(
                    "MCP HTTP error %s: %s", response.status_code, response.text
                )
                response.raise_for_status()
            if not response.text.strip():
                logger.info("MCP HTTP response is empty body; returning empty result")
                return {}
            try:
                msg = response.json()
            except Exception as exc:
                sse_msg = _parse_sse_like_body(response.text)
                if sse_msg:
                    msg = sse_msg
                else:
                    logger.error("Failed to parse MCP JSON response: %s; body=%r", exc, response.text)
                    raise
            if "error" in msg:
                raise Exception(f"MCP error: {msg['error']}")
            if msg.get("id") != payload.get("id"):
                logger.warning("Mismatched response id (got %s, expected %s)", msg.get("id"), payload.get("id"))
            return msg.get("result", {})

    async def _ensure_initialized(self):
        if self._initialized:
            return
        init_id = uuid4().hex
        payload = {
            "jsonrpc": "2.0",
            "id": init_id,
            "method": "initialize",
            "params": {
                "protocolVersion": self._protocol_version,
                "capabilities": {
                    "sampling": None,
                    "experimental": None,
                    "roots": {"listChanged": True},
                },
                "clientInfo": {"name": "langchain-agent", "version": "0.1.0"},
            },
        }
        await self._send_request(payload, timeout=30.0)
        self._initialized = True

    async def list_tools(self) -> List[dict]:
        """Получает список доступных инструментов от MCP сервера по Streamable HTTP."""
        await self._ensure_initialized()
        req_id = uuid4().hex
        payload = {
            "jsonrpc": "2.0",
            "id": req_id,
            "method": "tools/list",
            "params": {},
        }
        result = await self._send_request(payload, timeout=60.0)
        tools: List[dict] = []
        for tool in result.get("tools", []):
            tools.append(
                {
                    "name": tool.get("name"),
                    "description": tool.get("description", "") or "",
                    "inputSchema": tool.get("inputSchema", {}) or {},
                }
            )
        return tools

    async def call_tool(self, tool_name: str, arguments: dict) -> Any:
        print(f'call_tool TOOL_NAME: {tool_name}')
        print(f'call_tool ARGUMENTS: {arguments}\n\n')
        """Вызывает инструмент по Streamable HTTP."""
        await self._ensure_initialized()
        req_id = uuid4().hex
        payload = {
            "jsonrpc": "2.0",
            "id": req_id,
            "method": "tools/call",
            "params": {"name": tool_name, "arguments": arguments or {}},
        }
        result = await self._send_request(payload, timeout=120.0)
        content = result.get("content", [])
        if content:
            first = content[0]
            if isinstance(first, dict) and "text" in first:
                return first["text"]
        return str(result)


def create_langchain_tool_from_mcp(mcp_client: MCPClient, mcp_tool: dict) -> Tool:
    """Создает LangChain Tool из описания MCP инструмента."""
    tool_name = mcp_tool["name"]
    tool_description = mcp_tool.get("description", f"MCP tool: {tool_name}")
    input_schema = mcp_tool.get("inputSchema", {})

    # Создаем функцию-обёртку для вызова MCP tool
    def tool_func(**kwargs) -> str:
        """Вызывает MCP инструмент."""
        try:
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = None

            coro = mcp_client.call_tool(tool_name, kwargs)

            if loop and loop.is_running():
                # Если сейчас уже есть активный loop (например, внутри LangChain),
                # выполняем корутину в отдельном потоке, чтобы не блокировать его.
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(asyncio.run, coro)
                    return str(future.result())
            else:
                # Нет активного loop — создаём новый через asyncio.run
                return str(asyncio.run(coro))
        except Exception as e:
            logger.error(f"Error calling MCP tool {tool_name}: {e}")
            return f"Error: {str(e)}"

    # Создаем Pydantic модель из JSON Schema для валидации
    if input_schema.get("properties"):
        print(f'created STRUCTURED TOOL')
        fields = {}
        for prop_name, prop_schema in input_schema.get("properties", {}).items():
            prop_type = str  # По умолчанию string
            if prop_schema.get("type") == "integer":
                prop_type = int
            elif prop_schema.get("type") == "number":
                prop_type = float
            elif prop_schema.get("type") == "boolean":
                prop_type = bool

            required = prop_name in input_schema.get("required", [])
            default = ... if required else None
            fields[prop_name] = (prop_type, Field(default=default, description=prop_schema.get("description", "")))

        ArgsModel = create_model(f"{tool_name}Args", **fields)

        return StructuredTool.from_function(
            func=tool_func,
            name=tool_name,
            description=tool_description,
            args_schema=ArgsModel,
        )
    else:
        print('created SIMPLE TOOL')
        # Простой tool без аргументов или со строковым input
        return Tool(
            name=tool_name,
            description=tool_description,
            func=lambda x="": tool_func(input=x) if x else tool_func()
        )


async def get_mcp_tools_async(mcp_urls: Optional[str]) -> List[Tool]:
    print(f'get_mcp_tools_async MCP_URLS: {mcp_urls}')
    """Асинхронно получает инструменты из MCP серверов."""
    tools = []
    print(f'MCP URLS {mcp_urls}')

    if not mcp_urls:
        logger.info("No MCP_URL configured, running without MCP tools")
        return tools

    for mcp_url in mcp_urls.split(','):
        mcp_url = mcp_url.strip()
        if not mcp_url:
            continue

        logger.info(f"Connecting to MCP server: {mcp_url}")
        mcp_client = MCPClient(mcp_url)

        try:
            mcp_tools = await mcp_client.list_tools()
            logger.info(f"Found {len(mcp_tools)} tools from {mcp_url}")

            for mcp_tool in mcp_tools:
                tool = create_langchain_tool_from_mcp(mcp_client, mcp_tool)
                print(f'ADDED TOOL: {tool}')
                tools.append(tool)
                logger.info(f"  - Added tool: {mcp_tool['name']}")

        except Exception as e:
            logger.error(f"Failed to connect to MCP server {mcp_url}: {e}")

    return tools


def get_mcp_tools(mcp_urls: Optional[str]) -> List[Tool]:
    """Синхронная обёртка для получения MCP tools."""
    try:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            # Создаём новый event loop в отдельном потоке
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(asyncio.run, get_mcp_tools_async(mcp_urls))
                return future.result()
        else:
            return asyncio.run(get_mcp_tools_async(mcp_urls))
    except Exception as e:
        logger.error(f"Error getting MCP tools: {e}")
        return []


def create_langchain_agent(mcp_urls: Optional[str] = None):
    """Создает LangChain агента с инструментами."""
    raw_model = os.getenv("LLM_MODEL")
    # Cloud.ru отдает модель вида hosted_vllm/openai/gpt-oss-120b, а endpoint ждет openai/gpt-oss-120b
    model = raw_model.removeprefix("hosted_vllm/") if raw_model else None
    if raw_model != model:
        logger.info(f'create_langchain_agent normalized LLM_MODEL from {raw_model} to {model}')
    else:
        logger.info(f'create_langchain_agent LLM_MODEL: {model}')
    logger.info(f'create_langchain_agent LLM_API_BASE: {os.getenv("LLM_API_BASE")}')
    logger.info(f'create_langchain_agent LLM_API_KEY: {os.getenv("LLM_API_KEY")}')

    # Создаем LLM через LiteLLM для унификации
    llm = ChatOpenAI(
        model=model,
        base_url=os.getenv("LLM_API_BASE"),
        api_key=os.getenv("LLM_API_KEY"),
        temperature=0.7,
    )
    
    # Получаем инструменты из MCP
    tools = get_mcp_tools(mcp_urls)
    
    # Системный промпт
    system_prompt = os.getenv(
        "AGENT_SYSTEM_PROMPT",
        "Ты полезный AI-ассистент. Используй доступные инструменты для решения задач пользователя."
    )
    
    # Создаем промпт для агента
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ])
    
    # Создаем агента
    agent = create_openai_tools_agent(llm, tools, prompt)
    
    # Создаем executor
    agent_executor = AgentExecutor(
        agent=agent,
        tools=tools,
        verbose=True,
        handle_parsing_errors=True,
        max_iterations=15,
    )
    
    return agent_executor


