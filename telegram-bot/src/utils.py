"""Утилиты для работы с Telegram ботом."""

# Telegram имеет лимит 4096 символов на сообщение
TELEGRAM_MAX_MESSAGE_LENGTH = 4096


def split_long_message(text: str, max_length: int = TELEGRAM_MAX_MESSAGE_LENGTH) -> list[str]:
    """
    Разбивает длинное сообщение на части, соблюдая лимит Telegram.
    Старается разбивать по границам абзацев или предложений.

    Args:
        text: Текст для разбиения
        max_length: Максимальная длина одного сообщения (по умолчанию 4096)

    Returns:
        Список частей текста, каждая не длиннее max_length
    """
    if len(text) <= max_length:
        return [text]

    chunks = []
    current_chunk = ""

    # Разбиваем по абзацам
    paragraphs = text.split('\n\n')

    for paragraph in paragraphs:
        # Если текущий параграф + накопленный chunk помещаются
        if len(current_chunk) + len(paragraph) + 2 <= max_length:
            if current_chunk:
                current_chunk += '\n\n' + paragraph
            else:
                current_chunk = paragraph
        else:
            # Сохраняем текущий chunk, если он не пустой
            if current_chunk:
                chunks.append(current_chunk)
                current_chunk = ""

            # Если параграф сам по себе слишком длинный, разбиваем его
            if len(paragraph) > max_length:
                # Разбиваем по предложениям
                sentences = paragraph.replace('. ', '.\n').split('\n')
                for sentence in sentences:
                    if len(current_chunk) + len(sentence) + 1 <= max_length:
                        if current_chunk:
                            current_chunk += ' ' + sentence
                        else:
                            current_chunk = sentence
                    else:
                        if current_chunk:
                            chunks.append(current_chunk)
                        # Если предложение слишком длинное, просто разрезаем
                        if len(sentence) > max_length:
                            for i in range(0, len(sentence), max_length):
                                chunks.append(sentence[i:i + max_length])
                            current_chunk = ""
                        else:
                            current_chunk = sentence
            else:
                current_chunk = paragraph

    # Добавляем последний chunk
    if current_chunk:
        chunks.append(current_chunk)

    return chunks
