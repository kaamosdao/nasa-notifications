import { useEffect, useMemo, useState } from "react";

import { throttleRAF } from "../utils/throttleRAF";

export function useThrottledValue<T>(value: T, delayFrames = 30): T {
  const [throttled, setThrottled] = useState(value);

  const throttleFunc = useMemo(
    () => throttleRAF(setThrottled, delayFrames),
    [delayFrames],
  );

  useEffect(() => {
    throttleFunc(value);
  }, [value]);

  return throttled;
}
