---
name: server-data-fetching
description: >-
  The server-side data flow in this project (Next.js Pages Router + Postgres): the
  getServerSidePropsData orchestrator (typed request map + per-key error isolation), direct
  SELECTs from getServerSideProps (never HTTP to our own API), distribution through
  GlobalDataProvider/PageDataProvider, cursor pagination for the notice feed, and sitemap.
  Use ALWAYS when adding or editing server-side page data loading, slow SSR, a heavy query,
  duplicated queries across pages, pagination of the feed, sitemap — "the page takes forever
  to open", "the feed jumps when new events arrive", "how do I load this on the server".
---

# Server-side data (Next.js Pages Router + Postgres)

## Model and current flow

Pages Router → `getServerSideProps` runs **on every request** and has no built-in cache.
The flow (files are real):

```
route getServerSideProps (src/pages/*)
  → getServerSidePropsData({ notices: getLatestNotices })   // orchestrator
      └─ getLatestNotices()   // direct SELECT via the pg pool → domain model
  → props.cms { notices }
  → GlobalDataProvider (outside the transition) + PageDataProvider (inside TransitionLayout)
  → useGlobalData / usePageData
```

The orchestrator lives in `src/shared/api/server-data/`. It parallelizes requests
(`Promise.all`) and isolates errors per key: a failed request yields `null` for its own key
only, the rest arrive as usual. Type safety comes from the request map — no casts at the
call site.

## Rule 1. SSR queries the database directly

`getServerSideProps` runs **inside** the same Node process that serves `/api/*`. Calling our
own HTTP route from it adds a network hop, loses the stack trace on failure, and breaks when
the app is behind a proxy that rewrites the host. Import the query and call it.

HTTP routes (`/api/notices`) exist for the **browser** — for pagination and the SSE stream,
not for the server talking to itself.

## Rule 2. Cursor pagination, never OFFSET

The feed is continuously appended to at the top. With `OFFSET` the second page shifts by
exactly the number of events that arrived in between — the user sees duplicates or gaps, and
nothing errors. Paginate by the ordering key:

```sql
select * from notices
where (received_at, id) < ($1, $2)     -- the cursor of the last row already shown
order by received_at desc, id desc
limit $3;
```

`id` is part of the key because `received_at` is not unique — a batch of GW alerts lands in
the same millisecond, and without the tiebreaker rows repeat across pages.

The index `notices_feed_idx on notices (received_at desc, id desc)` matches this ordering;
changing the `ORDER BY` without changing the index turns every page into a sort of the table.

## Rule 3. One pool per process

`pg.Pool` is a singleton in `src/shared/api/db/`, pinned to `globalThis` — in dev, HMR
re-evaluates modules and a plain module-level pool leaks connections until Postgres refuses
new ones with `too many clients already`.

The `LISTEN gcn_notice` client is **separate from the pool** and also a singleton: a listening
connection is occupied for its whole lifetime, so taking it from the pool would starve it.

## Adding a server request

```ts
// entities/notice/api/get-latest-notices.ts
import { pool } from "@shared/api/db";
import { NoticeSchema } from "../model/schemas";

export const getLatestNotices = async (limit = 20) => {
  const { rows } = await pool.query(
    `select * from notices order by received_at desc, id desc limit $1`,
    [limit],
  );

  // Boundary "raw row → domain": validate, don't cast.
  return rows.map((row) => NoticeSchema.parse(mapRow(row)));
};
```

Wiring it up is one line in the orchestrator map:
`getServerSidePropsData({ notices: () => getLatestNotices() })`.

**Always parameterize.** String interpolation into SQL is an injection vector even when the
value "comes from our own code" — cursors and limits arrive from query strings.

**Clamp input.** A spoofed `limit` from the query will request the whole table:
`Math.min(Number(limit) || 20, 100)`.

## Serializing for props

`getServerSideProps` props must be JSON-serializable. `pg` returns `timestamptz` as a JS
`Date` and `bigint` columns as strings — a `Date` in props throws
`Error: cannot be serialized as JSON`. Map dates to ISO strings at the boundary (the domain
model already declares them as `string`).

## Sitemap

Implemented in `src/shared/api/sitemap/` + `src/pages/sitemap.xml.ts`: a recursive scan of
`src/pages` for static routes, XML-escaping of `& < >`, `Cache-Control` for a day. No
database involvement — events don't get their own URLs.
Details: [docs/12-sitemap.md](../../../docs/12-sitemap.md).

## Verifying the result

```bash
npx tsc --noEmit -p tsconfig.json        # types
pnpm check                               # biome
```

By hand: open the page with an empty database (must render, not 500), then with data; scroll
the history up twice and check that no notice appears twice — that's the pagination bug this
skill exists to prevent.

## What not to do

- **Don't call your own `/api/*` from `getServerSideProps`** — import the query.
- **Don't paginate the feed with `OFFSET`** — the result silently duplicates rows.
- **Don't create a pool per request or per module** — connections leak until Postgres refuses.
- **Don't take the `LISTEN` client from the pool** — it holds the connection forever.
- **Don't put a `Date` or `undefined` into props** — serialization throws at runtime, not build.
