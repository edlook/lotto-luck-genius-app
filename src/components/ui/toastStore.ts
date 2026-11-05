/**
 * Toast queue (module-level store, no dependencies). Call `toast()` from anywhere,
 * render <Toaster /> once in the app shell.
 */
export type ToastVariant = "default" | "success" | "error";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  variant?: ToastVariant;
  description?: string;
  /** Optional action ("Undo", "Change"). The same action must also exist elsewhere in the UI. */
  action?: ToastAction;
  /** ms; default 6000 (WCAG 2.2.1: long enough to read and reach the action). 0 = until closed. */
  duration?: number;
}

export interface ToastItem extends Required<Pick<ToastOptions, "variant" | "duration">> {
  id: number;
  message: string;
  description?: string;
  action?: ToastAction;
}

export const MAX_TOASTS = 3;
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function subscribeToasts(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export const getToasts = (): ToastItem[] => items;

export function dismissToast(id: number): void {
  const next = items.filter((t) => t.id !== id);
  if (next.length !== items.length) {
    items = next;
    emit();
  }
}

function show(message: string, opts: ToastOptions = {}): number {
  const id = nextId++;
  const item: ToastItem = {
    id,
    message,
    variant: opts.variant ?? "default",
    duration: opts.duration ?? 6000,
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.action ? { action: opts.action } : {}),
  };
  items = [...items, item].slice(-MAX_TOASTS);
  emit();
  return id;
}

/** Shows a toast and returns its id. */
export const toast = Object.assign(show, {
  success: (message: string, opts?: Omit<ToastOptions, "variant">) => show(message, { ...opts, variant: "success" }),
  error: (message: string, opts?: Omit<ToastOptions, "variant">) => show(message, { ...opts, variant: "error" }),
  dismiss: dismissToast,
});
