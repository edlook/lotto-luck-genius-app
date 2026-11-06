import { useId, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "@/lib/cx";

type CardElement = "div" | "section" | "article" | "li" | "aside";

export type CardProps = HTMLAttributes<HTMLElement> & {
  as?: CardElement;
  /** "md" = 16 px (20 px from 640 px). "none" for edge-to-edge content such as tables. */
  padding?: "none" | "md";
};

/** Surface for grouped content: card colour, 1rem radius, decorative border, soft shadow. */
export function Card({ as = "div", padding = "md", className, ...rest }: CardProps) {
  // One cast keeps the polymorphic element simple; all supported tags accept HTMLAttributes.
  const Tag = as as "div";
  return (
    <Tag
      className={cx(
        "rounded-lg border border-border bg-card text-card-foreground shadow-soft",
        padding === "md" && "p-4 sm:p-5",
        className,
      )}
      {...rest}
    />
  );
}

export interface SectionProps {
  title: ReactNode;
  /** Anchor for links like /about#data. */
  id?: string;
  description?: ReactNode;
  /** Buttons/links at the right of the heading. */
  actions?: ReactNode;
  /** Heading level inside the page (H1 is the page title). */
  level?: 2 | 3;
  /** Wrap the content in a Card. */
  card?: boolean;
  className?: string;
  children?: ReactNode;
}

/** Titled block of a screen; the heading labels the region for screen readers. */
export function Section({
  title,
  id,
  description,
  actions,
  level = 2,
  card = false,
  className,
  children,
}: SectionProps) {
  const headingId = `${id ?? "s"}-${useId()}-h`;
  const H = level === 2 ? "h2" : "h3";
  const body = card ? <Card>{children}</Card> : children;
  return (
    <section id={id} aria-labelledby={headingId} className={cx("flex min-w-0 flex-col gap-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <H id={headingId} className={cx("font-bold text-foreground", level === 2 ? "text-title-3" : "text-body")}>
            {title}
          </H>
          {description ? <p className="text-body text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {body}
    </section>
  );
}
