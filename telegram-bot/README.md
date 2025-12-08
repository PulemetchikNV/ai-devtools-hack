# Deployment

## Setup

```bash
cp .env.example .env
# Fill in your environment variables
```

## Run with Docker

```bash
docker build -t telegram-bot .
docker run --env-file .env telegram-bot
```

## Environment Variables

See `.env.example` for required configuration.