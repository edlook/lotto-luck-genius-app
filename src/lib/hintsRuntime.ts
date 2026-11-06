/**
 * In-memory state of the tips and the tour that is not stored: whether the tour is open (it can be
 * reopened from the settings) and how many tips were dismissed in this session (for the
 * "tips in the way?" tip). Tiny external stores read with useSyncExternalStore.
 */
function createStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next: T) {
      if (Object.is(next, value)) return;
      value = next;
      listeners.forEach((l) => l());
    },
    subscribe(cb: () => void) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

/** True while the tour was asked to open (settings button) and has not closed yet. */
export const tourRequest = createStore(false);

const dismissed = createStore(0);
/** Number of tips dismissed with "Got it" in this session. */
export const sessionDismissals = {
  get: dismissed.get,
  subscribe: dismissed.subscribe,
  increment: () => dismissed.set(dismissed.get() + 1),
};
