import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";

export type ChildrenLine = {
  word: HTMLElement;
  chars: HTMLElement[];
};

/**
 * Offset top of `el` relative to `root` via offsetParent chain (no getBoundingClientRect).
 * Fallback to getBoundingClientRect only if the chain leaves root (e.g. root has position: static).
 */
function getOffsetTopFromRoot(el: HTMLElement, root: HTMLElement): number {
  let top = 0;
  let current: HTMLElement | null = el;
  while (current && current !== root) {
    top += current.offsetTop;
    const next = current.offsetParent as HTMLElement | null;
    if (next && !root.contains(next)) {
      return Math.round(
        el.getBoundingClientRect().top - root.getBoundingClientRect().top,
      );
    }
    current = next;
  }
  return current === root ? top : 0;
}

function linesLayoutSignature(
  lines: Map<number, ChildrenLine[]>,
  wordCount: number,
): string {
  const keys = [...lines.keys()].sort((a, b) => a - b);
  const counts = keys.map((k) => lines.get(k)?.length ?? 0).join(",");
  return `${wordCount}|${keys.join(",")}|${counts}`;
}

export const useGetLines = () => {
  const rootRef = useRef<HTMLElement>(null);
  const [linesVersion, setLinesVersion] = useState(0);
  const lastSignatureRef = useRef("");

  const vars = useMemo(
    () => ({
      lines: new Map<number, ChildrenLine[]>(),
    }),
    [],
  );

  useLayoutEffect(() => {
    const onResize = () => {
      const root = rootRef.current;
      if (!root) return;

      const q = gsap.utils.selector(root);
      const words = q(`.word:not(:is(.word .word))`);

      vars.lines = new Map<number, ChildrenLine[]>();

      for (let i = 0; i < words.length; i++) {
        const word = words[i] as HTMLElement;
        const offsetTopFromRoot = getOffsetTopFromRoot(word, root);
        const group = vars.lines.get(offsetTopFromRoot) ?? [];

        group.push({
          word,
          chars: [
            ...word.querySelectorAll(`.char:not(:is(.char .char))`),
          ] as HTMLElement[],
        });

        vars.lines.set(offsetTopFromRoot, group);
      }

      const nextSig = linesLayoutSignature(vars.lines, words.length);
      if (nextSig !== lastSignatureRef.current) {
        lastSignatureRef.current = nextSig;
        setLinesVersion((v) => v + 1);
      }
    };

    onResize();
    const root = rootRef.current;
    const resizeObserver = new ResizeObserver(onResize);
    if (root) {
      resizeObserver.observe(root, { box: "border-box" });
    }

    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        onResize();
      });
    });

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
    };
  }, []);

  return [rootRef, vars, linesVersion] as const;
};
