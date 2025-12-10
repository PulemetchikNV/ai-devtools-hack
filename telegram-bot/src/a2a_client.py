"""A2A клиент для общения с gitlab-agent."""
import logging
from typing import Optional
from uuid import uuid4

import httpx
from a2a.client import A2ACardResolver, A2AClient
from a2a.types import (
    AgentCard,
    Message,
    MessageSendParams,
    SendMessageRequest,
    TextPart,
)

from src.config import settings


logger = logging.getLogger(__name__)


class AgentClient:
    """Клиент для общения с A2A агентом."""

    def __init__(self):
        self._client: Optional[A2AClient] = None
        self._http_client: Optional[httpx.AsyncClient] = None
        self._agent_card: Optional[AgentCard] = None

    async def _get_client(self) -> A2AClient:
        """Получает или создает A2A клиент."""
        if self._client is None:
            self._http_client = httpx.AsyncClient(timeout=60.0)

            # Используем A2ACardResolver для получения agent card
            resolver = A2ACardResolver(
                httpx_client=self._http_client,
                base_url=settings.a2a_agent_url,
            )

            logger.info(f"Fetching agent card from: {settings.a2a_agent_url}")
            self._agent_card = await resolver.get_agent_card()
            logger.info(f"Successfully fetched agent card: {self._agent_card.name}")

            # Создаем клиент с полученной agent card
            self._client = A2AClient(
                httpx_client=self._http_client,
                agent_card=self._agent_card,
            )
        return self._client

    async def send_message(
        self,
        message: str,
        user_context: dict,
        context_id: Optional[str] = None,
    ) -> tuple[str, Optional[str]]:
        """
        Отправляет сообщение агенту с контекстом пользователя.

        Args:
            message: Сообщение от пользователя
            user_context: Контекст пользователя (данные из БД)
            context_id: ID контекста для сохранения истории диалога

        Returns:
            Tuple[ответ от агента, contextId для следующих запросов]
        """
        client = await self._get_client()

        # Формируем сообщение с контекстом пользователя
        context_prefix = self._format_user_context(user_context)
        full_message = f"{context_prefix}\n\nСообщение пользователя: {message}"

        # Создаем запрос по формату A2A протокола
        request = SendMessageRequest(
            id=str(uuid4()),
            params=MessageSendParams(
                message=Message(
                    role="user",
                    parts=[TextPart(text=full_message)],
                    message_id=uuid4().hex,
                    context_id=context_id,  # None при первом запросе, затем сохранённый
                ),
            ),
        )

        logger.info(f"Sending message to agent, context_id={context_id}")

        try:
            response = await client.send_message(request)

            # Извлекаем текст и contextId из ответа
            # Структура: response.root.result — это Task с history и contextId
            result = response.root.result
            new_context_id = None

            print(f"MSG RESULT: {result}")

            if result:
                # Сохраняем context_id для следующих запросов (snake_case в Pydantic модели)
                new_context_id = getattr(result, 'context_id', None)
                logger.info(f"Response result: context_id={new_context_id}, type={type(result)}")

                # Ищем последнее НЕпустое сообщение от агента
                if hasattr(result, 'history') and result.history:
                    for msg in reversed(result.history):
                        if msg.role == 'agent' and msg.parts:
                            return self.parts_to_text(msg.parts), new_context_id

                if(hasattr(result, 'artifacts') and result.artifacts):
                    for artifact in result.artifacts:
                        if hasattr(artifact, 'parts') and artifact.parts:
                            return self.parts_to_text(artifact.parts), new_context_id

            return "Агент не вернул ответ", new_context_id

        except Exception as e:
            logger.error(f"Error sending message to agent: {e}", exc_info=True)
            raise

    async def send_message_streaming(
        self,
        message: str,
        user_context: dict,
        session_id: Optional[str] = None,
    ):
        """
        Отправляет сообщение агенту с потоковым ответом.

        Args:
            message: Сообщение от пользователя
            user_context: Контекст пользователя
            session_id: ID сессии

        Yields:
            Части ответа от агента
        """
        client = await self._get_client()

        context_prefix = self._format_user_context(user_context)
        full_message = f"{context_prefix}\n\nСообщение пользователя: {message}"

        request = SendMessageRequest(
            id=str(uuid4()),
            params=MessageSendParams(
                message=Message(
                    role="user",
                    parts=[TextPart(text=full_message)],
                    messageId=uuid4().hex,
                ),
            ),
        )

        logger.info(f"Sending streaming message to agent, session_id={session_id}")

        try:
            async for event in client.send_message_streaming(request):
                if hasattr(event, 'result') and event.result:
                    if hasattr(event.result, 'artifacts') and event.result.artifacts:
                        for artifact in event.result.artifacts:
                            for part in artifact.parts:
                                if hasattr(part.root, 'text'):
                                    yield part.root.text
        except Exception as e:
            logger.error(f"Error in streaming message: {e}", exc_info=True)
            raise

    def _format_user_context(self, user_context: dict) -> str:
        """Форматирует контекст пользователя для передачи агенту."""
        if not user_context:
            return "Контекст пользователя: отсутствует"

        lines = ["Контекст пользователя:"]
        for key, value in user_context.items():
            lines.append(f"- {key}: {value}")

        return "\n".join(lines)

    async def close(self):
        """Закрывает HTTP клиент."""
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None
            self._client = None

    def parts_to_text(self, parts: list[TextPart]) -> str:
        """Преобразует список частей в текст."""
        texts = []
        for part in parts:
            root = part.root
            if hasattr(root, 'text') and root.text and root.text.strip():
                texts.append(root.text)
        if texts:
            return "\n".join(texts)


# Глобальный экземпляр клиента
agent_client = AgentClient()
