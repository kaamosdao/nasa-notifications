import { useEffect } from "react";

import { EVENTS_TRANSITION_LAYOUT, transitionLayoutEmitter } from "../emmiter";

export const useTransitionStart = (callback: () => void) => {
  useEffect(() => {
    transitionLayoutEmitter.on(EVENTS_TRANSITION_LAYOUT.pageOutStart, callback);

    return () => {
      transitionLayoutEmitter.off(
        EVENTS_TRANSITION_LAYOUT.pageOutStart,
        callback,
      );
    };
  }, [callback]);
};
