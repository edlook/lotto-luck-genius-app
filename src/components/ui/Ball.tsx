import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cx } from "@/lib/cx";
import { useI18n } from "@/i18n/context";

export type BallVariant = "main" | "euro" | "superzahl" | "empty";
/** sm = 32 px (list rows, not interactive), md = 44 px (tickets, grids), lg = 56 px (results). */
export type BallSize = "sm" | "md" | "lg";
/** After a check: matched = filled + check mark; missed = outline, muted digit. */
export type BallState = "default" | "matched" | "missed";

export interface BallProps {
  value?: number | null;
  variant?: BallVariant;
  size?: BallSize;
  state?: BallState;
  /** Accessible text instead of the digit (e.g. "14, matched"). Sets role="img". */
  label?: string;
  className?: string;
}

const SIZE: Record<BallSize, string> = {
  sm: "size-8 text-caption",
  md: "size-11 text-body",
  lg: "size-14 text-title-3",
};

const FILL: Record<Exclude<BallVariant, "empty">, string> = {
  main: "bg-[linear-gradient(135deg,hsl(var(--ball-main-from)),hsl(var(--ball-main-to)))] text-primary-foreground",
  euro: "bg-accent text-accent-foreground",
  superzahl: "bg-accent text-accent-foreground",
};

/** A number ball. Numbers use tabular figures; the soft shadow replaces the old gold glow. */
export function Ball({ value, variant = "main", size = "md", state = "default", label, className }: BallProps) {
  const empty = variant === "empty" || value === null || value === undefined;
  const missed = !empty && state === "missed";
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      className={cx(
        "relative inline-flex shrink-0 items-center justify-center rounded-full font-bold tabular-nums leading-none select-none",
        SIZE[size],
        empty && "bg-ball-empty",
        missed && "border-2 border-border-strong bg-transparent text-muted-foreground",
        !empty && !missed && cx(FILL[variant as Exclude<BallVariant, "empty">], "shadow-soft"),
        className,
      )}
    >
      {empty ? null : <span aria-hidden={label ? true : undefined}>{value}</span>}
      {state === "matched" && !empty ? (
        <span
          aria-hidden="true"
          className={cx(
            "absolute -top-0.5 -right-0.5 inline-flex items-center justify-center rounded-full border-2 border-background bg-foreground text-background",
            size === "sm" ? "size-3.5" : "size-4.5",
          )}
        >
          <Check className={size === "sm" ? "size-2.5" : "size-3"} strokeWidth={3} />
        </span>
      ) : null}
    </span>
  );
}

export interface BallRowProps {
  main: readonly number[];
  /** EuroJackpot Euro numbers. */
  euro?: readonly number[];
  /** Lotto 6aus49 Superzahl: number, null = not given, undefined = not shown. */
  superzahl?: number | null;
  size?: BallSize;
  /** Check result: matched numbers are filled with a mark, the rest are outlined. */
  matches?: { main: readonly number[]; euro?: readonly number[]; superzahl?: boolean | null };
  className?: string;
  /** Extra content at the end of the row (e.g. a class badge). */
  after?: ReactNode;
}

/**
 * A combination: main balls, then the Euro numbers or the Superzahl after a text label
 * ("Euro" / "SZ"), so the groups differ by more than colour. Screen readers get one
 * summary sentence (ball.summary.*) plus per-ball match state when checked.
 */
export function BallRow({ main, euro, superzahl, size = "md", matches, className, after }: BallRowProps) {
  const { t } = useI18n();
  const numbers = main.join(", ");
  const summary =
    euro && euro.length
      ? t("ball.summary.ej", { numbers, euro: euro.join(", ") })
      : superzahl !== undefined
        ? superzahl === null
          ? t("ball.summary.649.noSz", { numbers })
          : t("ball.summary.649", { numbers, sz: superzahl })
        : numbers;

  const stateOf = (n: number, list: readonly number[] | undefined): BallState =>
    !matches ? "default" : list?.includes(n) ? "matched" : "missed";
  const ballLabel = (n: number, s: BallState) =>
    s === "matched" ? t("ball.aria.match", { n }) : s === "missed" ? t("ball.aria.miss", { n }) : undefined;
  const gap = size === "sm" ? "gap-1" : "gap-1.5 sm:gap-2";
  const tag = "text-caption font-semibold text-muted-foreground";

  const szState: BallState =
    !matches || matches.superzahl === undefined || matches.superzahl === null
      ? "default"
      : matches.superzahl
        ? "matched"
        : "missed";
  // Unchecked rows: the summary sentence is enough, the balls are hidden from screen readers.
  // Checked rows: each ball also announces "matched" / "not matched".
  const hideBalls = matches ? undefined : true;

  return (
    <div className={cx("flex flex-wrap items-center", gap, className)}>
      <span className="sr-only">{summary}</span>
      <ul className={cx("flex flex-wrap items-center", gap)} aria-hidden={hideBalls}>
        {main.map((n) => {
          const s = stateOf(n, matches?.main);
          return (
            <li key={`m${n}`}>
              <Ball value={n} variant="main" size={size} state={s} label={ballLabel(n, s)} />
            </li>
          );
        })}
      </ul>
      {euro && euro.length ? (
        <>
          <span aria-hidden="true" className={cx(tag, "ml-1")}>
            {t("ball.label.euro")}
          </span>
          <ul className={cx("flex flex-wrap items-center", gap)} aria-hidden={hideBalls}>
            {euro.map((n) => {
              const s = stateOf(n, matches?.euro);
              return (
                <li key={`e${n}`}>
                  <Ball value={n} variant="euro" size={size} state={s} label={ballLabel(n, s)} />
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
      {superzahl !== undefined && !(euro && euro.length) ? (
        <span className={cx("inline-flex items-center", gap)} aria-hidden={hideBalls}>
          <span aria-hidden="true" className={cx(tag, "ml-1")}>
            {t("ball.label.sz")}
          </span>
          {superzahl === null ? (
            <Ball variant="empty" size={size} />
          ) : (
            <Ball value={superzahl} variant="superzahl" size={size} state={szState} label={ballLabel(superzahl, szState)} />
          )}
        </span>
      ) : null}
      {after}
    </div>
  );
}
