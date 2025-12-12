# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI DevTools Hack — a GitLab assistant with three components communicating via A2A and MCP protocols:
1. **telegram-bot** — Telegram UI, sends user messages to gitlab-agent via A2A HTTP
2. **gitlab-agent** — LangChain agent with A2A server, consumes MCP tools from mcp-gitlab-server
3. **mcp-gitlab-server** — TypeScript MCP/REST server for GitLab API, uses Prisma + PostgreSQL

## Tech Stack

- **Python 3.12** — telegram-bot, gitlab-agent
- **Node.js 20+** — mcp-gitlab-server
- **uv** — Python package manager for both Python components
- **aiogram 3.x** — Telegram bot framework
- **LangChain** — Agent framework with OpenAI tools agent
- **A2A SDK** — Agent-to-Agent protocol (cloud.ru AI Agents platform)
- **MCP SDK** — Model Context Protocol for tool exposure
- **Prisma** — ORM for PostgreSQL (chat configs, encrypted GitLab tokens)

## Common Commands

### Local Development (without Docker)

```bash
# MCP server
cd mcp-gitlab-server
npm install
cp env.example .env
npx prisma generate && npx prisma db push
npm run dev

# Agent
cd gitlab-agent
uv sync
uv run python -m src.start_a2a

# Bot
cd telegram-bot
uv sync
uv run python -m telegram_bot
```

### Docker Compose

```bash
# Start MCP + Postgres
docker compose -f docker-compose.mcp.yml up -d

# Start agent + bot (uses MCP via internal Docker network)
docker compose -f docker-compose.yml up -d
```

### Build & Publish

```bash
# MCP server to Artifact Registry
REGISTRY=mcp-gitlab-server.cr.cloud.ru IMAGE_NAME=mcp-gitlab-server TAG=latest ./publish-mcp-gitlab-server.sh

# Agent
REGISTRY=gitlab-agent.cr.cloud.ru IMAGE_NAME=gitlab-agent TAG=latest ./publish-agent.sh
```

### MCP Server Scripts

```bash
npm run dev           # Development with tsx watch
npm run build         # TypeScript compile
npm run db:generate   # Prisma generate
npm run db:push       # Push schema to DB
npm run db:studio     # Prisma Studio GUI
npm run lint          # ESLint
npm run typecheck     # TypeScript check without emit
```

## Architecture

### Communication Flow

```
User → Telegram Bot → (A2A HTTP) → gitlab-agent → (MCP JSON-RPC/SSE) → mcp-gitlab-server → GitLab API
```

### mcp-gitlab-server (TypeScript)

- `src/index.ts` — Express server entry, mounts `/api` (REST) and `/mcp` (MCP) routers
- `src/mcp/server.ts` — MCP server setup with StreamableHTTPServerTransport
- `src/mcp/tools/` — MCP tool implementations (register_user, list_projects, list_merge_requests, get_mr_details, get_pipeline_status, retry_pipeline, list_issues, create_issue)
- `src/services/gitlab.service.ts` — GitLab API wrapper using @gitbeaker/rest
- `src/services/chat-config.service.ts` — Chat config CRUD with encrypted tokens
- `prisma/schema.prisma` — ChatConfig model for per-chat GitLab credentials

### gitlab-agent (Python)

- `src/start_a2a.py` — Entry point, creates A2A server with uvicorn
- `src/agent.py` — LangChain AgentExecutor with MCP client that converts MCP tools to LangChain Tools
- `src/a2a_wrapper.py` — Wraps LangChain agent for A2A protocol (streaming support)
- `src/agent_task_manager.py` — A2A executor integration

Key pattern: `MCPClient` class connects to MCP servers via Streamable HTTP (JSON-RPC + SSE), fetches tool list, and creates LangChain `StructuredTool` wrappers dynamically from JSON Schema.

### telegram-bot (Python)

- `src/__main__.py` — aiogram Bot + Dispatcher with MemoryStorage
- `src/a2a_client.py` — A2A client using a2a-sdk, sends messages to gitlab-agent
- `src/handlers/users.py` — Message handlers with FSM states
- `src/user_service.py` — User registration flow via MCP REST API
- `src/config.py` — Settings via pydantic-settings

## Environment Variables

| Component | Variable | Purpose |
|-----------|----------|---------|
| MCP | `PORT` | Server port (default 3000) |
| MCP | `DATABASE_URL` | PostgreSQL connection string |
| MCP | `ENCRYPTION_KEY` | 32+ byte hex for token encryption |
| MCP | `API_KEY` | REST API authentication |
| Agent | `LLM_MODEL`, `LLM_API_BASE`, `LLM_API_KEY` | LLM configuration |
| Agent | `MCP_URL` | Comma-separated MCP server URLs |
| Agent | `AGENT_SYSTEM_PROMPT` | System prompt for agent |
| Agent | `PORT`, `URL_AGENT` | A2A server config |
| Bot | `TELEGRAM_BOT_TOKEN` | BotFather token |
| Bot | `A2A_AGENT_URL` | Agent URL (default http://gitlab-agent:10000) |
| Bot | `ADMIN_CHAT_ID` | Optional admin notifications |

## Verification Endpoints

```bash
# MCP health/info
curl http://localhost:3000/health
curl http://localhost:3000/mcp/info

# Agent card
curl http://localhost:10000/.well-known/agent.json

# MCP tools list
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
