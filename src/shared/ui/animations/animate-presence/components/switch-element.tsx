import type { ComponentProps } from "react";
import { cloneElement, memo, useCallback, useMemo, useRef } from "react";

import { useCountValueUpdate } from "@shared/hooks/use-count-value-update";

import type { AnimatePresenceMode } from "../types";
import { AnimatePresence } from "./animate-presence";
import { PresenceChildJS } from "./presence-child-js";

export type SwitchElementProps = ComponentProps<"div"> & {
  transitionKey: string | number | boolean | unknown[];
  children: React.ReactElement;
  /** Если `false`, дочерний узел убирается из дерева (с анимацией выхода). По умолчанию всегда показан. */
  isVisible?: boolean;
  /** Пробрасывается в `Animate`: пока `true`, вход не начинается (см. `Animate` `isDelayed`). */
  isDelayed?: boolean;
  mode?: AnimatePresenceMode;
  onEnter?: (ref: HTMLElement | null) => void;
  onLeave?: (ref: HTMLElement | null) => void;
  onLeaveComplete?: (ref: HTMLElement | null) => void;
  /** Вызывается при смене ключа: (входящий узел, уходящий узел). */
  onTransition?: (
    nextNode: HTMLElement | null,
    prevNode: HTMLElement | null,
  ) => void;
};

export const SwitchElement = memo(
  ({
    transitionKey,
    children,
    isVisible = true,
    isDelayed,
    mode = "wait",
    onEnter,
    onLeave,
    onLeaveComplete,
    onTransition,
  }: SwitchElementProps) => {
    const countListRender =
      useCountValueUpdate<SwitchElementProps["transitionKey"]>(transitionKey);
    const prevNodeRef = useRef<HTMLElement | null>(null);

    const child = useMemo(() => {
      if (isDelayed === undefined) return children;

      return cloneElement(children, {
        isDelayed,
      } as Parameters<typeof cloneElement>[1]);
    }, [children]);

    const handleLeave = useCallback(
      (ref: HTMLElement | null) => {
        prevNodeRef.current = ref;
        onLeave?.(ref);
      },
      [onLeave],
    );

    const handleEnter = useCallback(
      (ref: HTMLElement | null) => {
        const nextNode = ref;
        const prevNode = prevNodeRef.current;
        prevNodeRef.current = null;
        if (prevNode !== null) {
          onTransition?.(nextNode, prevNode);
        }
        onEnter?.(ref);
      },
      [onEnter, onTransition],
    );

    return (
      <AnimatePresence mode={mode}>
        {isVisible && (
          <PresenceChildJS
            key={`${transitionKey}-${countListRender.current}`}
            onEnter={handleEnter}
            onLeave={handleLeave}
            onLeaveComplete={onLeaveComplete}
          >
            {child}
          </PresenceChildJS>
        )}
      </AnimatePresence>
    );
  },
);
