import "gsap";

import type { AnimationPresetType } from "./animationPresetes";
/** Same union as `stagger` on GSAP tween vars: number, function, or `StaggerVars` object. */
export type GsapStagger = NonNullable<gsap.TweenVars["stagger"]>;

export type IntersectionAnimationType = {
  triggerOnce?: boolean;
  threshold?: number;
};

export type AnimationDefaultProps = {
  in?: number;
  out?: number;
};

export type AnimationStaggerValueType = {
  in?: GsapStagger;
  out?: GsapStagger;
};

export type AnimationValueType = AnimationDefaultProps | number;

/** in/out для ease — строки, как у GSAP (`EaseString`). */
export type AnimationEaseDefaultProps = {
  in?: string;
  out?: string;
};
export type AnimationEaseType = AnimationEaseDefaultProps | string;
export type AnimationStaggerType =
  | AnimationDefaultProps
  | AnimationStaggerValueType
  | number;

export interface AnimationPropsType {
  isVisible?: boolean;
  animateOnMount?: boolean;
  stagger?: AnimationStaggerType;
  duration?: AnimationValueType;
  delay?: AnimationValueType;
  ease?: AnimationEaseType;
  animation?: AnimationPresetType;
  onComplete?: (isVisible: boolean) => void;
}
