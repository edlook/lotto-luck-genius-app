import { useState, type ComponentPropsWithRef } from "react";
import { Minus, Plus } from "lucide-react";
import { cx } from "@/lib/cx";
import { useFieldControl } from "./fieldContext";
import { IconButton } from "./IconButton";

export const inputClasses =
  "h-12 w-full min-w-0 rounded-md border border-border-strong bg-background px-3 text-[16px] text-foreground " +
  "placeholder:text-muted-foreground transition-[border-color,box-shadow] duration-150 ease-out " +
  "hover:border-foreground/60 focus-visible:border-primary aria-[invalid=true]:border-danger " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export type InputProps = ComponentPropsWithRef<"input">;

/** Text input, 48 px high, 16 px text (no iOS zoom). Inside <Field> it is wired automatically. */
export function Input({ className, ...props }: InputProps) {
  const p = useFieldControl(props);
  return <input className={cx(inputClasses, className)} {...p} />;
}

export interface NumberInputProps
  extends Omit<ComponentPropsWithRef<"input">, "value" | "defaultValue" | "onChange" | "type" | "min" | "max" | "step"> {
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Decimal places allowed (0 = integers, numeric keyboard). */
  decimals?: number;
  /** Labels of the − / + buttons. Both required to show the steppers (WCAG 2.5.7: no drag needed). */
  decrementLabel?: string;
  incrementLabel?: string;
  /** BCP 47 locale for the decimal separator, e.g. i18n.locale. */
  locale?: string;
}

function decimalSeparator(locale: string | undefined): string {
  return new Intl.NumberFormat(locale).format(1.5).includes(",") ? "," : ".";
}

function format(value: number | null, decimals: number, sep: string): string {
  if (value === null || !Number.isFinite(value)) return "";
  const s = decimals > 0 ? String(Number(value.toFixed(decimals))) : String(Math.round(value));
  return sep === "," ? s.replace(".", ",") : s;
}

function parse(text: string, decimals: number): number | null | undefined {
  const t = text.trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") return null;
  const re = decimals > 0 ? new RegExp(`^-?\\d*(\\.\\d{0,${decimals}})?$`) : /^-?\d*$/;
  if (!re.test(t) || t === "-" || t === ".") return undefined; // not (yet) a number
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

const clamp = (n: number, min?: number, max?: number) =>
  Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, n));

/**
 * Number entry with optional − / + steppers. Accepts "," and "." as decimal separator,
 * keeps the typed text while editing, clamps to min/max on blur. `null` = empty.
 */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  decimals = 0,
  decrementLabel,
  incrementLabel,
  locale,
  className,
  onBlur,
  disabled,
  ...props
}: NumberInputProps) {
  const sep = decimalSeparator(locale ?? (typeof document !== "undefined" ? document.documentElement.lang : undefined));
  const [text, setText] = useState(() => format(value, decimals, sep));
  const p = useFieldControl(props);

  // Follow outside changes (steppers, reset, locale) unless the text already means the same
  // number. Adjusted during render, as React recommends, instead of in an effect.
  const sync = `${value}|${decimals}|${sep}`;
  const [lastSync, setLastSync] = useState(sync);
  if (sync !== lastSync) {
    setLastSync(sync);
    if (parse(text, decimals) !== value) setText(format(value, decimals, sep));
  }

  const commit = (n: number | null) => {
    const v = n === null ? null : Number(clamp(n, min, max).toFixed(decimals));
    onChange(v);
    setText(format(v, decimals, sep));
  };

  const stepBy = (dir: 1 | -1) => commit((value ?? min ?? 0) + dir * step);
  const steppers = Boolean(decrementLabel && incrementLabel);

  const input = (
    <input
      type="text"
      inputMode={decimals > 0 ? "decimal" : "numeric"}
      enterKeyHint="done"
      autoComplete="off"
      disabled={disabled}
      className={cx(inputClasses, "tabular-nums", steppers && "text-center", className)}
      value={text}
      onChange={(e) => {
        const next = e.target.value;
        const n = parse(next, decimals);
        if (n === undefined && next.trim() !== "" && !/^-?[\d.,]*$/.test(next.trim())) return; // reject letters
        setText(next);
        if (n !== undefined) onChange(n);
      }}
      onBlur={(e) => {
        const n = parse(text, decimals);
        commit(n === undefined ? value : n);
        onBlur?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          stepBy(1);
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          stepBy(-1);
        }
      }}
      {...p}
    />
  );

  if (!steppers) return input;
  return (
    <div className="flex items-center gap-2">
      <IconButton
        variant="secondary"
        label={decrementLabel!}
        disabled={disabled || (min !== undefined && value !== null && value <= min)}
        onClick={() => stepBy(-1)}
      >
        <Minus />
      </IconButton>
      {input}
      <IconButton
        variant="secondary"
        label={incrementLabel!}
        disabled={disabled || (max !== undefined && value !== null && value >= max)}
        onClick={() => stepBy(1)}
      >
        <Plus />
      </IconButton>
    </div>
  );
}
