import { useId, useMemo, type ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { cx } from "@/lib/cx";
import { FieldContext, type FieldContextValue } from "./fieldContext";

export interface FieldProps {
  label: ReactNode;
  /** Hint under the control (always visible, linked with aria-describedby). */
  help?: ReactNode;
  /** Error text. When set, the control gets aria-invalid and the text is announced with it. */
  error?: ReactNode;
  required?: boolean;
  /** Text after the label for optional fields, e.g. t("common.optional"). */
  optionalText?: string;
  /** Override the generated control id. */
  id?: string;
  className?: string;
  /** One control: Input, NumberInput or any element using useFieldControl(). */
  children: ReactNode;
}

/**
 * Label + control + help + error. The control picks up id, aria-describedby and
 * aria-invalid from context, so callers never wire ids by hand. Errors are shown with
 * an icon and text, never by colour alone.
 */
export function Field({ label, help, error, required = false, optionalText, id, className, children }: FieldProps) {
  const autoId = useId();
  const controlId = id ?? `f${autoId}`;
  const helpId = help ? `${controlId}-help` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const ctx = useMemo<FieldContextValue>(
    () => ({
      id: controlId,
      describedBy: [errorId, helpId].filter(Boolean).join(" ") || undefined,
      invalid: Boolean(error),
      required,
    }),
    [controlId, errorId, helpId, error, required],
  );

  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={controlId} className="text-body font-semibold text-foreground">
        {label}
        {!required && optionalText ? (
          <span className="ml-1.5 font-normal text-muted-foreground">({optionalText})</span>
        ) : null}
      </label>
      <FieldContext.Provider value={ctx}>{children}</FieldContext.Provider>
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-caption font-semibold text-danger">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
      {help ? (
        <p id={helpId} className="text-caption text-muted-foreground">
          {help}
        </p>
      ) : null}
    </div>
  );
}
