import { cx } from "@/lib/cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
/** md = 44 px (minimum touch target), lg = 56 px (main CTA on a screen). */
export type ButtonSize = "md" | "lg";

export interface ButtonStyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Full width. */
  block?: boolean;
}

const BASE =
  // Labels may wrap (long German strings at 320 px) instead of pushing the page sideways.
  "inline-flex max-w-full select-none items-center justify-center gap-2 rounded-md py-2 text-center leading-5 font-semibold " +
  "transition-[background-color,color,border-color,box-shadow,transform,opacity] duration-150 ease-out " +
  "motion-safe:active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 " +
  "aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground shadow-soft hover:bg-primary/90 active:bg-primary/85",
  secondary: "border border-border-strong bg-surface-2 text-foreground hover:bg-muted active:bg-muted",
  ghost: "bg-transparent text-foreground hover:bg-muted active:bg-muted",
  danger: "bg-danger text-danger-foreground hover:bg-danger/90 active:bg-danger/85",
};

const SIZES: Record<ButtonSize, string> = {
  md: "min-h-11 px-4 text-body",
  lg: "min-h-14 px-6 text-body",
};

/** Class string of a button; use it to style links or labels as buttons. */
export function buttonClasses({ variant = "primary", size = "md", block = false }: ButtonStyleProps = {}): string {
  return cx(BASE, VARIANTS[variant], SIZES[size], block && "w-full");
}
