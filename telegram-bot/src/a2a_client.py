"""A2A клиент для общения с base-agent."""
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
        user_info: dict,
        context_id: Optional[str] = None,
    ) -> tuple[str, Optional[str]]:
        """
        Отправляет сообщение агенту с информацией о пользователе.

        Args:
            message: Сообщение от пользователя
            user_info: Информация о пользователе (telegram_id, username, first_name, last_name)
            context_id: ID контекста для сохранения истории диалога

        Returns:
            Tuple[ответ от агента, contextId для следующих запросов]
        """
        client = await self._get_client()

        # Формируем сообщение с информацией о пользователе
        user_prefix = self._format_user_info(user_info)
        full_message = f"{user_prefix}\n\n{message}"

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
                    logger.debug(f"History messages count: {len(result.history)}")
                    for msg in reversed(result.history):
                        logger.debug(f"Message: role={msg.role}, parts_count={len(msg.parts) if msg.parts else 0}")
                        if msg.role == 'agent' and msg.parts:
                            text = self.parts_to_text(msg.parts)
                            if text:  # Проверяем, что текст не пустой
                                logger.info(f"Found agent message in history, length={len(text)}")
                                return text, new_context_id

                if(hasattr(result, 'artifacts') and result.artifacts):
                    logger.debug(f"Artifacts count: {len(result.artifacts)}")
                    for artifact in result.artifacts:
                        if hasattr(artifact, 'parts') and artifact.parts:
                            text = self.parts_to_text(artifact.parts)
                            if text:  # Проверяем, что текст не пустой
                                logger.info(f"Found artifact, length={len(text)}")
                                return text, new_context_id

            logger.warning("Agent returned no content in history or artifacts")
            return "Агент не вернул ответ", new_context_id

        except Exception as e:
            logger.error(f"Error sending message to agent: {e}", exc_info=True)
            raise

    async def send_message_streaming(
        self,
        message: str,
        user_info: dict,
        context_id: Optional[str] = None,
    ):
        """
        Отправляет сообщение агенту с потоковым ответом.

        Args:
            message: Сообщение от пользователя
            user_info: Информация о пользователе
            context_id: ID контекста для сохранения истории диалога

        Yields:
            Части ответа от агента
        """
        client = await self._get_client()

        user_prefix = self._format_user_info(user_info)
        full_message = f"{user_prefix}\n\n{message}"

        request = SendMessageRequest(
            id=str(uuid4()),
            params=MessageSendParams(
                message=Message(
                    role="user",
                    parts=[TextPart(text=full_message)],
                    message_id=uuid4().hex,
                    context_id=context_id,
                ),
            ),
        )

        logger.info(f"Sending streaming message to agent, context_id={context_id}")

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

    def _format_user_info(self, user_info: dict) -> str:
        """Форматирует информацию о пользователе для передачи агенту."""
        if not user_info:
            return ""

        parts = []
        if user_info.get("first_name"):
            parts.append(f"Имя: {user_info['first_name']}")
        if user_info.get("last_name"):
            parts.append(f"Фамилия: {user_info['last_name']}")
        if user_info.get("username"):
            parts.append(f"Username: @{user_info['username']}")
        if user_info.get("telegram_id"):
            parts.append(f"Telegram ID: {user_info['telegram_id']}")

        return f"[Информация о пользователе: {', '.join(parts)}]" if parts else ""

    async def close(self):
        """Закрывает HTTP клиент."""
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None
            self._client = None

    def parts_to_text(self, parts: list[TextPart]) -> str:
        """Преобразует список частей в текст."""
        if not parts:
            logger.debug("parts_to_text: empty parts list")
            return ""

        texts = []
        for i, part in enumerate(parts):
            root = part.root
            if hasattr(root, 'text') and root.text and root.text.strip():
                texts.append(root.text)
            else:
                logger.debug(f"parts_to_text: part {i} has no text or empty text")

        result = "\n".join(texts) if texts else ""
        logger.debug(f"parts_to_text: extracted {len(texts)} text parts, total length={len(result)}")
        return result


# Глобальный экземпляр клиента
agent_client = AgentClient()
