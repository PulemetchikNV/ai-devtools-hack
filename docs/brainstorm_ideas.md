# Брейншторм: Расширение MVP для Тимлидов и Менеджеров

## Текущий MVP
- Telegram бот + GitLab Agent + MCP сервер с базовыми операциями
- Сценарий: `/check_mrs` - получить открытые MR

---

## Готовые MCP серверы на Cloud.ru Evolution (можно использовать)

| MCP Сервер | Описание | Релевантность для ЦА |
|------------|----------|---------------------|
| **jira-mcp** | Управление задачами, спринтами, эпиками | Тимлиды, Менеджеры |
| **confluence-mcp** | База знаний, документация | Онбординг, документация |
| **trello-mcp** | Управление досками и карточками | Альтернатива Jira |
| **grafana-mcp** | Метрики, дашборды, алерты | DevOps метрики |
| **postgres-mcp** | Анализ БД, SQL, рекомендации | DBA задачи |
| **messanger-max-mcp** | Корпоративный мессенджер | Нотификации |
| **miro-mcp** | Работа с досками Miro | Планирование, ретро |
| **web-searcher-mcp** | Поиск в интернете | Исследования |
| **python-code-executor-mcp** | Выполнение Python кода | Аналитика, скрипты |
| **evolution-k8s-mcp** | Управление Kubernetes | DevOps |
| **evolution-iam-mcp** | Управление доступами | Security |
| **evolution-managed-rag-mcp** | База знаний с RAG | Онбординг |
| **docx-mcp** | Работа с Word документами | Отчеты |
| **excel-mcp** | Работа с Excel | Отчеты, аналитика |
| **powerpoint-mcp** | Работа с презентациями | Отчеты |
| **mermaid-mcp** | Генерация диаграмм | Визуализация |

---

## Новые Агенты (детальное описание)

### 1. Code Review Agent
**Цель:** Автоматический анализ качества кода в MR

**MCP серверы:**
| MCP | Тулзы | Зачем |
|-----|-------|-------|
| **mcp-gitlab-server** (кастомный) | `get_mr_diff()`, `get_file_content()`, `add_mr_comment()` | Получить изменения, оставить комментарии |
| **python-code-executor-mcp** | `execute_code()` | Запуск линтеров, анализаторов |
| **confluence-mcp** | `search_docs()` | Найти coding guidelines команды |

**Связь с другими агентами:**
- Вызывается из **GitLab Manager Agent** при событии "new MR"
- Может запросить **Security Sentinel Agent** для проверки секретов
- Передает результат в **Notification Agent** для отправки в Telegram

**Пример flow:**
```
User: /review !123
    → GitLab Agent: get_mr_diff(123)
    → Code Review Agent: анализ diff
    → python-code-executor-mcp: run pylint on diff
    → confluence-mcp: search "code style guide"
    → GitLab Agent: add_mr_comment(123, "Найдены проблемы...")
    → User: получает summary в Telegram
```

---

### 2. Sprint Analytics Agent
**Цель:** Агрегация метрик спринта для менеджеров

**MCP серверы:**
| MCP | Тулзы | Зачем |
|-----|-------|-------|
| **jira-mcp** | `get_sprint_issues()`, `get_board_backlog()`, `search_issues()` | Данные по задачам и спринтам |
| **mcp-gitlab-server** (кастомный) | `get_project_issues()`, `get_milestones()` | Если используют GitLab Issues |
| **grafana-mcp** | `query_dashboard()`, `get_panel_data()` | DORA метрики, если настроены |
| **excel-mcp** | `create_workbook()`, `write_cells()` | Генерация Excel отчетов |
| **mermaid-mcp** | `generate_diagram()` | Burndown chart как картинка |
| **python-code-executor-mcp** | `execute_code()` | Расчет velocity, прогнозов |

**Связь с другими агентами:**
- Может запросить данные у **GitLab Manager Agent** по MR статистике
- Отправляет scheduled отчеты через **Notification Agent**
- Получает данные о деплоях от **Deployment Guardian Agent**

**Пример flow:**
```
User: Как идет спринт 42?
    → jira-mcp: get_sprint_issues(42)
    → jira-mcp: get_board_backlog(board_id)
    → python-code-executor-mcp: calculate velocity
    → mermaid-mcp: generate burndown chart
    → User: "Sprint 42: 15/20 задач done, velocity 18 SP, [burndown.png]"
```

