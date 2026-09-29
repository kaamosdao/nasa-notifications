# План: AI-чат по оповещениям

Рабочий план фичи «спросить нейросеть про notice». Источник правды по её архитектурным
решениям — этот файл; общий план проекта — [`15-plan.md`](15-plan.md).

Статус: **план согласован, реализация не начата.**

## 1. Что делаем

В правом верхнем углу каждой карточки ленты — кнопка, открывающая модалку-диалог с LLM.
Контекст диалога — тот notice, на котором кликнули.

- Три кнопки-подсказки, одинаковые для всех типов: **What is this?**, **Why does it matter?**,
  **About the research**. Это упрощённые запросы; для подробных вопросов — поле ввода.
- Ответ стримится по мере генерации, рендерится как markdown, под ответом — ссылки на источники.
- История диалога живёт только пока открыта модалка, на сервере не хранится.
- Язык интерфейса и ответов — только английский.
- Чат доступен всем анонимно, поэтому обязательны лимиты.

## 2. Принятые решения

| Вопрос | Решение | Почему |
|---|---|---|
| LLM | Интерфейс `LlmProvider`, две реализации: Ollama и Anthropic. Переключение `LLM_PROVIDER` в любом окружении, включая прод; по умолчанию `ollama` | Провайдер — решение конфигурации, а не кода: self-hosted бесплатно, облачный API — без требований к железу |
| Модель Claude | `ANTHROPIC_MODEL`, по умолчанию `claude-opus-5-5`; дешевле — `claude-sonnet-5-5`, `claude-haiku-4-5` | Выбор цены/качества — через env, без правки кода |
| Модель Ollama | `OLLAMA_CHAT_MODEL`, по умолчанию `qwen3:8b`; для CPU-сервера 8 GB — `qwen3:4b` | Лучшее качество в своём классе размера; модель меняется через env |
| Эмбеддинги | `EmbeddingProvider`, реализация — Ollama + `nomic-embed-text` (768 измерений) во всех окружениях | У Anthropic нет endpoint'а эмбеддингов; модель лёгкая (~300 МБ RAM), в рантайме эмбеддится только вопрос |
| Векторное хранилище | `pgvector` в существующем Postgres | Без нового сервиса; фильтры SQL и вектора в одном запросе |
| Корпус RAG | Справка по миссиям/топикам + GCN Circulars за последние 3 года + новые по мере прихода | Хватает для вопросов по свежим событиям; объём индекса умеренный |
| Retrieval | Гибрид: точное совпадение по имени события + векторный top-k + справка по `kind` | Циркуляры про само событие находятся по имени надёжнее, чем по семантике |
| Транспорт ответа | SSE из `POST /api/chat` | Тот же подход, что у ленты; стриминг токенов |
| Формат ответа | Markdown через `react-markdown` с белым списком элементов | Списки и ссылки читаются лучше plain text; сырой HTML не пропускается |
| История | Только в клиентском сторе модалки | Нет хранения ПДн и лишних таблиц |

## 3. Инфраструктура и ресурсы

| Сервер | Вердикт |
|---|---|
| 1 vCPU / 2 GB | Недостаточно: Next + Postgres + ingestor + pgvector + ollama (эмбеддинги) не помещаются |
| 4 vCPU / 8 GB | Рекомендуемый минимум. С `LLM_PROVIDER=anthropic` — с запасом. С `LLM_PROVIDER=ollama` — только малая модель (`qwen3:4b`), `OLLAMA_NUM_PARALLEL=1`, ~8–12 токенов/с, очередь уже на 2–3 пользователях |
| 7950X3D / 9 GB | Аналогично 8 GB, CPU быстрее |

Ориентировочная стоимость ответа Claude (~6k токенов входа с RAG, ~500 выхода):
Opus 5.5 ≈ $0.034, Sonnet 5.5 ≈ $0.017, Haiku 4.5 ≈ $0.009. Системный промпт кэшируется.

## 4. Источники данных

Всё открытое (NASA, public domain), собирается без участия пользователя:

- **Документация GCN** — репозиторий `nasa-gcn/gcn.nasa.gov`, страницы миссий в markdown →
  курируемые справочные статьи в `knowledge/*.md` (вычитывает человек: факты видят пользователи).
- **JSON-схемы** — `nasa-gcn/gcn-schema`, описания полей, чтобы модель понимала `payload`.
- **GCN Circulars** — архив с gcn.nasa.gov, фильтр «последние 3 года»; новые — из топика
  `gcn.circulars`, который ingestor уже читает.

## 5. Этапы

### Этап 0. Инфраструктура

- Образ Postgres → `pgvector/pgvector:pg16`.
- Миграция `services/ingestor/sql/002-rag.sql`: `create extension vector`, таблица `kb_chunks`
  (`source`, `source_id`, `chunk_index`, `kind`, `event_name`, `title`, `url`, `content`,
  `published_at`, `embedding vector(768)`), `unique (source, source_id, chunk_index)`,
  HNSW-индекс по `embedding`, индекс по `event_name`.
