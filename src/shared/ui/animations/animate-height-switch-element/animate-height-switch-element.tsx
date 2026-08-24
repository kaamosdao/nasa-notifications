import type { ComponentProps, ReactElement } from "react";
import { cloneElement, useCallback, useRef } from "react";
import clsx from "clsx";
import gsap from "gsap";

import { useCountValueUpdate } from "@/shared/hooks/use-count-value-update";
import { composeRefs } from "@/shared/utils/compose-refs";
import { getBoundElement } from "@/shared/utils/get-bound-element";

import type { PresenceChildJSProps } from "../animate-presence/types";

import s from "./animate-height-switch-element.module.scss";

type AnimateHeightSwitchChildProps = Pick<
  PresenceChildJSProps,
  "onEnter" | "onLeave"
>;

export type AnimateHeightSwitchElementProps = ComponentProps<"div"> & {
  className?: string;
  transitionKey?: string | number | boolean | unknown[];
  children: ReactElement<AnimateHeightSwitchChildProps>;
};

export const AnimateHeightSwitchElement = ({
  className,
  transitionKey,
  children,
  ref,
  ...rest
}: AnimateHeightSwitchElementProps) => {
  const $rootItems = useRef<HTMLDivElement>(null);

  const updateItems = useCountValueUpdate(transitionKey);
  const key = updateItems.current;
  const prevKey = useRef(key);

  if (prevKey.current !== key && $rootItems.current) {
    const bound = getBoundElement($rootItems.current);
    $rootItems.current.style.setProperty("height", `${bound.height}px`);
    prevKey.current = key;
  }

  const onEnter = useCallback((_node: HTMLElement | null) => {
    if (!$rootItems.current) return;
    gsap.to($rootItems.current, {
      height: "auto",
      duration: 0.8,
      ease: "power3.out",
    });
  }, []);

  const onLeave = useCallback((node: HTMLElement | null) => {
    if (!node) return;
    gsap.set(node, {
      position: "absolute",
      pointerEvents: "none",
      top: 0,
      left: 0,
      width: "100%",
    });
  }, []);

  return (
    <div
      className={clsx(s.root, className)}
      ref={composeRefs(ref, $rootItems)}
      {...rest}
    >
      {cloneElement(children, {
        onEnter,
        onLeave,
      })}
    </div>
  );
};

AnimateHeightSwitchElement.displayName = "AnimateHeightSwitchElement";
