import type { ComponentProps } from "react";
import { useMemo } from "react";
import clsx from "clsx";

import { useThrottledValue } from "@/shared/hooks/use-throttled-value";

import { Animate, type AnimateProps } from "../animate";
import { SwitchElement } from "../animate-presence";

import s from "./animate-number-switcher.module.scss";

export type AnimateNumberSwitcherProps = ComponentProps<"div"> & {
  className?: string;
  classNameItem?: string;
  number: number;
  throttledFrames?: number;
  animateSettings?: Omit<AnimateProps, "children">;
};

export const AnimateNumberSwitcher = ({
  number,
  className,
  classNameItem,
  throttledFrames = 500,
  animateSettings,
  ...rest
}: AnimateNumberSwitcherProps) => {
  const renderNumber = useThrottledValue<number>(number, throttledFrames);
  const numbers = useMemo(() => `${renderNumber}`.split(""), [renderNumber]);

  return (
    <span className={clsx(s.root, className)} {...rest}>
      {numbers.map((num, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
        <span key={index} className={clsx(classNameItem, s.item)}>
          <span className={s.hidden}>
            {num === "." || num === "," ? "." : "0"}
          </span>
          <SwitchElement transitionKey={num} mode="sync">
            <Animate {...animateSettings}>
              <span className={s.number}>{num}</span>
            </Animate>
          </SwitchElement>
        </span>
      ))}
    </span>
  );
};
