import { GAMES, type GameId } from "@/lib/games";

/** "Tuesday, Friday" in the UI language, from the game's draw weekdays. */
export function drawDaysText(game: GameId, locale: string): string {
  // 2026-11-01 is a Sunday (weekday 0).
  const fmt = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" });
  return GAMES[game].drawDays.map((d) => fmt.format(new Date(Date.UTC(2026, 10, 1 + d)))).join(", ");
}
