import { lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router";
import { I18nProvider } from "@/i18n/I18nProvider";
import { AppShell } from "@/components/layout/AppShell";
import type { GameId } from "@/lib/games";

// Every screen is its own chunk; the shell (navigation, game switch, i18n) loads first.
const Generator = lazy(() => import("./pages/Generator"));
const Tickets = lazy(() => import("./pages/Tickets"));
const Draws = lazy(() => import("./pages/Draws"));
const DrawDetail = lazy(() => import("./pages/DrawDetail"));
const Stats = lazy(() => import("./pages/Stats"));
const Backtest = lazy(() => import("./pages/Backtest"));
const Odds = lazy(() => import("./pages/Odds"));
const About = lazy(() => import("./pages/About"));
const Guide = lazy(() => import("./pages/Guide"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));

/** Long game names in draw URLs (/draws/eurojackpot/…, /draws/lotto6aus49/…, /draws/lotto/…) → short ids. */
function DrawAliasRedirect({ game }: { game: GameId }) {
  const { date } = useParams();
  return <Navigate to={`/draws/${game}/${date ?? ""}`} replace />;
}

export default function App() {
  return (
    <I18nProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Generator />} />
            <Route path="tickets" element={<Tickets />} />
            <Route path="draws" element={<Draws />} />
            <Route path="draws/eurojackpot/:date" element={<DrawAliasRedirect game="ej" />} />
            <Route path="draws/lotto6aus49/:date" element={<DrawAliasRedirect game="649" />} />
            <Route path="draws/lotto/:date" element={<DrawAliasRedirect game="649" />} />
            <Route path="draws/:game/:date" element={<DrawDetail />} />
            <Route path="stats" element={<Stats />} />
            <Route path="backtest" element={<Backtest />} />
            <Route path="odds" element={<Odds />} />
            <Route path="about" element={<About />} />
            <Route path="guide" element={<Guide />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  );
}
