#!/usr/bin/env bash
set -euo pipefail

# Сборка и пуш образа mcp-gitlab-server в реестр.
# Настраиваем через переменные:
#   REGISTRY   (по умолчанию mcp-gitlab-server.cr.cloud.ru)
#   IMAGE_NAME (по умолчанию mcp-gitlab-server)
#   TAG        (по умолчанию latest)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

REGISTRY="${REGISTRY:-mcp-gitlab-server.cr.cloud.ru}"
IMAGE_NAME="${IMAGE_NAME:-mcp-gitlab-server}"
TAG="${TAG:-latest}"
FULL_IMAGE="${REGISTRY}/${IMAGE_NAME}:${TAG}"

echo "==> Целевой образ: ${FULL_IMAGE}"

# Убедимся, что есть builder (если есть local-builder — просто используем его)
if docker buildx inspect local-builder >/dev/null 2>&1; then
  echo "==> Использую существующий builder local-builder"
  docker buildx use local-builder
else
  echo "==> Создаю buildx builder local-builder..."
  docker buildx create --use --name local-builder
fi

echo "==> Собираю linux/amd64 и пушу..."
docker buildx build \
  --platform linux/amd64 \
  -t "${FULL_IMAGE}" \
  "${ROOT_DIR}/mcp-gitlab-server" \
  --push

echo "==> Готово: ${FULL_IMAGE} отправлен в реестр"
