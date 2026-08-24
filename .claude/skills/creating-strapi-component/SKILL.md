---
name: creating-strapi-component
description: >-
  How to create reusable components in this project's Strapi: the structure of a component file,
  how a component differs from a Content Type, how to attach a component to an entity (component/
  dynamiczone, repeatable, nesting), the naming and category-grouping pattern, and
  the ready-made list of the build's components (media/images, links, buttons, gallery, SEO, card).
  Use ALWAYS when you need to create or edit a Strapi component, add a reusable
  group of fields, embed a component into an entity, assemble a dynamiczone — or when the user
  says "make block X", "add a link/image/button to the model", "a reusable field".
---

# Creating a component (Component) in Strapi

A component is a **reusable group of fields** that you embed into a Content Type, another
component, or a dynamiczone. It lives as a single JSON file at `@strapi/src/components/<category>/<name>.json`,
and has no API endpoint of its own. The related skill about entities is
[creating-strapi-content-type](../creating-strapi-content-type/SKILL.md); typing on the FE —
[strapi-frontend-typing](../strapi-frontend-typing/SKILL.md), [project-typing](../project-typing/SKILL.md).

## Structure of a component file

```json
{
  "collectionName": "components_shared_links",  // auto: components_<category>_<plural>
  "info": {
    "displayName": "Link",                       // human-readable name in the admin (PascalCase)
    "icon": "link",                              // opt. icon in the Content-Type Builder
    "description": "A link with text"            // opt.
  },
  "options": {},
  "attributes": { /* the same field types as a Content Type */ },
  "config": {}
}
```
- Path: `@strapi/src/components/<category>/<name>.json`. The `<category>` folder = the group.
- The component's technical key = `<category>.<filename>` (kebab), e.g. `shared.link-social`, `widgets.card-base`.
- `attributes` use the **same field types** as entities (see the type table in
  [creating-strapi-content-type](../creating-strapi-content-type/SKILL.md)): string/text/richtext/
  media/relation/boolean/component, etc.

## Component vs Content Type

| | Component | Content Type |
|---|---|---|
| API endpoint | **no** (only inside a record) | yes (REST/GraphQL) |
| Own record/lifecycle | no — embedded in a parent | yes |
| draftAndPublish, permissions/roles | no (inherits from the parent) | yes (its own) |
| Files | one `.json` | `schema.json` + `routes/controllers/services` |
| Purpose | a reusable group of fields | a standalone entity |
| Nesting | nested into a CT / component / dynamiczone | top-level |

Rule of thumb: **a standalone entity with queries** → Content Type; **a repeating set of
fields inside others** (link, media, SEO, card) → component.

## How to attach a component to an entity

As a field of type `component`:
```json
"seo":   { "type": "component", "component": "widgets.seo", "repeatable": false },
"cards": { "type": "component", "component": "widgets.card-base", "repeatable": true }
```
- `repeatable: false` → a single object; `true` → an array.
- **Nesting**: a component can contain a component (`shared.media-gallery.items` = `shared.media[]`;
  `widgets.card-base.image` = `shared.media`).
- **dynamiczone** — when a single field needs a set of DIFFERENT components:
  ```json
  "blocks": { "type": "dynamiczone", "components": ["shared.media", "widgets.card-base"] }
  ```
  On the FE it renders via `dynamic-zone-renderer`.
- **Populate**: for the component to arrive in the response, specify it in the request's `populate`
  (`populate: { seo: { populate: "*" } }`) — see [strapi-frontend-typing](../strapi-frontend-typing/SKILL.md).

## Naming and grouping

- **File** — kebab-case, this is the technical key (`link-social.json` → `shared.link-social`).
- **`info.displayName`** — PascalCase, human-readable (`LinkSocial`).
- **`collectionName`** — auto `components_<category>_<plural>` (don't make it up by hand when creating via the UI).
- **The category (folder)** groups components (in the UI — collapsible groups). There are two in the project:
  - `shared` — base, domain-neutral (media, links) — in spirit like the FSD `shared` layer;
  - `widgets` — composite/page blocks (SEO, card) — like the FSD `widgets` layer.
  Stick to this split when creating new ones.

## The build's component list

Ready-made components you can reuse. Each has a counterpart on the FE (`src/shared/ui/*`):

| Key | Purpose | Key fields | FE counterpart |
|---|---|---|---|
| `shared.media` | **Image/video** with breakpoints | `media` + `lg/md/sm/xs` + the `hasADifferentImageOnViewports` flag | `MediaImage` (`MediaWithBreakpoints`) |
| `shared.media-gallery` | Media gallery | `items`: `shared.media[]` (repeatable) | `media-gallery` |
| `shared.link` | **Link / button** | `text*`, `url*` (regex url/email), `target_blank` (default true) | `Link` / `StyledButton` |
| `shared.link-social` | Social link with an icon | `url*`, `text`, `image` (media), `target_blank` | `Link` + icon |
| `widgets.seo` | Page metadata | `title`, `description`, `ogImage`, `keywords`, `theme` (color), `structuredData` (json) | `Seo` type + `SeoLayout` |
| `widgets.card-base` | Card | `title`, `description`, `link?`, `price?`, `image?` (`shared.media`) + flags | `project-card` / `Content` |

⚠️ **There is no separate "button" component** — a button is modeled as `shared.link` (`text` + `url` +
`target_blank`), and on the FE it renders as `Link` or `StyledButton` depending on where it's used.

## Project patterns (when creating new components)

1. **Conditional fields** — `conditions.visible` + a private boolean flag. Example: in `shared.media`
   the `lg/md/sm/xs` fields are visible only when `isLg/isMd/...`; in `widgets.card-base` `image/link/price`
   depend on `hasImage/hasLink/hasPrice`. The flags are marked `"private": true`.
2. **`private: true`** — the field is not exposed in the API (internal visibility flags). Account for this on the FE: they won't be in the response.
3. **Auto media serializer**: on output the `shared.media` component is transformed by the
   `media-serializer` middleware into `{ id, xs, sm, md, lg, default }` (→ `MediaWithBreakpoints`). Model the
   FE Zod to this shape, not to the raw Strapi media.

## Checklist

- [ ] The file `@strapi/src/components/<category>/<name>.json` in the correct category (`shared`/`widgets`)
- [ ] `info.displayName` (PascalCase), `attributes` from the standard field types
- [ ] The reference key `<category>.<name>` matches the file path
- [ ] Attached to an entity as a `component` (repeatable?) or in a `dynamiczone`
- [ ] Specified in the request's `populate`, otherwise it won't arrive in the response
- [ ] On the FE: a Zod model matching the component's shape (accounting for the media serializer and `private` fields) + a counterpart in `shared/ui`
