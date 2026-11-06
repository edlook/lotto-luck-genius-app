import { Suspense, lazy, useState, useSyncExternalStore } from "react";
import { useIdle } from "@/hooks/useIdle";
import { tourRequest } from "@/lib/hintsRuntime";
import { useLocalStore } from "@/lib/storage/localStore";
import { tourStore } from "@/lib/storage/onboarding";

// The tour is its own chunk: it is fetched only when it is going to open.
const Tour = lazy(() => import("./Tour"));

/**
 * Opens the tour once on the first launch (after the browser is idle, so it never competes with
 * the first paint) and whenever the settings ask for it. Renders nothing otherwise.
 */
export function TourHost() {
  const tour = useLocalStore(tourStore);
  const requested = useSyncExternalStore(tourRequest.subscribe, tourRequest.get, tourRequest.get);
  const idle = useIdle();
  const [mounted, setMounted] = useState(false);
  if ((requested || (!tour.done && idle)) && !mounted) setMounted(true);
  if (!mounted) return null;
  return (
    <Suspense fallback={null}>
      <Tour onExited={() => setMounted(false)} />
    </Suspense>
  );
}
