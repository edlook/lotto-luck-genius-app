import { useId, useState } from "react";
import { CircleAlert } from "lucide-react";
import { inputClasses } from "@/components/ui";
import { useI18n } from "@/i18n/context";
import { cx } from "@/lib/cx";
import { parseNumberList } from "@/lib/numberInput";

export interface NumberPickerProps {
  /** Group label, e.g. "Main numbers (1–50)". */
  label: string;
  pool: number;
  required: number;
  value: number[];
  onChange: (next: number[]) => void;
  /** Grid columns from 360 px (the Lotto 6 aus 49 slip has 7). Below 360 px one column less. */
  columns?: number;
  /** Euro numbers / Superzahl use the green ball colour. */
  tone?: "main" | "euro";
  /** Show the "type the numbers" text field under the grid. */
  withText?: boolean;
  /** Error from outside (e.g. "field 2 is not complete"). */
  error?: string;
}

const COLS: Record<number, string> = {
  6: "grid-cols-5 min-[360px]:grid-cols-6",
  7: "grid-cols-6 min-[360px]:grid-cols-7",
  10: "grid-cols-6 min-[360px]:grid-cols-7 sm:grid-cols-10",
};

const key = (v: readonly number[]) => [...v].sort((a, b) => a - b).join(" ");

/**
 * Number selection: a grid of toggle buttons laid out like the play slip, plus an optional
 * text field ("3 14 22 31 40"). Both always show the same selection:
 * - grid clicks and "Clear" rewrite the text (QA B4);
 * - the "too many" message disappears as soon as the selection is valid again (QA B7);
 * - cells are square and fill the column, so 7 columns fit 375 px with ≥ 44 px targets and
 *   a 4 px gap; below 360 px the grid drops to 6 columns (QA B5).
 */
export function NumberPicker({
  label,
  pool,
  required,
  value,
  onChange,
  columns = 7,
  tone = "main",
  withText = true,
  error,
}: NumberPickerProps) {
  const { t } = useI18n();
  const id = useId();
  const [text, setText] = useState(() => key(value));
  const [textError, setTextError] = useState<string | null>(null);
  const [overflow, setOverflow] = useState(false);

  // Follow outside changes (grid, clear, reset) during render instead of in an effect.
  const valueKey = key(value);
  const [lastKey, setLastKey] = useState(valueKey);
  if (valueKey !== lastKey) {
    setLastKey(valueKey);
    const parsed = parseNumberList(text, pool, required);
    if (parsed.error || key(parsed.numbers) !== valueKey) {
      setText(valueKey);
      setTextError(null);
    }
    if (value.length < required || overflow) setOverflow(false);
  }

  const toggle = (n: number) => {
    if (value.includes(n)) {
      onChange(value.filter((x) => x !== n));
      return;
    }
    if (value.length >= required) {
      setOverflow(true);
      return;
    }
    onChange([...value, n].sort((a, b) => a - b));
  };

  const onText = (next: string) => {
    setText(next);
    const parsed = parseNumberList(next, pool, required);
    if (parsed.error) {
      setTextError(t(parsed.error.key, parsed.error.params));
      return;
    }
    setTextError(null);
    setOverflow(false);
    setLastKey(key(parsed.numbers));
    onChange(parsed.numbers);
  };

  const message = textError ?? (overflow ? t("evaluate.error.tooMany", { required }) : null) ?? error ?? null;
  const counterId = `${id}-count`;
  const errorId = `${id}-err`;
  const textId = `${id}-text`;
  const hintId = `${id}-hint`;

  return (
    <div className="flex flex-col gap-2" role="group" aria-labelledby={`${id}-label`}>
      <div className="flex items-baseline justify-between gap-3">
        <p id={`${id}-label`} className="text-body font-semibold text-foreground">
          {label}
        </p>
        <p
          id={counterId}
          aria-live="polite"
          className={cx(
            "shrink-0 text-caption font-semibold tabular-nums",
            value.length === required ? "text-success" : "text-muted-foreground",
          )}
        >
          {t("evaluate.counter", { selected: value.length, required })}
        </p>
      </div>
      <ul className={cx("grid gap-1", COLS[columns] ?? COLS[7])}>
        {Array.from({ length: pool }, (_, i) => i + 1).map((n) => {
          const on = value.includes(n);
          return (
            <li key={n} className="flex">
              <button
                type="button"
                aria-pressed={on}
                aria-describedby={message ? errorId : undefined}
                onClick={() => toggle(n)}
                className={cx(
                  "aspect-square w-full min-w-0 rounded-full text-body font-bold tabular-nums",
                  "transition-[background-color,color,border-color,transform] duration-150 ease-out motion-safe:active:scale-[0.94]",
                  on
                    ? tone === "main"
                      ? "bg-[linear-gradient(135deg,hsl(var(--ball-main-from)),hsl(var(--ball-main-to)))] text-primary-foreground shadow-soft"
                      : "bg-accent text-accent-foreground shadow-soft"
                    : "border border-border-strong bg-background text-foreground hover:border-foreground/70",
                )}
              >
                {n}
              </button>
            </li>
          );
        })}
      </ul>
      {message ? (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-caption font-semibold text-danger">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{message}</span>
        </p>
      ) : null}
      {withText ? (
        <div className="mt-1 flex flex-col gap-1.5">
          <label htmlFor={textId} className="text-caption font-semibold text-muted-foreground">
            {t("evaluate.input.label")}
          </label>
          <input
            id={textId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            spellCheck={false}
            value={text}
            placeholder={t("evaluate.input.placeholder")}
            aria-invalid={textError ? true : undefined}
            aria-describedby={cx(hintId, textError && errorId) || undefined}
            onChange={(e) => onText(e.target.value)}
            className={cx(inputClasses, "tabular-nums")}
          />
          <p id={hintId} className="text-caption text-muted-foreground">
            {t("evaluate.input.hint")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
