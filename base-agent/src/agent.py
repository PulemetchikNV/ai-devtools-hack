import asyncio
import logging
import os
from typing import List, Optional

from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.tools import StructuredTool, Tool
from langchain_openai import ChatOpenAI
from pydantic import Field, create_model

from mcp_client import MCPClient

logger = logging.getLogger(__name__)


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
        print('created STRUCTURED TOOL')
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
