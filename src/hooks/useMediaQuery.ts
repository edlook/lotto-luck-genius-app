import { useCallback, useSyncExternalStore } from "react";

/** Live result of a CSS media query, e.g. useMediaQuery("(min-width: 64rem)"). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (cb: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** The sidebar layout (≥ 1024 px), same breakpoint as Tailwind `lg:`. */
export const DESKTOP_QUERY = "(min-width: 64rem)";
