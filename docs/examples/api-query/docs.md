# Docs — типизированный запрос к Strapi

| Тема | Ссылка | Что там |
|---|---|---|
| @strapi/client (SDK) | https://docs.strapi.io/cms/api/client | `strapiClient.collection/single`, `find`, populate, pagination |
| Zod | https://zod.dev/ | Валидация и вывод типа (`z.infer`) на границе CMS→домен |
| getServerSideProps | https://nextjs.org/docs/pages/building-your-application/data-fetching/get-server-side-props | SSR-загрузка данных (проект на Pages Router) |

## Локальные ориентиры

- Живой аналог: `src/_pages/home/api/getHomePage.ts` (запрос + Zod-маппинг).
- Оркестратор: `src/shared/api/strapi/getServerSidePropsData.ts`.
- Скилл: `strapi-frontend-typing`.
