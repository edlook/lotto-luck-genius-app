import { useEffect, useState } from "react";

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

/**
 * Becomes true once the browser is idle after the first render (requestIdleCallback with a
 * timeout, setTimeout where it is missing, e.g. Safari). Use it to start work that must not
 * compete with the first paint, such as loading data for a badge.
 */
export function useIdle(timeout = 2500): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (idle) return;
    const w = window as IdleWindow;
    if (w.requestIdleCallback && w.cancelIdleCallback) {
      const id = w.requestIdleCallback(() => setIdle(true), { timeout });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(() => setIdle(true), 1200);
    return () => window.clearTimeout(t);
  }, [idle, timeout]);
  return idle;
}
