---
name: server-data-fetching
description: >-
  The server-side request flow to Strapi in this project (Next.js Pages Router): the
  getServerSidePropsData orchestrator (typed request map + error isolation), global data via
  getCommonData with lru-cache, distribution through GlobalDataProvider/PageDataProvider, and
  request OPTIMIZATION via fields/populate (trimming over-fetch, media, relations, pagination, N+1) + sitemap.
  Use ALWAYS when adding/editing server-side page data loading, slow SSR,
  a heavy Strapi response, duplicated requests across pages, over-fetching, populate/fields,
  caching of common data (header/footer/menu/settings), sitemap — "the page takes forever to open",
  "Strapi returns a megabyte of JSON", "the header loads on every page", "optimize populate".
---

# Server-side requests to Strapi (Next.js Pages Router)

## Model and current flow

Pages Router → `getServerSideProps` runs **on every request** and with no built-in cache.
Our flow (files are real):

```
route getServerSideProps (src/pages/*)
  → getServerSidePropsData({ homePage: getHomePage }, { isDraftMode })   // orchestrator
      ├─ getCommonData()      // global data (header/footer/SEO), lru-cache (SWR + single-flight)
      └─ getHomePage()        // page request: strapiClient + Zod safeParse → domain
  → props.cms { commonData, homePage }
  → GlobalDataProvider (common, outside the transition) + PageDataProvider (page, inside TransitionLayout)
  → useGlobalData / usePageData
```

The key properties of this flow (type safety without casts, per-key error isolation, caching of
global data) are described in [strapi-frontend-typing](../strapi-frontend-typing/SKILL.md) and
[code-conventions](../code-conventions/SKILL.md). Here it's **how to add requests and how to
optimize them**.

**Order of work matters: cache first, field trimming second.** Caching gives a multiplied win at zero
risk of breaking the layout; trimming `fields`/`populate` requires checking every field and can quietly
break images.

## Step 1. Request map

Before changing anything, understand what loads from where:
```bash
grep -rln "getServerSideProps" src/pages                    # SSR pages
grep -rln "strapiClient" src --include='*.ts'               # all Strapi fetchers
```
The orchestrator `src/shared/api/strapi/getServerSidePropsData.ts` pulls common + page requests —
the prime candidate for optimization. For each request, write out: collection → `fields` → `populate`
branches → `pagination`, and cross-check against the **schema** (`@strapi/src/api/*/content-types/*/schema.json`,
`@strapi/src/components/**/*.json`) and the **actual usage** (types + JSX).

## Step 2. Adding a server request

The reference is `src/_pages/home/api/getHomePage.ts`. The pattern (details in `strapi-frontend-typing`):
```ts
export const getProducts = async (opts?: { status?: "draft" | "published" }) => {
  const products = strapiClient.collection("products");
  const findOptions: Parameters<typeof products.find>[0] = {
    fields: ["title", "slug", "price"],          // don't pull every column
    populate: { image: { fields: MEDIA_FIELDS } }, // explicit fields, not "*"
    pagination: { page: 1, pageSize: 12, withCount: false },
  };
  if (opts?.status) findOptions.status = opts.status;
  const json = await products.find(findOptions);
  const parsed = ProductsSchema.safeParse(json.data);   // Zod mapping into the domain
  return parsed.success ? parsed.data : null;
};
```
Wiring it up is one line in the orchestrator map: `getServerSidePropsData({ homePage, products }, ...)`.
The orchestrator parallelizes (`Promise.all`), isolates errors (`settle`), and always mixes in `commonData`.
The full reference **with field trimming** — [optimized-fetcher.example.ts](../../../docs/examples/optimized-fetcher/optimized-fetcher.example.ts);
populate helpers — `src/shared/api/strapi/populate.ts`.

## Step 3. Cache of common data (lru-cache)

Global data (header/footer/menu/SEO) changes rarely but loads on every navigation.
The cache lives in `src/shared/api/cache/` on top of **lru-cache** (the `cached(key, loader, { tags })` helper),
and `getCommonData` uses it. Don't write the cache by hand — three things are easy to get wrong, and
lru-cache gives all three out of the box:

| What | Option | Why in our build |
|---|---|---|
| stale-while-revalidate | `allowStale: true` | the user instantly gets the previous value while the refresh runs in the background — SSR doesn't wait on Strapi for a stale record |
| single-flight | `fetchMethod` + `.fetch()` | concurrent requests for one key share ONE promise — a traffic spike/cold start doesn't hit Strapi in a burst |
| resilience to CMS failure | `noDeleteOnFetchRejection` | on error we return the last value instead of a 500 |
| memory bound | `max` | LRU eviction, the cache doesn't grow indefinitely |
| TTL | `ttl` | lifetime, configurable per key |

Rules:
- **Don't cache previews.** With `status: "draft"` bypass the cache — an editor must see edits immediately
  (implemented in `getCommonData`).
- **The instance is a singleton via `globalThis`**, otherwise HMR in dev spawns multiple caches (done in `cache.ts`).
- **The in-memory cache is per-instance.** With multiple frontend replicas each has its own; for a single
  container that's enough. When scaling — swap the store for Redis behind the same `cached()`.

