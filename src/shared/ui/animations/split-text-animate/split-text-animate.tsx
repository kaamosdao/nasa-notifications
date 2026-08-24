import { memo, useLayoutEffect, useRef } from "react";
import clsx from "clsx";
import { gsap } from "gsap";

import { SplitText } from "@shared/ui/split-text";
import { composeRefs } from "@shared/utils/compose-refs";
import { deepEqual } from "@/shared/utils/deep-equal";

import { useAnimateSetup } from "../hooks/use-animate-setup";
import type { AnimationPropsType } from "../types";

import s from "./split-text-animate.module.scss";

export type SplitTextAnimateProps = AnimationPropsType & {
  className?: string;
  children: React.ReactNode;
  as?: React.ElementType;
  type?: "char" | "word";
  ref?: React.Ref<HTMLElement>;
  disableClip?: boolean;
  disableInnerSplitText?: boolean;
};

const SplitTextAnimate = ({
  className,
  children,
  isVisible,
  stagger = 0.02,
  duration = 1,
  delay = 0,
  as: As = "div",
  type = "word",
  animation = "slide",
  ease = "quartInOut",
  animateOnMount = false,
  onComplete,
  disableClip,
  disableInnerSplitText = false,
  ref,
}: SplitTextAnimateProps) => {
  const rootRef = useRef<HTMLElement>(null);
  const $letters = useRef<HTMLElement[]>([]);

  useLayoutEffect(() => {
    const q = gsap.utils.selector(rootRef.current);
    $letters.current = q(".char");
  }, []);

  useAnimateSetup(
    (tl, animationProps, animationSettings) => {
      tl.fromTo(
        $letters.current,
        { ...animationSettings.from },
        { ...animationSettings.to, ...animationProps, overwrite: "auto" },
      );
    },
    { stagger, duration, delay, ease, animation },
    isVisible ?? false,
    animateOnMount,
    onComplete,
  );

  return (
    <As
      ref={composeRefs(ref, rootRef)}
      className={clsx(s.root, className, { [s.disableClip]: disableClip })}
    >
      {disableInnerSplitText ? (
        children
      ) : (
        <SplitText type={type}>{children}</SplitText>
      )}
    </As>
  );
};

SplitTextAnimate.displayName = "SplitTextAnimate";

export default memo(SplitTextAnimate, (prevProps, nextProps) => {
  return deepEqual(prevProps, nextProps);
});
