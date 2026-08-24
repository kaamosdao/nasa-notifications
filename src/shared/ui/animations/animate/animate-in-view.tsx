import { Intersection } from "../../Intersection";
import type { IntersectionAnimationType } from "../types";
import Animate, { type AnimateProps } from "./animate";

export type AnimateInViewProps = IntersectionAnimationType & AnimateProps;

export const AnimateInView = ({
  children,
  threshold = 0.3,
  triggerOnce = true,
  ...props
}: AnimateInViewProps) => {
  return (
    <Intersection triggerOnce={triggerOnce} threshold={threshold}>
      <Animate {...props}>{children}</Animate>
    </Intersection>
  );
};
