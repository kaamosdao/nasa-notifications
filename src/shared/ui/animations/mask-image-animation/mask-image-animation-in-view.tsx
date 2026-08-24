import { Intersection } from "../../Intersection";
import type { IntersectionAnimationType } from "../types";
import {
  default as MaskImageAnimation,
  type MaskImageAnimationProps,
} from "./mask-image-animation";

export type MaskImageAnimationInViewProps = MaskImageAnimationProps &
  IntersectionAnimationType;

export const MaskImageAnimationInView = ({
  children,
  triggerOnce = true,
  threshold = 0.3,
  ...rest
}: MaskImageAnimationInViewProps) => {
  return (
    <Intersection triggerOnce={triggerOnce} threshold={threshold}>
      <MaskImageAnimation {...rest}>{children}</MaskImageAnimation>
    </Intersection>
  );
};
