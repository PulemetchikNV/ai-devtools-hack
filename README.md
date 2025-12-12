# The One Market — GitLab MCP + Agent + Telegram Bot

Единое руководство по развёртыванию решения тремя способами: локально, гибридно (MCP в Cloud.ru Artifact Registry, агент и бот локально) и минимально (только Telegram-бот для демо). Добавьте ссылку на репозиторий GitHub на последний слайд презентации. Для полной схемы с двумя MCP (GitLab + Code Review) и агентной системой в Cloud.ru смотрите `docs/cloudru-integration.md`.

## Состав решения
- `mcp-gitlab-server` — MCP/REST сервер для GitLab, Prisma + Postgres.
- `base-agent` — LangChain/A2A агент, использует MCP инструменты.
- `telegram-bot` — бот, обращается к агенту через A2A HTTP.
- `docker-compose.mcp.yml` — Postgres + MCP.
- `docker-compose.yml` — агент + Telegram-бот.
- `publish-*.sh` — сборка/пуш образов в Artifact Registry Cloud.ru.

## Предварительно
- Docker + Docker Compose, docker buildx.
- Node.js 20+ для MCP (если запускаете без контейнера).
- Python 3.12+ / uv или pip для агента и бота (если без контейнера).
- Доступ к Cloud.ru Artifact Registry (логин/пароль или токен).
- GitLab PAT с нужными правами (api/read_api/read_user).

## Переменные окружения (ключевые)
| Компонент | Переменная | Назначение |
| --- | --- | --- |
| MCP | `PORT` | Порт MCP/REST (по умолчанию 3000) |
| MCP | `DATABASE_URL` | Строка подключения Postgres |
| MCP | `ENCRYPTION_KEY` | 32+ байт hex для шифрования токенов |
| MCP | `API_KEY` | API-ключ для REST бэкенда (бот) |
| MCP | `AGENT_NAME` | `GitLab` или `Code Review` — задаёт набор тулов |
| MCP | `DEFAULT_GITLAB_URL`, `DEFAULT_GITLAB_TOKEN` | Необязательные дефолтные значения для тестов |
| Агент | `LLM_MODEL`, `LLM_API_BASE`, `LLM_API_KEY` | Настройки LLM |
| Агент | `MCP_URL` | URL MCP (http://mcp-gitlab-server:3000/mcp) |
| Агент | `AGENT_NAME`, `AGENT_DESCRIPTION`, `AGENT_VERSION` | Метаданные агента |
| Агент | `AGENT_SYSTEM_PROMPT` | Системный промпт |
| Агент | `PHOENIX_ENDPOINT`, `ENABLE_PHOENIX` | Телеметрия (опц.) |
| Бот | `TELEGRAM_BOT_TOKEN` | Токен BotFather |
| Бот | `ADMIN_CHAT_ID` | ID администратора для оповещений |
| Бот | `A2A_AGENT_URL` | URL агента (по умолчанию http://base-agent:10000) |
| Образы | `REGISTRY`, `IMAGE_NAME`, `TAG` | Для `publish-*.sh` скриптов |

Примеры смотрите в `.env.example` (корень и подпроекты) и `docker-compose*.yml`.

## Быстрый старт: локально все компоненты
1) Поднимите MCP + Postgres:
```bash
docker compose -f docker-compose.mcp.yml up -d
```
2) Поднимите агент + бот (используют MCP по внутренней сети Docker):
```bash
docker compose -f docker-compose.yml up -d
```
3) Проверки:
- MCP health: `curl http://localhost:3000/mcp/info`
- Агент: `curl http://localhost:10000/.well-known/agent.json` (если включите healthcheck)
- Бот: отправьте `/start` из разрешённого чата.

