# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI DevTools hackathon project consisting of three components:
1. **telegram-bot** - Telegram bot UI for user interaction with AI
2. **mcp-gitlab-server** - Custom MCP (Model Context Protocol) server for GitLab integration (WIP)
3. **lab3-langchain-agent** - LangChain agent with A2A (Agent-to-Agent) protocol support

## Tech Stack

- **Python 3.12** (required for all components)
- **aiogram 3.x** - Telegram bot framework
- **LangChain** - AI agent framework
- **A2A SDK** - Agent-to-Agent protocol for cloud.ru AI Agents platform
- **OpenAI-compatible API** - LLM integration
- **uv** - Package manager (telegram-bot uses uv.lock)
- **Poetry** - Alternative package manager (lab3 uses poetry in Docker)

## Common Commands

### telegram-bot

```bash
cd telegram-bot
cp .env.example .env  # Fill in required vars
uv sync               # Install dependencies
uv run -m src         # Run the bot
```

Docker:
```bash
docker build -t telegram-bot .
docker run --env-file .env telegram-bot
```

### lab3-langchain-agent

```bash
cd lab3-langchain-agent
cp .env.example .env  # Configure LLM and A2A settings
python src/start_a2a.py  # Run A2A server
```

Docker (for cloud deployment):
```bash
docker buildx build --platform linux/amd64 -t langchain-agent .
```

## Architecture

### telegram-bot

- `src/__main__.py` - Entry point, initializes aiogram Bot and Dispatcher
- `src/config.py` - Settings via pydantic-settings, loads from .env
- `src/handlers/users.py` - Message handlers with FSM states, OpenAI client integration
- Uses MemoryStorage for FSM state management

### lab3-langchain-agent

- `src/start_a2a.py` - Entry point, creates A2A server with uvicorn
- `src/agent.py` - LangChain AgentExecutor creation with MCP tool integration
- `src/a2a_wrapper.py` - Wraps LangChain agent for A2A protocol (supports streaming)
- `src/agent_task_manager.py` - A2A executor integration

Key pattern: MCP tools are converted to LangChain Tools and injected into the agent.

## Environment Variables

### telegram-bot
- `TELEGRAM_BOT_TOKEN` - Bot token from @BotFather
- `AI_API_BASE_URL`, `AI_API_KEY`, `AI_MODEL` - LLM API configuration
- `ADMIN_CHAT_ID` - Optional admin notifications

### lab3-langchain-agent
- `LLM_MODEL`, `LLM_API_BASE`, `LLM_API_KEY` - LLM configuration
- `AGENT_NAME`, `AGENT_DESCRIPTION`, `AGENT_VERSION`, `AGENT_SYSTEM_PROMPT` - Agent metadata
- `URL_AGENT`, `PORT` - A2A server configuration
- `MCP_URL` - Comma-separated MCP server URLs
- `PHOENIX_ENDPOINT`, `ENABLE_PHOENIX` - Optional telemetry

## Deployment Target

Components are designed for deployment on cloud.ru AI Agents platform using Container Apps.
