# MCP GitLab Server

MCP (Model Context Protocol) сервер для работы с GitLab API. Поддерживает как gitlab.com, так и self-hosted инстансы.

## 🎯 Возможности

- **MCP Tools**: Предоставляет инструменты для AI-агентов (Cloud.ru Agent System и др.)
- **REST API**: API для управления конфигурациями чатов Telegram
- **Мультитенантность**: Каждый чат может использовать свой GitLab инстанс
- **Безопасность**: Токены хранятся в зашифрованном виде (AES-256-GCM)

## 📦 Структура проекта

```
mcp-gitlab-server/
├── src/
│   ├── index.ts              # Entry point
│   ├── config.ts             # Environment configuration
│   ├── api/                  # REST API для Telegram бота
│   │   ├── router.ts         # Express routes
│   │   └── middleware/
│   │       └── auth.ts       # API key authentication
│   ├── mcp/                  # MCP Server
│   │   ├── server.ts         # JSON-RPC 2.0 handler
│   │   ├── router.ts         # MCP HTTP endpoint
│   │   └── tools/            # MCP Tools
│   │       ├── index.ts
│   │       ├── list-projects.ts
│   │       └── schemas.ts
│   ├── services/
│   │   ├── gitlab.service.ts
│   │   └── chat-config.service.ts
│   ├── db/
│   │   └── client.ts         # Prisma client
│   └── utils/
│       └── crypto.ts         # Encryption utilities
├── prisma/
│   └── schema.prisma
├── Dockerfile
└── package.json
```

## 🚀 Быстрый старт

### С Docker Compose (рекомендуется)

```bash
# Из корня проекта
docker compose up -d db           # Запустить только БД
docker compose --profile dev up   # Запустить в dev режиме с hot reload

# Или для production
docker compose up -d mcp-server
```

### Локально

```bash
cd mcp-gitlab-server

# Установить зависимости
npm install

# Настроить переменные окружения
cp env.example .env
# Отредактировать .env

# Сгенерировать Prisma клиент
npx prisma generate

# Применить миграции
npx prisma db push

# Запустить в dev режиме
npm run dev
```

### Деплой на Cloud.ru / Production

При запуске Docker контейнера схема БД применяется автоматически:

```bash
# Контейнер при старте выполняет:
# 1. npx prisma db push - синхронизирует схему БД
# 2. node dist/index.js - запускает сервер
```

**Необходимые переменные окружения для контейнера:**
```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname
ENCRYPTION_KEY=your-32-char-encryption-key
API_KEY=your-api-key
PORT=3000
```

## 🔧 Переменные окружения

| Переменная | Описание | Пример |
|------------|----------|--------|
| `PORT` | Порт сервера | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/db` |
| `ENCRYPTION_KEY` | Ключ для шифрования токенов (32+ символов) | `openssl rand -hex 32` |
| `API_KEY` | API ключ для REST API | `openssl rand -hex 24` |

## 📡 API Endpoints

### MCP (для AI агентов)

```
POST /mcp                 # JSON-RPC 2.0 endpoint
GET  /mcp/info           # Server info
```

### REST API (для Telegram бота)

```
POST   /api/chats/:chatId/config       # Создать/обновить конфиг
GET    /api/chats/:chatId/config       # Получить конфиг (без токена)
GET    /api/chats/:chatId/credentials  # Получить credentials (для агента)
PUT    /api/chats/:chatId/repos        # Обновить список репозиториев
DELETE /api/chats/:chatId/config       # Удалить конфиг
```

Все REST API endpoints требуют заголовок `X-API-Key`.

## 🔨 MCP Tools

### `list_projects`

Получает список проектов из GitLab.

**Input:**
```json
{
  "gitlab_url": "https://gitlab.com",
  "access_token": "glpat-xxxx",
  "search": "my-project",
  "membership": true,
  "per_page": 20
}
```

**Output:**
```json
{
  "total": 5,
  "gitlab_instance": "https://gitlab.com",
  "projects": [
    {
      "id": 123,
      "name": "my-project",
      "full_path": "group/my-project",
      "url": "https://gitlab.com/group/my-project",
      "description": "Project description",
      "visibility": "private",
      "stars": 10,
      "forks": 2
    }
  ]
}
```

## 🧪 Тестирование MCP

### Через curl

```bash
# Initialize
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": { "name": "test", "version": "1.0" }
    }
  }'

# List tools
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list"
  }'

# Call tool
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "list_projects",
      "arguments": {
        "gitlab_url": "https://gitlab.com",
        "access_token": "YOUR_TOKEN"
      }
    }
  }'
```

## 🔒 Безопасность

- Все токены GitLab шифруются перед сохранением в БД (AES-256-GCM)
- REST API защищен API ключом
- Рекомендуется использовать HTTPS в production
- Токены не логируются

## 📝 TODO

- [ ] Добавить больше tools (get_project, list_merge_requests, get_pipeline_status)
- [ ] SSE транспорт для MCP
- [ ] Rate limiting
- [ ] Метрики и мониторинг

