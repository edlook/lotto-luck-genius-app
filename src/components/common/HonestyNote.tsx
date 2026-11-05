import type { ReactNode } from "react";
import { Scale } from "lucide-react";
import { cx } from "@/lib/cx";

/**
 * Permanent honesty note ("the chance is the same for every combination"). Not dismissible
 * on purpose: the brief requires it to stay visible wherever popularity is discussed.
 */
export function HonestyNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <aside
      role="note"
      className={cx(
        "flex items-start gap-3 rounded-lg border border-secondary/60 bg-secondary/15 px-4 py-3 text-body text-foreground",
        className,
      )}
    >
      <Scale aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
      <p>{children}</p>
    </aside>
  );
}
