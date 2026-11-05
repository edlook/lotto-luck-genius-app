import type { ReactNode } from "react";
import { CircleAlert, RotateCw } from "lucide-react";
import { cx } from "@/lib/cx";
import { Button } from "./Button";

export interface ErrorStateProps {
  title: ReactNode;
  body?: ReactNode;
  /** Shows a retry button with this label, e.g. t("common.retry"). */
  retryLabel?: string;
  onRetry?: () => void;
  /** Additional actions (e.g. a link to import). */
  actions?: ReactNode;
  level?: 2 | 3;
  className?: string;
}

/** What failed, why it is safe, and what to do. Announced politely when it appears. */
export function ErrorState({ title, body, retryLabel, onRetry, actions, level = 2, className }: ErrorStateProps) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <div
      role="status"
      className={cx(
        "flex flex-col items-center gap-3 rounded-lg border border-danger/50 bg-card px-5 py-8 text-center",
        className,
      )}
    >
      <CircleAlert aria-hidden="true" className="size-8 text-danger" />
      <H className="text-title-3 font-bold text-foreground">{title}</H>
      {body ? <p className="max-w-prose text-body text-muted-foreground">{body}</p> : null}
      {(onRetry && retryLabel) || actions ? (
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {onRetry && retryLabel ? (
            <Button variant="secondary" icon={<RotateCw />} onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : null}
          {actions}
        </div>
      ) : null}
    </div>
  );
}