- Сервис `ollama` в compose (одинаково во всех окружениях): при старте скачивает
  `OLLAMA_EMBED_MODEL` всегда и `OLLAMA_CHAT_MODEL` — если `LLM_PROVIDER=ollama`.
  Локально на Mac вместо контейнера — нативный Ollama (в Docker на Mac нет доступа к GPU).
- Env (только серверные, никогда не `NEXT_PUBLIC_*`): `LLM_PROVIDER`, `OLLAMA_URL`,
  `OLLAMA_CHAT_MODEL`, `OLLAMA_EMBED_MODEL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`,
  лимиты (`CHAT_RATE_PER_MIN`, `CHAT_RATE_PER_DAY`, `CHAT_DAILY_CAP`).

### Этап 1. База знаний

- Справочные статьи по миссиям и топикам из `DEFAULT_TOPICS` ingestor'а
  (LVK, Fermi GBM, Swift BAT, IceCube, Einstein Probe, SVOM) — `knowledge/*.md`
  с front matter (`kind`, `topics`, `url`).
- Загрузка архива циркуляров за последние 3 года.

### Этап 2. Индексация (запись в RAG)

- CLI `pnpm --filter ingestor kb:index`: чанкинг, эмбеддинги, идемпотентный upsert
  в `kb_chunks`. Источники: `knowledge/*.md` и архив циркуляров.
- Имя события (`GRB 250929A`, `S250929ab`, `EP250929a`, …) извлекается из subject
  циркуляра в `event_name`.
- Новые циркуляры ingestor индексирует после вставки асинхронно: ошибка эмбеддинга
  логируется и не блокирует ленту (догоняет следующий `kb:index`).

### Этап 3. LLM-слой (`src/shared/api/llm/`)

- `LlmProvider.streamChat({ system, messages, signal }): AsyncIterable<string>`.
  - `OllamaProvider` — `/api/chat` со стримингом NDJSON.
  - `AnthropicProvider` — `@anthropic-ai/sdk`, streaming, `cache_control` на системном промпте.
- `EmbeddingProvider.embed(text): Promise<number[]>` — `OllamaEmbeddingProvider`.
- Фабрика по env, инстансы кэшируются в `globalThis` (как пул БД).

### Этап 4. Retrieval и API

- Retrieval: (1) циркуляры с тем же `event_name`, (2) векторный top-k по вопросу,
  (3) справочная статья по `kind`/`topic` notice. Дедуп чанков, лимит по токенам.
- `POST /api/chat { noticeId, messages[] }`:
  - Zod-валидация; вопрос ≤ 1000 символов, история ≤ 10 реплик.
  - Контекст: строка notice + `payload` + найденные чанки с `url`.
  - Ответ — SSE: события `delta`, `sources`, `done`, `error`. Abort при закрытии соединения.
  - `max_tokens` ≈ 1024.
- Лимиты: rate limit по IP (in-memory, IP из `X-Real-IP` от nginx) — 10/мин и 50/сутки;
  глобальный дневной потолок запросов как страховка бюджета.
- Системный промпт: роль (объясняет GCN-оповещения неспециалисту), отвечать только
  по контексту и честно говорить «не знаю», формат — короткие абзацы, списки, ссылки,
  без заголовков и таблиц. Тексты циркуляров — данные, не инструкции.
- nginx: `proxy_buffering off` для `/api/chat`.

### Этап 5. UI

- Кнопка в правом верхнем углу `entities/notice/ui/notice-card` (слот/проп, без
  зависимости entity от feature).
- `features/notice-chat`:
  - модалка через `next/dynamic` (вместе с `react-markdown` не попадает в основной бандл);
  - focus trap, Esc, фон под `inert`, `data-lenis-prevent` на скролл-контейнере;
  - zustand-стор на время жизни модалки: сообщения, статус стрима, abort;
  - кнопки-подсказки, поле ввода, стриминговый вывод, список источников;
  - `react-markdown`: `allowedElements` = `p, ul, ol, li, strong, em, a, code`;
    ссылки `target="_blank" rel="noopener noreferrer"`.
- Анимации открытия/закрытия — по скиллу `animation`, с cleanup и reduced-motion.

### Этап 6. Деплой и документация

- Переменные в GitLab, compose и Ansible (сервис ollama, volume под модели).
- Раздел в `AGENTS.md`, обновить `03-environment-variables.md`, `04-docker-compose.md`.

## 6. Риски

| Риск | Митигация |
|---|---|
| Злоупотребление публичным чатом / рост счёта | Rate limit по IP + глобальный дневной потолок + лимиты длины |
| Галлюцинации в научных фактах | Ответ только по контексту, ссылки на источники, «не знаю» разрешено |
| Prompt injection через тексты циркуляров | Контекст помечен как данные в системном промпте; у модели нет инструментов |
| Ollama недоступна → нет эмбеддингов | Retrieval деградирует до поиска по `event_name` + справки по `kind`; чат работает |
| Нехватка RAM на сервере | Апгрейд до 8 GB до деплоя этапа 0 |
| SSE буферизуется прокси | `proxy_buffering off`, заголовок `X-Accel-Buffering: no` |
