import { NavLink } from "react-router";
import { useI18n } from "@/i18n/context";
import { cx } from "@/lib/cx";
import { MAIN_NAV } from "./navItems";

/**
 * Phones (< 1024 px): 5 destinations, label always visible, each target 1/5 of the width × 64 px.
 * Active item: gold icon + label, a bar on top and aria-current="page" (not colour alone).
 * Padded by the home-indicator safe area.
 */
export function BottomNav({ waiting }: { waiting: number }) {
  const { t, tp } = useI18n();
  return (
    <nav
      aria-label={t("nav.aria.main")}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[var(--safe-bottom)] backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto grid h-[var(--bottomnav-h)] max-w-xl grid-cols-5 px-[var(--safe-left)]">
        {MAIN_NAV.map(({ to, key, icon: Icon }) => (
          <li key={to} className="flex">
            <NavLink
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cx(
                  "relative flex flex-1 flex-col items-center justify-center gap-1 px-1 text-[12px] leading-4 font-semibold",
                  "transition-colors duration-150 ease-out select-none",
                  "before:absolute before:inset-x-4 before:top-0 before:h-0.5 before:rounded-full",
                  isActive
                    ? "text-primary before:bg-primary"
                    : "text-muted-foreground before:bg-transparent hover:text-foreground active:text-foreground",
                )
              }
            >
              <span className="relative">
                <Icon aria-hidden="true" className="size-6" />
                {to === "/tickets" && waiting > 0 ? (
                  <span className="absolute -top-1.5 -right-2.5 inline-flex min-w-4.5 items-center justify-center rounded-full bg-warning px-1 text-[11px] leading-4.5 font-bold text-warning-foreground tabular-nums">
                    <span aria-hidden="true">{waiting}</span>
                    <span className="sr-only">{tp("nav.tickets.badge", waiting)}</span>
                  </span>
                ) : null}
              </span>
              <span className="max-w-full truncate">{t(key)}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
