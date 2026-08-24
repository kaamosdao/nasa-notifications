# [AGENTS.md](http://AGENTS.md)

Ориентация для AI-агентов по этому репозиторию. Детальные плейбуки вынесены в **скиллы**
(`.claude/skills/`), которые Claude Code подхватывает автоматически по их описанию. Здесь —
только сквозной контекст и карта: не дублируй сюда содержимое скиллов.

## Стек

- **Frontend**: Next.js 15, **Pages Router**, архитектура Feature-Sliced Design (`src/`). TypeScript, SCSS-модули, zustand, Zod.
- **Backend (CMS)**: Strapi 5 (`@strapi/`), Postgres, imgproxy, Meilisearch.
- **Инфра**: Docker Compose, GitLab CI (ci-components), Ansible. Пакетный менеджер — pnpm.

## Команды

```bash
pnpm dev            # фронт (next dev, :3000)
pnpm build          # next build
pnpm check          # biome: линт + формат + порядок импортов (запускай после правок)
cd @strapi && pnpm develop   # Strapi (:1337/admin)
docker compose up -d         # весь стек локально (нужен .env, PROJECT_SLUG, ENVIRONMENT)
```

Node зафиксирован в `.nvmrc` = **v22.17.0**. Типчек — `tsc --noEmit -p tsconfig.json`.

## Сквозные особенности проекта

- **RSC нет** — это Pages Router; директивы `"use client"` декоративны. Серверный код — в
`getServerSideProps`/`api/`-функциях, клиентский — компоненты + zustand-сторы.
- **FSD-раскладка**: `src/app` = слой инициализации (провайдеры/сторы, **не** App Router),
`src/_pages` = слайсы страниц, `src/pages` = Next-роуты.
- **Мост типов Strapi→FE ручной**: генерённые `@strapi/types/generated/`* фронт НЕ импортирует;
доменные типы описываются Zod на границе `api/` (эталон — `getHomePage`).
- **Медиа**: backend-middleware `media-serializer` приводит `shared.media` к `{xs,sm,md,lg,default}`
(→ `MediaWithBreakpoints`). Моделируй FE-типы под это, а не под сырой Strapi-медиа.
- **Кириллица**: `src/widgets/сursor/` содержит кириллическую `с` — не копируй как образец, новые пути только латиницей.
- **Брейкпоинты** дублируются в JS (`src/shared/config/breakpoints.ts`) и SCSS (`styles/vars/_breakpoints.scss`) — правь оба.
- `@strapi` **исключён** из корневого tsconfig/biome. Примеры для бэка — файлы `.example` (вне компиляции) в `@strapi/docs/`.



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
- `strapi-frontend-typing` — мост Strapi→FE, Zod, оркестратор данных, `getCommonData`.
- `server-data-fetching` — флоу серверных запросов, изоляция ошибок, кэш, оптимизация `populate`/`fields`, sitemap.
- `caching-and-isr` — стратегия: что и насколько кэшировать (глобальные данные vs фильтрация каталога vs per-request), short-TTL + single-flight, перевод контентных страниц на ISR, revalidate-вебхук по ключу (lru-cache + ISR-путь).
- `animation` — GSAP + Lenis + ScrollTrigger + переходы; централизованная регистрация, cleanup при unmount.
- `forms` — react-hook-form + Zod + примитивы + отправка; подводные камни (Input не RHF-совместим, mailer не смаршрутизирован).
- `cms-content-rendering` — рендер Strapi-контента: Blocks / rich text / dynamic zone, санитайз и XSS.
- `responsive-images` — CMS-медиа через MediaImage + imgproxy: source/image/src, срсет/sizes, брейкпоинты.
- `seo` — SeoLayout, цепочка fallback (page seo → commonData.seo → APP_INFO), meta/OG/canonical/robots, компонент `widgets.seo` + `noindex`, env-гейт индексации, JSON-LD.

**Качество / аудит** (внешние WCAG/Lighthouse-скиллы, адаптированы под стек — секция «In this project» в каждом)

- `web-quality-audit` — зонтичный аудит (perf/a11y/SEO/best-practices); ведёт к профильным скиллам. `scripts/analyze.sh` сканирует статичный HTML — запускать по отданному дев-серверу, не по `.tsx`.
- `performance` — загрузка/рантайм/ресурсы: imgproxy/MediaImage, lru-cache, `next/dynamic`, Lenis, nginx-кэш.
- `core-web-vitals` — LCP/INP/CLS; ключевая правка — картинки через MediaImage+imgproxy, **не** `next/image`.
- `accessibility` — WCAG 2.2: `sr-only()`, токены/`mq()`, reduced-motion для GSAP/Lenis, a11y форм через `shared/ui`.
- `best-practices` — безопасность/совместимость/качество: XSS через CMS-HTML (`cms-content-rendering`), заголовки/CSP на nginx, pnpm/biome.

**Strapi backend**

- `creating-strapi-content-type` — сущности (schema.json, поля, связи, права).
- `creating-strapi-component` — переиспользуемые компоненты Strapi.
- `custom-strapi-route-controller` — кастомные роуты/контроллеры, `ctx`, ответы.
- `strapi-policy-middleware` — policy vs middleware, подключение, use case.
- `strapi-lifecycle-hooks` — хуки жизненного цикла, `event`, side effects.
- `strapi-custom-field` — кастомное поле с React-UI (плагин).

**Процессы**

- `mr-review` — ревью MR/PR: только Blocker/Major, «что не так → почему → как починить», вывод на русском.



## Примеры и документация

- **Frontend**: `docs/examples/` (компоненты, хуки, запросы, типы).
- **Strapi backend**: `@strapi/docs/` (Content Type, роуты/контроллеры, policy/middleware, lifecycle, custom fields + ссылки на офф. docs).
- Проектная документация — `docs/01..14-*.md`; сводный список подводных камней — [`docs/13-gotchas.md`](docs/13-gotchas.md); SEO — [`docs/14-seo.md`](docs/14-seo.md).



## Cursor

Скиллы (`.claude/skills/`) — формат Claude Code. Для Cursor есть тонкие правила-указатели в
`.cursor/rules/*.mdc` (по одному на скилл, `alwaysApply: false`), которые ведут к тому же `SKILL.md`.
Источник правды — `SKILL.md`; правила Cursor не дублируют контент.