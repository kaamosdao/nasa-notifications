/** Keys that belong to tween config, not to DOM style props. */
const TWEEN_ONLY_KEYS = new Set([
  "delay",
  "duration",
  "ease",
  "stagger",
  "overwrite",
  "repeat",
  "repeatDelay",
  "yoyo",
  "immediateRender",
  "clearProps",
]);

function stripTweenOnlyKeys(
  vars: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...vars };
  for (const key of TWEEN_ONLY_KEYS) {
    delete out[key];
  }
  return out;
}

function normalizeTargets(
  target: Element | Iterable<Element> | null | undefined,
): HTMLElement[] {
  if (target == null) return [];
  if (target instanceof Element) return [target as HTMLElement];
  if (typeof Symbol !== "undefined" && Symbol.iterator in Object(target)) {
    return Array.from(target as Iterable<Element>).filter(
      (n): n is HTMLElement => n instanceof HTMLElement,
    );
  }
  return [];
}

function numPx(value: unknown, fallback = 0): string {
  if (value === undefined || value === null) return `${fallback}px`;
  if (typeof value === "number" && !Number.isNaN(value)) return `${value}px`;
  const s = String(value).trim();
  if (
    s.endsWith("px") ||
    s.endsWith("em") ||
    s.endsWith("rem") ||
    s.endsWith("%") ||
    s.endsWith("deg") ||
    s === "auto"
  ) {
    return s;
  }
  const n = Number.parseFloat(s);
  return Number.isNaN(n) ? `${fallback}px` : `${n}px`;
}

function numDeg(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const n = Number.parseFloat(String(value));
  return Number.isNaN(n) ? undefined : n;
}

function numUnit(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const n = Number.parseFloat(String(value));
  return Number.isNaN(n) ? undefined : n;
}

const TRANSFORM_KEYS = new Set([
  "x",
  "y",
  "z",
  "xPercent",
  "yPercent",
  "zPercent",
  "rotation",
  "rotationX",
  "rotationY",
  "rotationZ",
  "skewX",
  "skewY",
  "scale",
  "scaleX",
  "scaleY",
  "transformPerspective",
]);

/**
 * Builds a `transform` string from GSAP-style props (subset aligned with GSAP 3
 * 2D/3D order: perspective → translate(px) → translate(%) → rotateZ → rotateX/Y → skew → scale).
 */
function buildTransformFromGsapVars(
  vars: Record<string, unknown>,
): string | null {
  const x = numUnit(vars.x);
  const y = numUnit(vars.y);
  const z = numUnit(vars.z);
  const xPercent = numUnit(vars.xPercent);
  const yPercent = numUnit(vars.yPercent);
  const zPercent = numUnit(vars.zPercent);

  const rotation = numDeg(vars.rotation);
  const rotationX = numDeg(vars.rotationX);
  const rotationY = numDeg(vars.rotationY);
  const rotationZ = numDeg(vars.rotationZ);

  const skewX = numDeg(vars.skewX);
  const skewY = numDeg(vars.skewY);

  const scaleRaw = numUnit(vars.scale);
  const scaleX = numUnit(vars.scaleX);
  const scaleY = numUnit(vars.scaleY);

  const perspective = numUnit(vars.transformPerspective);

  const hasTranslatePx = x !== undefined || y !== undefined || z !== undefined;
  const hasTranslatePct =
    xPercent !== undefined || yPercent !== undefined || zPercent !== undefined;
  const hasRotation =
    rotation !== undefined ||
    rotationX !== undefined ||
    rotationY !== undefined ||
    rotationZ !== undefined;
  const hasSkew = skewX !== undefined || skewY !== undefined;
  const hasScale =
    scaleRaw !== undefined || scaleX !== undefined || scaleY !== undefined;
  const hasPerspective = perspective !== undefined;

  if (
    !hasTranslatePx &&
    !hasTranslatePct &&
    !hasRotation &&
    !hasSkew &&
    !hasScale &&
    !hasPerspective
  ) {
    return null;
  }

  const parts: string[] = [];

  if (hasPerspective) {
    parts.push(`perspective(${numPx(perspective)})`);
  }

  if (hasTranslatePx) {
    parts.push(`translate3d(${numPx(x, 0)}, ${numPx(y, 0)}, ${numPx(z, 0)})`);
  }

  if (hasTranslatePct) {
    parts.push(
      `translate3d(${xPercent ?? 0}%, ${yPercent ?? 0}%, ${zPercent ?? 0}%)`,
    );
  }

  if (rotation !== undefined) {
    parts.push(`rotate(${rotation}deg)`);
  }
  if (rotationX !== undefined) {
    parts.push(`rotateX(${rotationX}deg)`);
  }
  if (rotationY !== undefined) {
    parts.push(`rotateY(${rotationY}deg)`);
  }
  if (rotationZ !== undefined) {
    parts.push(`rotateZ(${rotationZ}deg)`);
  }

  if (skewX !== undefined) {
    parts.push(`skewX(${skewX}deg)`);
  }
  if (skewY !== undefined) {
    parts.push(`skewY(${skewY}deg)`);
  }

  if (hasScale) {
    let sx = 1;
    let sy = 1;
    if (scaleRaw !== undefined) {
      sx = scaleRaw;
      sy = scaleRaw;
    }
    if (scaleX !== undefined) sx = scaleX;
    if (scaleY !== undefined) sy = scaleY;
    parts.push(`scale(${sx}, ${sy})`);
  }

  return parts.length > 0 ? parts.join(" ") : null;
}