---

### 3. Deployment Guardian Agent
**Цель:** Контроль релизов и CI/CD

**MCP серверы:**
| MCP | Тулзы | Зачем |
|-----|-------|-------|
| **mcp-gitlab-server** (кастомный) | `get_pipelines()`, `get_pipeline_jobs()`, `get_environments()`, `retry_pipeline()` | Статус CI/CD |
| **evolution-k8s-mcp** | `get_cluster_status()`, `get_deployments()`, `get_pod_logs()` | Статус в Kubernetes |
| **grafana-mcp** | `get_alerts()`, `query_metrics()` | Алерты после деплоя |
| **messanger-max-mcp** или Telegram | `send_message()` | Нотификации о failed pipeline |

**Связь с другими агентами:**
- Получает webhook от GitLab → триггерит анализ
- Запрашивает **Code Review Agent** если pipeline failed из-за тестов
- Алертит **Sprint Analytics Agent** о задержках релиза

**Пример flow:**
```
Webhook: Pipeline #456 failed
    → mcp-gitlab-server: get_pipeline_jobs(456)
    → mcp-gitlab-server: get_job_log(job_id)
    → Анализ: "Test test_auth.py failed"
    → mcp-gitlab-server: get_commit_author(commit_sha)
    → User @developer: "Твой коммит сломал билд: test_auth.py line 42"
```

---

### 4. Onboarding Agent
**Цель:** Помощь новым разработчикам

**MCP серверы:**
| MCP | Тулзы | Зачем |
|-----|-------|-------|
| **mcp-gitlab-server** (кастомный) | `get_repository_tree()`, `get_file_content()`, `search_code()` | Анализ структуры кода |
| **confluence-mcp** | `search_docs()`, `get_page_content()` | Документация команды |
| **evolution-managed-rag-mcp** | `search_knowledge_base()`, `get_relevant_docs()` | RAG по кодовой базе |
| **web-searcher-mcp** | `search()` | Поиск внешней документации |

**Связь с другими агентами:**
- Независимый агент, не связан напрямую с другими
- Может использовать результаты **Code Review Agent** для объяснения паттернов

**Пример flow:**
```
User: Объясни как работает модуль auth/
    → mcp-gitlab-server: get_repository_tree("auth/")
    → mcp-gitlab-server: get_file_content("auth/main.py")
    → evolution-managed-rag-mcp: search("authentication flow")
    → confluence-mcp: search("auth documentation")
    → User: "Модуль auth/ отвечает за... [структура] [ключевые функции]"
```

---

### 5. Security Sentinel Agent
**Цель:** Безопасность кода

**MCP серверы:**
| MCP | Тулзы | Зачем |
|-----|-------|-------|
| **mcp-gitlab-server** (кастомный) | `get_vulnerability_report()`, `get_mr_diff()`, `get_dependency_list()` | SAST/DAST результаты |
| **evolution-iam-mcp** | `get_user_permissions()`, `audit_access()` | Аудит доступов |
| **python-code-executor-mcp** | `execute_code()` | Запуск bandit, safety, trivy |
| **web-searcher-mcp** | `search()` | Поиск CVE информации |

**Связь с другими агентами:**
- Вызывается из **Code Review Agent** для проверки секретов
- Может блокировать merge через **GitLab Manager Agent**
- Алертит через **Notification Agent** при critical findings

**Пример flow:**
```
Event: New MR with changes in requirements.txt
    → mcp-gitlab-server: get_mr_diff(mr_id)
    → python-code-executor-mcp: run safety check
    → web-searcher-mcp: search CVE for "requests==2.25.0"
    → Found: CVE-2023-XXXX (HIGH)
    → mcp-gitlab-server: add_mr_comment("Security issue found!")
    → User: Alert в Telegram
```

---

### 6. Meeting Summary Agent
**Цель:** Связка коммуникации с кодом

**MCP серверы:**
| MCP | Тулзы | Зачем |
|-----|-------|-------|
| **confluence-mcp** | `get_page_content()`, `create_page()` | Заметки встреч в Confluence |
| **jira-mcp** | `create_issue()`, `link_issues()` | Создание задач из action items |
| **mcp-gitlab-server** (кастомный) | `create_issue()`, `link_mr_to_issue()` | GitLab Issues |
| **docx-mcp** | `read_document()` | Парсинг Word документов |
| **miro-mcp** | `get_board_content()`, `get_sticky_notes()` | Данные с Miro досок |

