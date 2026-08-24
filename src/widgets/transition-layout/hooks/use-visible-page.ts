import { useEffect, useState } from "react";
import gsap from "gsap";

import { useTransitionLayout } from "./use-transition-layout";

export const useVisiblePage = () => {
  const { isVisible: isVisiblePage } = useTransitionLayout();
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    if (isVisiblePage) {
      const call = gsap.delayedCall(0.3, () => {
        setIsVisible(isVisiblePage);
      });

      return () => {
        call.kill();
      };
    }
  }, [isVisiblePage]);

  return isVisible;
};
