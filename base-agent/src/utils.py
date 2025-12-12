import json
from typing import Optional


def parse_sse_like_body(body: str) -> Optional[dict]:
    """
    Сервер может вернуть SSE-формат в теле (даже с неверным Content-Type).
    Пытаемся вынуть первую data: строку и распарсить как JSON.
    """
    lines = [line.strip() for line in body.splitlines() if line.strip()]
    data_lines = []
    for line in lines:
        if line.startswith("data:"):
            data_lines.append(line[len("data:"):].strip())
    if not data_lines:
        return None
    try:
        return json.loads("".join(data_lines))
    except Exception:
        return None
