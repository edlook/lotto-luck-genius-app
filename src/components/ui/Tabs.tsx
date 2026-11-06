import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "@/lib/cx";

export interface TabItem<T extends string = string> {
  id: T;
  label: ReactNode;
  panel: ReactNode;
}

export interface TabsProps<T extends string = string> {
  items: readonly TabItem<T>[];
  /** Controlled value. */
  value?: T;
  /** Uncontrolled start value (defaults to the first tab). */
  defaultValue?: T;
  onChange?: (id: T) => void;
  /** Accessible name of the tab list. */
  label: string;
  /** Keep inactive panels in the DOM (hidden) to preserve their state. Default: true. */
  keepMounted?: boolean;
  className?: string;
}

/**
 * ARIA tabs with automatic activation: Left/Right (and Home/End) move between tabs.
 * The active tab is marked by a gold underline and bold foreground text.
 */
export function Tabs<T extends string = string>({
  items,
  value,
  defaultValue,
  onChange,
  label,
  keepMounted = true,
  className,
}: TabsProps<T>) {
  const base = useId();
  const [inner, setInner] = useState<T | undefined>(defaultValue ?? items[0]?.id);
  const active = value ?? inner;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = Math.max(
    0,
    items.findIndex((t) => t.id === active),
  );

  const select = (i: number) => {
    const item = items[i];
    if (!item) return;
    if (value === undefined) setInner(item.id);
    onChange?.(item.id);
    refs.current[i]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (idx + 1) % items.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    if (next === null) return;
    e.preventDefault();
    select(next);
  };

  return (
    <div className={cx("flex flex-col gap-4", className)}>
      <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex gap-1 border-b border-border">
        {items.map((t, i) => {
          const selected = i === idx;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              id={`${base}-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              // Panels of other tabs are not rendered unless keepMounted: no dangling reference.
              {...(keepMounted || selected ? { "aria-controls": `${base}-panel-${t.id}` } : {})}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(i)}
              className={cx(
                "relative -mb-px min-h-11 flex-1 px-3 text-body font-semibold sm:flex-none",
                "transition-colors duration-150 ease-out",
                "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:transition-colors",
                selected
                  ? "text-foreground after:bg-primary"
                  : "text-muted-foreground after:bg-transparent hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {items.map((t, i) =>
        keepMounted || i === idx ? (
          <div
            key={t.id}
            id={`${base}-panel-${t.id}`}
            role="tabpanel"
            aria-labelledby={`${base}-tab-${t.id}`}
            tabIndex={0}
            hidden={i !== idx}
            className="rounded-md"
          >
            {t.panel}
          </div>
        ) : null,
      )}
    </div>
  );
}
