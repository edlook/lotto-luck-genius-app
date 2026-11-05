import { Link } from "react-router";
import { useI18n } from "@/i18n/context";
import { cx } from "@/lib/cx";

/** App name as a home link (≥ 44 px target). Plain text, no gradient (§3.2). */
export function Logo({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <Link
      to="/"
      className={cx(
        "inline-flex min-h-11 items-center gap-2 rounded-md pr-2 text-body font-extrabold tracking-tight text-foreground",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="inline-flex size-7 items-center justify-center rounded-full bg-[linear-gradient(135deg,hsl(var(--ball-main-from)),hsl(var(--ball-main-to)))] text-caption font-extrabold text-primary-foreground"
      >
        1
      </span>
      {t("app.name")}
    </Link>
  );
}
