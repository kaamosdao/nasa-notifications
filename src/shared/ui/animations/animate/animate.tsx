import { memo, useRef } from "react";

import { Slot } from "@shared/ui/slot";
import { composeRefs } from "@/shared/utils/compose-refs";
import { deepEqual } from "@/shared/utils/deep-equal";

import { useAnimateSetup } from "../hooks/use-animate-setup";
import type { AnimationPropsType } from "../types";

export interface AnimateProps extends AnimationPropsType {
  children: React.ReactNode;
  ref?: React.Ref<HTMLElement>;
}

const Animate = ({
  children,
  isVisible = false,
  stagger = 0.1,
  duration = 1,
  delay = 0,
  ease = "power3.out",
  animation = "fade",
  animateOnMount = false,
  ref,
  onComplete,
}: AnimateProps) => {
  const $root = useRef<HTMLElement>(null);

  useAnimateSetup(
    (tl, animationProps, animationSettings) => {
      tl.fromTo(
        $root.current,
        { ...animationSettings.from },
        { ...animationSettings.to, ...animationProps },
      );
    },
    { stagger, duration, delay, ease, animation },
    isVisible,
    animateOnMount,
    onComplete,
  );

  return <Slot ref={composeRefs(ref, $root)}>{children}</Slot>;
};

export default memo(Animate, (prevProps, nextProps) => {
  return deepEqual(prevProps, nextProps);
});

Animate.displayName = "Animate";
