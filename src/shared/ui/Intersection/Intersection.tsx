import {
  cloneElement,
  forwardRef,
  isValidElement,
  type ReactElement,
  type Ref,
} from "react";

import { useIntersectionObserver } from "@/shared/hooks/use-intersection-observer";
import { composeRefs } from "@/shared/utils/compose-refs";
import { useVisiblePage } from "@/widgets/transition-layout/hooks/use-visible-page";

export type IntersectionRenderProps = {
  ref: Ref<Element | null>;
  [key: string]: boolean | Ref<Element | null>;
};

export type IntersectionProps = {
  triggerOnce?: boolean;
  propsName?: string;
  threshold?: number | number[];
  children:
    | ReactElement
    | ((props: IntersectionRenderProps) => React.ReactNode);
};

export const Intersection = forwardRef<Element, IntersectionProps>(
  function Intersection(
    { threshold, triggerOnce = true, children, propsName = "isVisible" },
    ref,
  ) {
    const isVisiblePage = useVisiblePage();
    const [intersectionRef, inView] = useIntersectionObserver<Element>({
      triggerOnce,
      threshold,
    });

    const mergedRef = composeRefs<Element>(ref, intersectionRef);

    if (typeof children === "function") {
      return children({
        ref: mergedRef,
        [propsName]: inView && isVisiblePage,
      });
    }

    if (!isValidElement(children)) {
      return null;
    }

    return cloneElement(
      children as ReactElement<{ ref?: Ref<Element | null> }>,
      {
        ref: mergedRef,
        [propsName]: inView && isVisiblePage,
      },
    );
  },
);

Intersection.displayName = "Intersection";
