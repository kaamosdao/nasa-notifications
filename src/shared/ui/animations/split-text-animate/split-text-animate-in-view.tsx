import { Intersection } from "../../Intersection";
import {
  default as SplitTextAnimate,
  type SplitTextAnimateProps,
} from "./split-text-animate";

export interface SplitTextAnimateInViewProps extends SplitTextAnimateProps {
  triggerOnce?: boolean;
  threshold?: number;
}

export const SplitTextAnimateInView = ({
  children,
  triggerOnce = true,
  threshold = 0.3,
  ...props
}: SplitTextAnimateInViewProps) => {
  return (
    <Intersection triggerOnce={triggerOnce} threshold={threshold}>
      <SplitTextAnimate {...props}>{children}</SplitTextAnimate>
    </Intersection>
  );
};

SplitTextAnimateInView.displayName = "SplitTextAnimateInView";
