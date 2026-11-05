import type { ComponentPropsWithRef, ReactNode } from "react";
import { Link, type LinkProps } from "react-router";
import { LoaderCircle } from "lucide-react";
import { cx } from "@/lib/cx";
import { buttonClasses, type ButtonStyleProps } from "./buttonStyles";

export type { ButtonSize, ButtonStyleProps, ButtonVariant } from "./buttonStyles";

export interface ButtonProps extends ComponentPropsWithRef<"button">, ButtonStyleProps {
  /** Shows a spinner, sets aria-busy and blocks clicks. */
  loading?: boolean;
  /** Icon before the label (lucide element, aria-hidden is added). */
  icon?: ReactNode;
}

export function Button({
  variant,
  size,
  block,
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(buttonClasses({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />
      ) : icon ? (
        <span aria-hidden="true" className="inline-flex">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}

export interface ButtonLinkProps extends LinkProps, ButtonStyleProps {
  icon?: ReactNode;
}

/** A router link that looks like a button (navigation must stay a link for the screen reader). */
export function ButtonLink({ variant, size, block, icon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={cx(buttonClasses({ variant, size, block }), className)} {...rest}>
      {icon ? (
        <span aria-hidden="true" className="inline-flex">
          {icon}
        </span>
      ) : null}
      {children}
    </Link>
  );
}