/**
 * Applies end-state vars from a GSAP-style `to` object without using `gsap.set`.
 * Handles opacity, filter, pointerEvents, transform (x/y/z px, x/y/z %, rotation*,
 * skew*, scale*, transformPerspective), transformOrigin, and any `--*` custom property.
 */
function applySetupStyleVars(
  el: HTMLElement,
  vars: Record<string, unknown>,
): void {
  const cleaned = stripTweenOnlyKeys(vars);

  let opacity: string | undefined;
  let filterVal: string | undefined;
  let pointerEvents: string | undefined;
  let transformOrigin: string | undefined;
  const customProps: Array<[string, string]> = [];

  const transformInput: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(cleaned)) {
    if (value === undefined) continue;

    if (key === "opacity") {
      opacity = String(value);
    } else if (key === "filter") {
      filterVal = String(value);
    } else if (key === "pointerEvents") {
      pointerEvents = String(value);
    } else if (key === "transformOrigin") {
      transformOrigin = String(value);
    } else if (key.startsWith("--")) {
      customProps.push([key, String(value)]);
    } else if (TRANSFORM_KEYS.has(key)) {
      transformInput[key] = value;
    }
  }

  if (opacity !== undefined) el.style.opacity = opacity;
  if (filterVal !== undefined) el.style.filter = filterVal;
  if (pointerEvents !== undefined) el.style.pointerEvents = pointerEvents;
  if (transformOrigin !== undefined) {
    el.style.transformOrigin = transformOrigin;
  }

  const transform = buildTransformFromGsapVars(transformInput);
  if (transform !== null) {
    el.style.transform = transform;
  }

  for (const [k, v] of customProps) {
    el.style.setProperty(k, v);
  }
}

export interface SetupTimeline {
  fromTo: (
    target: Element | Iterable<Element> | null | undefined,
    fromVars: Record<string, unknown>,
    toVars: Record<string, unknown>,
    position?: number | string,
  ) => void;
}

/**
 * Minimal timeline-like object for mount-time setup: each `fromTo` applies
 * only the end state as plain inline / custom properties (no GSAP, no Timeline).
 */
export function createSetupTimeline(): SetupTimeline {
  return {
    fromTo(target, _fromVars, toVars) {
      const elements = normalizeTargets(target);
      if (elements.length === 0) return;

      const vars = toVars as Record<string, unknown>;
      for (const el of elements) {
        applySetupStyleVars(el, vars);
      }
    },
  };
}
