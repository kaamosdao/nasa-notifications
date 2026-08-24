# Подводные камни проекта (footguns)

> ⚠️ **Документ ещё описывает конфигурацию студийного boilerplate (Strapi / imgproxy /
> Meilisearch).** Эти сервисы удалены на этапе 0; документ будет переписан на этапе 5
> вместе с финальным деплоем. Источник правды по архитектуре — [план проекта](./15-plan.md).

Единый список неочевидных ловушек этого репозитория — то, что «работает локально, падает на проде»
или «выглядит правильно, но течёт». Сгруппировано по областям; детали и «как правильно» — в
соответствующих скиллах (`.claude/skills/`).

## Окружение и сборка фронта

- **Node пиньётся `.nvmrc` = `v22.17.0`.** Должен быть установлен (`nvm install v22.17.0`), иначе
  `cd` в проект в интерактивной оболочке роняет команды через nvm-хук.
- **`NEXT_PUBLIC_*` вшиваются на `next build`** (build-time), а не в рантайме. Смена значения на
  сервере без пересборки образа **не подхватится** клиентским кодом. Рантайм-переключение — только
  через серверный env в `getServerSideProps`/`getStaticProps` + пересоздание контейнера.
- **Токен Strapi — `NEXT_PUBLIC_STRAPI_API_TOKEN`** → попадает в клиентский бандл. Для рантайм-путей
  используй серверный (не `NEXT_PUBLIC_`) env. 
- **`pnpm check` = biome** (линт + формат + порядок импортов). Порядок импортов расставляет biome —
  вручную не трогай.
- **Брейкпоинты продублированы**: JS `src/shared/config/breakpoints.ts` и SCSS
  `src/shared/styles/vars/_breakpoints.scss`. Правь оба. (Скилл `writing-styles`.)
- **next.config `prependData: @use 'helpers'`** авто-инжектит только миксины/функции SCSS, но **не**
  CSS-токены (`--spacing-*` и т.п. объявлены в `:root`).
- **tsconfig: битые маппинги** `@shared/config/* → ./src/constants/*` и `@shared/styles/* → ./src/styles/*`
  (таких папок нет). Работает общий `@shared/* → ./src/shared/*`.

## Архитектура фронта

- **Это Pages Router, не App Router.** RSC нет; `"use client"` декоративны. Серверный код — в
  `getServerSideProps`/`api/`, клиентский — компоненты + zustand-сторы. (Скилл `code-conventions`.)
- **Три «pages»-сущности**: `src/app` = FSD-слой инициализации (провайдеры/сторы, **не** App Router);
  `src/_pages` = слайсы страниц; `src/pages` = Next-роуты.
- **Кириллица в путях**: `src/widgets/сursor/` — первая буква кириллическая `с` (U+0441); `emmiter` —
  опечатка. Ломает grep/автоимпорт. Новые имена — только латиница.
- **Анимации текут при навигации**: tween/ScrollTrigger/observer/listener без cleanup продолжает жить
  на следующей странице. Всё убивать на unmount (`.kill()`/`.revert()`). (Скилл `animation`.)
- **Скролл — не `window`**, а Lenis-контейнер `#scroll`. Подписка через `useScroll`, не
  `window.addEventListener("scroll")`. (Скилл `animation`.)

## Strapi и данные

- **Мост типов Strapi→FE ручной** (Zod). Генерённые `@strapi/types/generated/*` фронт не импортирует —
  дубли рассинхронизируются при правке схемы. 
- **`media-serializer` меняет форму медиа** на выходе: `shared.media` → `{ xs, sm, md, lg, default }`
  (`MediaWithBreakpoints`). Zod моделируй под это, не под сырой Strapi-медиа.
- **`srcSet` строится через imgproxy из `url`**, а не из Strapi `formats` → `formats` в `populate` обычно
  не нужен. (Скилл `server-data-fetching`.)
- **`getCommonData` требует опубликованный single-type `common`.** Иначе `commonData: null` (страница не
  падает, но глобальных данных нет).
- **HTML из CMS без санитайза = XSS.** `dangerouslySetInnerHTML`/парсер с данными Strapi — только через
  санитайз. 
- **Права Strapi — только в Admin UI** (роли/API-токен), не в коде. Забытое право = 403 на фронте.
  

## Docker и деплой

- **`docker compose up -d` (пересоздание), а не `restart`** — `restart` не перечитывает env_file.
  Новый env подхватывается только при пересоздании контейнера. (Скилл `local-run`.)
- **Образы тянутся с РФ-зеркал**: `dockerhub.timeweb.cloud/*` (Docker Hub заблокирован из раннера),
  npm — `npm-mirror.gitverse.ru`. Внешние образы вне этого окружения могут не подтянуться. (Скилл `docker-images`.)
- **Энтрипоинт Strapi — `node_modules/@strapi/strapi/bin/strapi.js`**, НЕ `.bin/strapi` (sh-shim →
  `SyntaxError`). Частая причина «Strapi падает на старте».
- **Backend runtime обязан иметь `NODE_ENV=production`**, иначе Strapi стартует в dev-режиме.
- **Prod-сборка образа требует BuildKit `--secret`** (env из секрета) + `# syntax=docker/dockerfile:1.6`.
- **`docker compose down -v` удаляет volume БД.** Снимай бэкап заранее.

## Тестирование

- **Тестов в проекте нет** (ни раннера, ни `*.test`/`*.spec`). `mr-review` не может опереться на «покрыто
  тестами». Стратегию тестирования нужно осознанно принять (см. рекомендации) — сейчас это молчаливая дыра.
