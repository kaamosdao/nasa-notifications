---
name: strapi-lifecycle-hooks
description: >-
  How to use lifecycle hooks in Strapi 5 in this project: the list of hooks (beforeCreate/afterCreate/
  beforeUpdate/afterUpdate/beforeDelete/afterDelete + *Many), the structure of the lifecycles.ts file, accessing
  data inside a hook (event.params.data/where, event.result, event.state), typical use cases
  (transforming data before writing, side effects after — deriving a slug, emails, invalidation,
  logging). Use ALWAYS when you need to automatically do something on create/update/
  delete of a Strapi record — "set the slug automatically", "send an email on create", "recompute
  a field", "do something after saving", "a hook on the model".
---

# Lifecycle hooks (Strapi 5)

Lifecycle hooks fire at the DB level during operations on an entity — for **transforming
data before writing** (before) and **side effects afterward** (after). The project has none yet —
an extension point.

Example (in `@strapi/docs`): [lifecycles.example](../../../@strapi/docs/lifecycle-hooks/lifecycles.example). Documentation:
[docs.md](../../../@strapi/docs/lifecycle-hooks/docs.md). Related: for endpoint business logic see
[custom-strapi-route-controller](../custom-strapi-route-controller/SKILL.md).

## File structure

`@strapi/src/api/<name>/content-types/<name>/lifecycles.ts` — exports an object with hook methods:
```ts
export default {
  async beforeCreate(event) { /* ... */ },
  async afterUpdate(event) { /* ... */ },
};
```
An alternative for several models is a global subscription in `@strapi/src/index.ts` `bootstrap`:
```ts
strapi.db.lifecycles.subscribe({
  models: ["api::product.product"],
  async beforeCreate(event) { /* ... */ },
});
```

## List of hooks

| Before | After | Trigger |
|---|---|---|
| `beforeCreate` | `afterCreate` | creating a single record |
| `beforeUpdate` | `afterUpdate` | updating a single record |
| `beforeDelete` | `afterDelete` | deleting a single record |
| `beforeFindOne` | `afterFindOne` | reading a single record |
| `beforeFindMany` | `afterFindMany` | reading a list |
| `beforeCount` | `afterCount` | counting |
| `beforeCreateMany` | `afterCreateMany` | batch create |
| `beforeUpdateMany` | `afterUpdateMany` | batch update |
| `beforeDeleteMany` | `afterDeleteMany` | batch delete |

## Accessing data inside a hook (`event`)

- **`event.params`** — operation parameters: `data` (input data — **mutate it in before**), `where`
  (which records), `select`, `populate`, `orderBy`.
- **`event.result`** — the operation result (**only in after hooks**; already written to the DB, do not mutate).
- **`event.state`** — a "pocket" for passing data from a before hook to an after hook (e.g. record a time/flag).
- **`event.action`** / **`event.model`** — the action name and the model.

Rule: **before** → edit `event.params.data` (the changes land in the record); **after** → read
`event.result`, do side effects. In `*Many` hooks `data`/`result` are arrays.

## Typical use cases

| Task | Hook |
|---|---|
| Derive a field (slug from title, normalization) | `beforeCreate`/`beforeUpdate` (editing `data`) |
| Set a service field, a default, a computed value | `before*` |
| Send an email/notification on create | `afterCreate` |
| Cache invalidation / webhook / external API | `after*` |
| Logging, auditing | `after*` (`strapi.log`) |
| Cascading cleanup of related resources | `afterDelete` |

## Pitfalls

1. **Infinite loops**: calling `strapi.documents(...).update(...)` inside `afterUpdate` triggers the
   hook again. Set a flag in `event.state`, check the actual field change, or edit the data in `beforeUpdate`.
2. **DB level, not Document Service**: a single document operation may spawn several
   DB events (draft/published versions with `draftAndPublish`). If you truly need the document level —
   see Document Service middlewares (see strapi-docs).
3. **Errors in an after hook** may "bring down" an already successful operation — wrap side effects in try/catch.
4. **Do not duplicate built-ins**: Meilisearch indexing runs through the plugin (`config/plugins.ts`), not by hand.

## Checklist

- [ ] File `content-types/<name>/lifecycles.ts` (or a global `subscribe` in bootstrap)
- [ ] Transformation — in `before*` via `event.params.data`; side effects — in `after*` via `event.result`
- [ ] Passing between before/after — through `event.state`
- [ ] No risk of an infinite loop in `afterUpdate`/`afterCreate`
- [ ] Side effects wrapped in try/catch
