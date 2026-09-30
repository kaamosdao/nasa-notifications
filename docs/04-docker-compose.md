# Docker Compose

## 📋 Файлы

| Файл | Где | Сервисы |
|---|---|---|
| `docker-compose.yml` | локально | postgres, ingestor, frontend (сборка из исходников, код примонтирован), ollama — по профилю |
| `docker-compose.production.yml` | прод | те же, образы из GHCR, порты только на `127.0.0.1` ([08-ci-cd.md](./08-ci-cd.md)) |

```
postgres (pgvector, healthy) ─┬─▶ ingestor ──▶ ollama (эмбеддинги новых циркуляров)
                              └─▶ frontend ──▶ ollama | Anthropic (AI-чат)
```

Ollama не в `depends_on`: без неё лента работает, а чат деградирует (retrieval без векторов,
[16-ai-chat.md](./16-ai-chat.md)).

## 🚀 Локальный запуск

Обычно в Docker держат только Postgres, остальное — нативно (быстрее hot-reload и доступна GPU
для Ollama):

```bash
cp .env.sample .env                 # вписать GCN_CLIENT_ID / GCN_CLIENT_SECRET
docker compose up -d postgres
brew install ollama && ollama serve # в отдельном терминале
ollama pull nomic-embed-text && ollama pull qwen3:8b
pnpm install
pnpm ingestor:dev                   # или без Kafka: pnpm --filter ingestor seed --loop
pnpm --filter ingestor kb:index     # база знаний чата: один раз, долго (эмбеддинги ~19 тыс. кусков)
pnpm dev                            # http://localhost:3000
```

Весь стек в Docker:

```bash
docker compose up -d                      # Ollama — нативная на хосте
docker compose --profile ollama up -d     # Ollama в контейнере (без GPU на Mac — медленно)
```

`DATABASE_URL` и `OLLAMA_URL` из `.env` указывают на `localhost` (для нативного запуска) — compose
переопределяет их ingestor'у и frontend'у на `postgres` и `OLLAMA_DOCKER_URL`. С `--profile ollama`
пропиши в `.env` `OLLAMA_DOCKER_URL=http://ollama:11434`, иначе контейнеры пойдут на хост.

## 🐘 Postgres

- Образ `pgvector/pgvector:pg16` (debian): расширение `vector` для RAG. Миграции
  (`services/ingestor/sql/*.sql`) применяет ingestor при старте и `kb:index`.
- Порт на хосте — `POSTGRES_PORT` (по умолчанию `5432`). Если 5432 занят локальным Postgres,
  поставь `5433` и поправь порт в `DATABASE_URL`.

## 🧠 Ollama

- Модели качаются при старте контейнера в volume `${PROJECT_SLUG}_ollama-models`: эмбеддинги
  всегда, чат-модель — только при `LLM_PROVIDER=ollama`. Повторный старт лишь сверяет манифест.
- Healthcheck проверяет модель эмбеддингов; `start_period: 30m` — на первом старте чат-модель
  весит гигабайты.
- На проде env сервиса — отдельный `ollama.env` без секретов GCN и БД.

## 🛠️ Команды

```bash
docker compose ps
docker compose logs -f ingestor
docker compose up -d                  # после правки .env — пересоздание, restart env не перечитывает
docker compose build --no-cache ingestor
docker compose exec postgres psql -U nasa nasa_notifications
docker compose down                   # volume сохраняются
docker compose down -v                # ⚠️ удалит БД и скачанные модели
```

Бэкап и восстановление:

```bash
docker compose exec -T postgres pg_dump -U nasa nasa_notifications > dump.sql
docker compose exec -T postgres psql -U nasa nasa_notifications < dump.sql
```

## 🐛 Частые проблемы

| Симптом | Решение |
|---|---|
| `port is already allocated` на 5432 | `POSTGRES_PORT=5433` + порт в `DATABASE_URL` |
| Лента пустая | ingestor не запущен или нет учётки GCN — `pnpm --filter ingestor seed --loop` |
| Лента не листается вверх | в базе мало событий (seed даёт 3) — запусти ingestor с backfill |
| Первый ответ чата идёт 20–30 с | Ollama загружает модель в память; дальше быстрее |
