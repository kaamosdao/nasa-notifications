---
name: animation
description: >-
  How animation works in this project: GSAP + Lenis smooth scroll + ScrollTrigger (bound to the custom
  #scroll scroller) + page transitions (transition-layout), all client-side under Pages Router. Central
  plugin registration, consuming scroll via useScroll/useElementLenisPosition (NOT window), and — most
  importantly — cleanup discipline (kill/revert tweens, ScrollTriggers, observers, listeners on unmount).
  Use ALWAYS when adding or editing animation: GSAP tweens/timelines, ScrollTrigger, scroll-driven effects,
  reveal-on-scroll, parallax, marquee, cursor, page transitions, split-text — "animate this", "add a
  scroll animation", "make it move", "parallax", "why does the animation leak / jump after navigation".
---

# Animation (GSAP + Lenis + ScrollTrigger)

The stack is **GSAP** (tweens/timelines, `CustomEase`, `ScrollToPlugin`, `ScrollTrigger`, `Observer`) +
**Lenis** smooth scroll + page transitions (`transition-layout`). All of it is **client-only** and runs
in effects — this is Pages Router, so never touch `window`/DOM during render (hydration).

Reuse the existing primitives before writing raw GSAP:
`Animate`/`AnimateInView` (`shared/ui/animate`), `SplitText` (`shared/ui/split-text`), `Sequence`,
`Transition`/`animate-presence`, `TransitionLayout` (page transitions), and the scroll hooks below.

## Don't register plugins yourself

GSAP config and plugin registration happen **once, centrally** in `src/widgets/gsap/` (`gsap.tsx` +
`modules.tsx`, mounted in `_app`). Plugins registered there: `CustomEase`, `ScrollToPlugin`,
`ScrollTrigger`, `Observer`. In components just `import { gsap } from "gsap"` and use it — do **not**
call `gsap.registerPlugin(...)` again (double registration / SSR issues).

## ScrollTrigger is bound to the Lenis scroller `#scroll`

The page does **not** scroll on `window` — it scrolls inside the Lenis container with `id="scroll"`.
`modules.tsx` sets `ScrollTrigger.defaults({ scroller: "#scroll" })`, so every ScrollTrigger you create
inherits that scroller. Consequences:
- Lenis drives ScrollTrigger: `useScroll(() => ScrollTrigger.update())`; on resize → `ScrollTrigger.refresh()`
  (handled by `widgets/scroll` core hooks). You usually don't wire this yourself.
- Positions/`start`/`end` are relative to `#scroll`, not the viewport top. Don't assume `window` scroll.

## Consume scroll through the hooks, never `window`

- **`useScroll(callback, deps?, priority?)`** (`@widgets/scroll/hooks/use-scroll`) — subscribe to Lenis
  scroll frames; it **auto-removes** the callback on unmount. Returns the Lenis instance.
- **`useElementLenisPosition(onUpdate)`** (`@shared/hooks/use-element-lenis-position`) — element position
  relative to Lenis scroll (for parallax/pinning), with resize handling built in.
- **`useCurrentScroll()`** — raw context (`scroll`, `addCallback`, `removeCallback`).

Do **not** add `window.addEventListener("scroll", ...)` — it won't fire the way you expect (Lenis owns scroll).

## Cleanup discipline (the #1 rule — MR review flags this)

Every animation artifact must be torn down on unmount / before re-running, or it leaks (keeps firing after
navigation, double-binds, drops FPS). Since the project does **not** use `@gsap/react`/`useGSAP`, cleanup is
**manual**. Patterns actually used here:

- **Tween/timeline** — keep a ref (or a stable `id`) and kill/revert on cleanup:
  ```ts
  const tween = useRef<gsap.core.Tween | null>(null);
  useEffect(() => {
    tween.current = gsap.to(el, { /* ... */, overwrite: "auto" });
    return () => { tween.current?.kill(); };
  }, []);
  ```
  (`shared/ui/animate/animate.tsx` uses `id` + `gsap.getById(id)?.revert()` and `overwrite: "auto"`.)
- **ScrollTrigger** — kill the instance on unmount: `const st = ScrollTrigger.create({...}); return () => st.kill();`.
- **Scroll callbacks** — use `useScroll(cb)`; it removes the callback automatically. Don't hand-roll.
- **Observer / event listeners / rAF** — pair every `add` with a `remove`/`cancel` in the effect cleanup.
- **Batch/DOM-heavy setups** — `const ctx = gsap.context(() => { ... }, scopeRef); return () => ctx.revert();`.
- Run all of this in `useEffect`/`useLayoutEffect`, never in render. Use `useLayoutEffect` for the initial
  `gsap.set(...)` to avoid a flash of unstyled/pre-animated content.

## Page transitions

Route transitions go through `TransitionLayout` (`_app`, wraps the page inside `Scroll`). Enter/leave
animations for a page hook into it (see `widgets/transition-layout`), and scroll position is reset via the
scroll core hooks (`use-scroll-page-transition`). When adding a page-level intro/outro, integrate with
`TransitionLayout` rather than animating on raw mount — otherwise it fights the transition.

## Reduced motion

Guard non-essential motion: `if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;`
(inside the effect) — skip or shorten heavy scroll/parallax animations for accessibility.

## Pitfalls

1. **Leaks after navigation** — a tween/ScrollTrigger/listener without cleanup keeps running on the next
   page. Always kill/revert on unmount (see above). This is the most common real bug and MR review flags it.
2. **`window` scroll assumptions** — the scroller is `#scroll` (Lenis), not the window. Use `useScroll`.
3. **Re-registering plugins** — don't; it's central in `widgets/gsap`.
4. **Animating in render / SSR** — GSAP touches the DOM; keep it in effects, or you get hydration mismatch
   and "not defined" on the server.
5. **Stale ScrollTrigger positions** — after layout/content changes call `ScrollTrigger.refresh()`
   (the scroll widget does it on resize; do it manually after async content that changes height).

## Checklist

- [ ] Reused an existing primitive (`Animate`/`SplitText`/`useScroll`/…) where possible
- [ ] No `gsap.registerPlugin` in the component (central in `widgets/gsap`)
- [ ] Scroll consumed via `useScroll`/`useElementLenisPosition`, not `window`
- [ ] Every tween/timeline/ScrollTrigger/Observer/listener is killed/reverted on unmount
- [ ] Animation code runs in effects; initial `gsap.set` in `useLayoutEffect` to avoid flash
- [ ] `prefers-reduced-motion` guarded for non-essential motion
- [ ] Page-level intro/outro integrates with `TransitionLayout`
