---
name: code-conventions
description: >-
  Frontend code conventions: Feature-Sliced Design architecture, import aliases, import order
  (biome), the Pages Router data model (getServerSideProps + zustand, NOT RSC), where business
  logic lives (stores/hooks/services/utilities), naming of files/components/types.
  Use ALWAYS when writing or editing any code in src/: when deciding which FSD layer to put a
  file in, which alias to use, server code vs client code, where to place logic, how to name an
  entity — and generally before creating any new file in this project's frontend.
---

# Code Conventions (Frontend)

The frontend is built on **Feature-Sliced Design**. Routing is the **Next.js Pages Router**
(`src/pages/`), while `src/app/` is the FSD initialization layer (providers + zustand stores),
**NOT** the Next App Router. There are no RSCs in the project (more on this below). Formatter and
import order are handled by `biome` (`biome.json`), run via `pnpm check`.

## Aliases (tsconfig.json)

| Alias | Points to |
|---|---|
| `@/*` | `src/*` |
| `@app/*` `@processes/*` `@pages/*` `@widgets/*` `@features/*` `@entities/*` `@shared/*` | the same-named layers in `src/*` |
| `@shared/types` | `src/shared/types/index.ts` |

Rule: import a slice from **your own layer or below** absolutely via its alias
(`@shared/ui/button`, `@widgets/header`); **within** a slice, import relatively (`./button`, `../model`).
A slice's public API is always exposed through `index.ts` (barrel); never import from the internals of another slice.

⚠️ `tsconfig.json` contains broken mappings `@shared/config/* → ./src/constants/*` and
`@shared/styles/* → ./src/styles/*` (those folders don't exist — the real ones live in `src/shared/`).
Don't rely on them; the general `@shared/* → ./src/shared/*` works.

## FSD layers (bottom to top)

`shared` → `entities` → `features` → `widgets` → `_pages` → `app`.

- **`shared`** — reusable, domain-agnostic code: `ui/` (primitives), `hooks/`, `utils/`, `api/`, `config/`, `styles/`, `types/`.
- **`entities`** — domain entities (`entities/article` is currently a stub). An extension point.
- **`features`, `processes`** — **empty** in the boilerplate. Extension points.
- **`widgets`** — large, self-contained blocks (`header`, `footer`, `preloader`, `scroll`…), composed of primitives.
- **`_pages`** — FSD page slices (`_pages/feed`), holding all of a page's logic. The `_` prefix keeps Next from confusing them with routes.
- **`app`** — initialization: providers and global stores (`app/model/{data,ui,viewport}-store`).

Internal slice segments: `ui/` (components + styles), `model/` (stores, types, schemas), `api/` (requests), optionally `hooks/`, `utils/`, `context/`. Each slice re-exports its public surface through `index.ts`.

**`src/pages/` vs `src/_pages/`:** `pages/` are thin Next routes (`index.tsx` calls `getServerSideProps` and renders the slice from `_pages/`); `_pages/` is the page slice itself. Don't mix them up.

## Server vs Client: the actual model (no RSC)

This is the **Pages Router**, so React Server Components **do not apply**. The
`"use client"` directives in the project (~27 files) are semantically **no-ops** — they don't create an RSC
boundary. Don't reason in terms of "server/client components."

The real split:
- **Server code** (runs on the server): `getServerSideProps` in the routes under `src/pages/*`;
  the `api/` segment functions of slices (`entities/notice/api/*`); the orchestrator
  `src/shared/api/server-data/`; Next API routes `src/pages/api/*`.
  CMS data is fetched **here**, not in components.
- **Client code**: UI components. Data from `getServerSideProps` is placed into `pageProps.cms`
  and distributed through two zustand contexts (`src/app/model/data-store`): `GlobalDataProvider`/
  `useGlobalData` — site-wide global data (`commonData`, outside page transitions);
  `PageDataProvider`/`usePageData` — the current page's data (inside `TransitionLayout`).
  A component reads page data with types: `const { homePage } = usePageData<{ homePage: HomePageProps | null }>()`.
- Data is assembled by the `getServerSidePropsData` orchestrator (it types the result from the request map,
  isolates errors per key) — `src/shared/api/server-data/`.
- `getServerSideProps` is used (per-request SSR). `getStaticProps`/ISR are not used at present.

## Where business logic lives

| Logic type | Where | Example |
|---|---|---|
| Global stores (zustand) | `src/app/model/*-store` | `useUiStore`, `useViewportStore`, `useGlobalData`/`usePageData` (data-store) |
| Slice-local store | the slice's `model/` segment | `widgets/preloader/model/preloaderStore.ts` |
| Reusable hooks | `src/shared/hooks/use-*.ts` | `use-media.ts`, `use-intersection-observer.ts` |
| Data/services | `src/shared/api/*` and slices' `api/` | `api/db/*`, `api/server-data/*`, `api/mailer/*` |
| Pure utilities | `src/shared/utils/*` | `is.ts` (type guards), `math/`, `debounce.ts` |

Store convention: `state` + a nested `actions` object + a separate hook selector for the actions
(`useUiActions`, `usePreloaderActions`).

## Naming

- **Components**: PascalCase, arrow function in a `const`, mandatory `displayName`. `Button`, `HomePage`.
- **Props**: `type <Component>Props` (not interface, not `Props`), always `export`. `ButtonProps`.
- **Hooks**: `useX` in a `use-*.ts` file (kebab).
- **Files/folders**: predominantly **kebab-case** (`home-page.tsx`, `use-media.ts`).
- **Variables/functions**: camelCase.
- **CSS module** imported as `s` (dominant): `import s from "./x.module.scss"`.

Import order is defined in `biome.json` (`organizeImports`); don't arrange it by hand —
`pnpm check` sorts it into groups: `react` → packages → `@entities` → `@/`,`@shared` →
relative → `public` → `*.module.scss` (last), with blank lines between groups.

## Known codebase gotchas (don't copy as a pattern)

1. **Cyrillic in paths**: `src/widgets/сursor/` — the first letter is a Cyrillic `с` (U+0441).
   Breaks grep/auto-import. New names — Latin only. `emmiter` is a typo (should be `emitter`).
2. **Mixed kebab/camelCase** in file names (`ui-store.ts` vs `preloaderStore.ts`) and a
   PascalCase folder amid kebab (`shared/ui/Image-switcher/`). For new code, stick to kebab-case.
3. **`"use client"` is misleading** — there's no RSC (see above).

Reference files to copy patterns from are in [docs/examples/](../../../docs/examples/).
Related skills: [creating-a-component](../creating-a-component/SKILL.md),
[writing-styles](../writing-styles/SKILL.md), [project-typing](../project-typing/SKILL.md).
