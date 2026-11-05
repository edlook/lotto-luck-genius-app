import type { GameId } from "./games";

/** Official result/quota pages (opened by the user; the app does not scrape them). */
export const OFFICIAL_RESULTS: Record<GameId, string> = {
  ej: "https://www.eurojackpot.de/gewinnzahlen/",
  "649": "https://www.lotto.de/lotto-6aus49/lottozahlen",
};
