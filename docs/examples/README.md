# Эталонные файлы для AI-контекста — Frontend

Каноничные образцы соглашений фронтенда, сгруппированные по топикам. Каждый топик содержит
пример(ы) кода (`.example.ts`/`.tsx`/`.scss` — реальный код, проходит типизацию) и `docs.md`
со ссылками на внешнюю документацию. Скиллы в `.claude/skills/` ссылаются сюда.

| Топик | Файлы | Скилл |
|---|---|---|
| **component/** | [component.example.tsx](component/component.example.tsx), [component.example.module.scss](component/component.example.module.scss), [docs.md](component/docs.md) | `creating-a-component`, `writing-styles` |
| **hook/** | [hook.example.ts](hook/hook.example.ts), [docs.md](hook/docs.md) | `code-conventions` |
| **api-query/** | [api-query.example.ts](api-query/api-query.example.ts), [docs.md](api-query/docs.md) | `strapi-frontend-typing` |
| **optimized-fetcher/** | [optimized-fetcher.example.ts](optimized-fetcher/optimized-fetcher.example.ts), [docs.md](optimized-fetcher/docs.md) | `server-data-fetching` |
| **cached-fetcher/** | [cache-tags.example.ts](cached-fetcher/cache-tags.example.ts), [cached-fetcher.example.ts](cached-fetcher/cached-fetcher.example.ts), [isr-revalidate.example.ts](cached-fetcher/isr-revalidate.example.ts), [docs.md](cached-fetcher/docs.md) | `caching-and-isr` |
| **types/** | [types.example.ts](types/types.example.ts), [docs.md](types/docs.md) | `project-typing` |

Примеры и документация по Strapi-бэкенду — в [`@strapi/docs/`](../../@strapi/docs/README.md)
(та же структура: топик → `*.example` + `docs.md`).
