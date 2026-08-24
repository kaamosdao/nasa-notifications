import { forwardRef, memo } from "react";
import clsx from "clsx";

import { SplitText } from "@shared/ui/split-text";
import { composeRefs } from "@shared/utils/compose-refs";
import { deepEqual } from "@shared/utils/deep-equal";

import { useAnimateSetup } from "../hooks/use-animate-setup";
import type { AnimationPropsType } from "../types";
import { useGetLines } from "./hooks/use-get-lines";

import s from "./line-by-line-animation.module.scss";

type ChildrenLine = {
  word: HTMLElement;
  chars: HTMLElement[];
};

export interface LineByLineAnimationProps extends AnimationPropsType {
  className?: string;
  children: React.ReactNode;
  as?: React.ElementType;
  type?: "char" | "word";
  shiftPercent?: number;
}

const LineByLineAnimation = forwardRef<
  HTMLDivElement,
  LineByLineAnimationProps
>(
  (
    {
      className,
      children,
      isVisible = false,
      stagger = 0.1,
      duration = 1,
      delay = 0,
      ease = "power3.out",
      as: As = "div",
      type = "word",
      animation = "slide",
      animateOnMount = false,
      onComplete,
    },
    ref,
  ) => {
    const [rootRef, vars, linesVersion] = useGetLines();

    useAnimateSetup(
      (tl, animationProps, animationSettings) => {
        const staggerValueNumber =
          typeof animationProps.stagger === "number"
            ? animationProps.stagger
            : 0;

        [...vars.lines.values()].forEach((line, i) => {
          line.forEach((childrenLine: ChildrenLine) => {
            tl.fromTo(
              childrenLine.word,
              { "--animation-word": isVisible ? 0 : 1 },
              {
                "--animation-word": isVisible ? 1 : 0,
                duration: animationProps.duration,
                delay: animationProps.delay,
                ease: animationProps.ease,
                overwrite: "auto",
              },
              i * staggerValueNumber,
            );

            tl.fromTo(
              childrenLine.chars,
              { ...animationSettings.from },
              {
                ...animationSettings.to,
                duration: animationProps.duration,
                delay: animationProps.delay,
                ease: animationProps.ease,
                overwrite: "auto",
              },
              i * staggerValueNumber,
            );
          });
        });
      },
      { stagger, duration, delay, ease, animation },
      isVisible,
      animateOnMount,
      onComplete,
    );

    const AsComponent = As as React.ComponentType<{
      ref?: React.Ref<HTMLElement | null>;
      className?: string;
      children?: React.ReactNode;
    }>;

    return (
      <AsComponent
        ref={composeRefs(ref, rootRef)}
        className={clsx(s.root, className)}
      >
        <SplitText type={type}>{children}</SplitText>
      </AsComponent>
    );
  },
);

LineByLineAnimation.displayName = "LineByLineAnimation";

export default memo(LineByLineAnimation, (prevProps, nextProps) => {
  return deepEqual(prevProps, nextProps);
});
