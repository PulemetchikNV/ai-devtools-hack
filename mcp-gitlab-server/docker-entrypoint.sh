#!/bin/sh
set -e

echo "🔄 Syncing database schema..."

# Try to sync database schema with retries
MAX_RETRIES=5
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if npx prisma db push --skip-generate 2>&1; then
    echo "✅ Database schema synced!"
    break
  else
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
      echo "❌ Failed to sync database after $MAX_RETRIES attempts"
      exit 1
    fi
    echo "⚠️ Database sync failed, retrying... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 3
  fi
done

echo "🚀 Starting MCP GitLab Server..."

exec node dist/index.js