**Webhook invalidation.** Instant reset instead of waiting for the TTL:
- cache each source under a **separate key** and **tag it**; `cache/` provides `invalidateTags([...])` /
  `invalidate(key)` / `invalidateAll()`. An **untagged** entry is invisible to the webhook and lives out its TTL;
- API route `src/pages/api/revalidate.ts` (POST, secret via `crypto.timingSafeEqual` + `REVALIDATE_SECRET`),
  accepting the Strapi webhook (`{ event, model, uid }`) and manual forms (no `event` → `invalidateAll()`);
- sitemap key `"sitemap"` is invalidated on `entry.create` / `entry.delete` / `entry.publish` /
  `entry.unpublish` only (URL set change); `entry.update` does not touch it;
- **content is invalidated by TAG**, via the `MODEL_TAGS` map (`cache/tags.ts`): a Strapi model maps to
  one or more tags (many-to-many — one dictionary feeds several sources), and an unknown model resets
  everything. Register new cached sources there; full strategy — [caching-and-isr](../caching-and-isr/SKILL.md);
- `cachedFetcher(key, fetcher, { tags })` adopts the cache by **renaming** the fetcher — no call-site changes;
- webhook is configured in Strapi Settings → Webhooks (see [docs/12-sitemap.md](../../../docs/12-sitemap.md)).

## Step 4. Optimizing populate / fields (the main thing about over-fetch)

`populate: "*"` and requests without `fields` are the primary source of heavy responses. Trim them, **but
first find every consumer of the field** (including post-processing), otherwise you'll quietly break images.

### Media — the biggest win

A naive media query does `populate: { media: { populate: { lg: { populate: "*" }, ... } } }` —
`"*"` pulls the whole file entity (`hash`, `ext`, `size`, `provider`, `provider_metadata`, `folderPath`,
dates). (`getHomePage` is already trimmed — it uses the helper below.) We build `srcSet` **via imgproxy from `url`** (`src/shared/ui/media-image/utils/get-sources.ts`),
NOT from Strapi `formats`. So an explicit list is enough:
```ts
const MEDIA_FIELDS = ["url", "width", "height", "mime", "alternativeText"];
// we do NOT read formats (imgproxy generates sizes from url) — check before removing:
//   grep -rn "formats" src/shared/ui/media-image src/shared/utils
```
Implemented in the project: `src/shared/api/strapi/populate.ts` (`MEDIA_FIELDS`, `mediaBreakpointsPopulate`);
`getHomePage` already uses it. Edit one helper → the effect lands in all fetchers at once.

⚠️ **Trap (verify for your case).** There's often post-processing between the API and the components. In our case:
the backend `media-serializer` middleware reshapes `shared.media` to `{xs,sm,md,lg,default}`, and the FE builds
srcSet via imgproxy. If FE normalization that reads `formats`/`source` appears in your slice —
`formats` will be needed again. Rule: **grep the consumers before trimming**.

### Relations and lists — a checklist

- **`fields` on the collection itself** — otherwise all columns.
- **`fields` on relations** — `populate: { category: true }` pulls the whole category; you need
  `{ category: { fields: ["name", "slug"] } }`.
- **`pagination`** — without it Strapi silently returns `defaultLimit` (~25) and the list is **truncated with no error**
  (dangerous for menus/cards).
- **`withCount: false`** — if `meta.pagination.total` isn't needed, this drops the extra `COUNT(*)` with joins.
- **Clamping input** — a spoofed `pageSize` from cookie/query will request hundreds of records: `slice(0, MAX)`.
- **N+1** — replace "list → a request per item in a loop" with a single request using `$in` + in-memory grouping.
- **Duplicates on a page** — one collection is often pulled 2-3 times (menu + cards + counter); consolidate them.

## Step 5. Sitemap

Implemented in `src/shared/api/sitemap/` + `src/pages/sitemap.xml.ts`:
- **Static routes** — smart recursive scan of `src/pages` (not a naive top-level `readdir` + `encodeURIComponent`).
- **Dynamic** — convention `src/pages/<uid>/[slug].tsx` + explicit `COLLECTIONS` registry (registry wins on uid clash).
- Crawl Strapi with pagination (`fields: ["slug","updatedAt"]`, `status: "published"`, exit when batch `< pageSize`).
- `Promise.allSettled` over collections, XML-escape `& < >`, `cached("sitemap")` until webhook invalidate.
- Details: [docs/12-sitemap.md](../../../docs/12-sitemap.md).

## Verifying the result

```bash
npx tsc --noEmit -p tsconfig.json        # types
pnpm check <changed files>               # biome
```
Record the baseline error level **before** the edits. Verify by hand: two requests in a row to a page → one
trip to Strapi (via the fetcher logs in dev); when trimming media — images and `srcSet` didn't break.

## What not to do

- **Don't trim fields "by grepping the components only"** — check the post-processing layer (in our case imgproxy/
  media-serializer), otherwise you'll break `srcSet` and responsive images.
- **Don't cache previews** (`status: "draft"`) — the editor will stop seeing edits.
- **Don't put "model → tags" in Strapi** — an extra backend deploy and a second source of truth; keep it on the frontend.
- **Don't rely on the in-memory cache with multiple replicas** — each has its own; for scale you need Redis.
- **Don't drop `pagination`** for simplicity — silent truncation of the list to `defaultLimit`.
