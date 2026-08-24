"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

import s from "./fps.module.scss";

export type FpsWidgetProps = {
  className?: string;
  /** Позиция: "topLeft" | "topRight" | "bottomLeft" | "bottomRight" */
  position?: "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
  /** Показывать только в development */
  devOnly?: boolean;
};

export const FpsWidget = (props: FpsWidgetProps) => {
  const { className, position = "topRight", devOnly = true } = props;

  const [fps, setFps] = useState(0);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (devOnly && process.env.NODE_ENV !== "development") {
      return;
    }

    const tick = (now: number) => {
      frameCountRef.current += 1;
      const elapsed = now - lastTimeRef.current;

      if (elapsed >= 1000) {
        const currentFps = Math.round((frameCountRef.current * 1000) / elapsed);
        setFps(currentFps);
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    lastTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [devOnly]);

  if (devOnly && process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <div className={clsx(s.root, s[position], className)} aria-hidden>
      <span className={s.value}>{fps}</span>
      <span className={s.label}> FPS</span>
    </div>
  );
};

FpsWidget.displayName = "FpsWidget";
