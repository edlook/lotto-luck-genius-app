import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export interface HBarRow {
  id: string;
  label: ReactNode;
  value: number;
  valueText: string;
  /** 95 % range of chance, drawn as a shaded band behind the bar. */
  band?: { low: number; high: number };
  /** Marks a value outside the chance band (the only use of colour). */
  outside?: boolean;
}

export interface HBarLegendItem {
  kind: "bar" | "reference" | "band" | "outside";
  text: string;
}

export interface HBarChartProps {
  rows: HBarRow[];
  /** Dashed vertical line, e.g. the value expected by chance. */
  reference: number;
  /** The axis starts at 0 and ends here. */
  axisMax: number;
  /** Accessible name of the list; every row carries its own label and value as text. */
  listLabel: string;
  legend: HBarLegendItem[];
  note?: string;
}

/**
 * Horizontal bars as plain CSS (no chart library). Each row is a list item with its label and value
 * as text, so a screen reader gets the numbers; the bars are decoration. The axis starts at zero so
 * small differences look as small as they are.
 */
export function HBarChart({ rows, reference, axisMax, listLabel, legend, note }: HBarChartProps) {
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / axisMax) * 100))}%`;
  return (
    <figure className="flex flex-col gap-3">
      <ul aria-label={listLabel} className="flex flex-col gap-3">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 text-caption">
              <span className="min-w-0 font-semibold text-foreground">{r.label}</span>
              <span className="shrink-0 font-semibold text-foreground tabular-nums">{r.valueText}</span>
            </div>
            <div aria-hidden="true" className="relative h-3 rounded-sm bg-muted/60">
              {r.band ? (
                <div
                  className="absolute inset-y-0 bg-secondary/45"
                  style={{ left: pct(r.band.low), width: `calc(${pct(r.band.high)} - ${pct(r.band.low)})` }}
                />
              ) : null}
              <div
                className={cx("absolute inset-y-0.5 left-0 rounded-r-sm", r.outside ? "bg-warning" : "bg-foreground/45")}
                style={{ width: pct(r.value) }}
              />
              <div className="absolute inset-y-[-3px] border-l-2 border-dashed border-foreground/80" style={{ left: pct(reference) }} />
            </div>
          </li>
        ))}
      </ul>
      <figcaption className="flex flex-col gap-2 text-caption text-muted-foreground">
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          {legend.map((l) => (
            <span key={l.kind} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cx(
                  "inline-block shrink-0",
                  l.kind === "bar" && "h-2.5 w-4 rounded-sm bg-foreground/45",
                  l.kind === "outside" && "h-2.5 w-4 rounded-sm bg-warning",
                  l.kind === "band" && "h-2.5 w-4 rounded-sm bg-secondary/45",
                  l.kind === "reference" && "h-3 border-l-2 border-dashed border-foreground/80",
                )}
              />
              {l.text}
            </span>
          ))}
        </span>
        {note ? <span>{note}</span> : null}
      </figcaption>
    </figure>
  );
}
