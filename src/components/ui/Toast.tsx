import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { cx } from "@/lib/cx";
import { dismissToast, getToasts, subscribeToasts, type ToastItem } from "./toastStore";

const ICONS = { default: Info, success: CircleCheck, error: CircleAlert } as const;

function ToastCard({ item, closeLabel }: { item: ToastItem; closeLabel: string }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(item.duration);
  const startedAt = useRef(0);

  useEffect(() => {
    if (item.duration === 0 || paused) return;
    startedAt.current = Date.now();
    const t = window.setTimeout(() => dismissToast(item.id), remaining.current);
    return () => {
      window.clearTimeout(t);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [item.id, item.duration, paused]);

  const Icon = ICONS[item.variant];
  return (
    <li
      className="llg-toast pointer-events-auto flex w-full items-start gap-3 rounded-lg border border-border bg-surface-2 p-3 pl-4 text-foreground shadow-raised"
      // Pause while the user reads or reaches the action (hover, focus, touch).
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      <Icon
        aria-hidden="true"
        className={cx(
          "mt-0.5 size-5 shrink-0",
          item.variant === "success" && "text-success",
          item.variant === "error" && "text-danger",
          item.variant === "default" && "text-muted-foreground",
        )}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-0.5">
        <p className="text-body font-semibold">{item.message}</p>
        {item.description ? <p className="text-caption text-muted-foreground">{item.description}</p> : null}
      </div>
      {item.action ? (
        <button
          type="button"
          onClick={() => {
            item.action?.onClick();
            dismissToast(item.id);
          }}
          className="min-h-11 shrink-0 rounded-md px-3 font-semibold text-primary hover:bg-muted active:bg-muted"
        >
          {item.action.label}
        </button>
      ) : null}
      <button
        type="button"
        aria-label={closeLabel}
        onClick={() => dismissToast(item.id)}
        className="-my-1 -mr-1 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X aria-hidden="true" className="size-5" />
      </button>
    </li>
  );
}

/**
 * Renders the toast queue. Two live regions exist from the first render (a region added
 * together with its message is often not announced): polite for info/success,
 * assertive for errors. Phones: above the bottom navigation; desktop: bottom right.
 */
export function Toaster({ closeLabel }: { closeLabel: string }) {
  const items = useSyncExternalStore(subscribeToasts, getToasts, getToasts);
  const polite = items.filter((t) => t.variant !== "error");
  const assertive = items.filter((t) => t.variant === "error");
  const listClass = "flex flex-col gap-2";
  return (
    <div
      className={cx(
        "pointer-events-none fixed inset-x-0 z-50 flex flex-col gap-2 px-4",
        "bottom-[calc(var(--bottomnav-h)+var(--safe-bottom)+0.75rem)]",
        "lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-96 lg:px-0",
      )}
    >
      <ol role="status" aria-live="polite" aria-atomic="false" className={listClass}>
        {polite.map((t) => (
          <ToastCard key={t.id} item={t} closeLabel={closeLabel} />
        ))}
      </ol>
      <ol role="alert" aria-live="assertive" aria-atomic="false" className={listClass}>
        {assertive.map((t) => (
          <ToastCard key={t.id} item={t} closeLabel={closeLabel} />
        ))}
      </ol>
    </div>
  );
}
