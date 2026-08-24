import { type RefObject, useEffect, useRef } from "react";

export type UsePointerDragProps = {
  onStart?: (event: PointerEvent) => void;
  onMove?: (offsetX: number, offsetY: number, event: PointerEvent) => void;
  onEnd?: (event: PointerEvent) => void;
  dragThreshold?: number;
  direction?: "horizontal" | "vertical" | "both";
};

const DEFAULT_DRAG_THRESHOLD = 5;
/** Window to swallow the synthetic click that follows a drag gesture. */
const SUPPRESS_CLICK_MS = 400;

const safeReleasePointerCapture = (el: Element, pointerId: number) => {
  if (pointerId < 0) return;
  if (!el.hasPointerCapture(pointerId)) return;
  el.releasePointerCapture(pointerId);
};

export const usePointerDrag = (
  {
    onStart,
    onMove,
    onEnd,
    dragThreshold,
    direction = "both",
  }: UsePointerDragProps,
  enable: boolean = true,
  capture: boolean = false,
): RefObject<HTMLDivElement | null> => {
  const $touchRef = useRef<HTMLDivElement | null>(null);
  const threshold =
    typeof dragThreshold === "number" ? dragThreshold : DEFAULT_DRAG_THRESHOLD;

  const vars = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
    pointerId: -1,
    suppressClick: false,
    suppressClickTimer: 0 as number | ReturnType<typeof setTimeout>,
  });

  useEffect(() => {
    if (!enable) return;
    if (!$touchRef.current) return;

    const touchElement = $touchRef.current;

    const clearSuppressClick = () => {
      vars.current.suppressClick = false;
      if (vars.current.suppressClickTimer) {
        clearTimeout(vars.current.suppressClickTimer);
        vars.current.suppressClickTimer = 0;
      }
    };

    const armSuppressClick = () => {
      clearSuppressClick();
      vars.current.suppressClick = true;
      vars.current.suppressClickTimer = setTimeout(() => {
        vars.current.suppressClick = false;
        vars.current.suppressClickTimer = 0;
      }, SUPPRESS_CLICK_MS);
    };

    const onClickCapture = (e: MouseEvent) => {
      if (!vars.current.suppressClick) return;
      e.preventDefault();
      e.stopPropagation();
      clearSuppressClick();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== vars.current.pointerId) return;

      const deltaX = e.clientX - vars.current.startX;
      const deltaY = e.clientY - vars.current.startY;
      let distance = Math.hypot(deltaX, deltaY);

      if (direction === "horizontal") {
        distance = Math.abs(deltaX);
      }
      if (direction === "vertical") {
        distance = Math.abs(deltaY);
      }

      if (!vars.current.isDragging) {
        if (distance > threshold) {
          touchElement.classList.add("pointer-dragging");
          vars.current.isDragging = true;
          touchElement.setPointerCapture(vars.current.pointerId);
          // Reset start point to avoid a jump on first drag frame.
          vars.current.startX = e.clientX;
          vars.current.startY = e.clientY;
          vars.current.offsetX = 0;
          vars.current.offsetY = 0;
          return;
        } else {
          return;
        }
      }

      vars.current.offsetX = deltaX;
      vars.current.offsetY = deltaY;

      onMove?.(deltaX, deltaY, e);
    };

    const onPointerUp = (e: PointerEvent) => {
      document.removeEventListener("pointermove", onPointerMove, { capture });
      document.removeEventListener("pointerup", onPointerUp, { capture });
      document.removeEventListener("pointerleave", onPointerUp, { capture });
      document.removeEventListener("pointercancel", onPointerUp, { capture });

      if (!vars.current.isDragging) return;

      if (e.pointerId !== vars.current.pointerId) {
        return;
      }

      const pointerId = vars.current.pointerId;

      if (touchElement) {
        safeReleasePointerCapture(touchElement, pointerId);
      }

      vars.current.isDragging = false;
      vars.current.pointerId = -1;
      touchElement.classList.remove("pointer-dragging");

      // Swallow the click that browsers fire after pointerup on the drag target
      // (e.g. product card links / page transitions).
      armSuppressClick();
      onEnd?.(e);
    };

    const onPointerDown = (e: PointerEvent) => {
      vars.current.startX = e.clientX;
      vars.current.startY = e.clientY;
      vars.current.offsetX = 0;
      vars.current.offsetY = 0;
      vars.current.pointerId = e.pointerId;

      document.addEventListener("pointermove", onPointerMove, { capture });
      document.addEventListener("pointerup", onPointerUp, { capture });
      document.addEventListener("pointerleave", onPointerUp, { capture });
      document.addEventListener("pointercancel", onPointerUp, { capture });

      onStart?.(e);
    };

    const onDragStart = (e: DragEvent) => {
      e.preventDefault();
    };

    touchElement.addEventListener("dragstart", onDragStart);
    touchElement.addEventListener("pointerdown", onPointerDown, { capture });
    touchElement.addEventListener("click", onClickCapture, true);

    return () => {
      clearSuppressClick();
      touchElement.removeEventListener("pointerdown", onPointerDown, {
        capture,
      });
      touchElement.removeEventListener("click", onClickCapture, true);

      touchElement.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("pointermove", onPointerMove, { capture });
      document.removeEventListener("pointerup", onPointerUp, { capture });
      document.removeEventListener("pointerleave", onPointerUp, { capture });
      document.removeEventListener("pointercancel", onPointerUp, { capture });

      safeReleasePointerCapture(touchElement, vars.current.pointerId);
    };
  }, [onStart, onMove, onEnd, enable, capture, threshold, direction]);

  return $touchRef;
};
