---
name: creating-a-component
description: >-
  How to create React components in this project: folder structure (name.tsx + name.module.scss
  + index.ts), props via `type <Name>Props`, named export + displayName, the variant system
  via mod() + clsx, placement across FSD layers (shared/ui vs widgets vs entities/features).
  Use ALWAYS when you need to create a new React component, UI primitive, or widget, or to
  refactor an existing one in the frontend — even if the user simply asks to "make a button/
  card/modal/header" without saying the word "component."
---

# Creating a Component

Reference to copy from: [component.example.tsx](../../../docs/examples/component/component.example.tsx)
+ [component.example.module.scss](../../../docs/examples/component/component.example.module.scss).
Live analog in the code: `src/shared/ui/styled-button/`. General conventions are in the
[code-conventions](../code-conventions/SKILL.md) skill; styles in [writing-styles](../writing-styles/SKILL.md).

## Folder structure

One component = a folder with three files:
```
<name>/
├── <name>.tsx            # component
├── <name>.module.scss    # styles (SCSS module)
└── index.ts              # public API (re-export of the component and the props type)
```
**Don't** create a separate `types.ts` for props — the type is declared inline in the `.tsx` and
exported from there. Components with sub-variants use nested folders
(e.g. `typography/` with `body/`, `heading/`).

`index.ts`:
```ts
export type { ButtonProps } from "./button";
export { Button } from "./button";
```
(if the props type isn't needed externally, re-export only the component, as in `widgets/header`).

## Props

- **`type`, not `interface`**; the name is **`<ComponentName>Props`**; always `export`.
- Extend native attributes: `ComponentProps<"button">`, or `ButtonHTMLAttributes<...>` with `Omit`.
- Compound variants via a discriminated union (see `button.tsx`: `ButtonAsButton | ButtonAsLink` keyed on `href`).
- A polymorphic component (a `tag` prop) — via `DynamicProps<Element>` / `ComponentOrTag` from `@shared/types`.
- **`forwardRef` is NOT used** — the ref is passed through as a native prop via `...rest`.

## Declaration and export

- **Named export**, no `default`.
- The component is an **arrow function in a `const`**: `export const Button = (props: ButtonProps) => {...}`. `function Foo()` is not used.
- The last line is **`Button.displayName = "Button"`** (mandatory).
- Add **`"use client"`** if there are hooks/handlers/`next/link`/browser APIs. Remember:
  this is the Pages Router, so the directive is decorative (no RSC), but it is added for explicitness.

## Classes and variants (the key convention)

Modifiers are assembled with the **`mod`** utility (`@shared/utils/css-mods`) and joined with `clsx`:
```ts
import clsx from "clsx";
import { mod } from "@shared/utils/css-mods";
import s from "./button.module.scss";

const mods = mod(s, { variant, size, colorScheme });
// ...
className={clsx(s.root, mods, className)}
```
`mod(s, { variant: "primary" })` looks up the classes `s.variant` and `s.variantPrimary` (kebab values
are split on `-`). **Prop values must match the SCSS class names**, otherwise the class silently
won't be applied. In `.module.scss` they are written nested: `.variant { &Primary {} }`.

Import the module as `s` (dominant in the project); `clsx` as `import clsx from "clsx"`.

## Placement across layers

- **`shared/ui`** — "dumb" reusable primitives with no domain logic (buttons, inputs,
  typography, icons, containers). They depend only on `@shared/*`.
- **`widgets`** — composition of primitives into a self-contained page block (header, footer, preloader).
- **`entities`** — domain entities (currently almost empty — an extension point).
- **`features`** — user scenarios (empty — an extension point).
- A page slice goes in `_pages/<page>/ui/`.

Decision rule: a domain-agnostic primitive → `shared/ui`; a block built from several primitives → `widgets`;
tied to a domain entity → `entities`/`features`.

## Checklist

- [ ] Folder `<name>/` with `<name>.tsx`, `<name>.module.scss`, `index.ts`
- [ ] `export type <Name>Props = ...` (type, exported)
- [ ] `export const <Name> = (props) => {...}` (named, arrow)
- [ ] Variants via `mod(s, {...})` + `clsx(s.root, mods, className)`, values = class names
- [ ] `<Name>.displayName = "<Name>"`
- [ ] `index.ts` re-exports the component (and the type, if needed externally)
- [ ] Correct layer; kebab-case names; Latin characters in paths
- [ ] `pnpm check` sorted the imports and doesn't complain
