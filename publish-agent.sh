#!/usr/bin/env bash
set -euo pipefail

# Сборка и пуш только образа base-agent в реестр.
# Настраиваем через переменные:
#   REGISTRY   (по умолчанию base-agent.cr.cloud.ru)
#   IMAGE_NAME (по умолчанию base-agent)
#   TAG        (по умолчанию latest)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

REGISTRY="${REGISTRY:-base-agent.cr.cloud.ru}"
IMAGE_NAME="${IMAGE_NAME:-base-agent}"
TAG="${TAG:-latest}"
FULL_IMAGE="${REGISTRY}/${IMAGE_NAME}:${TAG}"

echo "==> Целевой образ: ${FULL_IMAGE}"

# Убедимся, что есть builder
if ! docker buildx ls | grep -q '\*'; then
  echo "==> Создаю buildx builder..."
  docker buildx create --use --name local-builder
fi

echo "==> Собираю linux/amd64 и пушу..."
docker buildx build \
  --platform linux/amd64 \
  -t "${FULL_IMAGE}" \
  "${ROOT_DIR}/base-agent" \
  --push

echo "==> Готово: ${FULL_IMAGE} отправлен в реестр"



