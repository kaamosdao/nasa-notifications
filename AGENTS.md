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
imgproxy и Meilisearch удалены из кода, compose и CI. Хвост остался в документации —
`docs/03`, `04`, `08`, `10`, `13` помечены баннером и переписываются на этапе 5.

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
- **Инфра**: Docker Compose, GitLab CI (ci-components), Ansible. Пакетный менеджер — pnpm.

## Команды

```bash
pnpm dev            # фронт (next dev, :3000)
pnpm build          # next build
pnpm check          # biome: линт + формат + порядок импортов (запускай после правок)
pnpm ingestor:dev   # воркер Kafka → Postgres (миграции применяются при старте)
pnpm --filter ingestor seed --loop   # моковый продюсер: событие раз в 2 с без Kafka
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
  только id (лимит payload — 8 КБ), строка добирается `SELECT`.
- **Kafka даёт at-least-once** — дедупликация обязательна: `unique (topic, kafka_partition,
  kafka_offset)` + `ON CONFLICT DO NOTHING`.
- **Форматы топиков разнородны** — у парсеров всегда должен быть fallback (`kind: "unknown"`),
  незнакомое сообщение не роняет ни воркер, ни ленту.
- **Канвас hero живёт выше страницы в дереве** (в layout). Если положить его внутрь страницы,
  при переходе intro → background пересоздаётся WebGL-контекст: фриз и мигание.
- **Секреты GCN** (`GCN_CLIENT_ID` / `GCN_CLIENT_SECRET`) — только серверные, никогда не
  `NEXT_PUBLIC_*`: из браузера к Kafka подключиться нельзя в принципе.
- **Кириллица**: `src/widgets/сursor/` содержит кириллическую `с` — не копируй как образец,
  новые пути только латиницей.
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
- **Frontend-примеры**: `docs/examples/` (компоненты, хуки, типы).
- Проектная документация — `docs/01..14-*.md`; документы с баннером ⚠️ описывают ещё
  boilerplate-конфигурацию. Сводный список подводных камней — [`docs/13-gotchas.md`](docs/13-gotchas.md).

## Cursor

Скиллы (`.claude/skills/`) — формат Claude Code. Для Cursor есть тонкие правила-указатели в
`.cursor/rules/*.mdc` (по одному на скилл, `alwaysApply: false`), которые ведут к тому же
`SKILL.md`. Источник правды — `SKILL.md`; правила Cursor не дублируют контент.
