---
name: seo
description: >-
  SEO in this project (Next.js Pages Router + Strapi): the SeoLayout widget, the mergeSeoData
  fallback chain (page seo → commonData.seo → APP_INFO), meta/OG/Twitter/canonical/robots tags,
  the widgets.seo Strapi component (title/description/ogImage/keywords/theme/structuredData/noindex),
  noindex + per-environment indexing gate, JSON-LD, sitemap/robots.txt. Use ALWAYS when adding or
  editing meta tags, title/description, canonical, Open Graph / social cards, robots / noindex,
  schema.org / JSON-LD, hreflang, per-page SEO, or "the OG image is broken", "wrong title",
  "page shouldn't be indexed", "add SEO fields to this page type", "link preview is empty".
---

# SEO (Next.js Pages Router + Strapi)

## The one principle

**SEO is never hand-assembled per page.** Every page type has predictable behavior with a
**fallback chain**, and an editor may override any field, but the site must render valid SEO with
zero manual fields. Empty strings and whitespace-only values count as **absent** (see `isEmpty`).

```
manual field (CMS)  →  page/entity data  →  parent/category  →  global site settings (commonData.seo)  →  build defaults (APP_INFO)
```

When you touch SEO, your job is to keep a page **on** this chain — never to special-case one page
with bespoke `<Head>` tags.

## What is already wired (don't rebuild it)

The subsystem lives in the `SeoLayout` widget, rendered once in [`src/pages/_app.tsx`](../../../src/pages/_app.tsx):

```
SeoLayout (src/widgets/seo-layout)
  ├─ OgTags   → og-tags.tsx + og-tags/utils.ts (mergeSeoData)   ← the fallback chain + all meta
  ├─ Favicons
  └─ LdJson   → ld-json.tsx                                     ← JSON-LD: parse → validate → escape
```

`_app.tsx` feeds it two inputs from page props:
- `commonSeoData = pageProps.cms.commonData.seo` — **global** site SEO (from `getCommonData`, cached).
- `pageSeoData = pageProps.cms.pageSeoData` — **this page's** SEO (top of the chain).

`mergeSeoData({ commonSeoData, pageSeoData })` in
[`og-tags/utils.ts`](../../../src/widgets/seo-layout/og-tags/utils.ts) resolves every field down
the chain and returns `{ title, description, keywords, ogImage, ogImageAlt, ogImageWidth,
ogImageHeight, siteName, theme, noindex, origin }`. [`og-tags.tsx`](../../../src/widgets/seo-layout/og-tags/og-tags.tsx)
renders from that: title, description, keywords, **robots**, theme-color, the full `og:*` set
(incl. `og:site_name`, `og:image` + `alt`/`width`/`height`), `twitter:*`, and `<link rel="canonical">`.

Already handled correctly today:
- **og:image is absolutized** (`toAbsoluteUrl`) — relative `/og.png` or `/uploads/...` become absolute
  public URLs. Social scrapers reject relative image URLs.
- **canonical is absolute**, `origin + asPath` with the query string stripped (`asPath.split("?")[0]`).
- **robots** = `index,follow` only when `APP_INFO.APP_ALLOW_INDEXING` **and** the page isn't `noindex`;
  otherwise `noindex,nofollow`.
- **Environment gate**: `APP_ALLOW_INDEXING` is `NEXT_PUBLIC_APP_ENV === "production"` — the **same**
  signal `src/pages/robots.txt.ts` uses. Test/preview are closed by default (meta robots **and** robots.txt).
- **noindex** is a boolean on the `widgets.seo` component (page-level), OR-ed with the global flag.

The Strapi component is [`@strapi/src/components/widgets/seo.json`](../../../@strapi/src/components/widgets/seo.json):
`title` (string), `description` (text), `ogImage` (media, single image), `keywords` (string),
`theme` (color), `structuredData` (json), `noindex` (boolean, default false). The FE type mirror is
[`Seo`](../../../src/shared/types/strapi-components/widgets.ts).

## Add SEO to a new page type (the whole task is 3 steps)

The home page is the reference. To give any page type its own SEO, replicate its wiring:

1. **Schema (CMS)** — add the seo component to the content-type's `schema.json`:
   ```json
   "seo": { "type": "component", "component": "widgets.seo", "repeatable": false }
   ```
   (`home-page` already has it. See the `creating-strapi-content-type` skill.)

