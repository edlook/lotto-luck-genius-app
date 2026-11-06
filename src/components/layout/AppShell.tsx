import { Suspense, useEffect, useMemo } from "react";
import { Outlet, useLocation } from "react-router";
import { Toaster } from "@/components/ui";
import { useI18n } from "@/i18n/context";
import { useGame } from "@/hooks/useGame";
import { useDraws } from "@/hooks/useDraws";
import { useServiceWorkerUpdate } from "@/hooks/useServiceWorkerUpdate";
import { useIdle } from "@/hooks/useIdle";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { ticketsStore } from "@/lib/storage/stores";
import { useLocalStore } from "@/lib/storage/localStore";
import { countWaitingForData } from "@/lib/ticketSummary";
import { berlinNow } from "@/lib/drawCalendar";
import { BottomNav } from "./BottomNav";
import { SideNav } from "./SideNav";
import { GameSwitch } from "./GameSwitch";
import { TopBar } from "./TopBar";
import { PageFallback } from "./PageFallback";
import { RouteErrorBoundary } from "./RouteErrorBoundary";
import { TourHost } from "@/components/tour/TourHost";

/** Scroll to top on navigation, or to the #anchor when present. */
function useScrollManagement() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const id = decodeURIComponent(hash.slice(1));
      // A screen is a lazy chunk (and /guide also waits for its texts): the target may not exist
      // yet on a direct visit, so look for it for a few seconds instead of once.
      let tries = 0;
      const t = window.setInterval(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ block: "start" });
        if (el || ++tries > 40) window.clearInterval(t);
      }, 50);
      return () => window.clearInterval(t);
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
  const tickets = useLocalStore(ticketsStore);
  const { pathname } = useLocation();
  useScrollManagement();
  useServiceWorkerUpdate();

  // The badge and the sidebar data line need the draw archive (~280 KB for EuroJackpot).
  // Never let them compete with the first render: start the request only when the browser
  // is idle, and only if there is something to show (tickets of this game, or the sidebar
  // on wide screens). Screens that need draws load them themselves; the shell then reuses
  // the cached copy for free.
  const idle = useIdle();
  const wide = useMediaQuery(DESKTOP_QUERY);
  const hasTickets = tickets.some((tk) => tk.game === game);
  const draws = useDraws(game, idle && (hasTickets || wide));

  // Tickets of the current game whose draw already took place but is not loaded yet.
  const waiting = useMemo(
    () => (draws.draws.length && hasTickets ? countWaitingForData(tickets, game, draws.byDate, berlinNow().date) : 0),
    [tickets, game, draws.byDate, draws.draws.length, hasTickets],
  );

  const dataStatus = draws.lastDate
    ? t("sidebar.dataStatus", { date: date(draws.lastDate) })
    : draws.isLoading
      ? null
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
          <div className="mb-5 lg:hidden">
            <GameSwitch />
          </div>
          <RouteErrorBoundary key={pathname}>
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </RouteErrorBoundary>
        </main>
      </div>
      <BottomNav waiting={waiting} />
      <TourHost />
      <Toaster closeLabel={t("common.close")} />
    </div>
  );
}
