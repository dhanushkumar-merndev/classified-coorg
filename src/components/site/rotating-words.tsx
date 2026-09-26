"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// An inline word that slides up to the next one every few seconds. Both words
// share one grid cell during the swap, so nothing is clipped or shifts. Screen
// readers get the whole list once; the moving word is hidden from them.
// With reduced motion the first word simply stays.
export function RotatingWords({ words, interval = 2600, className }: {
  words: readonly string[];
  interval?: number;
  className?: string;
}) {
  const [state, setState] = useState<{ index: number; prev: number | null }>({ index: 0, prev: null });

  useEffect(() => {
    if (words.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      setState((s) => ({ index: (s.index + 1) % words.length, prev: s.index }));
    }, interval);
    return () => clearInterval(id);
  }, [words.length, interval]);

  return (
    <span className={cn("relative inline-grid overflow-hidden align-bottom", className)}>
      <span className="sr-only">{words.join(", ")}</span>
      {state.prev !== null && (
        <span
          key={`out-${state.index}`}
          aria-hidden="true"
          className="animate-word-out whitespace-nowrap [grid-area:1/1]"
          onAnimationEnd={() => setState((s) => ({ ...s, prev: null }))}
        >
          {words[state.prev]}
        </span>
      )}
      <span
        key={`in-${state.index}`}
        aria-hidden="true"
        className={cn("whitespace-nowrap [grid-area:1/1]", state.prev !== null && "animate-word-in")}
      >
        {words[state.index]}
      </span>
    </span>
  );
}
