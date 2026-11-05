/**
 * Moves focus after an action that removed or replaced the focused element (delete, save).
 * Runs after the dialog has closed and React has committed, then scrolls the target into view.
 */
export function focusLater(getTarget: () => HTMLElement | null | undefined, delay = 60): void {
  window.setTimeout(() => {
    const el = getTarget();
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, delay);
}
