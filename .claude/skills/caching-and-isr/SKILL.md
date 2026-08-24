---
name: caching-and-isr
description: >-
  Caching + rendering strategy for server data in this project (Next.js Pages Router + Strapi):
  WHAT to cache and for how long (global rarely-changing data vs catalog filtering vs per-request),
  the short-TTL + single-flight pattern for listings, moving content pages from getServerSideProps to
  ISR (getStaticProps + revalidate), and propagating changes via the Strapi revalidate webhook
  BY KEY (lru-cache invalidate + on-demand ISR path revalidation). Mechanics of cached()/populate live
  in server-data-fetching; this skill is the decisions layer. Use ALWAYS when deciding whether to cache
  a request, picking a TTL, "should I cache catalog filtering / search / a filtered listing", moving a
  page to ISR / getStaticProps / revalidate, wiring or extending /api/revalidate, invalidating a cache
  key on a Strapi webhook, on-demand revalidation, "stale header after editing in CMS", "the listing
  hits Strapi on every request".
---

# Caching & rendering strategy (Pages Router + Strapi)

This is the **decisions layer**: *what* to cache, for *how long*, and *SSR vs ISR*. The **mechanics** —
the `cached()` helper, lru-cache options, `fields`/`populate` trimming — live in
[server-data-fetching](../server-data-fetching/SKILL.md); read it for the how, read this for the when.

**Battle-tested reference code** (tags, `cachedFetcher`, ISR path invalidation) is extracted from a
production project into [docs/examples/cached-fetcher/](../../../docs/examples/cached-fetcher/docs.md) —
read it before designing an invalidation scheme; it has the gotchas that only show up in production
(globalThis tag map, invalidation order, slug renames, `notFound` caching a Strapi outage).

Today the project is **100% `getServerSideProps`** (no ISR anywhere), and the only cached loaders are
`getCommonData` (key `"common"`) and the sitemap (`SITEMAP_CACHE_KEY`). Everything below builds on that.

## 1. What to cache, and for how long

Cache value = **hit-rate × cost**. Cache risk = **staleness tolerance × key cardinality**. Score each
request on those axes instead of caching everything or nothing.

