# Переменные окружения

## 📋 Обзор

| Где | Файл | Кто читает |
|---|---|---|
| Локально | `.env` в корне (шаблон — `.env.sample`) | `next dev`, ingestor (`--env-file-if-exists=../../.env`), docker compose |
| Прод | `frontend.env`, `ingestor.env`, `postgres.env`, `ollama.env` | собираются в CI из `ci/env/*.env.tpl` ([08-ci-cd.md](./08-ci-cd.md)) |

Правило: **всё, кроме `NEXT_PUBLIC_*`, — только серверное.** `NEXT_PUBLIC_*` вшиваются в клиентский
бандл на `next build`; секреты GCN, БД и ключ Anthropic туда попасть не должны — из браузера они
не нужны вовсе.

Валидация — zod при старте (ingestor, `services/ingestor/src/config.ts`) или при первом обращении
(AI-чат, `src/shared/api/llm/config.ts`: `next build` идёт без runtime-env). Пустое значение
`KEY=` в чате считается «не задано» и берёт дефолт.

## 🐳 Docker Compose

| Переменная | Назначение |
|---|---|
| `PROJECT_SLUG` | префикс имён контейнеров, volume и сетей |
| `ENVIRONMENT` | `development` \| `production` — какой Dockerfile собирать локально |
| `POSTGRES_PORT` | порт Postgres на хосте (по умолчанию `5432`; поменяй, если занят) |
| `OLLAMA_DOCKER_URL` | адрес Ollama для ingestor и frontend внутри compose; по умолчанию нативная Ollama хоста `http://host.docker.internal:11434`, с `--profile ollama` — `http://ollama:11434` |

## 🌐 Frontend (Next.js)

| Переменная | Назначение | По умолчанию |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | публичный URL сайта (canonical, sitemap) | — |
| `NEXT_PUBLIC_APP_ENV` | `development` \| `production` | — |
| `NEXT_PUBLIC_YANDEX_TRACKING_ID` | счётчик Метрики | пусто — выключен |
| `DATABASE_URL` | Postgres: SSR-выборка ленты, SSE `/api/stream`, AI-чат | — |
| `NOTICES_LIVE_LIMIT` | сколько карточек лента держит в DOM в live-режиме | `500` |

## 🛰️ Ingestor

| Переменная | Назначение | По умолчанию |
|---|---|---|
| `GCN_CLIENT_ID` / `GCN_CLIENT_SECRET` | учётка Kafka с gcn.nasa.gov | обязательны |
| `GCN_TOPICS` | csv топиков | пусто — `DEFAULT_TOPICS` из `config.ts` |
| `GCN_BACKFILL_DAYS` | глубина первичной загрузки, 0–30 | `7` |
| `GCN_CONSUMER_GROUP` | consumer group Kafka; **у прода и локалки разные**, иначе они делят партиции | `nasa-notifications` |
| `DATABASE_URL` | Postgres | обязательна |
| `OLLAMA_URL` | эмбеддинги для индексации циркуляров | `http://localhost:11434` |
| `OLLAMA_EMBED_MODEL` | модель эмбеддингов | `nomic-embed-text` |

## 🤖 AI-чат

Архитектура — [16-ai-chat.md](./16-ai-chat.md). Читает frontend (`/api/chat`), кроме
`OLLAMA_NUM_PARALLEL` — его читает сервис ollama.

| Переменная | Назначение | По умолчанию |
|---|---|---|
| `LLM_PROVIDER` | `ollama` \| `anthropic` — кто генерирует ответ. Эмбеддинги всегда идут через Ollama | `ollama` |
| `OLLAMA_URL` | адрес Ollama; в прод-compose — `http://ollama:11434` (зашит в шаблон) | `http://localhost:11434` |
| `OLLAMA_CHAT_MODEL` | чат-модель Ollama; для CPU-сервера 8 GB — `qwen3:4b` | `qwen3:8b` |
| `OLLAMA_EMBED_MODEL` | модель эмбеддингов; **смена требует переиндексации** (`kb:index` сделает её сам) | `nomic-embed-text` |
| `OLLAMA_NUM_PARALLEL` | параллельных генераций в Ollama; без GPU — `1` | дефолт Ollama |
| `ANTHROPIC_API_KEY` | ключ из console.anthropic.com; обязателен при `LLM_PROVIDER=anthropic` | — |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5`, дешевле — `claude-haiku-4-5`, качественнее — `claude-opus-5-5` | `claude-sonnet-5-5` |
| `ANTHROPIC_EFFORT` | `low` \| `medium` \| `high` \| `none`; `none` — не передавать (нужно для `claude-haiku-4-5`) | не передаётся |
| `CHAT_RATE_PER_MIN` | вопросов с одного IP в минуту | `10` |
| `CHAT_RATE_PER_DAY` | вопросов с одного IP в сутки (UTC) | `50` |
| `CHAT_DAILY_CAP` | общий потолок вопросов в сутки — защита счёта Anthropic | `1000` |

> ⚠️ Подписка Claude Pro/Max не даёт доступа к API: у API отдельный предоплаченный баланс
> в console.anthropic.com. Пустой баланс — `400 credit balance is too low`.

## 🗄️ Postgres

Локально образ читает `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` из `.env`; на проде
`postgres.env` собирается из секретов `DATABASE_USERNAME` / `DATABASE_PASSWORD` / `DATABASE_NAME`.

`DATABASE_URL` на хосте указывает на `localhost:<POSTGRES_PORT>`, внутри compose — на `postgres:5432`.
Локальный compose подставляет контейнерам правильный URL сам, прод-URL собирает workflow.

## 🐛 Частые ошибки

| Симптом | Причина |
|---|---|
| Новое значение не подхватилось | `docker compose restart` не перечитывает env — нужен `up -d` (пересоздание) |
| `NEXT_PUBLIC_*` не поменялась на проде | вшивается на сборке — нужен новый выкат |
| Контейнер не видит БД / Ollama | в URL `localhost` — внутри контейнера это сам контейнер |
| Чат отвечает 503 | ошибка конфигурации (`anthropic` без ключа, опечатка в `ANTHROPIC_EFFORT`) — текст в логе frontend |
| Ответы чата без циркуляров | база знаний пуста — не прошёл `kb:index` ([16-ai-chat.md](./16-ai-chat.md), этап 2) |
