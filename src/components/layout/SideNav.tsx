import { useId } from "react";
import { NavLink } from "react-router";
import { useI18n } from "@/i18n/context";
import { cx } from "@/lib/cx";
import { MAIN_NAV, SECONDARY_NAV, type NavItem } from "./navItems";
import { GameSwitch } from "./GameSwitch";
import { LanguageSwitch } from "./LanguageSwitch";
import { Logo } from "./Logo";

function SideLink({ item, badge, badgeLabel }: { item: NavItem; badge?: number; badgeLabel?: string }) {
  const { t } = useI18n();
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      className={({ isActive }) =>
        cx(
          "relative flex min-h-11 items-center gap-3 rounded-md px-3 py-2 leading-5 font-semibold transition-colors duration-150 ease-out",
          "before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full",
          isActive
            ? "bg-surface-2 text-primary before:bg-primary"
            : "text-muted-foreground before:bg-transparent hover:bg-surface-2 hover:text-foreground",
        )
      }
    >
      <Icon aria-hidden="true" className="size-5 shrink-0" />
      <span className="min-w-0 flex-1">{t(item.key)}</span>
      {badge ? (
        <span className="rounded-full bg-warning px-2 text-caption font-bold text-warning-foreground tabular-nums">
          <span aria-hidden="true">{badge}</span>
          <span className="sr-only">{badgeLabel}</span>
        </span>
      ) : null}
    </NavLink>
  );
}

/** Desktop (≥ 1024 px): name → game switch → 5 screens → about/settings → language and data status. */
export function SideNav({ waiting, dataStatus }: { waiting: number; dataStatus: string }) {
  const { t, tp } = useI18n();
  const langId = useId();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[var(--sidebar-w)] shrink-0 flex-col gap-5 overflow-y-auto border-r border-border bg-[hsl(220_30%_10%)] px-3 py-5 lg:flex">
      <Logo className="px-2" />
      <GameSwitch orientation="vertical" />
      <nav aria-label={t("nav.aria.main")} className="flex flex-1 flex-col gap-4">
        <ul className="flex flex-col gap-1">
          {MAIN_NAV.map((item) => (
            <li key={item.to}>
              <SideLink
                item={item}
                badge={item.to === "/tickets" ? waiting : undefined}
                badgeLabel={item.to === "/tickets" ? tp("nav.tickets.badge", waiting) : undefined}
              />
            </li>
          ))}
        </ul>
        <hr className="border-border" />
        <ul className="flex flex-col gap-1">
          {SECONDARY_NAV.map((item) => (
            <li key={item.to}>
              <SideLink item={item} />
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex flex-col gap-2">
        <p id={langId} className="px-1 text-caption font-semibold text-muted-foreground">
          {t("topbar.language")}
        </p>
        <LanguageSwitch labelledBy={langId} compact />
        <p className="px-1 text-caption text-muted-foreground">{dataStatus}</p>
      </div>
    </aside>
  );
}
