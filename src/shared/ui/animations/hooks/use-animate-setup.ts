import { useCallback, useLayoutEffect } from "react";
import { gsap } from "gsap";

import useValueUpdate from "@/shared/hooks/use-value-update";

import type { AnimationPresetType } from "../animationPresetes";
import { ANIMATION_PRESETS } from "../animationPresetes";
import type { AnimationPropsType } from "../types";
import type { AnimationProps } from "../utils";
import { getAnimationProps } from "../utils";
import type { SetupTimeline } from "../utils/create-setup-timeline";
import { createSetupTimeline } from "../utils/create-setup-timeline";

/** One phase (`in` / `out`) from {@link ANIMATION_PRESETS}. */
export type AnimationPresetPhase =
  (typeof ANIMATION_PRESETS)[AnimationPresetType]["in"];

/** Props passed into the hook (preset + tween props; `isVisible` is a separate argument). */
export type UseAnimateSetupProps = Omit<AnimationPropsType, "isVisible"> & {
  animation: AnimationPresetType;
};

type GsapTimeline = ReturnType<typeof gsap.timeline>;

export type AnimateSetupCreatAnim = (
  tl: SetupTimeline | GsapTimeline,
  animationProps: AnimationProps,
  animationSettings: AnimationPresetPhase,
) => void;

export const useAnimateSetup = (
  creatAnim: AnimateSetupCreatAnim,
  props: UseAnimateSetupProps,
  isVisible: boolean = false,
  animateOnMount: boolean = false,
  onComplete?: (isVisible: boolean) => void,
): void => {
  const animate = useCallback((newVisible: boolean) => {
    const tl = gsap.timeline({
      onComplete: () => onComplete?.(newVisible),
    });

    const phase = newVisible ? "in" : "out";
    const { animation: _animation, ...tweenProps } = props;
    const animationProps = getAnimationProps({ ...tweenProps, phase });
    const animationSettings = ANIMATION_PRESETS[props.animation][phase];
    creatAnim(tl, animationProps, animationSettings);

    return () => {
      tl.kill();
    };
  }, []);

  useLayoutEffect(() => {
    if (animateOnMount) {
      const animationSettings = ANIMATION_PRESETS[props.animation].out;
      const tl = createSetupTimeline();
      creatAnim(tl, {}, animationSettings);
      animate(isVisible);
      return;
    }

    const phase = isVisible ? "in" : "out";
    const animationSettings = ANIMATION_PRESETS[props.animation][phase];

    const tl = createSetupTimeline();
    creatAnim(tl, {}, animationSettings);
  }, []);

  useValueUpdate(animate, isVisible);
};
