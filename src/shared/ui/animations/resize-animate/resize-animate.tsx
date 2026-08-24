"use client";

import type { ReactNode, Ref } from "react";
import { useLayoutEffect, useRef } from "react";
import clsx from "clsx";
import { gsap } from "gsap";

import { Slot } from "@shared/ui/slot";
import { composeRefs } from "@/shared/utils/compose-refs";

import s from "./resize-animate.module.scss";

export type ResizeAnimateAxis = "both" | "width" | "height";

export type ResizeAnimateProps = {
  children: ReactNode;
  axis?: ResizeAnimateAxis;
  duration?: number;
  ease?: string;
  animateOnMount?: boolean;
  className?: string;
  ref?: Ref<HTMLElement | null>;
  onResizeComplete?: () => void;
};

type Size = { width: number; height: number };

const EPS = 0.5;

const readSize = (entry: ResizeObserverEntry): Size => {
  const border = entry.borderBoxSize?.[0];
  if (border) {
    return { width: border.inlineSize, height: border.blockSize };
  }
  const rect = entry.target.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
};

export const ResizeAnimate = (props: ResizeAnimateProps) => {
  const {
    children,
    axis = "both",
    duration = 0.5,
    ease = "power3.out",
    animateOnMount = false,
    className,
    ref,
    onResizeComplete,
  } = props;

  const $el = useRef<HTMLElement>(null);
  const prevRef = useRef<Size | null>(null);

  useLayoutEffect(() => {
    const el = $el.current;
    if (!el) return;

    const animateWidth = axis === "both" || axis === "width";
    const animateHeight = axis === "both" || axis === "height";

    let isAnimating = false;

    const pickVars = (size: Size): gsap.TweenVars => {
      const vars: gsap.TweenVars = {};
      if (animateWidth) vars.width = size.width;
      if (animateHeight) vars.height = size.height;
      return vars;
    };

    // Возвращаем элемент к натуральному размеру (auto), чтобы он снова
    // реагировал на изменения контента после твина.
    const releaseSize = () => {
      const axes: string[] = [];
      if (animateWidth) axes.push("width");
      if (animateHeight) axes.push("height");
      if (axes.length) gsap.set(el, { clearProps: axes.join(",") });
    };

    const tween = (from: gsap.TweenVars, to: Size) => {
      isAnimating = true;
      gsap.fromTo(el, from, {
        ...pickVars(to),
        duration,
        ease,
        overwrite: true,
        onComplete: () => {
          releaseSize();
          isAnimating = false;
          onResizeComplete?.();
        },
      });
    };

    const run = (next: Size) => {
      const prev = prevRef.current;
      prevRef.current = next;

      if (prev === null) {
        if (!animateOnMount) return;
        const from: gsap.TweenVars = {};
        if (animateWidth) from.width = 0;
        if (animateHeight) from.height = 0;
        tween(from, next);
        return;
      }

      const sameWidth = Math.abs(prev.width - next.width) < EPS;
      const sameHeight = Math.abs(prev.height - next.height) < EPS;
      if (sameWidth && sameHeight) return;

      const from: gsap.TweenVars = {};
      if (animateWidth) from.width = prev.width;
      if (animateHeight) from.height = prev.height;
      tween(from, next);
    };

    const observer = new ResizeObserver((entries) => {
      // Игнорируем ресайзы, вызванные нашим же твином.
      if (isAnimating) return;
      const entry = entries[0];
      if (entry) run(readSize(entry));
    });

    observer.observe(el);

    return () => {
      observer.disconnect();
      gsap.killTweensOf(el);
    };
  }, [axis, duration, ease, animateOnMount, onResizeComplete]);

  return (
    <Slot ref={composeRefs(ref, $el)} className={clsx(s.root, className)}>
      {children}
    </Slot>
  );
};

ResizeAnimate.displayName = "ResizeAnimate";
