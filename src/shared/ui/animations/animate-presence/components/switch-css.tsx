import type { ComponentProps } from "react";

import { useCountValueUpdate } from "@shared/hooks/use-count-value-update";

import type { AnimatePresenceMode } from "../types";
import { AnimatePresence } from "./animate-presence";
import { PresenceChildCSS } from "./presence-child-css";

export type SwitchCssProps = ComponentProps<"div"> & {
  transitionKey: string | number;
  children: React.ReactElement;
  mode?: AnimatePresenceMode;
};

export const SwitchCss = ({
  transitionKey,
  children,
  mode = "wait",
}: SwitchCssProps) => {
  const countListRender = useCountValueUpdate<string | number>(transitionKey);

  return (
    <AnimatePresence mode={mode}>
      <PresenceChildCSS key={`${transitionKey}-${countListRender.current}`}>
        {children}
      </PresenceChildCSS>
    </AnimatePresence>
  );
};

SwitchCss.displayName = "SwitchCss";
