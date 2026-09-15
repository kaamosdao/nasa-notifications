"use client";

import { useEffect, useRef } from "react";
import {
  EVENTS_TRANSITION_LAYOUT,
  transitionLayoutEmitter,
} from "@widgets/transition-layout/emmiter";
import { gsap } from "gsap";

import { usePerformanceStore } from "./use-performance-store";

const FPS_THRESHOLD = 30;
const MEASURE_INTERVAL_MS = 1000;

export const PerformanceDetect = () => {
  const performanceIndex = usePerformanceStore(
    (state) => state.performanceIndex,
  );
  const incrementPerformanceIndex = usePerformanceStore(
    (state) => state.actions.incrementPerformanceIndex,
  );

  /** Skip FPS measurement during page transition (it's heavy by design). */
  const isTransitionInProgressRef = useRef(false);

  useEffect(() => {
    const onTransitionStart = () => {
      isTransitionInProgressRef.current = true;
    };
    const onTransitionEnd = () => {
      isTransitionInProgressRef.current = false;
    };
    transitionLayoutEmitter.on(
      EVENTS_TRANSITION_LAYOUT.pageOutStart,
      onTransitionStart,
    );
    transitionLayoutEmitter.on(
      EVENTS_TRANSITION_LAYOUT.pageInComplete,
      onTransitionEnd,
    );
    return () => {
      transitionLayoutEmitter.off(
        EVENTS_TRANSITION_LAYOUT.pageOutStart,
        onTransitionStart,
      );
      transitionLayoutEmitter.off(
        EVENTS_TRANSITION_LAYOUT.pageInComplete,
        onTransitionEnd,
      );
    };
  }, []);

  useEffect(() => {
    if (performanceIndex === 0) return;

    const className = `perf-${performanceIndex}`;
    document.documentElement.classList.add(className);

    return () => {
      // document.documentElement.classList.remove(className);
    };
  }, [performanceIndex]);

  useEffect(() => {
    let measureStartTime = performance.now();
    /** Timestamps of each tick in the last second (sliding window). */
    const times: number[] = [];

    const refreshLoop = () => {
      if (usePerformanceStore.getState().performanceIndex >= 5) {
        gsap.ticker.remove(refreshLoop);
        return;
      }

      if (document.hidden) return;
      if (isTransitionInProgressRef.current) return;

      const now = performance.now();
      while (times.length > 0 && times[0] <= now - MEASURE_INTERVAL_MS) {
        times.shift();
      }
      times.push(now);
      const fps = times.length;

      if (now - measureStartTime >= MEASURE_INTERVAL_MS) {
        measureStartTime = now;
        if (fps < FPS_THRESHOLD) {
          incrementPerformanceIndex();
        }
      }
    };

    gsap.ticker.add(refreshLoop);

    return () => {
      gsap.ticker.remove(refreshLoop);
    };
  }, [incrementPerformanceIndex]);

  return null;
};

PerformanceDetect.displayName = "PerformanceDetect";
