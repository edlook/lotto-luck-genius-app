import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export interface PageHeaderProps {
  /** The screen's H1 (one per page). */
  title: ReactNode;
  description?: ReactNode;
  /** Actions at the right (e.g. a screen menu). */
  actions?: ReactNode;
  className?: string;
}

/** H1 of a screen. Plain foreground text: gold is reserved for one accent per screen. */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cx("mb-6 flex items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 flex-col gap-2">
        <h1 className="text-title-2 font-extrabold tracking-tight text-balance text-foreground lg:text-title-1">
          {title}
        </h1>
        {description ? <p className="text-body text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
