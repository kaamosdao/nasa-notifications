---
name: creating-strapi-content-type
description: >-
  How to create an entity (Content Type) in this project's Strapi and wire it into the frontend:
  the structure of schema.json, field types and their settings, relations and components,
  access rights (API token vs Public role), generating and creating types on the FE via a Zod model.
  Use ALWAYS when you need to set up a new entity/collection/single-type in Strapi, add
  a field or relation, create a component, configure API access, or push new content to the
  frontend — even if the user simply says "add model X", "make a news collection",
  "link a product to a category", "expose this to the frontend".
---

# Creating an entity (Content Type) in Strapi

The backend is **Strapi 5** (`@strapi/`). An entity = the folder `@strapi/src/api/<name>/` with four parts:
`content-types/<name>/schema.json` (the model) + `routes/` + `controllers/` + `services/`.
The routes/controllers/services in the project are **default factories** (one line each); customize only
when necessary. Schema reference: [content-type.example](../../../@strapi/docs/content-type/content-type.example).

The FE part (creating types) builds on the [project-typing](../project-typing/SKILL.md) and
[strapi-frontend-typing](../strapi-frontend-typing/SKILL.md) skills — see the "Creating types on the FE" section.

## Two ways to create an entity

1. **Content-Type Builder (Admin UI)** — recommended. It creates `schema.json` + the trio of files
   automatically and regenerates the types. Requires Strapi running in dev (`pnpm develop` in `@strapi`).
2. **By hand** — create the files. The trio is trivial:
   ```ts
   // routes/<name>.ts
   import { factories } from "@strapi/strapi";
   export default factories.createCoreRouter("api::<name>.<name>");
   // controllers/<name>.ts → createCoreController, services/<name>.ts → createCoreService
   ```
   After you edit the files, Strapi in dev will restart and regenerate the types in `@strapi/types/generated/`.

## Structure of schema.json

```json
{
  "kind": "collectionType",          // collectionType (list) | singleType (one record, e.g. home-page)
  "collectionName": "products",      // table name in the DB (snake_case, plural)
  "info": {
    "singularName": "product",       // used in API paths and strapiClient.collection("products")/single("...")
    "pluralName": "products",
    "displayName": "Product",
    "description": "Catalog product"
  },
  "options": { "draftAndPublish": true },  // enables drafts/publishing (status: draft|published)
  "pluginOptions": {},
  "attributes": { /* fields — see below */ }
}
```

- `kind`: `collectionType` gives `find` + `findOne`; `singleType` — only `find` (one record).
- `draftAndPublish: true` → a record has draft/published. The FE passes `status` (see the orchestrator in
  [strapi-frontend-typing](../strapi-frontend-typing/SKILL.md)).

## Field types and settings

| type | Purpose | Common settings |
|---|---|---|
| `string` / `text` | short / long string | `required`, `unique`, `minLength`, `maxLength`, `default`, `private` |
| `richtext` | markdown text | (passes through `typograf-serializer`) |
| `blocks` | block editor (Strapi Blocks) | on the FE — `BlocksContent` + `BlocksRenderer` |
| `email` / `password` | email / password | `required`, `unique` |
| `integer` / `biginteger` / `decimal` / `float` | numbers | `required`, `min`, `max`, `default` |
| `boolean` | flag | `default`, `private` |
| `date` / `datetime` / `time` | date/time | `required` |
| `enumeration` | enumeration | `enum: [...]`, `default` |
| `json` | arbitrary JSON | — |
| `uid` | slug from another field | `targetField: "title"`, `required` |
| `media` | file(s) | `multiple: true/false`, `allowedTypes: ["images","videos","files","audios"]` |
| `relation` | relation to another entity | see "Relations" |
| `component` | nested component | see "Components" |
| `dynamiczone` | a set of different components | `components: ["shared.media", ...]` |

Common settings: `required`, `unique`, `private` (not exposed in the API), `configurable`, `default`,
`regex`, length/value constraints. Example field: `"price": { "type": "decimal", "required": true, "min": 0 }`.

## Relations (relation)

```json
"category": {
  "type": "relation",
  "relation": "manyToOne",           // oneToOne | oneToMany | manyToOne | manyToMany
  "target": "api::category.category",
  "inversedBy": "products"           // the owning side of the relation; on the inverse side — mappedBy
}
```
- The **owner** of the relation uses `inversedBy`, the inverse side uses `mappedBy` (a bidirectional relation).
  A one-directional one has no `inversedBy`/`mappedBy`.
