---
name: strapi-policy-middleware
description: >-
  How to create policies and middleware in Strapi 5 in this project: how a policy differs
  from middleware (a true/false gatekeeper vs a request/response wrapper), the structure of a policy and
  middleware file, where they live and how they are registered (global:: / api:: , config.policies/middlewares,
  config/middlewares.ts), typical use cases (checking permissions/roles/ownership, validation,
  response transformation). Use ALWAYS when you need to restrict access to a route, check a role/
  owner/permission, validate a request, intercept or transform a response on the backend, add
  cross-cutting logic (logging/headers) — "lock the endpoint down by role", "check that it's the owner".
---

# Policy / middleware (Strapi 5)

Both intercept the request, but solve **different** tasks. Examples (as files):
[policy.example](../../../@strapi/docs/policy-middleware/policy.example), [route-middleware.example](../../../@strapi/docs/policy-middleware/route-middleware.example),
[global-middleware.example](../../../@strapi/docs/policy-middleware/global-middleware.example). Documentation:
[docs.md](../../../@strapi/docs/policy-middleware/docs.md).

## Policy vs middleware difference

| | Policy | Middleware |
|---|---|---|
| Purpose | **allow/deny** (gatekeeper) | **wrap** the request/response (before/after) |
| Return | `true` = let through, `false`/throw = 403 | calls `next()`, can change `ctx.body` |
| Access to response | no (runs BEFORE the controller) | yes (code after `next()`) |
| When | after route matching, before the controller | global — around the whole pipeline; route — around the route |
| Registration | route's `config.policies` | `config/middlewares.ts` (global) or route's `config.middlewares` |

Rule: **"allowed/not allowed" → policy; "transform/log/add" → middleware.** A policy
must not change the response; middleware must not be the sole access guard.

## Policy

A function `(policyContext, config, { strapi }) => boolean`. Returns `true`/`false`.
Location:
- global — `@strapi/src/policies/<name>.ts` → `global::<name>`;
- API-scoped — `@strapi/src/api/<x>/policies/<name>.ts` → `api::<x>.<name>`;
- plugin — `plugin::users-permissions.<name>`.

Registration in a route:
```ts
config: {
  policies: [
    "global::is-owner",
    { name: "api::product.has-role", config: { role: "Editor" } }, // with config
  ],
}
```
`policyContext` provides `state.user`, `params`, `request`. A typical case is a role/owner check
(see [policy.example](../../../@strapi/docs/policy-middleware/policy.example)). The project has no policies yet — an extension point.

## Middleware

A function `(config, { strapi }) => async (ctx, next) => { … }`. Code before `next()` is request
preprocessing, after it is response postprocessing (`ctx.body`).

**Global** (on every request): `@strapi/src/middlewares/<name>.ts` + registration as the string
`"global::<name>"` in the `@strapi/config/middlewares.ts` array (order matters — after `strapi::*`).
Real examples in the project: `media-serializer`, `url-serializer`, `typograf-serializer`. To
transform the body use the helper `@strapi/src/utils/middleware.ts` (`transformApiResponse` —
it checks on its own that it's a successful `/api/*` response). See [global-middleware.example](../../../@strapi/docs/policy-middleware/global-middleware.example).

**Route-level** (only for the route): `@strapi/src/api/<x>/middlewares/<name>.ts`, registered in
`config.middlewares: ["api::<x>.<name>"]`. See [route-middleware.example](../../../@strapi/docs/policy-middleware/route-middleware.example).

## Typical use cases

| Task | Tool |
|---|---|
| Let only the resource owner / a specific role through | **policy** (`state.user`, compared against `params`) |
| Check a permission/token before an action | **policy** (or the route's built-in auth) |
| Validate/normalize input data | **policy** (rejection) or **middleware** (editing `ctx.request.body`) |
| Transform the response (media/URL serialization, camelCase) | **global middleware** (as in the project) |
| Add headers, timings, logging | **middleware** |
| Rate limiting | plugin **policy/middleware** |

⚠️ Domain-data validation is more often kept on the FE (Zod, see [strapi-frontend-typing](../strapi-frontend-typing/SKILL.md)) —
on the backend, policy/middleware guard **access and request shape**, not business validation of content.

## Checklist

- [ ] The right tool chosen: access → policy, transformation → middleware
- [ ] File in the right place (`policies/` or `middlewares/`, global vs api-scoped)
- [ ] Global middleware registered in `config/middlewares.ts` (`global::<name>`), order accounted for
- [ ] Policy registered in the route's `config.policies`; returns a boolean
- [ ] Middleware calls `next()`; response transformation — after `next()` (the `transformApiResponse` helper)
- [ ] Custom routes/controllers — in the [custom-strapi-route-controller](../custom-strapi-route-controller/SKILL.md) skill
