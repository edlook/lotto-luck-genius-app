import { useId, useState } from "react";
import { Link, useLocation } from "react-router";
import { ChevronRight, EllipsisVertical } from "lucide-react";
import { IconButton, Sheet } from "@/components/ui";
import { useI18n } from "@/i18n/context";
import { SECONDARY_NAV } from "./navItems";
import { GameSwitch } from "./GameSwitch";
import { LanguageSwitch } from "./LanguageSwitch";
import { Logo } from "./Logo";

/**
 * Phones (< 1024 px): sticky header with the name (home link), the menu button and the
 * game switch underneath. The menu is a bottom sheet (easy to reach with the thumb):
 * language RU/EN/DE, "About the method", "Data and settings".
 */
export function TopBar() {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const langId = useId();
  // Close the menu after navigating (state reset during render, no effect needed).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (menuOpen) setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 pt-[var(--safe-top)] backdrop-blur-md lg:hidden">
      <div className="mx-auto flex h-[var(--topbar-h)] max-w-[var(--content-max)] items-center justify-between gap-2 pr-[max(0.5rem,var(--safe-right))] pl-[max(1rem,var(--safe-left))]">
        <Logo />
        <IconButton label={t("topbar.menu.aria")} aria-haspopup="dialog" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
          <EllipsisVertical />
        </IconButton>
      </div>
      <div className="mx-auto max-w-[var(--content-max)] px-4 pb-2">
        <GameSwitch />
      </div>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={t("topbar.menu")} closeLabel={t("common.close")}>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <p id={langId} className="text-caption font-semibold text-muted-foreground">
              {t("topbar.language")}
            </p>
            <LanguageSwitch labelledBy={langId} />
          </div>
          <nav aria-label={t("topbar.menu")}>
            <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
              {SECONDARY_NAV.map(({ to, key, icon: Icon }) => (
                <li key={to}>
                  <Link
                    to={to}
                    onClick={() => setMenuOpen(false)}
                    className="flex min-h-12 items-center gap-3 px-4 font-semibold text-foreground hover:bg-muted active:bg-muted"
                  >
                    <Icon aria-hidden="true" className="size-5 text-muted-foreground" />
                    <span className="flex-1">{t(key)}</span>
                    <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </Sheet>
    </header>
  );
}
