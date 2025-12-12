"""Клиент MCP для Streamable HTTP (JSON-RPC + optional SSE)."""

import json
import logging
from typing import Any, List, Optional
from uuid import uuid4

import httpx
from httpx_sse import aconnect_sse

from utils import parse_sse_like_body

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
                sse_msg = parse_sse_like_body(response.text)
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
