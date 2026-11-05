import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export interface SkeletonProps {
  /** Tailwind size/shape classes, e.g. "h-6 w-40" or "size-14 rounded-full". */
  className?: string;
}

/** Placeholder in the shape of the coming content. Decorative: wrap groups in an element with aria-busy. */
export function Skeleton({ className }: SkeletonProps) {
  return <span aria-hidden="true" className={cx("llg-skeleton block rounded-md", className)} />;
}

/**
 * A busy region with an accessible name (state.loading.aria) and skeleton children.
 * Example: <SkeletonGroup label={t("state.loading.aria")}><Skeleton className="h-6 w-40" /></SkeletonGroup>
 */
export function SkeletonGroup({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={cx("flex flex-col gap-3", className)}>
      {children}
    </div>
  );
}
