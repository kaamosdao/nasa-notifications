---
name: writing-styles
description: >-
  How to write styles in this project: SCSS modules (*.module.scss), auto-injected mixins/functions
  via next.config, CSS variable tokens (--spacing/--c/--radius), the vw() function for responsive sizing,
  the mq() mixin for media queries, typography presets. Use ALWAYS when writing or editing
  styles, creating a .module.scss, building responsive layouts, working with variables/tokens, breakpoints,
  typography or media queries in the frontend — even if the user simply asks to "style this,"
  "make it responsive," or "fix the spacing."
---

# Writing Styles

The approach is **SCSS modules** (`<name>.module.scss` per component). Reference:
[component.example.module.scss](../../../docs/examples/component/component.example.module.scss).
Live analogs: `src/shared/ui/styled-button/styled-button.module.scss`, `src/widgets/header/header.module.scss`.
The styling-system sources are in `src/shared/styles/`.

## Auto-injection: mixins and functions available without an import

`next.config.js` sets `sassOptions.prependData: "@use 'helpers' as *;"` and `includePaths`
to `src/shared/styles` + `src/shared/ui`. So in **any** `.module.scss`, **without a manual
`@use`**, the following are available:
- **functions**: `vw()`, `rem()`, `between()`, `vVH()`;
- **mixins**: `mq()`, `transition()`, `hover()`, `blur()`, `grid()`, `sr-only()`, and typography presets (`btnS`, `h2`…).

`helpers` → `src/shared/styles/_helpers.scss` → `@forward "mixins"; @forward "functions";`.
⚠️ Only mixins and functions are auto-injected. **CSS variable tokens** (`--spacing-*`, `--c-*`)
are declared in `:root` (via `globals.scss`/`_root.scss`) and are available as ordinary custom properties.

## Tokens (variables)

Two levels:
1. **CSS custom properties `--x`** — the primary mechanism. Declared in `src/shared/styles/vars/*`:
   - colors — `_colors.scss` (`--c-white`, `--text-primary-dark`, `--background-button-primary`…);
   - spacing — `_spacing.scss` (`--spacing-4 … --spacing-140`, each via `vw()`);
   - plus `--z-*` (`_z-indexes`), `--radius-*` (`_layout`), transition tokens.
   In a module you only **read** them: `padding: var(--spacing-20) var(--spacing-32);`.
2. **SCSS `$` variables** — only for breakpoints (`vars/_breakpoints.scss`, the `$breakpoints` map).

Don't hardcode pixels/colors — use a token. If the one you need doesn't exist, add it to the relevant `vars/*` file.

## Responsive: the vw() function

Convert sizes from the design into responsive units with the **`vw($px)`** function
(`calc` relative to `--vw-screen`): `width: vw(208);`, `--gap: #{vw(6)};` (inside interpolation — `#{}`).
Also available: `rem($px)`, `between($from,$to,$fromW,$toW)` (fluid clamp), `v-min-vh-vw()`.

## Media queries: the mq() mixin

Write **only** through the `mq($breakpoint, $direction: max)` mixin — raw `@media` is not used:
```scss
@include mq(lg) { padding: vw(14) var(--spacing-20); }
@include mq(md) { grid-template-columns: repeat(2, 1fr); }
```
- By default it's **`max`-width minus 1px** → the layout is **desktop-first** (base styles = desktop,
  `mq()` narrows down). For `min-width`, pass `mq(md, min)`.
- Breakpoints (px): `xs 360`, `sm 481`, `md 769`, `lg 1025`, `xl 1280`, `2xl 1440`.
  It accepts a map key or a number; supports `landscape/portrait/retina`.

⚠️ The breakpoint values are **duplicated** in JS (`src/shared/config/breakpoints.ts`, `BREAKPOINTS`)
and SCSS (`vars/_breakpoints.scss`, `$breakpoints`). There's no auto-sync — when you change them, edit **both** files.

## Typography

Preset mixins are in `src/shared/styles/mixins/_typography.scss` (the base
`@mixin typography(...)` + `accentXXL`, `h2`–`h5`, `btnS`, `btnM`, `captionXL/M/XS`,
`body-paragraph*`). Usage: `@include btnS();`. Sizes inside them go through `vw()`.
⚠️ `src/shared/styles/_typo.scss` is practically empty — the real presets are in `mixins/_typography.scss`.

## Modifiers for mod()

Write modifier classes nested via `&`; their names must match the prop values
passed into `mod(styles, {...})` (see [creating-a-component](../creating-a-component/SKILL.md)):
```scss
.size    { &S {} &M {} &L {} }        // size="s"|"m"|"l"
.variant { &Primary {} &Icon-round {} } // variant="primary"|"icon-round"
```
⚠️ A real gotcha: in `typography.module.scss` the classes `.colorPrimary`/`.weight-semibold` don't
match the props (`color="primary"`, `weight="semiBold"`) → the modifiers silently aren't applied.
Always cross-check the class names against the prop values.

## Property order and linting

**There is no Stylelint/Prettier in the project** — CSS property order isn't enforced. Follow the manual
convention from the existing modules: positioning → box model → layout → spacing →
typography → visuals (fill/bg/border) → `transition`/`@include`. Biome does **not** lint SCSS.