2. **Fetcher** — populate it and validate it into the domain model. Reference:
   [`getHomePage.ts`](../../../src/_pages/home/api/getHomePage.ts) +
   [`schemas.ts`](../../../src/_pages/home/model/schemas.ts):
   ```ts
   // populate — pull ogImage media inside the seo component
   populate: { /* ...media... */, seo: { populate: "*" } },
   // Zod schema — external shape, validate loosely, guarantee null when absent
   seo: z.custom<Seo>().nullish().transform((v): Seo | null => v ?? null),
   ```

3. **Route** — hand it to `SeoLayout` via `cms.pageSeoData`. Reference:
   [`src/pages/index.tsx`](../../../src/pages/index.tsx):
   ```ts
   props: { cms: { commonData, myPage, pageSeoData: myPage?.seo ?? null } }
   ```

That's it — `_app.tsx` already reads `cms.pageSeoData`. Don't add `<Head>` tags in the page.

> ⚠️ For a **collection item** (`[slug].tsx`), `pageSeoData` is that entry's `seo` component, and
> the entity's own image should be the og:image fallback when the editor left `seo.ogImage` empty
> (map the entity image into `seo.ogImage` in the fetcher, or extend `mergeSeoData`'s image source).

## Studio conventions (defaults to design toward)

These are the agreed defaults from the studio SEO audit. Some are code today (above); the rest are
**conventions to honor per project** — don't invent divergent behavior.

**Title / description.** Home = brand + short positioning. Inner pages = `Page | Site` (dedup already
in `mergeSeoData` — identical page/base title isn't doubled). Catalog cards: add commercial params
(type, area, price, region) when present. Articles/events: title, lead, author, date/type. Don't
silently truncate — warn.

**Canonical & duplicate URLs.** Canonical is always absolute. Model sections and SEO-filters as
**path** (`/catalog/kitchens/white/`), not random query. Ordinary filters/sorts: `noindex,follow` or
canonical→base. SEO-filters: index only from an allow-list, each with its own
slug/title/description/canonical/sitemap rule.

**Query params use a per-route ALLOW-LIST** — `CANONICAL_PARAMS` in
[`og-tags/canonical.ts`](../../../src/widgets/seo-layout/og-tags/canonical.ts). Only listed params
survive into canonical; UTM/`fbclid`/`gclid`/debug/preview are dropped automatically. Allow-list, not
block-list: the tracker list is endless, the meaningful-param list is short and known.

**Pagination is implemented** for `/products` (`?page`): a paginated page canonicalizes **to itself**,
never to the base listing (canonicalizing page 2 → page 1 tells Google the deep items are duplicates,
and they may never get indexed). Normalizers drop `?page=1`, `?page=abc`, `?page=-5` back to the base
URL and collapse `?page=02` → `?page=2`; param order never changes the result; paginated pages get a
`… — страница N` title suffix. `PAGINATION_NOINDEX` switches to the `noindex,follow` strategy.

⚠️ **Two rules when allowing a param:** (1) the route MUST return different content for it — allowing
a param the server ignores creates a genuine duplicate (two indexable URLs, same content); (2) the
pagination controls must be real `<a href>`, not `router.push` buttons — otherwise bots never crawl
the deep pages no matter how correct the canonical is.

**Open Graph.** Every indexable page needs a valid OG image: public, absolute, no cookies/auth,
1200×630 (1.91:1). Fallback: page image → entity image → global OG. Emit `alt`/`width`/`height`
(done). Dynamic text/price OG images can come later; the base image must work now.

**Robots & indexing.** Prod open, test/preview closed (done via the env gate). Each page has a clear
mode: `index,follow` / `noindex,follow` / `noindex,nofollow`. Search, service pages, ordinary filters:
not indexed by default. A `noindex` page must not appear in sitemap. Editors can exclude a page via
the CMS `noindex` flag.

**Sitemap.** Built from real public pages (static + published CMS entries + SEO-filters + localized
URLs), canonical & indexable only, `lastmod` from real `updatedAt` (never today's date by default),
sitemap index for large projects, locale links for multilingual. **Already implemented** — see the
`server-data-fetching` skill and [docs/12-sitemap.md](../../../docs/12-sitemap.md).

**`noindex` exclusion is implemented too** (the two stay consistent): collection entries are filtered
during the crawl via `populate: { seo: { fields: ["noindex"] } }`, and static routes via the
`STATIC_PAGE_SEO` registry (`src/shared/api/sitemap/static-pages.ts`) — **register a static page there
when it gets a SEO component**, otherwise its `noindex` won't be honored in the map. The filter is
deliberately **fail-open**: only an explicit `true` excludes, so a missing `seo` component or a failed
read never silently drops a real page (a lost page is worse than a stray one).

**Schema.org / JSON-LD.** Generate base markup automatically from real CMS fields; manual JSON is a
last-resort extra. Today `LdJson` only outputs the manual `structuredData` — **auto-generation
is per-project**.

The Strapi field is declared `json` but **arrives as a hand-written string**, so `LdJson`
**parses → validates → re-serializes** it instead of passing it through: invalid JSON is dropped with
a console warning (broken markup shipped silently is worse than none), and every `<` is replaced with
its unicode escape so a `</script>` inside a value cannot break out of the script tag (the parser
decodes it back — the value itself is unchanged). An object input works
too, for when markup is built in code. **Don't bypass this** — never interpolate CMS content straight
into a `<script>`.

Types: `WebSite` (site), `Organization`/`LocalBusiness`/`Store` (company),
`CollectionPage`/`ItemList`/`BreadcrumbList` (catalog), `Product`/`Offer`/`Service`/`CreativeWork`
(card), `Article`/`BlogPosting`/`NewsArticle` (posts), `Event` (events). **Never** emit ratings,
reviews, prices, or availability that don't actually exist on the page.

**Organization data.** Keep one structured org block in global data (name, legal name, description,
logo, phone, email, address, geo, hours, socials). Reuse it for footer, contacts, and schema.org;
socials become `sameAs`. Don't emit empty fields into schema.org. `commonData` today carries
`socials`/`contacts` but **not** a full structured org block — add per project.

**Catalog / filters.** Separate SEO-filters from user filters. User filters: not indexed. SEO-filters:
deliberate, own URL/title/description/text/sitemap flag. Listing schema = current page's list, not the
whole catalog. Card schema from the card's own data; price/availability must match the visible page.

**Media / articles / events.** Each article/news/event gets its own title/description/canonical/OG.
Store author + publish date + updated date + lead + main image (articles); start/end/place/status/
organizer (events). On archive migration: map old→new URLs, add 301s, no old/new duplicates.

**Multilingual.** Per-locale canonical + `hreflang` alternates + sitemap locale links. Don't route
users or bots to an empty/non-equivalent translation. **Not implemented** (single locale today) — add
per project.

## Quality control (run before release)

Check the **HTML a bot receives** (view-source / curl), not just the rendered page, across a typed URL
set: home, catalog, ordinary filter, SEO-filter, card, article, event, contacts, pagination, 404,
preview. For each verify: `<title>`, `<meta name="description">`, `<link rel="canonical">` (absolute),
`<meta name="robots">`, the `og:*` set, JSON-LD, and presence/absence in `sitemap.xml`.

Treat as **errors**: empty SEO data, relative OG images, OG images behind auth/cookies, `noindex`
pages in sitemap, indexable technical pages. Before release, test link previews in messengers and the
social validators; validate schema.org (especially Organization, catalog, product, article, event).

```bash
# quick local checks
curl -s localhost:3000/ | grep -iE '<title>|og:image|canonical|name="robots"'
# prod-only: robots.txt opens the site, test/preview must Disallow: /
```

## Don'ts

- **Don't add per-page `<Head>` blocks.** Route SEO through `cms.pageSeoData` → `SeoLayout`.
- **Don't hardcode absolute image URLs** in CMS/data — let `toAbsoluteUrl` + the fallback chain do it.
- **Don't remove the query strip from canonical** without handling UTM/tracking explicitly first.
- **Don't emit fake structured data** — no invented ratings, prices, availability.
- **Don't open indexing on non-prod** — the env gate is deliberate; test/preview stay `noindex`.
- **Don't let a `noindex` page into the sitemap** — keep the two consistent.

## Related

- `server-data-fetching` — fetchers, populate/fields, orchestrator, sitemap crawl, cache.
- `strapi-frontend-typing` — the Strapi→FE Zod bridge (how `seo` is validated into the domain).
- `creating-strapi-content-type` / `creating-strapi-component` — adding the seo component to a schema.
- `cms-content-rendering` — sanitizing CMS HTML (JSON-LD is serialized, not user-editable HTML).
- Docs: [docs/14-seo.md](../../../docs/14-seo.md), [docs/12-sitemap.md](../../../docs/12-sitemap.md).
