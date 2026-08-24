---
name: project-typing
description: >-
  How the project's typing is organized: where types live (shared/types + slices' model/), file
  naming (types.ts prevails over type.ts), the domain/api/ui split, utility types
  (Nullable, Brand, ApiList, DynamicProps), typing of data from Postgres and Kafka. Use ALWAYS when you
  declare types, decide where to place a type, look for an existing utility type, type props/
  domain models/API responses — and before creating any new .ts with types in the frontend.
---

# Project Typing

Reference: [types.example.ts](../../../docs/examples/types/types.example.ts).
The shared utility barrel is `src/shared/types/index.ts` (alias `@shared/types`). The specifics of the
bridge to external data (Kafka payloads, Postgres rows) live in the slice that owns them.

## Where types live

- **Shared utility types** — `src/shared/types/index.ts` (import `@shared/types`).
- **SEO-layer types** — `src/shared/types/seo.ts` (`Seo`, `Organization`, `LinkSocial`, `SeoImage`).
- **Slice types** — in its `model/` segment (`entities/notice/model/types.ts`, `schemas.ts`) or alongside.
- **UI props** — inline in the component's `.tsx` (`type <Component>Props`), not in a separate file.

## Naming of type files

⚠️ The convention is **not fully** upheld. In practice: `types.ts` — 9 files (prevailing),
`type.ts` — 5 files; `.types.ts` and `.d.ts` are **not used** in `src/`. For a new slice type
file, prefer **`types.ts`** (or `model/schemas.ts` for a page's Zod schemas) —
for consistency. The shared barrel is always `index.ts`.

## The domain / api / ui split

There's no explicit three-layer split in the code, but follow the intent of FSD (the boundaries are maintained by hand):
- **api types** — the shape of the raw row/response: a `pg` result row, a parsed Kafka payload,
  the inferred result of the `getServerSidePropsData` orchestrator.
- **domain types** — domain models after adaptation: Zod-derived types in a slice's `model/`,
  the hand-written `Seo`/`Organization` in `shared/types/seo.ts`.
- **ui types** — component props (`<Component>Props`), e.g. `HomePageProps` in `model/schemas.ts`.

⚠️ The `getServerSidePropsData` orchestrator is now typed (the `as` cast in the route was removed). What remains
is the row→domain gap: a `pg` row is `any`-shaped, and the domain shape is set by the
consumer (`usePageData<{ homePage: HomePageProps }>()`). Close it with an explicit mapping in
`api/`/`adapters/` (a Zod `.parse` or a map function), not a bare `as`.

## Utility types (use the existing ones, don't spawn duplicates)

All in `src/shared/types/index.ts`:
- `Nullable<T>` = `T | null`
- `Brand<K, T>` and `EntityId = Brand<string, "EntityId">` — type-safe identifiers
- `ApiList<T>` = `{ items: T[]; total: number }`
- `ComponentOrTag<Props>`, `DynamicProps<Element>` — for polymorphic components (a `tag` prop)
- `BreakpointKeys`, `ElementSize` (`"xs"|"s"|"m"|"l"|"xl"`), `MediaType`

Missing (add to this same file if needed, not locally): `Maybe`, `DeepPartial`,
`PropsWithClassName`, `Optional`, `Prettify`. Of the "classics," only `Nullable` and `Brand` exist.

## Typing external data

Rows from Postgres and payloads from Kafka arrive untyped. Validate at the boundary with Zod and
derive the domain type via `z.infer` — one source of truth for the runtime check and the static
type. The result of page data is typed by the `getServerSidePropsData` orchestrator, so routes
need no casts. Details — [server-data-fetching](../server-data-fetching/SKILL.md).

## Gotchas

1. **Naming inconsistency** — `types.ts` vs `type.ts`. Stick with `types.ts`.
2. **Unchecked `as` casts** at the api→ui boundary — replace with mapping/validation.
3. **`@shared/types` resolves to `index.ts`**, not the folder — a deep import needs `@shared/types/seo`.
