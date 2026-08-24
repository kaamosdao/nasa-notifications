# Эталонные файлы для AI-контекста — Frontend

Каноничные образцы соглашений фронтенда, сгруппированные по топикам. Каждый топик содержит
пример(ы) кода (`.example.ts`/`.tsx`/`.scss` — реальный код, проходит типизацию) и `docs.md`
со ссылками на внешнюю документацию. Скиллы в `.claude/skills/` ссылаются сюда.

| Топик | Файлы | Скилл |
|---|---|---|
| **component/** | [component.example.tsx](component/component.example.tsx), [component.example.module.scss](component/component.example.module.scss), [docs.md](component/docs.md) | `creating-a-component`, `writing-styles` |
| **hook/** | [hook.example.ts](hook/hook.example.ts), [docs.md](hook/docs.md) | `code-conventions` |
| **types/** | [types.example.ts](types/types.example.ts), [docs.md](types/docs.md) | `project-typing` |

Примеры серверных запросов удалены вместе со Strapi-слоем: актуальный образец работы с
Postgres живёт в скилле [`server-data-fetching`](../../.claude/skills/server-data-fetching/SKILL.md).