**Связь с другими агентами:**
- Создает задачи → **Sprint Analytics Agent** их отслеживает
- Линкует с MR через **GitLab Manager Agent**

**Пример flow:**
```
User: /parse_meeting https://confluence.company.com/page/123
    → confluence-mcp: get_page_content(123)
    → LLM: извлечь action items
    → jira-mcp: create_issue("Рефакторинг auth модуля", assignee="@vasya")
    → jira-mcp: create_issue("Написать тесты для API", assignee="@petya")
    → User: "Создано 2 задачи: PROJ-101, PROJ-102"
```

---

### 7. Notification Agent (новый - инфраструктурный)
**Цель:** Централизованная отправка уведомлений

**MCP серверы:**
| MCP | Тулзы | Зачем |
|-----|-------|-------|
| **messanger-max-mcp** | `send_message()`, `send_to_channel()` | Корп. мессенджер |
| Telegram Bot API | `send_message()`, `send_photo()` | Основной канал |
| **mermaid-mcp** | `generate_diagram()` | Графики для нотификаций |

**Связь с другими агентами:**
- Все агенты отправляют через него уведомления
- Умеет батчить сообщения (digest вместо спама)
- Роутит по приоритету (critical → сразу, info → digest)

---

## Новые MCP Серверы

### 1. mcp-jira-server
**Инструменты:**
- `get_sprint_issues(sprint_id)` - задачи спринта
- `get_issue_details(issue_key)` - детали задачи
- `move_issue(issue_key, status)` - изменить статус
- `link_issue_to_mr(issue_key, mr_url)` - связать с MR
- `get_team_workload(team_id)` - загрузка команды

### 2. mcp-confluence-server
**Инструменты:**
- `search_docs(query)` - поиск документации
- `get_page_content(page_id)` - содержимое страницы
- `create_page(space, title, content)` - создать страницу
- `update_page(page_id, content)` - обновить страницу

### 3. mcp-slack-server (или mcp-mattermost-server)
**Инструменты:**
- `send_notification(channel, message)` - отправить сообщение
- `get_thread(thread_id)` - получить обсуждение
- `create_reminder(user, message, time)` - напоминание

### 4. mcp-metrics-server
**Инструменты:**
- `get_dora_metrics(project)` - DORA метрики
- `get_lead_time(project, period)` - время от коммита до прода
- `get_deployment_frequency(project)` - частота деплоев
- `get_change_failure_rate(project)` - процент откатов

### 5. mcp-calendar-server
**Инструменты:**
- `get_team_availability(team_id, date)` - доступность команды
- `schedule_review(mr_id, participants)` - запланировать ревью
- `get_release_calendar(project)` - расписание релизов

### 6. mcp-ai-review-server
**Инструменты:**
- `analyze_code_quality(diff)` - анализ качества кода
- `suggest_reviewers(mr_id)` - подбор ревьюеров
- `estimate_risk(mr_id)` - оценка рискованности изменений
- `generate_changelog(commits)` - генерация changelog

---

## Сценарии использования (User Stories)

### Для Тимлида

1. **Утренний статус**
   > "Покажи что застряло: MR без ревью больше 2 дней, задачи в blocked"

2. **Подготовка к 1-1**
   > "Дай статистику по разработчику @vasya за последние 2 недели"

3. **Перед релизом**
   > "Проверь все MR в release-ветку, есть ли риски?"

4. **Code review help**
   > "Посмотри этот MR, на что обратить внимание?"

### Для Менеджера

1. **Статус проекта**
   > "Как идет спринт? Успеваем к дедлайну?"

2. **Ресурсы**
   > "Кто из команды перегружен?"

3. **Отчетность**
   > "Подготовь отчет по метрикам за месяц"

4. **Планирование**
   > "Сколько story points команда закрывает в среднем?"

---

## Архитектура расширенной системы

### Схема взаимодействия агентов

