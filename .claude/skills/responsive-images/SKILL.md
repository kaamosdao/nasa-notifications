---
name: responsive-images
description: >-
  How to render CMS/media images on the frontend via the MediaImage component and imgproxy: the
  source/image/src props, the MediaWithBreakpoints shape ({xs,sm,md,lg,default} from the media-serializer),
  srcSet/sizes built through imgproxy from the image url, the imgSizes() helper, and the two distinct
  breakpoint sets. Use ALWAYS when rendering an image from Strapi, a responsive/adaptive image, art-direction
  per breakpoint, srcSet/sizes, imgproxy, an avatar/cover/hero image — "show this image", "make the image
  responsive", "why is the image blurry / not loading / huge", "different image on mobile".
---

# Responsive images (MediaImage + imgproxy)

Render CMS media with **`MediaImage`** (`src/shared/ui/media-image`) — never a raw `<img>` for CMS
content. It emits a `<picture>` with per-breakpoint `<source srcSet sizes media type>` + a fallback
`<img>`, and builds every URL through **imgproxy** (webp, on-the-fly resize). If the source is empty it
renders **`null`** (no broken `<img>`).

## Three ways to pass an image

| Prop | Type | When |
|---|---|---|
| `source` | `MediaWithBreakpoints` | **CMS media** (the `shared.media` component) — the main path; supports different images per breakpoint |
| `image` | `RebuiltImage` | a single rebuilt image without breakpoints |
| `src` | `string` | a raw URL string (static/external) |

`MediaWithBreakpoints` = `Partial<Record<"xs"|"sm"|"md"|"lg"|"xl"|"2xl"|"default", RebuiltImage>>`. From the
backend it arrives as `{ xs, sm, md, lg, default }` — the Strapi `shared.media` component reshaped by the
`media-serializer` middleware (it renames `media` → `default` and drops the visibility flags). See the
`creating-strapi-component` skill.

Common props: `sizes` (defaults to `DEFAULT_SIZES = imgSizes({ md: 100, default: 50 })`),
`loading` (`"lazy"` default), `fetchPriority`, `objectFit` (`"cover"` default), `aspectRatio`
(when set, `img` width/height are dropped for `style.aspectRatio`), `placeholder` (animated placeholder on),
`alt`/`altText`/`fallbackAlt` (priority in that order).

```tsx
<MediaImage source={homePage.media} sizes={imgSizes({ md: 100, default: 50 })} />
```

## How srcSet / sizes / URLs are built

- **srcSet widths** come from `IMAGE_BREAKPOINTS` (320/720/1440/1920/2560), filtered below
  `min(image.width, IMAGE_MAX_WIDTH=2560)` — so they never exceed the natural width.
- **`sizes`** is authored with **`imgSizes({ [breakpointKey]: vw, default: vw })`** — it maps
  **viewport** `BREAKPOINTS` (360/481/769/1025/1280/1440) to `(max-width: Npx) Xvw` + a trailing `default vw`.
- **`<source media>`** uses viewport `BREAKPOINTS` (`max-width`), with `default` → `(min-width: 0px)` and
  forced to the **end** of `<picture>` (correct fallback order).
- **URLs** go through `imageproxyUrl(url, format, dpr, quality, { width })` → `@imgproxy/imgproxy-node`,
  same-origin at `/imgproxy` (`IMG_PROXY_DEFAULTS = { format: "webp", quality: 90, dpr: 1 }`).

## The fields you must populate

`MediaImage` reads `url`, `width`, `height`, `alt`/`alternativeText`. So a media query **must** request
those — use `MEDIA_FIELDS` / `mediaBreakpointsPopulate` from `src/shared/api/strapi/populate.ts` (see
`server-data-fetching`). `formats` is **not** needed (srcSet is generated from `url` via imgproxy). If
`width`/`height` are missing, the `img` loses its intrinsic dimensions and srcSet won't cap at natural width.

## Pitfalls

1. **Two different breakpoint sets.** Viewport `BREAKPOINTS` (for `<source media>` + `imgSizes`) vs
   `IMAGE_BREAKPOINTS` (for srcSet widths). Don't mix them; `IMAGE_BREAKPOINTS["2xl"]` is `null` (no width).
2. **Missing `width`/`height` in populate** → no intrinsic `img` size and no natural-width cap. Keep them in `MEDIA_FIELDS`.
3. **imgproxy uses only the URL pathname** (`local://{pathname}{search}`) — the image must be reachable by
   imgproxy at that path (Strapi uploads volume / the `/imgproxy` rewrite). External absolute URLs on a
   different host lose the host and resolve locally. Only `% ? @` are escaped in the path.
4. **Type vs runtime shape.** Backend keys hold raw Strapi media (`url/width/height/mime/alternativeText`),
   while the type promises `RebuiltImage`; the component tolerates both (`alt ?? alternativeText`), but rely
   on `width/height` being present.
5. **Don't use `next/image` here** — the responsive/imgproxy pipeline is custom; `MediaImage` is the component.

## Checklist

- [ ] `MediaImage` (not raw `<img>`) for CMS media; `source` for breakpoint media
- [ ] Query populated with `MEDIA_FIELDS` (incl. `width`/`height`) via `mediaBreakpointsPopulate`
- [ ] `sizes` authored with `imgSizes({...})` matching the layout
- [ ] `alt` provided; `aspectRatio`/`objectFit` set where layout needs it
- [ ] Not confusing viewport `BREAKPOINTS` with `IMAGE_BREAKPOINTS`
