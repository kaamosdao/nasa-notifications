"use client";

import {
  cloneElement,
  type ReactElement,
  type Ref,
  useCallback,
  useLayoutEffect,
  useRef,
} from "react";

import { usePresence } from "../hooks";
import type { PresenceChildJSProps } from "../types";

export function PresenceChildJS({
  children,
  onEnter,
  onLeave,
  onLeaveComplete,
}: PresenceChildJSProps): ReactElement {
  const { isPresent, safeToRemove } = usePresence();
  const nodeRef = useRef<HTMLElement | null>(null);
  const isPresentRef = useRef(isPresent);
  isPresentRef.current = isPresent;

  /** Animate вызывает onComplete(el); DelayDelete — onComplete(el, false). */
  const handleComplete = useCallback(
    (_: HTMLElement | null, isVisibleArg?: boolean) => {
      const isExit =
        isVisibleArg === false ||
        (isVisibleArg === undefined && !isPresentRef.current);

      if (isExit) {
        safeToRemove();
        onLeaveComplete?.(nodeRef.current);
      }
    },
    [safeToRemove, onLeaveComplete],
  );

  useLayoutEffect(() => {
    const rafId = requestAnimationFrame(() => {
      if (isPresent) {
        onEnter?.(nodeRef.current);
      } else {
        onLeave?.(nodeRef.current);
      }
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [isPresent]);

  if (!children) {
    return null as unknown as ReactElement;
  }

  return cloneElement(
    children as ReactElement<{
      isVisible?: boolean;
      onComplete?: (element: HTMLElement | null, isVisible: boolean) => void;
      ref?: Ref<HTMLElement>;
    }>,
    {
      isVisible: isPresent,
      onComplete: handleComplete,
      ref: nodeRef,
    },
  );
}
