# Формирование sitemap.xml

Как строится `sitemap.xml` в этом проекте (Next.js Pages Router + Strapi): умный обход
`src/pages`, обход коллекций CMS (реестр + конвенция `[slug]`), XML-экранирование и кэш
до webhook-инвалидации.

- Реализация: [`src/shared/api/sitemap/`](../src/shared/api/sitemap/)
- Роут: [`src/pages/sitemap.xml.ts`](../src/pages/sitemap.xml.ts)
- Инвалидация: [`src/pages/api/revalidate.ts`](../src/pages/api/revalidate.ts)
- Связанное: [`src/pages/robots.txt.ts`](../src/pages/robots.txt.ts), кэш — [11-server-cache.md](./11-server-cache.md).

## Почему не `getStaticProps`

`getStaticProps` рендерит React-страницу как HTML и не даёт `res.write` с `Content-Type: text/xml`.
Поэтому `/sitemap.xml` отдаётся через `getServerSideProps` + серверный `cached("sitemap")` с
долгим TTL (год) до явного `invalidate` из webhook — для краулера это статичный XML.

## Источники URL

### 1. Статические маршруты — скан `src/pages`

Рекурсивный обход (не наивный `readdir` верхнего уровня):

- `index.tsx` → `/`, `about.tsx` → `/about`, `foo/bar.tsx` → `/foo/bar`
- Исключены: `_app`, `_document`, `404`, `500`, `api/**`, `*.xml.ts`, `robots.txt.ts`, динамические сегменты

### 2. Динамика Strapi — реестр **и** конвенция

Два способа добавить URL из CMS. Сначала скан находит файлы `[slug].tsx` (конвенция), затем
накладывается явный реестр [`COLLECTIONS`](../src/shared/api/sitemap/collections.ts) — при
совпадении **uid** реестр перекрывает конвенцию.

Обход каждой коллекции: `fields: ["slug", "updatedAt"]`, `status: "published"`, `pageSize: 100`,
пагинация до пустой/короткой страницы, `Promise.allSettled` (падение одной коллекции не роняет карту).

### Исключение `noindex`-страниц

Страница, закрытая от индексации в CMS (`seo.noindex`), в карту **не попадает** — иначе sitemap
предлагает поисковику ровно то, что от него закрыто.

- **Коллекции** — флаг проверяется при обходе: к запросу добавлен `populate: { seo: { fields: ["noindex"] } }`
  (только boolean, не весь SEO-компонент), запись с `noindex` пропускается.
- **Статика** — маршруты приходят из файловой системы, и флаг брать неоткуда, поэтому связь
  «маршрут → single type» объявляется явно в реестре
  [`STATIC_PAGE_SEO`](../src/shared/api/sitemap/static-pages.ts):
  ```ts
  export const STATIC_PAGE_SEO = [
    { path: "/", uid: "home-page" },
    // { path: "/about", uid: "about-page" },
  ];
  ```
  Незарегистрированный роут всегда попадает в карту. Добавляешь страницу с SEO-компонентом —
  зарегистрируй её здесь.

⚠️ **Почему фильтр в JS, а не `filters: { seo: { noindex: { $ne: true } } }` в запросе.** Компонент
`seo` у записи может отсутствовать — тогда в SQL сравнение `NULL != true` даёт `NULL`, и такая
запись **молча выпадет** из карты. Потерять реальную страницу хуже, чем оставить лишнюю, поэтому
тянем один boolean и исключаем **только явный `true`** (`=== true`): `null`, `undefined` и
отсутствие `seo` в карту проходят. По той же причине ошибка чтения single type не исключает
страницу (fail open).

Пока нет `[slug].tsx` и пустой реестр — в карте только статика (`/`, `/about`).

#### Конвенция: имя папки = uid коллекции

Правило: файл роута называется именно `[slug].tsx` (не `[id]`, не `[[...slug]]`), а **последний
статичный сегмент пути** совпадает с **plural API id** коллекции в Strapi (`info.pluralName` /
`collection(...)` uid).

```
src/pages/<uid>/[slug].tsx
→ Strapi: strapiClient.collection("<uid>")
→ URL:    /<uid>/<значение-поля-slug>
```

**Пример 1 — простой**

```
src/pages/products/[slug].tsx
```

| Что | Значение |
|-----|----------|
| Файл роута | `src/pages/products/[slug].tsx` |
| Strapi collection uid | `products` |
| Поле в CMS | `slug` (обязательно), draft & publish |
| Запись в Strapi | `slug: "wooden-chair"` |
| URL в sitemap | `https://<origin>/products/wooden-chair` |
| `<lastmod>` | `updatedAt` этой записи |

**Пример 2 — вложенный путь**

Uid берётся из **последнего** сегмента; префикс URL — весь путь до `[slug]`:

```
src/pages/blog/posts/[slug].tsx
```

| Что | Значение |
|-----|----------|
| Strapi collection uid | `posts` (не `blog`) |
| Запись | `slug: "hello-world"` |
| URL в sitemap | `https://<origin>/blog/posts/hello-world` |

