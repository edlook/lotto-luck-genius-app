import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export interface EmptyStateProps {
  /** Decorative visual: a lucide icon or a row of empty balls (rendered aria-hidden). */
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  /** Buttons or links: what the user can do next. */
  actions?: ReactNode;
  /** Heading level of the title. Default 2 (the page H1 is above it). */
  level?: 2 | 3;
  className?: string;
}

/** "Nothing here yet" with the reason and the next step. Never a dead end. */
export function EmptyState({ icon, title, body, actions, level = 2, className }: EmptyStateProps) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <div
      className={cx(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-strong/60 px-5 py-10 text-center",
        className,
      )}
    >
      {icon ? (
        <div aria-hidden="true" className="mb-1 text-muted-foreground [&_svg]:size-8">
          {icon}
        </div>
      ) : null}
      <H className="text-title-3 font-bold text-foreground">{title}</H>
      {body ? <p className="max-w-prose text-body text-muted-foreground">{body}</p> : null}
      {actions ? <div className="mt-2 flex flex-wrap justify-center gap-2">{actions}</div> : null}
    </div>
  );
}