```
                              ┌─────────────────────┐
                              │    TELEGRAM USER    │
                              │  (Тимлид/Менеджер)  │
                              └──────────┬──────────┘
                                         │
                              ┌──────────▼──────────┐
                              │   TELEGRAM BOT UI   │
                              │  /review /sprint    │
                              │  /deploy /explain   │
                              └──────────┬──────────┘
                                         │
┌────────────────────────────────────────┼────────────────────────────────────────┐
│                          CLOUD.RU EVOLUTION ORCHESTRATOR                        │
│                                        │                                        │
│    ┌───────────────────────────────────┼───────────────────────────────────┐   │
│    │                                   ▼                                    │   │
│    │  ┌─────────────┐  webhook   ┌─────────────┐  delegate  ┌───────────┐  │   │
│    │  │  Deployment │◄───────────│   GitLab    │───────────►│   Code    │  │   │
│    │  │  Guardian   │            │   Manager   │            │  Review   │  │   │
│    │  └──────┬──────┘            └──────┬──────┘            └─────┬─────┘  │   │
│    │         │                          │                         │        │   │
│    │         │ metrics                  │ issues                  │ check  │   │
│    │         ▼                          ▼                         ▼        │   │
│    │  ┌─────────────┐            ┌─────────────┐            ┌───────────┐  │   │
│    │  │   Sprint    │◄───────────│  Meeting    │            │ Security  │  │   │
│    │  │  Analytics  │  creates   │  Summary    │            │ Sentinel  │  │   │
│    │  └──────┬──────┘            └─────────────┘            └───────────┘  │   │
│    │         │                                                             │   │
│    │         │                   ┌─────────────┐                           │   │
│    │         └──────────────────►│ Onboarding  │ (независимый)             │   │
│    │                             └─────────────┘                           │   │
│    └───────────────────────────────────┬───────────────────────────────────┘   │
│                                        │                                        │
│                             ┌──────────▼──────────┐                            │
│                             │  Notification Agent │                            │
│                             │  (батчинг, роутинг) │                            │
│                             └─────────────────────┘                            │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
┌────────────────────────────────────────┼────────────────────────────────────────┐
│                              MCP SERVERS LAYER                                  │
│                                                                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │mcp-gitlab    │ │jira-mcp      │ │confluence-mcp│ │grafana-mcp   │           │
│  │(кастомный)   │ │(Cloud.ru)    │ │(Cloud.ru)    │ │(Cloud.ru)    │           │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘           │
│                                                                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │python-code-  │ │evolution-    │ │evolution-    │ │miro-mcp      │           │
│  │executor-mcp  │ │k8s-mcp       │ │iam-mcp       │ │(Cloud.ru)    │           │
│  │(Cloud.ru)    │ │(Cloud.ru)    │ │(Cloud.ru)    │ │              │           │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘           │
│                                                                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │evolution-    │ │mermaid-mcp   │ │excel-mcp     │ │docx-mcp      │           │
│  │managed-rag   │ │(Cloud.ru)    │ │(Cloud.ru)    │ │(Cloud.ru)    │           │
│  │(Cloud.ru)    │ │              │ │              │ │              │           │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘           │
└─────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
                              ┌─────────────────────┐
                              │   EXTERNAL APIs     │
                              │  GitLab, Jira, K8s  │
                              │  Grafana, etc.      │
                              └─────────────────────┘
```

### Матрица "Агент → MCP серверы"

| Агент | mcp-gitlab | jira-mcp | confluence | grafana | py-executor | k8s-mcp | iam-mcp | mermaid | excel | rag |
|-------|:----------:|:--------:|:----------:|:-------:|:-----------:|:-------:|:-------:|:-------:|:-----:|:---:|
| **GitLab Manager** | ✅ | | | | | | | | | |
| **Code Review** | ✅ | | ✅ | | ✅ | | | | | |
| **Sprint Analytics** | ✅ | ✅ | | ✅ | ✅ | | | ✅ | ✅ | |
| **Deployment Guardian** | ✅ | | | ✅ | | ✅ | | | | |
| **Onboarding** | ✅ | | ✅ | | | | | | | ✅ |
| **Security Sentinel** | ✅ | | | | ✅ | | ✅ | | | |
| **Meeting Summary** | ✅ | ✅ | ✅ | | | | | | | |
| **Notification** | | | | | | | | ✅ | | |