| Request type | Hit-rate | Cardinality | Recommendation |
|---|---|---|---|
| **Global, rarely-changing** — header/footer/menu/settings/global SEO (`getCommonData`) | very high | 1 key | **Cache, minutes-long TTL**, invalidate on webhook. ✅ already done (`cached("common", …)`, TTL 60s) |
| **Content entity by slug** — product/article page | high per slug | bounded (# published) | **Short-medium cache, or move to ISR** (§3 — usually the better answer) |
| **Default listing** — catalog page 1, no filters | high | 1–few keys | **Cache, short TTL (30–60s)**. Cheap, high reuse |
| **SEO-filter pages** — path-based, allow-listed, indexable (`/catalog/kitchens/white/`) | medium | bounded allow-list | Treat like content pages / ISR |
| **User filters & sort** — arbitrary query combos | low | **unbounded** | **Don't cache long.** Tiny TTL for burst-dedup only (§2), or skip |
| **Draft / preview** (`status: "draft"`) | — | — | **Never cache** — editors must see edits instantly (already the rule) |

The global-data cache is the multiplied win at near-zero risk; do it first. Per-request caching is a
scalpel, not a default.

## 2. Should you cache catalog filtering? (short answer: briefly, and carefully)

**Yes — but only ~10–30s, with a normalized, bounded key, and mainly for the single-flight benefit,
not long-term reuse.**

Reasoning: user filters/sort are an **unbounded key space** (every combination is a new key), so a long
TTL both bloats memory and rarely gets a second hit before it's stale. But two things still make a *tiny*
TTL worth it:
- **single-flight** — concurrent identical requests (a bot crawling facets, a double-submit, back/forward
  pagination) collapse into **one** Strapi call (`cached()` shares one promise per key);
- **burst absorption** — a short window dedupes repeated identical hits without meaningful staleness.

Do it safely:
- **Normalize the key** so equivalent requests share it: sort the filter params, clamp `pageSize`, drop
  tracking/UTM. `products:list:{sortedFilters}:{page}` — never the raw query string.
- **Keep `max` bounded** (the cache is already `max: 200` LRU) so unbounded combos just evict, not grow.
- **Short TTL**: `cached(key, loader, { ttlMs: 15_000 })`.
- **User filters are `noindex` anyway** (see [seo](../seo/SKILL.md)) — so this is about server load, not SEO.

```ts
// listing fetcher — normalize, then cache briefly for burst-dedup (NOT long reuse)
const norm = normalizeListingParams(query); // sort filters, clamp pageSize, strip tracking
const key = `products:list:${norm.filters}:${norm.page}`;
const products = await cached(key, () => getProducts(norm), { ttlMs: 15_000 });
```

**Don't** cache arbitrary filters with a minutes-long TTL, and **don't** cache draft/preview.

## 3. Moving content pages to ISR

Content pages that don't need per-request data are better served **static + revalidated** than SSR-on-
every-hit: HTML comes from disk/CDN, Strapi is touched only on (re)build/revalidate, and TTFB/LCP drop.

**Good ISR candidates:** home, about, `products/[slug]`, articles, path-based SEO-filter listings.

**Migration shape** (Pages Router — `getServerSideProps` → `getStaticProps` + `getStaticPaths`):

```ts
// src/pages/products/[slug].tsx
export const getStaticProps = async ({ params, draftMode }) => {
  const status = draftMode ? "draft" : "published";
  const { commonData, product } = await getServerSidePropsData(
    { product: () => getProduct(String(params?.slug), { status }) },
    { isDraftMode: Boolean(draftMode) },
  ); // getCommonData is still lru-cached at build/revalidate time
  if (!product) return { notFound: true };          // 404 for missing/unpublished
  return {
    props: { cms: { commonData, product, pageSeoData: product.seo ?? null } },
    revalidate: 300,                                 // time-based SAFETY NET (see §4 for instant)
  };
};

export const getStaticPaths = async () => ({
  paths: [],              // don't pre-render at build; generate on first hit
  fallback: "blocking",   // new slugs render on-demand, then cache
});
```

**Keep as SSR — do NOT convert:**
- `sitemap.xml.ts`, `robots.txt.ts` — need `res.write` + `text/xml`/`text/plain`; `getStaticProps`
  renders a React page, so these stay `getServerSideProps` + `cached()` (see [docs/12-sitemap.md](../../../docs/12-sitemap.md)).
- `pages/api/*` — API routes.
- Anything that becomes per-request later (auth, personalization, live search).

**Preview must keep working:** branch `getStaticProps` on `draftMode`/`previewData` (draft bypasses the
static/ISR cache), see [docs/07-strapi-preview.md](../../../docs/07-strapi-preview.md). `revalidate: N` alone
is only a lag-bounded safety net — pair it with on-demand revalidation (§4) so publishes appear instantly.

## 4. Revalidate BY KEY from the Strapi webhook

There are **two** things a Strapi change can invalidate, and the webhook should drive both:

| Mechanism | API | Purpose |
|---|---|---|
| **lru-cache tag** | `invalidateTags([...])` / `invalidate(key)` / `invalidateAll()` ([cache/](../../../src/shared/api/cache/)) | drop cached loader results marked with a tag |
| **ISR path** | `await res.revalidate("/products/" + slug)` | rebuild a specific static page on demand |

**Current state — tag-based** ([`cache/tags.ts`](../../../src/shared/api/cache/tags.ts) +
[`api/revalidate.ts`](../../../src/pages/api/revalidate.ts), secret-checked via `REVALIDATE_SECRET` +
`timingSafeEqual`):

- **Why tags, not "model → one key":** the relation is many-to-many. One dictionary (contacts,
  categories) surfaces in several sources; one collection affects several subsystems (products =
  cards + sitemap). Keys can't express that; tags can.
- `CACHE_TAGS` = `common` | `sitemap` | `page-content` | `dictionaries`. `MODEL_TAGS` maps each
  Strapi uid to its tags; **an unknown model invalidates everything** (a missed invalidation is more
  expensive than one extra refetch).
- Cached entries **must** pass `tags` — an untagged entry is invisible to `invalidateTags()` and will
  live out its full TTL. Both current call sites are tagged (`getCommonData` → `common`,
  `sitemap.xml` → `sitemap`).
- The `sitemap` tag is dropped for non-URL-set events: `entry.update` on a product changes content,
  not the URL set, and rebuilding the map is a full collection crawl.
- Request forms: Strapi payload `{ event, model|uid }` → tags by model; `{ "tags": ["common"] }` →
  manual, takes priority; `{}` → `invalidateAll()`. Response: `{ revalidated, tags, removed }`.

**To extend it:** add the model's uid row to `MODEL_TAGS`, and pass matching `tags` when caching.

`cachedFetcher(key, fetcher, { tags })` wraps a fetcher **keeping its signature** — adopting the cache
is a rename (`getX` → `getXUncached`), no call sites change. Only for fetchers whose result depends on
`status` alone; anything taking a slug/page/filters must build the key by hand via `cached()`.

**Still a TODO — ISR on-demand path revalidation** (project is all-SSR today, so there's nothing to
revalidate yet). Once pages move to ISR (§3), add path revalidation alongside the key invalidation,
**reusing the sitemap `COLLECTIONS` `toPath`** so URL shape has one source of truth:
```ts
// in the handler, after auth — once ISR pages exist:
const path = collectionPathFor(model, slug); // e.g. COLLECTIONS toPath
if (path) await res.revalidate(path);
await res.revalidate("/products");            // the affected listing too
```

Configure the webhook in Strapi Admin → Settings → Webhooks (URL `/api/revalidate`,
`Authorization: Bearer <REVALIDATE_SECRET>`). Keep the event set aligned with what actually changes URLs
vs content (see the sitemap doc's table).

## 5. Precise `populate` / `fields` (fetch only what you use)

Caching hides a heavy query; it doesn't make it cheap on a miss. Trim the request too — this is the
[server-data-fetching](../server-data-fetching/SKILL.md) Step 4 playbook, in one line each:

- **`fields` on the collection** — else every column. `getProducts` uses `["title","slug","price"]`.
- **Explicit `populate`, never `"*"`** — media via `mediaBreakpointsPopulate` / `MEDIA_FIELDS`
  (`["url","width","height","mime","alternativeText"]`), relations with their own `fields`.
- **`pagination` + `withCount: false`** — without pagination Strapi silently truncates to `defaultLimit`
  (~25); drop the `COUNT(*)` when you don't render a total.
- **Grep consumers before trimming media `formats`** — srcSet is built from `url` via imgproxy, not from
  Strapi `formats` (see [responsive-images](../responsive-images/SKILL.md)).

**Order of work:** cache first (multiplied win, zero layout risk), then trim `fields`/`populate` (needs
checking every consumer). Do them in that order.

## Decision checklist

- [ ] Is this **global & rarely-changing**? → cache with a minutes TTL + webhook invalidation.
- [ ] Is this a **content page** with no per-request data? → prefer **ISR** over SSR+cache.
- [ ] Is this a **user-filtered listing**? → tiny TTL (burst-dedup) with a **normalized, bounded** key, or skip.
- [ ] Is this **draft/preview**? → **never** cache.
- [ ] Does a CMS edit need to show up instantly? → wire the **webhook by key** (cache key and/or ISR path).
- [ ] Did I also **trim `fields`/`populate`**, not just cache the fat query?

## Don'ts

- **Don't cache draft/preview** — editors stop seeing changes.
- **Don't cache arbitrary user-filter combos with a long TTL** — unbounded keys, near-zero reuse; normalize + tiny TTL or skip.
- **Don't convert `sitemap.xml`/`robots.txt`/`api/*` to ISR** — they need `res.write`, not a React page.
- **Don't rely on `revalidate: N` alone** for freshness — it's a lag-bounded safety net; add on-demand revalidation.
- **Don't cache without `tags`** — an untagged entry is invisible to `invalidateTags()` and lives out its full TTL; also register the model in `MODEL_TAGS`.
- **Don't duplicate URL shape** — reuse the sitemap `COLLECTIONS` `toPath` for ISR revalidation paths.
- **Don't trust the in-memory cache across replicas** — each has its own; for scale, swap the store for Redis behind `cached()`.

## Related

- [server-data-fetching](../server-data-fetching/SKILL.md) — the mechanics: `cached()`, orchestrator, populate/fields, sitemap.
- [seo](../seo/SKILL.md) — user filters are `noindex`; SEO-filters are indexable path pages.
- Docs: [11-server-cache.md](../../../docs/11-server-cache.md), [12-sitemap.md](../../../docs/12-sitemap.md), [07-strapi-preview.md](../../../docs/07-strapi-preview.md).
