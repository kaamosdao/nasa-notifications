---
name: custom-strapi-route-controller
description: >-
  How to create custom routes and controllers in Strapi 5 in this project: route file structure
  (routes[] + handler + config), extending the core controller through the factory, working with ctx
  (ctx.request/ctx.state/ctx.params + error helpers), response format ({ data, meta } +
  sanitizeOutput/transformResponse), configuring permissions for a custom endpoint. Use ALWAYS
  when you need a non-standard Strapi endpoint, custom business logic in a controller, overriding
  find/create, an extra action (featured/like/search), request handling on the backend — even
  if the user just says "make endpoint X", "add an endpoint", "custom logic on the backend".
---

# Custom route / controller (Strapi 5)

Default routes/controllers are one-line factories (`createCoreRouter`/`createCoreController`).
Customization is needed for non-standard endpoints and your own logic. This project has no custom
ones yet — everything runs on factories, this is the extension point.

Examples (in `@strapi/docs`): [routes.example](../../../@strapi/docs/routes-controllers/routes.example), [controller.example](../../../@strapi/docs/routes-controllers/controller.example).
Official documentation: [docs.md](../../../@strapi/docs/routes-controllers/docs.md).
Access permissions are tied to the [creating-strapi-content-type](../creating-strapi-content-type/SKILL.md) skill.

## Where the files live

`@strapi/src/api/<name>/`:
- `routes/<name>.ts` — core route (factory). Custom routes go in a **separate file** in the same
  folder (`routes/custom-<name>.ts`); Strapi loads every file from `routes/`.
- `controllers/<name>.ts` — controller. Extended in place (replaces the default factory).
- `services/<name>.ts` — put heavy business logic here (thin controller → service).

## Route file structure

A custom route file exports `{ routes: [...] }`:
```ts
export default {
  routes: [
    {
      method: "GET",                    // GET | POST | PUT | DELETE | PATCH
      path: "/products/featured",       // path (can use :param)
      handler: "product.findFeatured",  // "<controller>.<action>" of the same entity
      config: {
        auth: false,                    // public access; remove → a role/token permission is required
        policies: [],                   // gatekeepers BEFORE the controller
        middlewares: [],                // request/response wrappers
      },
    },
  ],
};
```
The core route can be configured too: `createCoreRouter("api::x.x", { config: { find: { policies, middlewares } }, only: ["find"], except: ["delete"] })`.

## Controller structure

Extend the core controller with a function `({ strapi }) => ({ ...actions })`:
```ts
import { factories } from "@strapi/strapi";

export default factories.createCoreController("api::product.product", ({ strapi }) => ({
  async find(ctx) {                       // overriding the default
    const query = await this.sanitizeQuery(ctx);
    const { results, pagination } = await strapi.documents("api::product.product").findPage(query);
    return this.transformResponse(await this.sanitizeOutput(results, ctx), { pagination });
  },
  async findFeatured(ctx) {               // custom action
    const entries = await strapi.documents("api::product.product").findMany({ filters: { isFeatured: true } });
    return this.transformResponse(await this.sanitizeOutput(entries, ctx));
  },
}));
```
- **Document Service API** (Strapi 5): `strapi.documents("api::x.x")` with `findMany/findOne/findPage/create/update/delete/publish`. Do NOT use the deprecated Entity Service.
- Move business logic larger than a couple of lines into a service (`strapi.service("api::x.x").myMethod()`).

## Working with ctx (Koa context)

- **`ctx.request`** — `ctx.request.body` (body), `ctx.request.headers`. Query — `ctx.query`.
- **`ctx.params`** — path parameters (`/:id` → `ctx.params.id`).
- **`ctx.state`** — data set by auth/policy/middleware: `ctx.state.user` (the authenticated
  user or `undefined`), `ctx.state.auth`.
- **`ctx.response`** / `ctx.status` / `ctx.body` — the low-level response (usually not needed, see the format below).
- **Error helpers** (return them): `ctx.badRequest(msg, details)` → 400, `ctx.unauthorized()` → 401,
  `ctx.forbidden()` → 403, `ctx.notFound()` → 404, `ctx.throw(status, msg)`.

## Response format

Return the standard `{ data, meta }` wrapper:
- **`this.sanitizeOutput(entityOrArray, ctx)`** — MANDATORY before returning: strips private
  fields and respects role permissions. `this.sanitizeInput(ctx.request.body, ctx)` — for input data.
- **`this.transformResponse(data, meta?)`** — wraps into `{ data, meta }` (for lists — `meta.pagination`).
- The project's global serializers (`media-serializer` and others) further process the response on top — keep
  this in mind (media becomes `{xs,sm,md,lg,default}`), see the [strapi-policy-middleware](../strapi-policy-middleware/SKILL.md) skill.

## Configuring permissions for a custom route

The action (`product.findFeatured`) becomes a separate **permission** in Users & Permissions. Options:
1. **`config.auth: false`** in the route — public access without a token/session (for open GETs).
2. **Public / Authenticated role** (Settings → Users & Permissions → Roles) — tick the checkbox for the new action.
3. **API token** (Custom) — the action appears in the token's permission list; for Full access it's available right away.

⚠️ A forgotten permission = 403/404 on a custom route — the most common reason "the endpoint doesn't respond".
The permission model is shared with the [creating-strapi-content-type](../creating-strapi-content-type/SKILL.md) skill.

## Checklist

- [ ] Custom route in a separate file in `routes/`, `handler: "<controller>.<action>"`
- [ ] Controller extends the factory; data — through `strapi.documents(...)` (Document Service)
- [ ] Input/output sanitized (`sanitizeInput`/`sanitizeOutput`), response — `transformResponse`
- [ ] Errors via the `ctx.*` helpers (badRequest/unauthorized/…)
- [ ] Permission for the action granted (`auth:false` / role / token)
- [ ] Heavy logic moved into a service