### A2A (Agent-to-Agent) коммуникации

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AGENT COMMUNICATION MAP                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  GitLab Manager ──────┬─────────────────────────────────────────────────►   │
│         │             │                                                      │
│         │ new_mr      │ pipeline_failed                                      │
│         ▼             ▼                                                      │
│  ┌─────────────┐  ┌─────────────┐                                           │
│  │ Code Review │  │ Deployment  │                                           │
│  │    Agent    │  │  Guardian   │                                           │
│  └──────┬──────┘  └──────┬──────┘                                           │
│         │                │                                                   │
│         │ secrets_found  │ deploy_metrics                                    │
│         ▼                ▼                                                   │
│  ┌─────────────┐  ┌─────────────┐                                           │
│  │  Security   │  │   Sprint    │◄──── Meeting Summary (new_issues)          │
│  │  Sentinel   │  │  Analytics  │                                           │
│  └──────┬──────┘  └──────┬──────┘                                           │
│         │                │                                                   │
│         │                │                                                   │
│         └────────┬───────┘                                                   │
│                  │ all notifications                                         │
│                  ▼                                                            │
│           ┌─────────────┐                                                    │
│           │ Notification│───► Telegram / Max Messenger                       │
│           │    Agent    │                                                    │
│           └─────────────┘                                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Типы сообщений между агентами:**

| От | К | Событие | Payload |
|----|---|---------|---------|
| GitLab Manager | Code Review | `new_mr` | `{mr_id, project_id, author}` |
| GitLab Manager | Deployment Guardian | `pipeline_event` | `{pipeline_id, status, branch}` |
| Code Review | Security Sentinel | `check_secrets` | `{diff_content, file_paths}` |
| Code Review | Notification | `review_complete` | `{mr_id, issues_found, summary}` |
| Deployment Guardian | Sprint Analytics | `deploy_metrics` | `{deploy_time, success, environment}` |
| Deployment Guardian | Notification | `pipeline_alert` | `{pipeline_id, error, author}` |
| Meeting Summary | Sprint Analytics | `new_issues` | `{issue_ids[], source_meeting}` |
| Security Sentinel | Notification | `security_alert` | `{severity, finding, mr_id}` |
| Sprint Analytics | Notification | `scheduled_report` | `{report_type, data, recipients}` |

---

## Приоритеты для MVP+

### Must Have (для хакатона)
- [ ] Расширение **mcp-gitlab-server** (pipeline status, job logs, webhooks)
- [ ] **GitLab Manager Agent** - базовый агент для работы с GitLab
- [ ] Подключение **jira-mcp** (готовый на Cloud.ru) для задач
- [ ] Базовый **Notification Agent** через Telegram
- [ ] Webhook endpoint для событий GitLab

### Should Have (усиление демо)
- [ ] **Sprint Analytics Agent** + jira-mcp + mermaid-mcp (burndown)
- [ ] **Code Review Agent** + python-code-executor-mcp (линтеры)
- [ ] Подключение **confluence-mcp** для документации
- [ ] Scheduled reports (cron через Cloud.ru)

### Nice to Have (wow-эффект)
- [ ] **Deployment Guardian Agent** + evolution-k8s-mcp
- [ ] **Onboarding Agent** + evolution-managed-rag-mcp
- [ ] Интеграция с **grafana-mcp** для DORA метрик
- [ ] **excel-mcp** для генерации отчетов

### После хакатона
- [ ] Security Sentinel Agent + evolution-iam-mcp
- [ ] Meeting Summary Agent + miro-mcp
- [ ] Multi-tenant поддержка
- [ ] Voice-to-text для голосовых

---

## Конкурентные преимущества

1. **Единая точка входа** - все через Telegram, не надо прыгать между GitLab/Jira/Slack
2. **Проактивность** - агенты сами алертят о проблемах
3. **Контекст** - агенты помнят контекст команды и проекта
4. **Естественный язык** - не надо учить команды, пиши как человек
5. **Интеграция** - связывает разрозненные инструменты

---

## Вопросы для обсуждения

1. Какой трекер задач у ЦА? (Jira / GitLab Issues / YouTrack)
2. Нужен ли multi-tenant (несколько команд в одном боте)?
3. Какие метрики реально важны тимлидам?
4. Есть ли требования по безопасности (self-hosted GitLab)?
5. Нужен ли voice-to-text для голосовых в Telegram?
6. Интеграция с Notion/Confluence?
