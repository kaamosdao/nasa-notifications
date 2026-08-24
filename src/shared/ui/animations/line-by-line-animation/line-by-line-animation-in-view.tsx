import { memo } from "react";

import { deepEqual } from "@shared/utils/deep-equal";

import { Intersection } from "../../Intersection";
import type { IntersectionAnimationType } from "../types";
import LineByLineAnimation, {
  type LineByLineAnimationProps,
} from "./line-by-line-animation";

export type LineByLineAnimationInViewProps = LineByLineAnimationProps &
  IntersectionAnimationType;

const LineByLineAnimationInView = ({
  threshold = 0.3,
  triggerOnce = true,
  ...props
}: LineByLineAnimationInViewProps) => {
  return (
    <Intersection triggerOnce={triggerOnce} threshold={threshold}>
      <LineByLineAnimation {...props} />
    </Intersection>
  );
};

export default memo(LineByLineAnimationInView, (prevProps, nextProps) => {
  return deepEqual(prevProps, nextProps);
});
