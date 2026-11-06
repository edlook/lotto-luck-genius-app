import { useState, useSyncExternalStore } from "react";
import {
  candidatesFor,
  dismiss,
  dismissForever,
  globalHints,
  pickHint,
  type HintCandidate,
  type HintInputs,
  type HintScreen,
} from "@/lib/hints";
import { sessionDismissals, tourRequest } from "@/lib/hintsRuntime";
import { useLocalStore } from "@/lib/storage/localStore";
import { hintsEnabledStore, hintsStore, tourStore } from "@/lib/storage/onboarding";

export interface HintControl {
  /** The one tip to show on this screen, or null. */
  hint: HintCandidate | null;
  /** "Got it": hides the tip for its number of days (or for good when it is shown once). */
  dismiss: () => void;
  /** "Do not show again". */
  dontShow: () => void;
}

/**
 * The tip of a screen (guide-copy.md section 7). `build` turns the current time into the data
 * the pure functions of `lib/hints.ts` need; this hook only adds what comes from the browser:
 * the stored dismissals, the settings switch, the state of the tour and the session counter.
 * One tip per screen: the most important one that is not hidden.
 */
export function useHints<S extends HintScreen>(screen: S, build: (now: number) => HintInputs[S]): HintControl {
  const state = useLocalStore(hintsStore);
  const enabled = useLocalStore(hintsEnabledStore);
  const tour = useLocalStore(tourStore);
  const tourOpen = useSyncExternalStore(tourRequest.subscribe, tourRequest.get, tourRequest.get);
  const dismissedThisSession = useSyncExternalStore(sessionDismissals.subscribe, sessionDismissals.get, sessionDismissals.get);
  // The clock is read once per screen visit: tips do not need to expire while a screen is open.
  const [now] = useState(() => Date.now());

  const candidates = [...candidatesFor(screen, build(now)), ...globalHints({ dismissedThisSession })];
  const hint = pickHint(candidates, { enabled, tourDone: tour.done, tourOpen, now, state });

  return {
    hint,
    dismiss: () => {
      if (!hint) return;
      hintsStore.set((prev) => dismiss(prev, hint, Date.now()));
      if (hint.id !== "hint.global.tooMany") sessionDismissals.increment();
    },
    dontShow: () => {
      if (!hint) return;
      hintsStore.set((prev) => dismissForever(prev, hint, Date.now()));
    },
  };
}
