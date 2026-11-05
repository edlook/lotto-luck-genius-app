import type { ComponentPropsWithRef, ReactNode } from "react";
import { cx } from "@/lib/cx";

export interface IconButtonProps extends Omit<ComponentPropsWithRef<"button">, "aria-label" | "children"> {
  /** Accessible name. Required: an icon alone has no text for screen readers. */
  label: string;
  /** The icon (lucide element); rendered aria-hidden. */
  children: ReactNode;
  variant?: "ghost" | "secondary" | "primary";
  /** Toggle buttons: sets aria-pressed. */
  pressed?: boolean;
}

const VARIANTS = {
  ghost: "bg-transparent text-foreground hover:bg-muted active:bg-muted",
  secondary: "border border-border-strong bg-surface-2 text-foreground hover:bg-muted active:bg-muted",
  primary: "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/85",
} as const;

/** Square 44×44 px button with an icon. */
export function IconButton({
  label,
  children,
  variant = "ghost",
  pressed,
  className,
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      aria-pressed={pressed}
      className={cx(
        "inline-flex size-11 shrink-0 select-none items-center justify-center rounded-md",
        "transition-[background-color,color,transform] duration-150 ease-out motion-safe:active:scale-[0.94]",
        "disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      <span aria-hidden="true" className="inline-flex">
        {children}
      </span>
    </button>
  );
}
