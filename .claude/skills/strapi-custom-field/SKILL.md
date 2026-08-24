---
name: strapi-custom-field
description: >-
  How to create a custom field with its own React UI in Strapi 5 in this project:
  the plugin structure (strapi-server/strapi-admin/admin/src), registering the type on the server
  (strapi.customFields.register) and in the admin panel (app.customFields.register + the Input component),
  a React component with custom logic (@strapi/design-system, the onChange contract), wiring up the
  plugin and using the field in the schema. Use ALWAYS when you need a non-standard field in the
  Strapi admin panel (color, slider, map, mask, custom select), your own UI editor for an attribute, a
  React component inside the Content Manager — "make a custom field", "my own input in the Strapi admin".
  Documentation: https://docs.strapi.io/cms/features/custom-fields
---

# Custom field in Strapi 5

A custom field = a **plugin** that registers a new field type on the server and its own **React component**
for input in the admin panel (Content Manager). The project has no local custom fields (it uses the external
`plugin::color-picker.color`), but there is a reference plugin structure — `@strapi/src/plugins/auto-save/`.

Examples (in `@strapi/docs`): [strapi-server.example](../../../@strapi/docs/custom-field/strapi-server.example),
[admin-index.example](../../../@strapi/docs/custom-field/admin-index.example), [Input.example](../../../@strapi/docs/custom-field/Input.example).
Documentation: [docs.md](../../../@strapi/docs/custom-field/docs.md) and
https://docs.strapi.io/cms/features/custom-fields.

## File structure (plugin)

`@strapi/src/plugins/<plugin>/` (like `auto-save`):
```
color-field/
├── package.json          # exports: ./strapi-admin, ./strapi-server; strapi.kind: "plugin"
├── strapi-server.js      # server-side registration of the field type
├── strapi-admin.js       # → export { default } from "./admin/src/index"
└── admin/src/
    ├── index.ts          # register(app): app.customFields.register(...)
    ├── pluginId.ts       # export const PLUGIN_ID = "color-field"
    └── components/
        └── Input.tsx      # React field component (default export)
```
The plugin is enabled in `@strapi/config/plugins.ts`:
```ts
"color-field": { enabled: true, resolve: "./src/plugins/color-field" },
```

## Registering the type (server)

`strapi-server.js` → `register({ strapi })`:
```js
strapi.customFields.register({
  name: "color",
  plugin: "color-field",   // pluginId
  type: "string",          // storage type in the DB (string/text/json/integer/boolean/...)
});
```
`type` determines how the value is stored in the DB and arrives on the FE (a plain string/json, etc.).

## Registering the UI (admin panel)

`admin/src/index.ts` → `register(app)`:
```ts
app.customFields.register({
  name: "color",
  pluginId: PLUGIN_ID,               // in admin — pluginId (on the server — plugin)
  type: "string",                    // matches the server-side registration
  intlLabel: { id: `${PLUGIN_ID}.color.label`, defaultMessage: "Color" },
  intlDescription: { id: `${PLUGIN_ID}.color.description`, defaultMessage: "..." },
  components: { Input: async () => import("./components/Input") }, // lazy import
  options: { advanced: [ /* extra field settings in the Content-Type Builder */ ] },
});
```

## Component with custom logic (Input.tsx)

React 18 + `@strapi/design-system` v2. Props come from the Content Manager: `name`, `value`,
`onChange`, `attribute`, `disabled`, `required`, `error`, `hint`, `label`, `labelAction`.

**The key contract**: the value is passed up strictly as
```ts
onChange({ target: { name, type: attribute.type, value } });
```
Custom logic (validation, normalization, formatting, your own widget) lives inside the component up to the
`onChange` call. Wrap it in `@strapi/design-system` `Field.Root/Label/Error/Hint`, and for the locale use
`useIntl`. Full example — [Input.example](../../../@strapi/docs/custom-field/Input.example).

## Using the field in an entity

In the `schema.json` of the entity/component:
```json
"theme": { "type": "customField", "customField": "plugin::color-field.color" }
```
(the same way the existing `plugin::color-picker.color` is used in `widgets.seo`). On the FE the value arrives as
the underlying `type` (here a string) — type it by the rules of [project-typing](../project-typing/SKILL.md)/
[strapi-frontend-typing](../strapi-frontend-typing/SKILL.md) (a Zod model).

## Pitfalls

1. **`plugin` vs `pluginId`**: on the server the key is `plugin`, in the admin it's `pluginId` — they must match
   the `strapi.name` from the plugin's `package.json`.
2. **`type` must match** in the server and admin registration, otherwise the field won't mount.
3. **The `onChange` contract is strict** — `{ target: { name, type, value } }`; otherwise the value won't be saved.
4. **The component is a default export**, `components.Input` imports it lazily.
5. **Don't forget to enable the plugin** in `config/plugins.ts` (`enabled: true`, `resolve`), otherwise the field won't appear.
6. Rebuilding the admin: Strapi rebuilds the panel in dev; after changes in `admin/src` a restart may be needed.

## Checklist

- [ ] Plugin in `@strapi/src/plugins/<plugin>/` with the `strapi-server`/`strapi-admin`/`admin/src` structure
- [ ] Server: `strapi.customFields.register({ name, plugin, type })`
- [ ] Admin: `app.customFields.register({ name, pluginId, type, intlLabel, components:{Input} })`
- [ ] `Input.tsx` (default export) emits `onChange({ target: { name, type, value } })`
- [ ] Plugin enabled in `config/plugins.ts`
- [ ] Field used as `"customField": "plugin::<plugin>.<name>"`; the FE type described with Zod
