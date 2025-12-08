my-hackathon-project/
├── README.md                   # Главный файл с описанием всей системы, схемой и инструкцией по запуску
├── docker-compose.yml          # (Опционально) Для локального запуска всех сервисов сразу
│
├── 📦 mcp-gitlab-server/       # [Backend Dev] Ваш кастомный MCP сервер
│   ├── src/
│   │   ├── main.py             # Точка входа FastMCP (определение тулзов)
│   │   ├── gitlab_service.py   # Логика работы с python-gitlab
│   │   ├── models.py           # Pydantic модели для входных/выходных данных
│   │   └── config.py           # Чтение ENV переменных
│   ├── tests/                  # Тесты (хотя бы 1-2 простых)
│   ├── Dockerfile              # Чтобы задеплоить в Cloud.ru Container Apps
│   ├── pyproject.toml          # Зависимости (fastmcp, python-gitlab)
│   ├── README.md               # Дока именно к этому серверу (какие тулзы есть)
│   └── .env.example            # Пример переменных (GITLAB_TOKEN и т.д.)
│
├── 🤖 telegram-bot-ui/         # [Integrator] Интерфейс для пользователя
│   ├── src/
│   │   ├── main.py             # Запуск бота (aiogram)
│   │   ├── handlers.py         # Обработка команд (/start, /check_mr)
│   │   ├── a2a_client.py       # Клиент для общения с Cloud.ru Agent System
│   │   └── keyboards.py        # Кнопки
│   ├── Dockerfile
│   ├── pyproject.toml          # Зависимости (aiogram, httpx)
│   ├── README.md
│   └── .env.example            # Токен бота, URL агента Cloud.ru
│
└── 📝 docs/                    # [Team Lead / Architect] Продуктовые артефакты
    ├── agent_prompts.md        # Тексты системных промптов (чтобы не потерять)
    ├── architecture.png        # Та самая схема из Mermaid
    ├── user_scenarios.md       # Описание сценариев для демо
    └── tools_config.json       # Конфиг для импорта в Cloud.ru (если понадобится)