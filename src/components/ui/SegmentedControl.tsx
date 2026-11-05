import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "@/lib/cx";

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Language of the label when it differs from the page (e.g. "de" for "Deutsch"). */
  lang?: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name of the group (or use labelledBy). */
  label?: string;
  labelledBy?: string;
  orientation?: "horizontal" | "vertical";
  /** Stretch to the container width (segments share it equally). */
  block?: boolean;
  className?: string;
}

/**
 * Single choice among 2–4 options (game, language, mode). ARIA radio group:
 * one tab stop, arrow keys move and select, Home/End jump. The selected segment
 * has a fill, a ring and gold text, so it does not rely on colour alone.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  labelledBy,
  orientation = "horizontal",
  block = false,
  className,
}: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
    };
    let next: number | null = null;
    if (e.key in keys) next = (current + keys[e.key]! + options.length) % options.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = options.length - 1;
    if (next === null) return;
    e.preventDefault();
    const opt = options[next];
    if (!opt) return;
    onChange(opt.value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-orientation={orientation}
      onKeyDown={onKeyDown}
      className={cx(
        "gap-1 rounded-md border border-border-strong bg-background p-1",
        orientation === "vertical" ? "flex flex-col" : block ? "flex" : "inline-flex",
        className,
      )}
    >
      {options.map((o, i) => {
        const selected = i === current;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            lang={o.lang}
            onClick={() => onChange(o.value)}
            className={cx(
              "min-h-11 rounded-sm px-3 text-body font-semibold whitespace-nowrap",
              "transition-[background-color,color,box-shadow] duration-150 ease-out",
              orientation === "vertical" ? "text-left" : "flex-1 text-center",
              selected
                ? "bg-primary/15 text-primary shadow-soft ring-1 ring-primary/60 ring-inset"
                : "text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