**Чеклист, чтобы конвенция сработала**

1. В schema коллекции есть атрибут `slug` (string/uid).
2. Включены draft & publish — в карту попадают только `published`.
3. Plural API id совпадает с сегментом папки: коллекция `products` → папка `products/`.
4. Роут: `src/pages/<…>/<uid>/[slug].tsx` — именно имя файла `[slug].tsx`.
5. После первого publish настроен webhook (см. ниже), иначе кэш sitemap не сбросится.

**Что конвенция не подхватит**

| Случай | Почему | Что делать |
|--------|--------|------------|
| `src/pages/products/[id].tsx` | параметр не `[slug]` | переименовать в `[slug].tsx` или запись в `COLLECTIONS` |
| `src/pages/blog/[slug].tsx`, а uid в Strapi = `articles` | папка `blog` ≠ uid `articles` | реестр (см. ниже) |
| `src/pages/[slug].tsx` в корне | нет родительского сегмента-uid | вынести в папку или реестр |
| У коллекции нет поля `slug` | crawl пропускает записи без slug | добавить `slug` в schema |
| Черновик без publish | `status: "published"` | опубликовать запись |

#### Реестр — когда путь ≠ uid

Если URL на сайте не совпадает с uid коллекции, опиши маппинг явно в
[`collections.ts`](../src/shared/api/sitemap/collections.ts):

```ts
export const COLLECTIONS: SitemapCollection[] = [
  // Strapi uid "articles", публичный путь /blog/:slug
  { uid: "articles", toPath: (slug) => `/blog/${slug}` },

  // Можно и совпадающий с конвенцией путь — реестр просто зафиксирует его явно
  // { uid: "products", toPath: (slug) => `/products/${slug}` },
];
```

При конфликте uid (и конвенция нашла `products/[slug].tsx`, и в реестре есть `products`) —
используется **`toPath` из реестра**.

### 3. XML

Экранирование `& < >` в `<loc>` / `<lastmod>`. `lastmod` из `updatedAt` записи, без фиктивного
`priority: 1.0` на всех URL.

## Кэш и webhook

```ts
await cached("sitemap", buildSitemapEntries, { ttlMs: SITEMAP_CACHE_TTL_MS });
// Cache-Control: public, s-maxage=86400, stale-while-revalidate
```

Пересборка набора URL sitemap — только когда в Strapi страница **появилась или исчезла**:

| Событие | Действие для sitemap |
|---------|----------|
| `entry.create` / `entry.delete` / `entry.publish` / `entry.unpublish` | `invalidate("sitemap")` |
| `entry.update` | sitemap не трогаем (набор URL не меняется) |
| ручной `POST` без `event` | `invalidateAll()` |

> Технически sitemap — это **тег кэша** (`CACHE_TAGS.sitemap`), как и остальной контент: запись
> помечается им в `sitemap.xml.ts`, а `/api/revalidate` сбрасывает теги по карте «модель → теги»
> (`src/shared/api/cache/tags.ts`). Тег `sitemap` отфильтровывается на событиях, не меняющих набор
> URL (`entry.update`). Подробнее — скилл `caching-and-isr`.

### Настройка webhook в Strapi

1. Добавь `REVALIDATE_SECRET` в `.env` фронта (и в GitLab / `frontend.env.tpl`).
2. Strapi Admin → Settings → Webhooks → Create:
   - URL: `https://<frontend-origin>/api/revalidate`
   - Headers: `Authorization: Bearer <REVALIDATE_SECRET>`
   - Events: Entry create, delete, publish, unpublish
3. Проверка: `POST /api/revalidate` без секрета → `401`; с секретом и телом
   `{ "event": "entry.publish", "model": "product" }` → `{ revalidated: true, tags: ["sitemap", "page-content"] }`;
   тело `{ "event": "entry.update", "model": "product" }` → `tags: ["page-content"]` (карта не трогается);
   тело `{ "event": "entry.update", "model": "common" }` → `tags: ["common"]`.

## Связь с robots.txt

`robots.txt.ts` отдаёт `Sitemap: <origin>/sitemap.xml` только в production и `Disallow: /` вне
прода — карта имеет смысл только там, где сайт открыт для индексации.

## Проверка

- `/sitemap.xml` — валидный XML без `%5B…%5D` и без служебных путей.
- Повторный запрос не ходит в Strapi (хит кэша).
- После webhook create/publish следующий GET пересобирает карту.
- Крупная коллекция (>25 записей) присутствует целиком — пагинация работает.
- `&` в URL экранирован как `&amp;`.
- Поставил записи `seo.noindex` в CMS → после инвалидации её URL пропал из карты, а записи
  **без** SEO-компонента остались на месте (проверять обязательно: это защита от «тихой» потери страниц).

## Ссылки

- [Протокол sitemaps.org](https://www.sitemaps.org/protocol.html)
- Оптимизация запросов и кэш — скилл `server-data-fetching`, [11-server-cache.md](./11-server-cache.md).
