---
name: cms-content-rendering
description: >-
  How to render Strapi content on the frontend safely: Blocks (@strapi/blocks-react-renderer — the only
  wired path, React-escaped and safe), rich text / HTML (normalizeRichText → RichTextRenderer, sanitize),
  and dynamic zones (DynamicZoneRenderer mapping __component → components). The security angle matters —
  raw CMS HTML in dangerouslySetInnerHTML / html-react-parser is an XSS vector and the project's sanitizer
  is weak. Use ALWAYS when rendering CMS content: blocks, rich text, HTML from Strapi, dynamic zones,
  dangerouslySetInnerHTML, "render the article body", "show the rich text", "why is the CMS HTML unsafe".
---

# Rendering CMS content (Strapi → Next.js)

Three mechanisms exist; **only Blocks is actually wired**. The `src/shared/content-types/*` layer and
`DynamicZoneRenderer` are **scaffolding** (grep shows nothing imports them) — treat them as templates,
not working code. `DOMPurify`/`sanitize-html` are **not** installed.

## 1. Blocks — the working, safe path

Strapi `blocks` fields render via `@strapi/blocks-react-renderer`:
```tsx
import { BlocksRenderer } from "@strapi/blocks-react-renderer";
{content && <BlocksRenderer content={content} />}   // content: BlocksContent
```
Live example: `src/_pages/home/ui/home-page.tsx`. The library maps nodes (paragraph/heading/list/link/
image/quote/code) to React elements and **React escapes text** — no `dangerouslySetInnerHTML`, minimal
XSS risk. Customize nodes via the `blocks`/`modifiers` props. Type the field as `BlocksContent`
(validated loosely with `z.custom<BlocksContent>()` — the shape isn't runtime-checked; trust the backend).
**Prefer Blocks for CMS body content.**

## 2. Rich text / HTML — scaffolding, sanitize-dependent

Intended chain (`src/shared/content-types/`): raw HTML → `normalizeRichText` (adapter) →
`RichTextRenderer`.
- `adapters/richText.adapter.ts` — `normalizeRichText(input)` validates via `RichTextSchema` and calls
  `sanitizeHtml(html)`.
- `renderers/richTextRenderer.tsx` — `<div dangerouslySetInnerHTML={{ __html: value.html }} />`. It does
  **no sanitizing itself** — safety depends entirely on the value having gone through `normalizeRichText`.

⚠️ **`utils/sanitize.ts` is weak.** `sanitizeHtml` only strips `<script>…</script>` with a regex — it does
**not** remove `onerror=`/`onload=` handlers, `javascript:` hrefs, `<iframe>`, `<svg onload>`, etc. For
production, replace it with **DOMPurify** (isomorphic wrapper for SSR). Never pass raw CMS HTML into
`RichTextRenderer` without `normalizeRichText`.

## 3. Dynamic zones — scaffolding

`src/shared/ui/dynamic-zone-renderer/` maps `__component` (uid) → a React component:
```tsx
<DynamicZoneRenderer
  blocksData={zone}                                  // array of { id, __component, ...fields }
  blocksSchema={{ "sections.faq": FaqSection }}      // uid → component
  additionalData={{ "sections.faq": extraProps }}
/>
```
Unknown `__component` → the block is skipped (`null`). ⚠️ Spread order is `{...additionalData} {...block}`,
so **CMS block fields override `additionalData`** (and `sectionId`) — contrary to the README. The renderer's
local types are not linked to `dynamicZone.schema.ts`.

## Security — where CMS data becomes XSS

`dangerouslySetInnerHTML` / `html-react-parser` with CMS strings is the risk surface. Audit these:
1. **`content-types/renderers/richTextRenderer.tsx`** — CMS HTML; safe only after `normalizeRichText`.
2. **`shared/ui/burger/burger.tsx`** — interpolates `text`/`closeText` props directly into
   `dangerouslySetInnerHTML` with **no** sanitize. If those come from the CMS → XSS. Don't feed CMS strings in raw.
3. **`shared/ui/split-text`** — `html-react-parser` parses strings containing HTML **without sanitize**.
   It won't run `<script>`, but carries inline handlers/attributes. Don't pass raw CMS HTML into `SplitText`.
4. `seo-layout/ld-json`, analytics inline scripts — controlled data; escape `<` in JSON-LD.

Rule: **CMS text is untrusted.** Prefer Blocks (auto-escaped). If you must render HTML, sanitize with
DOMPurify in an adapter, then render — never render raw.

## Scaffolding caveats (don't present as working)

- Nothing in `shared/content-types/*` or `DynamicZoneRenderer` is imported by the app.
- The README promises `dto/` + `mappers/` layers that don't exist (`adapters/` ≈ the mappers).
- `media.schema.ts` uses the **Strapi v4** response shape (`data.attributes.url`) — wrong for this v5
  project (flat shape). Don't reuse it as-is.

## Checklist

- [ ] Body content → `BlocksRenderer` (`BlocksContent`) — the safe default
- [ ] Raw HTML → `normalizeRichText` (sanitize) **before** `RichTextRenderer`; sanitizer upgraded to DOMPurify for prod
- [ ] No raw CMS string in `dangerouslySetInnerHTML` / `html-react-parser` / `SplitText` / `Burger`
- [ ] Dynamic zone: every `__component` mapped in `blocksSchema`; mind the `{...block}`-wins spread order
- [ ] Not relying on the unwired `content-types` scaffolding as if it were live
