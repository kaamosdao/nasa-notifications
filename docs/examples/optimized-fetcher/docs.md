# Docs — оптимизированный фетчер (fields / populate)

| Тема | Ссылка | Что там |
|---|---|---|
| REST: fields | https://docs.strapi.io/cms/api/rest#fields | Выбор конкретных колонок вместо всех |
| REST: populate | https://docs.strapi.io/cms/api/rest/populate-select | `populate` с `fields`, вложенность, вместо `"*"` |
| REST: pagination | https://docs.strapi.io/cms/api/rest/sort-pagination | `pagination`, `withCount` |
| @strapi/client (SDK) | https://docs.strapi.io/cms/api/client | Как это вызывать из `strapiClient` |

## Локальные ориентиры

- Хелперы: `src/shared/api/strapi/populate.ts` (`MEDIA_FIELDS`, `mediaBreakpointsPopulate`).
- Кэш общих данных: `src/shared/api/cache/` (lru-cache + теги).
- Базовый фетчер: [../api-query/api-query.example.ts](../api-query/api-query.example.ts).
- Скилл: `server-data-fetching`.
