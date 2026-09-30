# AGENTS.md

Ориентация для AI-агентов по этому репозиторию. Детальные плейбуки вынесены в **скиллы**
(`.claude/skills/`), которые Claude Code подхватывает автоматически по их описанию. Здесь —
только сквозной контекст и карта: не дублируй сюда содержимое скиллов.

## Что это за проект

**NASA / GCN Notifications** — сайт, показывающий в реальном времени поток научных оповещений
[GCN](https://gcn.nasa.gov/) (гравитационные волны, гамма-всплески, FRB, нейтрино, циркуляры).
Hero на весь экран с WebGL-metaballs, по клику уходящий на задний план, и лента событий с
поведением мессенджера: новые снизу, история подгружается сверху.

Согласованный план и все архитектурные решения — [`docs/15-plan.md`](docs/15-plan.md).
**Читай его перед любой задачей по проекту.**

⚠️ **Проект вырос из студийного boilerplate (Next + Strapi).** Этап 0 выполнен: CMS-слой,
imgproxy и Meilisearch удалены из кода, compose и CI. `docs/03`, `04`, `08`, `10` переписаны;
хвост остался в `docs/13` (помечен баннером).

## Стек

- **Frontend**: Next.js 15, **Pages Router**, архитектура Feature-Sliced Design (`src/`).
  TypeScript, SCSS-модули, zustand, Zod. GSAP + Lenis для анимаций, WebGL2 (сырой, без three.js)
  для hero-сцены.
- **Ingestor**: отдельный Node-сервис (`services/ingestor`, пакет pnpm-воркспейса) —
  единственный потребитель Kafka через `gcn-kafka` **0.3.0** (на `kafkajs`; версия 1.x перешла
  на нативный librdkafka — в alpine это сборка из исходников, поэтому не обновляем).
  Нормализует сообщения и пишет в Postgres, миграции (`services/ingestor/sql/*.sql`) применяет
  сам при старте.
- **Данные**: Postgres. Реалтайм в браузер — SSE поверх `LISTEN/NOTIFY`.
- **AI-чат**: RAG на `pgvector` в том же Postgres, эмбеддинги — Ollama (`nomic-embed-text`),
  ответ — Ollama или Claude (`LLM_PROVIDER`). План и решения — [`docs/16-ai-chat.md`](docs/16-ai-chat.md).
- **Инфра**: Docker Compose, GitLab CI (ci-components), Ansible. Пакетный менеджер — pnpm.

## Команды

```bash
pnpm dev            # фронт (next dev, :3000)
pnpm build          # next build
pnpm check          # biome: линт + формат + порядок импортов (запускай после правок)
pnpm ingestor:dev   # воркер Kafka → Postgres (миграции применяются при старте)
pnpm --filter ingestor seed --loop   # моковый продюсер: событие раз в 2 с без Kafka
pnpm --filter ingestor kb:index      # база знаний AI-чата (нужна запущенная Ollama)
docker compose up -d         # весь стек локально (нужен .env, PROJECT_SLUG, ENVIRONMENT)
```

Node зафиксирован в `.nvmrc` = **v22.17.0**. Типчек — `tsc --noEmit -p tsconfig.json`.

## Сквозные особенности проекта

- **RSC нет** — это Pages Router; директивы `"use client"` декоративны. Серверный код — в
  `getServerSideProps`/`api/`-функциях, клиентский — компоненты + zustand-сторы.
- **FSD-раскладка**: `src/app` = слой инициализации (провайдеры/сторы, **не** App Router),
  `src/_pages` = слайсы страниц, `src/pages` = Next-роуты.
- **Данные приходят не из CMS, а из Kafka.** `getServerSideProps` делает прямой SELECT в
  Postgres (не HTTP-запрос к собственному API), результат кладётся в `pageProps.cms` и
  раздаётся через те же data-store-провайдеры, что и раньше.
- **SSE, а не WebSocket.** `/api/stream` держит один singleton-клиент `pg` с
  `LISTEN gcn_notice` на процесс и мультиплексирует уведомления подписчикам. В `NOTIFY` уходит
  только id (лимит payload — 8 КБ), строка добирается `SELECT`. Поддержан `Last-Event-ID`:
  после обрыва сервер доигрывает пропущенное.
- **Серверный слой БД — `src/shared/api/db/`**: пул и LISTEN-клиент кэшируются в `globalThis`
  (hot-reload иначе плодит соединения и слушателей), пагинация курсорная (`<epoch_ms>_<id>`),
  `payload` наружу не отдаётся.
- **Store ленты — не синглтон**: `NoticeFeedProvider` создаёт его на монтирование страницы сразу
  с SSR-данными. Серверный снимок zustand берётся из начального состояния, поэтому наполнить
  модульный store перед первым рендером нельзя — SSR отдал бы пустую ленту.
- **Скролл-контейнер ленты помечен `data-lenis-prevent`** — страницу скроллит Lenis, без атрибута
  колесо над лентой уходит в общий скролл. Позицию при подгрузке истории компенсируем сами
  (`overflow-anchor: none` + замер `scrollHeight` в `useLayoutEffect`).
- **Kafka даёт at-least-once** — дедупликация обязательна: `unique (topic, kafka_partition,
  kafka_offset)` + `ON CONFLICT DO NOTHING`.
- **Форматы топиков разнородны** — у парсеров всегда должен быть fallback (`kind: "unknown"`),
  незнакомое сообщение не роняет ни воркер, ни ленту.
- **Канвас hero живёт выше страницы в дереве** (в `_app`). Если положить его внутрь страницы,
  при переходе intro → background пересоздаётся WebGL-контекст: фриз и мигание. Канвас —
  fixed-слой с `z-index: 0`, поэтому страницы обязаны объявлять свой слой явно
  (`position: relative; z-index: 1`).
- **WebGL живёт в классе `HeroRenderer`, а не в хуках**: контекст, rAF, слушатели указателя и
  `destroy()` (с `WEBGL_lose_context` — иначе контекст держится до GC) в одном владельце, React
  только монтирует и переключает фазу. Шейдеры — TS-строки с комментарием `/* glsl */`,
  webpack-loader под `.glsl` не заводим.
- **Фаза hero — общий стор, таймлайны у каждого слоя свои.** `useHeroStore` (синглтон в
  `widgets/hero-metaballs`) хранит `intro | background`; текст (`widgets/hero-intro`), лента и
  канвас реагируют на неё каждый своим GSAP-таймлайном с `overwrite: "auto"`. Одного общего
  таймлайна с `.reverse()` нет намеренно: слои монтируются независимо, а карточки меняются
  потоком SSE — собранный один раз таймлайн указывал бы на устаревший DOM.
- **Скрытый слой закрываем `inert`, а не одной прозрачностью** — иначе он остаётся в таб-порядке
  и в дереве доступности. `main` в разметке ровно один (его отдаёт `TransitionLayout`).
- **Секреты GCN** (`GCN_CLIENT_ID` / `GCN_CLIENT_SECRET`) и `ANTHROPIC_API_KEY` — только
  серверные, никогда не `NEXT_PUBLIC_*`: из браузера к Kafka подключиться нельзя в принципе,
  а ключ API в бандле — чужой счёт за наш.
- **Кириллица**: `src/widgets/сursor/` содержит кириллическую `с` — не копируй как образец,
  новые пути только латиницей.
- **AI-чат** (`features/notice-chat` → `POST /api/chat` → `shared/api/chat` + `shared/api/llm`):
  - провайдер — конфигурация, а не код: `LlmProvider` с реализациями Ollama и Anthropic,
    выбор `LLM_PROVIDER`. Не завязывай логику на конкретную модель; эмбеддинги — всегда Ollama;
  - ответ — SSE из `POST` (`sources` → `delta`* → `done` | `error`), закрытие соединения
    обрывает генерацию; история живёт только в сторе модалки, на сервере не хранится;
  - всё, что пришло из циркуляров, — данные, а не инструкции (prompt injection); markdown
    рендерится с белым списком элементов, сырой HTML не пропускается;
  - публичный анонимный эндпоинт: лимиты по `X-Real-IP` и дневной потолок обязательны;
  - `kb:index` идемпотентен (`doc_hash`), на проде запускается фоном при каждом деплое.
- **Модалки — нативный `<dialog>` + `showModal()`**: фон inert, фокус заперт и возвращается сам.
  Глобальные хоткеи пропускают Esc, пока есть `dialog:modal`; Lenis на время модалки — `stop()`.
- **Брейкпоинты** дублируются в JS (`src/shared/config/breakpoints.ts`) и SCSS
  (`styles/vars/_breakpoints.scss`) — правь оба.

## Карта скиллов (`.claude/skills/`)

**Сборка / деплой**

- `new-project-from-boilerplate` — инициализация нового проекта из шаблона.
- `local-run` — локальный запуск (pnpm / docker compose).
- `ci-deploy` — GitLab-переменные, pipeline, ветки, Ansible.
- `docker-images` — сборка образов, BuildKit-секреты, npm-зеркало.

**Frontend**

- `code-conventions` — FSD, алиасы, импорты, модель данных, именование.
- `creating-a-component` — структура компонента, пропсы, `mod()`+`clsx`, слои.
- `writing-styles` — SCSS-модули, токены, `vw()`, `mq()`, типографика.
- `project-typing` — организация типов, утилитарные типы.
- `server-data-fetching` — флоу серверных запросов, изоляция ошибок, sitemap.
  ⚠️ Примеры на Strapi устарели, принцип (серверный слой + изоляция ошибок) актуален;
  оркестратор переехал в `src/shared/api/server-data/`.
- `animation` — GSAP + Lenis + ScrollTrigger + переходы; централизованная регистрация,
  cleanup при unmount. **Обязателен для ленты и hero.**
- `forms` — react-hook-form + Zod + примитивы + отправка.

**Качество / аудит**

- `web-quality-audit` — зонтичный аудит (perf/a11y/SEO/best-practices); ведёт к профильным скиллам.
- `performance` — загрузка/рантайм/ресурсы, `next/dynamic`, Lenis, nginx-кэш.
- `core-web-vitals` — LCP/INP/CLS.
- `accessibility` — WCAG 2.2: `sr-only()`, токены/`mq()`, reduced-motion для GSAP/Lenis.
- `best-practices` — безопасность/совместимость/качество, заголовки/CSP на nginx, pnpm/biome.

**Процессы**

- `mr-review` — ревью MR/PR: только Blocker/Major, «что не так → почему → как починить»,
  вывод на русском.

## Примеры и документация

- **План проекта**: [`docs/15-plan.md`](docs/15-plan.md) — архитектура, схема БД, этапы, риски.
- **AI-чат**: [`docs/16-ai-chat.md`](docs/16-ai-chat.md); env — [`docs/03`](docs/03-environment-variables.md),
  деплой и `kb:index` на проде — [`docs/08`](docs/08-ci-cd.md).
- **Frontend-примеры**: `docs/examples/` (компоненты, хуки, типы).
- Проектная документация — `docs/01..14-*.md`; документы с баннером ⚠️ описывают ещё
  boilerplate-конфигурацию. Сводный список подводных камней — [`docs/13-gotchas.md`](docs/13-gotchas.md).

## Cursor

Скиллы (`.claude/skills/`) — формат Claude Code. Для Cursor есть тонкие правила-указатели в
`.cursor/rules/*.mdc` (по одному на скилл, `alwaysApply: false`), которые ведут к тому же
`SKILL.md`. Источник правды — `SKILL.md`; правила Cursor не дублируют контент.
