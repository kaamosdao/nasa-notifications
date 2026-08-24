import type { ComponentProps } from "react";
import { memo } from "react";
import clsx from "clsx";

import { mod } from "@/shared/utils/css-mods";
import { deepEqual } from "@/shared/utils/deep-equal";

import { Animate, type AnimateProps } from "../animate";

import s from "./mask-image-animation.module.scss";

export interface MaskImageAnimationInViewProps extends ComponentProps<"div"> {
  children: React.ReactNode;
}

export type MaskImageAnimationProps = ComponentProps<"div"> &
  AnimateProps & {
    className?: string;
    direction?: "top" | "bottom" | "left" | "right" | "center" | "left-top";
    variant?: "radial" | "linear";
    as?: string | React.ComponentType<any>;
  };

const MaskImageAnimation = ({
  className,
  direction = "center",
  variant = "radial",
  isVisible,
  ease = "power3.out",
  children,
  as: As = "div",
  ref,
  ...rest
}: MaskImageAnimationProps) => {
  const mods = mod(s, {
    direction,
    variant,
  });

  return (
    <Animate
      ref={ref}
      isVisible={isVisible}
      animation="progress"
      ease={ease}
      {...rest}
    >
      <As className={clsx(s.root, className, mods)}>{children}</As>
    </Animate>
  );
};

export default memo(MaskImageAnimation, (prevProps, nextProps) => {
  return deepEqual(prevProps, nextProps);
});