## Гибрид: MCP из Cloud.ru Artifact Registry, агент и бот локально
1) Залогиньтесь в реестр:
```bash
docker login $REGISTRY -u "$CLOUDRU_AR_USERNAME" -p "$CLOUDRU_AR_PASSWORD"
```
2) Укажите образ MCP в `.env` или через env при запуске Compose:
```bash
export MCP_IMAGE="$REGISTRY/mcp-gitlab-server:${TAG:-latest}"
```
3) Запуск:
```bash
docker compose -f docker-compose.mcp.yml \
  --profile mcp-image-from-registry up -d
# или замените build секцию на image вручную в файле, если нужен один compose
docker compose -f docker-compose.yml up -d
```

## Облако Cloud.ru: два MCP + два агента + оркестратор
1) Опубликуйте образы в Artifact Registry (см. ниже). Один образ MCP работает в двух режимах через `AGENT_NAME` (`GitLab` и `Code Review`).
2) Создайте в UI два MCP-сервера на одном образе: `gitlab-mcp` (AGENT_NAME=GitLab) и `code-review-mcp` (AGENT_NAME=Code Review).
3) Создайте два агента на образе `base-agent`, каждому подключите свой MCP и задайте соответствующий системный промпт.
4) Соберите агентную систему (оркестратор) из двух агентов; её URL подставьте в `A2A_AGENT_URL` бота.
Детальные промпты и чек-листы — в `docs/cloudru-integration.md`.

## Минимальный вариант: только Telegram-бот (демо)
Если нужен только бот, который ходит к уже развёрнутому агенту:
```bash
cd telegram-bot
cp .env.example .env
# заполните TELEGRAM_BOT_TOKEN и A2A_AGENT_URL на внешний агент
uv run python -m telegram_bot  # или docker build && docker run --env-file .env
```

## Сборка и публикация образов в Artifact Registry
MCP:
```bash
REGISTRY=mcp-gitlab-server.cr.cloud.ru IMAGE_NAME=mcp-gitlab-server TAG=latest \
./publish-mcp-server.sh
```
Агент:
```bash
REGISTRY=base-agent.cr.cloud.ru IMAGE_NAME=base-agent TAG=latest \
./publish-agent.sh
```
Telegram-бот (пример вручную):
```bash
docker buildx build --platform linux/amd64 \
  -t ${REGISTRY}/telegram-bot:${TAG:-latest} ./telegram-bot --push
```

## Локальный запуск без Docker (для разработки)
- MCP:
  ```bash
  cd mcp-gitlab-server
  npm install
  cp env.example .env
  npx prisma generate && npx prisma db push
  npm run dev
  ```
- Агент:
  ```bash
  cd base-agent
  uv sync  # или pip install -r requirements
  uv run python -m src.start_a2a
  ```
- Бот:
  ```bash
  cd telegram-bot
  uv sync
  uv run python -m telegram_bot
  ```

## Файлы Compose
- `docker-compose.mcp.yml`: Postgres + MCP (порты 5432, 3000). Можно подставить готовый образ MCP через переменную `image` вместо `build`.
- `docker-compose.yml`: агент (порт 10000) + бот, связываются по внутренней сети; бот берёт агент из `A2A_AGENT_URL` (по умолчанию http://base-agent:10000).

## Проверка и отладка
- Логи: `docker compose -f <file> logs -f <service>`.
- Переменные: `docker compose config` покажет итоговые значения.
- Доступ к MCP: `curl -X POST http://localhost:3000/mcp -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' -H "Content-Type: application/json" -H "X-API-Key: $API_KEY"`.
- Проблемы с реестром: перепроверьте логин/пароль, тег, сеть (VPN/прокси).

## Полезные замечания
- В prod замените дефолтные `ENCRYPTION_KEY` и `API_KEY`.
- Используйте HTTPS/прокси перед MCP/агентом в публичных окружениях.
- Убедитесь, что GitLab PAT имеет нужные скоупы.
- Размер презентации ≤ 18 МБ, загружать PDF, имя файла: `Название команды_название трека`.

## Ссылка на репозиторий
Добавьте ссылку на GitHub проекта на последний слайд презентации и убедитесь, что репозиторий публичен или доступен экспертам.
