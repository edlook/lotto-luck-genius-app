import { Lightbulb, TriangleAlert } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui";
import { useI18n, useNamespace } from "@/i18n/context";
import type { HintControl } from "@/hooks/useHints";
import type { HintAction, HintCandidate, ParamFormat } from "@/lib/hints";
import { cx } from "@/lib/cx";

export interface HintProps {
  control: HintControl;
  /** Runs the actions that are not links (replace a field, apply a change, export, …). */
  onAction?: (action: HintAction, hint: HintCandidate) => void;
  className?: string;
}

/** Moves focus out of a tip that is about to disappear, so keyboard users do not land on <body>. */
function leave() {
  window.requestAnimationFrame(() => document.getElementById("main")?.focus({ preventScroll: true }));
}

/**
 * A quiet card with one tip: icon, text, up to two actions and "Got it". Not a banner: no
 * animation beyond a short fade, no colour accent except the warning look for money, deadlines
 * and unchecked data. `role="note"` (not a live region), so a screen reader reads it in order
 * and does not interrupt.
 */
export function Hint({ control, onAction, className }: HintProps) {
  const h = control.hint;
  return h ? <HintCard control={control} hint={h} onAction={onAction} className={className} /> : null;
}

function HintCard({ control, hint: h, onAction, className }: HintProps & { hint: HintCandidate }) {
  const { t, num, money, date } = useI18n();
  // The tip texts are the `coach` dictionary, fetched when the first tip is about to show.
  const ready = useNamespace("coach");
  if (!ready) return null;

  const fmt: Record<ParamFormat, (v: string | number) => string> = {
    date: (v) => date(String(v)),
    money: (v) => money(Number(v)),
    p: (v) => num(Number(v), { maximumFractionDigits: Number(v) < 0.01 ? 4 : 3 }),
    line: (v) => t(`popularity.rule.ticketPattern.line.${v}`),
    game: (v) => t(`game.${v}.name`),
    index: (v) => num(Number(v), { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
  };
  const params = Object.fromEntries(
    Object.entries(h.params).map(([k, v]) => [k, h.format[k] ? fmt[h.format[k]!](v) : v]),
  );
  const Icon = h.tone === "alert" ? TriangleAlert : Lightbulb;

  return (
    <aside
      role="note"
      aria-label={t("hint.aria")}
      data-hint={h.id}
      className={cx(
        "llg-appear flex items-start gap-3 rounded-lg border px-4 py-3 text-body text-foreground",
        h.tone === "alert" ? "border-warning/60 bg-warning/10" : "border-border-strong bg-surface-2",
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className={cx("mt-0.5 size-5 shrink-0", h.tone === "alert" ? "text-warning" : "text-muted-foreground")}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <p>{t(`${h.id}.text`, params)}</p>
        <div className="flex flex-wrap items-center gap-2">
          {h.actions.map((a) =>
            a.to ? (
              <ButtonLink key={a.labelKey} to={a.to} variant="secondary">
                {t(a.labelKey, a.labelParams)}
              </ButtonLink>
            ) : (
              <Button
                key={a.labelKey}
                variant="secondary"
                onClick={() => {
                  onAction?.(a, h);
                  // Saving moves the focus to the saved ticket itself; every other action removes the tip.
                  if (a.id !== "saveSet" && a.id !== "saveEvaluated") leave();
                }}
              >
                {t(a.labelKey, a.labelParams)}
              </Button>
            ),
          )}
          <Button
            variant="ghost"
            onClick={() => {
              control.dismiss();
              leave();
            }}
          >
            {t(h.dismissKey ?? "hint.dismiss")}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              control.dontShow();
              leave();
            }}
          >
            {t("hint.dontShow")}
          </Button>
        </div>
      </div>
    </aside>
  );
}
