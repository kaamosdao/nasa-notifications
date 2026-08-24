---
name: strapi-frontend-typing
description: >-
  How typing works between Strapi (CMS) and the Next.js frontend: a manual bridge (generated Strapi
  types are NOT wired into the frontend), Zod schemas + adapters in shared/content-types, typed
  requests via @strapi/client (Parameters<typeof ...>), the getServerSidePropsData orchestrator
  (type inference from the request map + error isolation), global data via getCommonData with caching,
  populate and pagination. Use ALWAYS when writing a request to Strapi, typing a CMS response,
  adding a Content Type, mapping a raw response into a domain model, loading global/page
  data, working with populate/pagination/draft mode — and for any integration of Strapi data into the frontend.
---

# Strapi → Frontend Typing

**The key point: there is NO automatic type bridge.** Strapi 5 generates its own `.d.ts`
(`@strapi/types/generated/*`), but the frontend does **not** import them — these are two independent projects.
The Strapi↔frontend link is held together by **manual** TS + Zod and must be synced by hand when
schemas change. Reference request: [api-query.example.ts](../../../docs/examples/api-query/api-query.example.ts).
Related: general typing — [project-typing](../project-typing/SKILL.md); the server request flow,
caching, and `populate`/`fields` optimization — [server-data-fetching](../server-data-fetching/SKILL.md).

## How types are "generated"

- **Backend**: the built-in Strapi 5 mechanism (`@strapi/strapi` 5.x) writes, on `strapi build/develop`,
  `@strapi/types/generated/contentTypes.d.ts` and `components.d.ts` (module augmentation of
  `@strapi/strapi`). There are **no** third-party plugins (`strapi-plugin-schemas-to-ts` and the like).
- **Frontend**: these types are confined inside `@strapi/` and do **not** reach the frontend. Content types
  on the frontend are **manual**, in two places:
  - `src/shared/content-types/` — **Zod schemas + adapters** (runtime validation + `z.infer` type):
    `schemas/media.schema.ts` (`StrapiMediaSchema` → `type StrapiMedia`), `adapters/richText.adapter.ts`
    (`normalizeRichText`). The README there describes the intended layers `schemas/ → dto/ → mappers/`
    (⚠️ `dto/` and `mappers/` are not created yet — the implementation is incomplete).
  - `src/shared/types/strapi-components/` — **manual TS mirrors** of Strapi components (`Image`, `Seo`).

## Transport: only the `@strapi/client` SDK

The sole CMS client is **`@strapi/client`**. `strapiClient` is created once in
`src/shared/api/strapi/strapi-client.ts` (`strapi({ baseURL, auth })`). The
`data/attributes/meta/pagination/populate` types come **from the package**, not from the project.

⚠️ Historical note: the axios wrapper (`client.ts`), the `strapi-query.ts` helpers, and the
`rebuild/*` post-processor have been **removed** as unused dead code. Do not recreate them — the CMS uses
only the SDK. If you ever need a non-Strapi HTTP endpoint, introduce a narrow client deliberately.

## Typed request (the pattern)

The live reference is `src/_pages/home/api/getHomePage.ts`. Requests live in the `api/` segment of a slice
(`_pages/<page>/api`, `entities/<entity>/api`) or in `src/shared/api/strapi` for shared ones. Key techniques:
- **Infer** the request options type from the SDK; don't write it by hand:
  `const findOptions: Parameters<typeof resource.find>[0] = { populate: {...} };`
- `populate` is a nested object (`{ media: { populate: { lg: { populate: "*" } } } }`).
- `draft mode` — via `findOptions.status = "draft" | "published"`.
- The request is called **on the server** (from `getServerSideProps` through the orchestrator), not in a client component.

```ts
const products = strapiClient.collection("products");
const findOptions: Parameters<typeof products.find>[0] = {
  populate: { image: { populate: "*" } },
  pagination: { page, pageSize },
};
const res = await products.find(findOptions);
// res.data is weakly typed by the SDK; map it into the domain model right here (the api→domain boundary)
```

## Page data orchestrator

`getServerSidePropsData` (`src/shared/api/strapi/getServerSidePropsData.ts`) assembles the data for
`getServerSideProps`. Call it from a route in `src/pages/*`, passing a request map:

```ts
export async function getServerSideProps(context) {
  const isDraftMode = context.draftMode || false;
  // homePage and commonData are already typed — no cast needed.
  const { commonData, homePage } = await getServerSidePropsData(
    { homePage: getHomePage },
    { isDraftMode },
  );
  return { props: { isDraftMode, cms: { commonData, homePage } } };
}
```

What matters here (the typing angle): **the result type is inferred from the request map** —
`data.homePage` has the type `Awaited<ReturnType<typeof getHomePage>> | null`, so **no `as` in the route**.
The request function must have the signature `(opts: { status }) => Promise<R>`. (Error isolation,
`commonData` mixing, and caching belong to the flow itself — see
[server-data-fetching](../server-data-fetching/SKILL.md).)

The returned `... | null` forces you to handle missing data in the UI (see `home-page.tsx`:
`homePage?.media`). Data is distributed through stores — see [code-conventions](../code-conventions/SKILL.md)
(`GlobalDataProvider`/`useGlobalData` for common, `PageDataProvider`/`usePageData` for the page).

## Global data: getCommonData + cache

`getCommonData` (`src/shared/api/strapi/getCommonData.ts`) fetches the `common` single-type
(`seo`/`socials`/`contacts`) and **caches it server-side** via lru-cache (stale-while-revalidate +
single-flight; see [server-data-fetching](../server-data-fetching/SKILL.md) and `docs/11-server-cache.md`),
so Strapi isn't hit on every navigation. In draft mode the cache is bypassed (`bypassCache: isDraft`).
The return type is a manual `CommonData` (see the pitfall about the bridge). When you add a global field in Strapi,
extend `populate` and `CommonData`.

## Adding a Content Type

The full process (schema.json, fields, relations, components, access rights) is in the
[creating-strapi-content-type](../creating-strapi-content-type/SKILL.md) skill. Briefly, about typing:
the schema lives in `@strapi/src/api/<name>/content-types/<name>/schema.json` (strict JSON).
Reference: [content-type.example](../../../@strapi/docs/content-type/content-type.example).
Structure: `kind` (`collectionType`/`singleType`), `info.{singularName,pluralName,displayName}`,
`options.draftAndPublish`, `attributes`. Attribute types: `string`, `richtext`, `decimal`, `boolean`,
`enumeration`, `uid`, `relation` (`manyToOne` + `target` + `inversedBy`), `component`, `media` (multiple/allowedTypes).
After a schema change Strapi regenerates `@strapi/types/generated/*` on `build/develop` —
**don't forget to manually update** the corresponding Zod schemas/types on the frontend.

## Pitfalls

1. **The bridge is manual** — generated Strapi types are not reused; the manual duplicates (`CommonData`,
   Zod schemas, TS mirrors) drift out of sync with the Strapi schemas. When you edit a schema, edit the frontend too.
2. **The SDK→domain gap remains type-unchecked.** The orchestrator is typed, but `res.data`
   from the SDK is weakly typed, and the domain shape (`HomePageProps` and such) is set by the consumer.
   Prefer explicit mapping in `api/`/`adapters/` (Zod `.parse` or a map function) over a bare `as`.
3. **`getCommonData` assumes a published `common` single-type.** If it is empty/not
   published, the request fails, the orchestrator returns `commonData: null` (the page won't break, but
   there will be no global data). Check that `common` is published in a new project.