- Live example: `product.category` (`manyToOne`) ↔ `category.products` (`oneToMany`).
- Media links are defined with the `media` type, not `relation`.

## Components (component)

Creating them and the full list of ready-made components are in the
[creating-strapi-component](../creating-strapi-component/SKILL.md) skill. Briefly: reusable
groups of fields, they live in `@strapi/src/components/<category>/<name>.json` and are referenced as `<category>.<name>`.
```json
"seo": { "type": "component", "component": "widgets.seo", "repeatable": false }
```
- `repeatable: true` → an array (e.g. `socials`), `false` → a single object.
- Structure of a component file: `collectionName`, `info.displayName`, `attributes` (the same field types).
- Existing ones: `shared.media`, `shared.link`, `shared.link-social`, `shared.media-gallery`,
  `widgets.seo`, `widgets.card-base`.
- `dynamiczone` — when a single field needs a set of DIFFERENT components (on the FE it renders via
  `dynamic-zone-renderer`).

⚠️ Global middleware (`config/middlewares.ts`) transforms the response automatically:
`media-serializer` reshapes the `shared.media` component into `{ id, xs, sm, md, lg, default }`
(→ `MediaWithBreakpoints` on the FE), `url-serializer` normalizes URLs, `typograf-serializer`
processes richtext. Account for this when typing on the FE — the data arrives already transformed.

## Access rights

Access rights are **not set in code** (`bootstrap`/`register` are empty, routes are default factories).
They are configured in the Admin UI (Settings), via two mechanisms:

1. **API token** (Settings → API Tokens) — the main path in this project. The SDK authenticates with the
   `NEXT_PUBLIC_STRAPI_API_TOKEN` token (`strapi-client.ts`). Token type:
   - *Full access* — new entities are available automatically;
   - *Custom* — you must **explicitly enable** `find`/`findOne` for the new entity, otherwise the FE gets a 403.
2. **Public role** (Settings → Users & Permissions → Roles → Public) — for anonymous access without a
   token: enable `find` (+ `findOne` for a collectionType).

For a collectionType open `find` + `findOne`; for a singleType — only `find`.
After creating an entity, **don't forget to grant access** — the most common cause of "the frontend is empty/403".

## Creating types on the FE

The Strapi→FE bridge is **manual** (the generated `@strapi/types/generated/*` are not imported by the frontend —
see [strapi-frontend-typing](../strapi-frontend-typing/SKILL.md)). The order:

1. **Regenerate the backend types**: `strapi build/develop` writes `@strapi/types/generated/*` — it's a
   reference for the shape, but we don't use it on the FE.
2. **Domain Zod model** (the single source of the type) — following the [project-typing](../project-typing/SKILL.md) rules:
   for page content — in the slice's `model/schemas.ts`; for something reusable — in
   `src/shared/content-types/schemas/`. `type X = z.infer<typeof XSchema>`.
3. **API function** `getX` in the slice's `api/` segment — reference `src/_pages/home/api/getHomePage.ts`:
   ```ts
   export const getProducts = async (opts?: { status?: "draft" | "published" }) => {
     const products = strapiClient.collection("products");
     const findOptions: Parameters<typeof products.find>[0] = { populate: { image: { populate: "*" } } };
     if (opts?.status) findOptions.status = opts.status;
     const json = await products.find(findOptions);
     const parsed = ProductsSchema.safeParse(json.data); // the CMS→domain boundary
     return parsed.success ? parsed.data : null;
   };
   ```
   `safeParse` (not `parse`) → on a malformed response, `null` rather than an exception. Infer the options type from the SDK
   via `Parameters<typeof ...find>[0]`.
4. **Wiring it into the page**: add `getX` to the route's `getServerSidePropsData` map, consume it via
   `usePageData<{ ... }>()` (see [code-conventions](../code-conventions/SKILL.md)). Global
   content (menu/footer) — via `getCommonData`.

## Checklist

- [ ] `schema.json`: `kind`, `info.{singularName,pluralName,displayName}`, `attributes`, plus `draftAndPublish` if needed
- [ ] The `routes/controllers/services` trio (factories) — if you created it by hand
- [ ] Relations: `relation` + `target` + `inversedBy`/`mappedBy`; components: `<category>.<name>` + `repeatable`
- [ ] **Rights**: `find`/`findOne` enabled for the API token (Custom) or the Public role
- [ ] Strapi restart → types regenerated in `@strapi/types/generated/`
- [ ] FE: domain Zod model + `getX` with `safeParse` + wiring into the route/store
- [ ] The auto media/URL/richtext serializer accounted for when typing the FE
