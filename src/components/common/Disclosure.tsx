import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cx } from "@/lib/cx";

export interface DisclosureProps {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  /** Visual weight of the summary row. */
  tone?: "plain" | "card";
  /** Content without the left indent (narrow screens, nested lists). */
  flush?: boolean;
}

/**
 * Native <details>/<summary>: keyboard and screen-reader support for free, works without JS,
 * and the browser's find-in-page opens it. The chevron turns with a short colour-safe rotation.
 */
export function Disclosure({ summary, children, defaultOpen, className, tone = "plain", flush = false }: DisclosureProps) {
  return (
    <details
      open={defaultOpen}
      className={cx("group/d", tone === "card" && "rounded-lg border border-border bg-card", className)}
    >
      <summary
        className={cx(
          "flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md font-semibold text-foreground select-none [&::-webkit-details-marker]:hidden",
          tone === "card" ? "px-4 py-2" : "py-1",
        )}
      >
        <ChevronDown
          aria-hidden="true"
          className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 ease-out group-open/d:rotate-180"
        />
        <span className="min-w-0 flex-1">{summary}</span>
      </summary>
      <div className={cx("text-body text-muted-foreground", tone === "card" ? "px-4 pb-4" : cx("pt-2 pb-1", !flush && "pl-7"))}>
        {children}
      </div>
    </details>
  );
}
