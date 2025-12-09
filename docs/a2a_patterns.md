# A2A Patterns: Архитектурные паттерны мультиагентных систем

> Анализ Google A2A Samples для построения системы управления проектами

## Оглавление

1. [Orchestrator-Planner-Executor](#1-orchestrator-planner-executor)
2. [Agent Discovery через MCP](#2-agent-discovery-через-mcp)
3. [WorkflowGraph (DAG)](#3-workflowgraph-dag)
4. [Event-Driven Architecture](#4-event-driven-architecture)
5. [Streaming Responses](#5-streaming-responses)
6. [Adversarial Multi-Agent](#6-adversarial-multi-agent)
7. [Routing Agent](#7-routing-agent)
8. [State Machine Agent](#8-state-machine-agent)
9. [Применение для PM/TL системы](#9-применение-для-pmtl-системы)

---

## 1. Orchestrator-Planner-Executor

**Главный паттерн для сложных задач с несколькими шагами.**

### Концепция

```
User Request
    ↓
┌─────────────────┐
│   Orchestrator  │  ← Координирует весь процесс
└────────┬────────┘
         ↓
┌─────────────────┐
│    Planner      │  ← Разбивает задачу на подзадачи
└────────┬────────┘
         ↓
┌─────────────────┐
│  Task Agent 1   │  ← Исполняет конкретную подзадачу
│  Task Agent 2   │
│  Task Agent N   │
└─────────────────┘
```

### Где искать

| Компонент | Путь |
|-----------|------|
| Orchestrator | `a2a-samples/samples/python/agents/a2a_mcp/src/a2a_mcp/agents/orchestrator_agent.py` |
| Planner | `a2a-samples/samples/python/agents/a2a_mcp/src/a2a_mcp/agents/langgraph_planner_agent.py` |
| Task Agent | `a2a-samples/samples/python/agents/a2a_mcp/src/a2a_mcp/agents/adk_travel_agent.py` |

### Ключевой код

**Orchestrator** управляет workflow:
```python
class OrchestratorAgent(BaseAgent):
    async def stream(self, query, context_id, task_id):
        # 1. Вызвать Planner для создания плана
        plan = await self.call_planner(query)

        # 2. Создать граф задач
        for task in plan.tasks:
            self.workflow_graph.add_node(task)

        # 3. Исполнить граф
        async for result in self.workflow_graph.run():
            yield result
```

**Planner** возвращает структурированный план:
```python
class ResponseFormat(BaseModel):
    status: Literal['input_required', 'completed', 'error']
    question: str  # Вопрос пользователю если нужно уточнение
    content: TaskList  # Список задач

class TaskList(BaseModel):
    original_query: str
    trip_info: TripInfo
    tasks: list[PlannerTask]  # Подзадачи для исполнения
```

### Когда использовать

- Сложные запросы, требующие нескольких шагов
- Задачи, где нужно сначала спланировать, потом исполнить
- Сценарии с условной логикой (если X, то делаем Y)

---

## 2. Agent Discovery через MCP

**Динамический поиск подходящего агента для задачи.**

### Концепция

```
Task: "Book flights from SFO to LHR"
         ↓
┌─────────────────────────┐
│   MCP Server (Registry) │
│                         │
│  find_agent(query)      │ ← Поиск по embeddings
│         ↓               │
│  [Agent Cards]          │ ← JSON описания агентов
│         ↓               │
│  Best Match: Air Agent  │
└─────────────────────────┘
         ↓
    Agent Card URL → A2A Connection
```

### Где искать

| Компонент | Путь |
|-----------|------|
| MCP Server | `a2a-samples/samples/python/agents/a2a_mcp/src/a2a_mcp/mcp/server.py` |
| Agent Cards | `a2a-samples/samples/python/agents/a2a_mcp/src/a2a_mcp/agent_cards/*.json` |
| Embeddings | `a2a-samples/samples/python/agents/a2a_mcp/src/a2a_mcp/mcp/embeddings.py` |

### Ключевой код

**MCP Server с find_agent:**
```python
@mcp.tool(name='find_agent')
def find_agent(query: str) -> str:
    """Finds the best agent for the given query using embeddings."""
    query_embedding = generate_embedding(query)

    best_match = None
    best_score = -1

    for agent_card in agent_cards:
        score = dot_product(query_embedding, agent_card.embedding)
        if score > best_score:
            best_score = score
            best_match = agent_card

    return best_match.model_dump_json()
```

**Agent Card структура:**
```json
{
    "name": "Air Ticketing Agent",
    "description": "Books flights and manages air travel",
    "url": "http://localhost:10102/",
    "capabilities": {"streaming": true},
    "skills": [
        {
            "id": "flights",
            "name": "Flight Booking",
            "description": "Search and book flights",
            "tags": ["flights", "air travel", "booking"],
            "examples": ["Book a flight from SFO to LHR"]
        }
    ]
}
```

### Когда использовать

- Система с множеством специализированных агентов
- Динамическая маршрутизация задач
- Расширяемая архитектура (новые агенты без изменения кода)

---

## 3. WorkflowGraph (DAG)

**Управление зависимостями между задачами через направленный граф.**

### Концепция

```
        ┌──────────┐
        │  Start   │
        └────┬─────┘
             │
        ┌────▼─────┐
        │ Planner  │
        └────┬─────┘
             │
    ┌────────┼────────┐
    │        │        │
┌───▼───┐┌───▼───┐┌───▼───┐
│Task 1 ││Task 2 ││Task 3 │  ← Параллельное исполнение
└───┬───┘└───┬───┘└───┬───┘
    │        │        │
    └────────┼────────┘
             │
        ┌────▼─────┐
        │ Summary  │
        └──────────┘
```

### Где искать

| Компонент | Путь |
|-----------|------|
| WorkflowGraph | `a2a-samples/samples/python/agents/a2a_mcp/src/a2a_mcp/agents/workflow_graph.py` |
| WorkflowNode | `a2a-samples/samples/python/agents/a2a_mcp/src/a2a_mcp/agents/workflow_node.py` |

### Ключевой код

**WorkflowGraph на NetworkX:**
```python
class WorkflowGraph:
    def __init__(self):
        self.graph = nx.DiGraph()  # Directed Acyclic Graph
        self.nodes = {}
        self.state = Status.INITIALIZED

    def add_node(self, node: WorkflowNode):
        self.graph.add_node(node.id)
        self.nodes[node.id] = node

    def add_edge(self, from_id: str, to_id: str):
        self.graph.add_edge(from_id, to_id)

    async def run_workflow(self, start_node_id: str):
        # Топологическая сортировка для правильного порядка
        execution_order = list(nx.topological_sort(self.graph))

        for node_id in execution_order:
            node = self.nodes[node_id]
            async for chunk in node.run():
                yield chunk

            # Обработка паузы
            if node.state == Status.PAUSED:
                self.state = Status.PAUSED
                self.paused_node_id = node_id
                break
```

**WorkflowNode:**
```python
class WorkflowNode:
    def __init__(self, node_id: str, agent_card: AgentCard):
        self.id = node_id
        self.agent_card = agent_card
        self.state = Status.READY

    async def run(self):
        self.state = Status.RUNNING

        async with httpx.AsyncClient() as client:
            a2a_client = A2AClient(client, self.agent_card)
            async for chunk in a2a_client.send_message_streaming(self.query):
                yield chunk

        self.state = Status.COMPLETED
```

### Когда использовать

- Задачи с зависимостями (A должно завершиться до B)
- Параллельное исполнение независимых задач
- Сложные workflow с условными переходами

---

## 4. Event-Driven Architecture

**Обработка событий от агентов в реальном времени.**

### Концепция

```
Agent Execution
      ↓
┌─────────────────────────────┐
│     Event Queue             │
│                             │
│  TaskStatusUpdateEvent      │ → Статус изменился
│  TaskArtifactUpdateEvent    │ → Новый результат
│  StreamingMessageResponse   │ → Часть ответа
└─────────────────────────────┘
      ↓
   Handler → Update UI / State
```

### Где искать

| Компонент | Путь |
|-----------|------|
| Event Processing | `a2a-samples/samples/python/agents/a2a_mcp/src/a2a_mcp/agents/orchestrator_agent.py` (строки 150-200) |
| TaskUpdater | Встроен в A2A SDK |

### Ключевой код

**Обработка событий в Orchestrator:**
```python
async for chunk in self.workflow_graph.run_workflow(start_node_id):
    if isinstance(chunk.root, SendStreamingMessageSuccessResponse):
        result = chunk.root.result

        # Событие: Артефакт (результат работы агента)
        if isinstance(result, TaskArtifactUpdateEvent):
            artifact = result.artifact
            self.results.append(artifact)

            # Специальная обработка результатов Planner
            if artifact.name == 'PlannerAgent-result':
                plan_data = artifact.parts[0].root.data
                for task in plan_data['tasks']:
                    self.add_task_to_graph(task)

        # Событие: Статус изменился
        if isinstance(result, TaskStatusUpdateEvent):
            if result.status.state == TaskState.input_required:
                # Агент запрашивает доп. информацию
                question = result.status.message.parts[0].text
                yield {"type": "question", "content": question}

            elif result.status.state == TaskState.completed:
                # Задача завершена
                yield {"type": "completed", "task_id": result.task_id}
```

### Когда использовать

- Real-time обновления для UI
- Обработка промежуточных результатов
- Запрос дополнительной информации от пользователя

---

## 5. Streaming Responses

**Потоковая передача ответов для лучшего UX.**

### Концепция

```
Agent starts working...
    ↓
[Chunk 1: "Analyzing"] → UI
[Chunk 2: "Found 3 issues"] → UI
[Chunk 3: "Generating report..."] → UI
[Chunk 4: Final result] → UI
    ↓
User sees progress in real-time
```

### Где искать

| Компонент | Путь |
|-----------|------|
| Streaming Agent | `a2a-samples/samples/python/agents/a2a_mcp/src/a2a_mcp/agents/adk_travel_agent.py` |
| Stream Handler | `main-agent/src/a2a_wrapper.py` |

### Ключевой код

**Streaming в агенте:**
```python
async def stream(self, query: str, session_id: str):
    async for chunk in self.agent_executor.astream({
        "input": query,
        "chat_history": self.get_history(session_id)
    }):
        if "output" in chunk:
            yield {
                "is_task_complete": False,
                "content": chunk["output"],
                "is_event": False
            }

        # Событие использования инструмента
        if "intermediate_steps" in chunk:
            for step in chunk["intermediate_steps"]:
                tool_name = step[0].tool
                yield {
                    "is_task_complete": False,
                    "content": f"Using tool: {tool_name}",
                    "is_event": True
                }

    # Финальный chunk
    yield {
        "is_task_complete": True,
        "content": "",
        "is_event": False
    }
```

**Streaming в Telegram Bot:**
```python
async def handle_message(message: Message):
    response_text = ""
    sent_message = None

    async for chunk in agent.stream(message.text):
        response_text += chunk["content"]

        # Обновляем сообщение каждые N символов
        if len(response_text) % 100 == 0:
            if sent_message:
                await sent_message.edit_text(response_text)
            else:
                sent_message = await message.answer(response_text)

    # Финальное обновление
    await sent_message.edit_text(response_text)
```

### Когда использовать

- Долгие операции (> 2 сек)
- Улучшение UX (пользователь видит прогресс)
- Отображение промежуточных шагов

---

## 6. Adversarial Multi-Agent

**Агенты с конкурирующими целями для тестирования и симуляций.**

### Концепция

```
┌──────────────┐         ┌──────────────┐
│   Attacker   │ ◄─────► │   Defender   │
│    Agent     │  A2A    │    Agent     │
└──────────────┘         └──────────────┘
       │                        │
       ▼                        ▼
  Try to break            Protect system
```

### Где искать

| Компонент | Путь |
|-----------|------|
| Adversarial Example | `a2a-samples/samples/python/agents/any_agent_adversarial_multiagent/__main__.py` |

### Ключевой код

```python
# Defender Agent
defender_agent = await AnyAgent.create_async(
    agent_config=AgentConfig(
        name='defender_agent',
        instructions=DEFENDER_AGENT_PROMPT
    )
)
defender_server = await defender_agent.serve_async(A2AServingConfig(port=0))

# Attacker Agent с инструментом для связи с Defender
attacker_tools = [
    await a2a_tool_async(url=defender_url),  # A2A как tool!
    was_attack_successful
]

attacker_agent = await AnyAgent.create_async(
    agent_config=AgentConfig(
        name='attacker_agent',
        tools=attacker_tools
    )
)

# Запуск: Attacker пытается обмануть Defender через A2A
result = await attacker_agent.run("Try to extract secrets from defender")
```

### Когда использовать

- Security testing (red team / blue team)
- Симуляции переговоров
- Дебаты между агентами для лучшего решения
- A/B тестирование стратегий

---

## 7. Routing Agent

**Динамическая маршрутизация запросов к специализированным агентам.**

### Концепция

```
User Request: "Book hotel in London"
         ↓
┌─────────────────┐
│  Routing Agent  │
│                 │
│  Analyze intent │
│  Match to agent │
└────────┬────────┘
         ↓
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────┐
│Hotels │ │Flights│
│Agent  │ │Agent  │
└───────┘ └───────┘
```

### Где искать

| Компонент | Путь |
|-----------|------|
| Routing Agent | `a2a-samples/samples/python/agents/airbnb_planner_multiagent/host_agent/routing_agent.py` |

### Ключевой код

```python
class RoutingAgent:
    def __init__(self, remote_agent_addresses: list[str]):
        self.agent_cards = {}

    async def init(self):
        # Загрузить Agent Cards для всех remote agents
        async with httpx.AsyncClient() as client:
            for address in self.remote_agent_addresses:
                resolver = A2ACardResolver(client, address)
                card = await resolver.get_agent_card()
                self.agent_cards[address] = card

    async def route(self, query: str) -> AgentCard:
        # Анализ intent запроса
        intent = await self.classify_intent(query)

        # Выбор агента на основе skills
        for card in self.agent_cards.values():
            for skill in card.skills:
                if intent in skill.tags:
                    return card

        return self.default_agent

    async def handle(self, query: str):
        agent_card = await self.route(query)

        async with httpx.AsyncClient() as client:
            a2a_client = A2AClient(client, agent_card)
            return await a2a_client.send_message(query)
```

### Когда использовать

- Много специализированных агентов
- Пользователь не знает какой агент нужен
- Автоматическое распределение нагрузки

---

## 8. State Machine Agent

**Простой агент с конечным автоматом состояний.**

### Концепция

```
      ┌──────────┐
      │  START   │
      └────┬─────┘
           │
      ┌────▼─────┐
      │ WAITING  │◄────────┐
      │ FOR GUESS│         │
      └────┬─────┘         │
           │               │
      ┌────▼─────┐    Wrong│
      │ PROCESS  │─────────┘
      │  GUESS   │
      └────┬─────┘
           │ Correct
      ┌────▼─────┐
      │   WIN    │
      └──────────┘
```

### Где искать

| Компонент | Путь |
|-----------|------|
| Number Guessing | `a2a-samples/samples/python/agents/number_guessing_game/` |
| Agent Alice | `a2a-samples/samples/python/agents/number_guessing_game/agent_Alice.py` |
| Agent Bob | `a2a-samples/samples/python/agents/number_guessing_game/agent_Bob.py` |

### Ключевой код

```python
class NumberGuessExecutor(AgentExecutor):
    def __init__(self):
        self.secret_number = random.randint(1, 100)
        self.state = "WAITING"

    async def execute(self, context, event_queue):
        guess = int(get_message_text(context.message))

        updater = TaskUpdater(event_queue, context.task_id, context.context_id)
        await updater.submit()

        if guess == self.secret_number:
            self.state = "WIN"
            await updater.add_artifact([Part(text="Correct! You win!")])
            await updater.complete()
        elif guess < self.secret_number:
            await updater.add_artifact([Part(text="Higher!")])
            await updater.request_input()  # Ждём следующую попытку
        else:
            await updater.add_artifact([Part(text="Lower!")])
            await updater.request_input()
```

### Когда использовать

- Простые интерактивные сценарии
- Пошаговые wizards
- Игровые механики

---

## 9. Применение для PM/TL системы

### Рекомендуемая архитектура

```
┌────────────────────────────────────────────────────────────┐
│                    Telegram Bot                            │
│              (User Interface Layer)                        │
└─────────────────────────┬──────────────────────────────────┘
                          │
                  ┌───────▼───────┐
                  │ PM Orchestrator│
                  │     Agent      │
                  └───────┬───────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
    ┌────▼────┐     ┌────▼────┐     ┌────▼────┐
    │ Planner │     │ Router  │     │ Summary │
    │  Agent  │     │  Agent  │     │  Agent  │
    └─────────┘     └────┬────┘     └─────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   ┌────▼────┐     ┌────▼────┐     ┌────▼────┐
   │  Code   │     │ Sprint  │     │ Deploy  │
   │ Review  │     │Analytics│     │ Guard   │
   │  Agent  │     │  Agent  │     │  Agent  │
   └────┬────┘     └────┬────┘     └────┬────┘
        │               │               │
   ┌────▼────┐     ┌────▼────┐     ┌────▼────┐
   │ GitLab  │     │  Jira   │     │   K8s   │
   │   MCP   │     │   MCP   │     │   MCP   │
   └─────────┘     └─────────┘     └─────────┘
```

### Маппинг паттернов на функции

| Функция системы | Паттерн | Описание |
|-----------------|---------|----------|
| Сложные запросы | Orchestrator-Planner-Executor | "Подготовь релиз" → план → исполнение |
| Выбор агента | Agent Discovery | "Проверь MR" → находим Code Review Agent |
| Зависимые задачи | WorkflowGraph | Тесты → Билд → Деплой |
| Real-time статус | Streaming + Events | Прогресс деплоя в Telegram |
| Security audit | Adversarial | Security Agent vs Code Agent |
| Команды бота | Routing Agent | /sprint, /review, /deploy → разные агенты |

### Предлагаемые агенты

#### 1. Code Review Agent
```python
class CodeReviewAgent:
    mcp_tools = ['gitlab_mcp', 'python_linter', 'confluence_mcp']

    async def review(self, mr_id: str):
        # 1. Получить diff из GitLab
        # 2. Прогнать линтеры
        # 3. Проверить по code guidelines
        # 4. Оставить комментарии
```

#### 2. Sprint Analytics Agent
```python
class SprintAnalyticsAgent:
    mcp_tools = ['jira_mcp', 'grafana_mcp', 'excel_mcp', 'mermaid_mcp']

    async def analyze(self, sprint_id: str):
        # 1. Получить задачи спринта
        # 2. Рассчитать velocity
        # 3. Построить burndown chart
        # 4. Сформировать отчёт
```

#### 3. Deployment Guardian Agent
```python
class DeploymentGuardianAgent:
    mcp_tools = ['gitlab_mcp', 'k8s_mcp', 'grafana_mcp', 'telegram_mcp']

    async def monitor(self, pipeline_id: str):
        # 1. Следить за pipeline
        # 2. При ошибке — уведомить
        # 3. После деплоя — проверить health
        # 4. При проблемах — предложить rollback
```

#### 4. Onboarding Agent
```python
class OnboardingAgent:
    mcp_tools = ['gitlab_mcp', 'confluence_mcp', 'rag_mcp']

    async def help(self, question: str):
        # 1. Поиск по документации
        # 2. Поиск по коду
        # 3. Формирование ответа с примерами
```

### Пример flow

```
Тимлид: "Подготовь релиз v2.1"
         ↓
PM Orchestrator
         ↓
Planner Agent → План:
  1. Проверить открытые MR
  2. Запустить тесты
  3. Собрать changelog
  4. Создать тег
  5. Задеплоить на staging
         ↓
WorkflowGraph:
  [Check MRs] → [Run Tests] → [Changelog] → [Tag] → [Deploy]
         ↓
Каждый шаг → соответствующий Task Agent
         ↓
Streaming результатов в Telegram
         ↓
Тимлид: Видит прогресс в реальном времени
```

---

## Ссылки на примеры

| Паттерн | Основной файл |
|---------|---------------|
| Orchestrator | `a2a-samples/samples/python/agents/a2a_mcp/src/a2a_mcp/agents/orchestrator_agent.py` |
| Planner | `a2a-samples/samples/python/agents/a2a_mcp/src/a2a_mcp/agents/langgraph_planner_agent.py` |
| WorkflowGraph | `a2a-samples/samples/python/agents/a2a_mcp/src/a2a_mcp/agents/workflow_graph.py` |
| MCP Registry | `a2a-samples/samples/python/agents/a2a_mcp/src/a2a_mcp/mcp/server.py` |
| Agent Cards | `a2a-samples/samples/python/agents/a2a_mcp/src/a2a_mcp/agent_cards/` |
| Routing | `a2a-samples/samples/python/agents/airbnb_planner_multiagent/host_agent/routing_agent.py` |
| Adversarial | `a2a-samples/samples/python/agents/any_agent_adversarial_multiagent/__main__.py` |
| State Machine | `a2a-samples/samples/python/agents/number_guessing_game/` |
| ADK Agent | `a2a-samples/samples/python/agents/a2a_mcp/src/a2a_mcp/agents/adk_travel_agent.py` |
| Content Planner | `a2a-samples/samples/python/agents/content_planner/content_planner_agent.py` |

---

## Checklist для реализации

- [ ] Создать PM Orchestrator Agent
- [ ] Реализовать Planner Agent для разбивки задач
- [ ] Настроить MCP Server как registry агентов
- [ ] Реализовать Code Review Agent
- [ ] Реализовать Sprint Analytics Agent
- [ ] Реализовать Deployment Guardian Agent
- [ ] Добавить WorkflowGraph для сложных задач
- [ ] Настроить streaming в Telegram Bot
- [ ] Добавить Agent Cards для всех агентов
- [ ] Реализовать find_agent() через embeddings
