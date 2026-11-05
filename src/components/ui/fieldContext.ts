import { createContext, useContext } from "react";

export interface FieldContextValue {
  /** id of the control (the <label> points to it). */
  id: string;
  /** Space-separated ids of the error and help text. */
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
}

export const FieldContext = createContext<FieldContextValue | null>(null);

interface ControlA11yProps {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false" | "grammar" | "spelling";
  required?: boolean;
}

/**
 * Wires a control to the surrounding <Field>: id, aria-describedby, aria-invalid, required.
 * Explicit props win over the field's values.
 */
export function useFieldControl<P extends ControlA11yProps>(props: P): P {
  const field = useContext(FieldContext);
  if (!field) return props;
  const describedBy = [field.describedBy, props["aria-describedby"]].filter(Boolean).join(" ") || undefined;
  return {
    ...props,
    id: props.id ?? field.id,
    "aria-describedby": describedBy,
    "aria-invalid": props["aria-invalid"] ?? (field.invalid || undefined),
    required: props.required ?? (field.required || undefined),
  };
}
