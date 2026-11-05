import { Suspense, useEffect, useMemo } from "react";
import { Outlet, useLocation } from "react-router";
import { Toaster } from "@/components/ui";
import { useI18n } from "@/i18n/context";
import { useGame } from "@/hooks/useGame";
import { useDraws } from "@/hooks/useDraws";
import { ticketsStore } from "@/lib/storage/stores";
import { useLocalStore } from "@/lib/storage/localStore";
import { evaluateTicket } from "@/lib/ticketStatus";
import { berlinNow } from "@/lib/drawCalendar";
import { BottomNav } from "./BottomNav";
import { SideNav } from "./SideNav";
import { TopBar } from "./TopBar";
import { PageFallback } from "./PageFallback";
import { RouteErrorBoundary } from "./RouteErrorBoundary";

/** Scroll to top on navigation, or to the #anchor when present. */
function useScrollManagement() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const id = decodeURIComponent(hash.slice(1));
      const t = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), 50);
      return () => window.clearTimeout(t);
    }
    window.scrollTo({ top: 0 });
  }, [pathname, hash]);
}

/**
 * Layout route: skip link, sidebar (≥ 1024 px) or top bar + bottom bar (phones), the
 * screen in <main>, toasts. Screens are lazy; their loading and errors stay inside <main>
 * so the navigation keeps working.
 */
export function AppShell() {
  const { t, date } = useI18n();
  const [game] = useGame();
  const draws = useDraws(game);
  const tickets = useLocalStore(ticketsStore);
  const { pathname } = useLocation();
  useScrollManagement();

  // Tickets of the current game whose draw already took place but is not loaded yet.
  const waiting = useMemo(() => {
    if (!draws.draws.length) return 0;
    const today = berlinNow().date;
    return tickets.filter((tk) => tk.game === game && evaluateTicket(tk, draws.byDate, today).notLoaded.length > 0)
      .length;
  }, [tickets, game, draws.byDate, draws.draws.length]);

  const dataStatus = draws.lastDate
    ? t("sidebar.dataStatus", { date: date(draws.lastDate) })
    : t("sidebar.dataStatus.none");

  return (
    <div className="min-h-dvh lg:flex">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-4 py-3 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-[calc(var(--safe-top)+1rem)] focus:left-4"
      >
        {t("nav.aria.skip")}
      </a>
      <SideNav waiting={waiting} dataStatus={dataStatus} />
      <div className="min-w-0 flex-1">
        <TopBar />
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-[var(--content-max)] pt-5 pr-[max(1rem,var(--safe-right))] pb-[calc(var(--bottomnav-h)+var(--safe-bottom)+2rem)] pl-[max(1rem,var(--safe-left))] outline-none md:px-6 lg:px-8 lg:pt-8 lg:pb-12"
        >
          <RouteErrorBoundary key={pathname}>
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </RouteErrorBoundary>
        </main>
      </div>
      <BottomNav waiting={waiting} />
      <Toaster closeLabel={t("common.close")} />
    </div>
  );
}
