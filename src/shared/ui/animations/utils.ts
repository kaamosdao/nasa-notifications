import type { AnimationPropsType, GsapStagger } from "./types";

/** Скаляр или `{ in, out }` → одно значение по фазе. */
function pickInOut<T>(
  value: T | { in?: T; out?: T } | undefined,
  phase: "in" | "out",
): T | undefined {
  if (value === undefined) return undefined;
  if (value !== null && typeof value === "object") {
    return (value as { in?: T; out?: T })[phase];
  }
  return value as T;
}

/** Уже «плоские» значения для передачи в GSAP (без in/out). */
export type AnimationProps = {
  delay?: number;
  duration?: number;
  ease?: string;
  stagger?: GsapStagger;
};

export const getAnimationProps = ({
  delay,
  duration,
  ease,
  stagger,
  phase,
}: Omit<AnimationPropsType, "animation" | "isVisible"> & {
  phase: "in" | "out";
}): AnimationProps => {
  return {
    delay: pickInOut(delay, phase),
    duration: pickInOut(duration, phase),
    ease: pickInOut(ease, phase),
    stagger: pickInOut(stagger, phase),
  };
};
