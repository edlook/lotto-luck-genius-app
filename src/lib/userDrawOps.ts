/**
 * Adding draws in this browser (manual entry and CSV import). Pure checks; the screen writes
 * the result to userDrawsStore.
 */
import { GAMES, type GameId } from "./games";
import { drawDateError } from "./drawCalendar";
import { euroPoolOn } from "./eras";
import type { Draw } from "./ticketCheck";
import type { UserDraw } from "./storage/validate";
import { drawToUserDraw } from "./storage/stores";

export interface ImportPlan {
  /** Draws whose date is neither in the archive nor added before. */
  fresh: Draw[];
  /** Already known dates (archive or earlier user entries). */
  duplicates: number;
}

export function planDrawImport(parsed: Draw[], known: Map<string, Draw>): ImportPlan {
  const fresh = parsed.filter((d) => !known.has(d.date));
  return { fresh, duplicates: parsed.length - fresh.length };
}

/** Adds draws to the stored list; same game and date are replaced by the newer entry. */
export function addUserDraws(list: UserDraw[], draws: Draw[]): UserDraw[] {
  const keyOf = (d: { game: GameId; date: string }) => `${d.game}|${d.date}`;
  const incoming = new Map(draws.map((d) => [keyOf(d), drawToUserDraw(d)]));
  return [...list.filter((u) => !incoming.has(keyOf(u))), ...incoming.values()];
}

export type ManualDrawError =
  | { key: "settings.manual.error.date" }
  | { key: "settings.manual.error.future"; date: string }
  | { key: "settings.manual.error.drawDay"; date: string }
  | { key: "settings.manual.error.exists"; date: string }
  | { key: "settings.manual.error.incomplete" };

export interface ManualDrawInput {
  game: GameId;
  date: string;
  main: number[];
  euro: number[];
  superzahl: number | null;
}

/** First problem of a manually entered draw (QA B1: future dates are rejected). */
export function manualDrawError(input: ManualDrawInput, today: string, known: Map<string, Draw>): ManualDrawError | null {
  const err = drawDateError(input.game, input.date, today);
  if (err === "date") return { key: "settings.manual.error.date" };
  if (err === "future") return { key: "settings.manual.error.future", date: input.date };
  if (err === "drawDay") return { key: "settings.manual.error.drawDay", date: input.date };
  if (known.has(input.date)) return { key: "settings.manual.error.exists", date: input.date };
  const g = GAMES[input.game];
  const pool = g.extraCount ? euroPoolOn(input.date) : 0;
  const okMain = input.main.length === g.mainCount && input.main.every((n) => n >= 1 && n <= g.mainPool);
  const okEuro = input.euro.length === g.extraCount && input.euro.every((n) => n >= 1 && n <= pool);
  if (!okMain || !okEuro) return { key: "settings.manual.error.incomplete" };
  return null;
}

export function manualToDraw(input: ManualDrawInput): Draw {
  const main = [...input.main].sort((a, b) => a - b);
  return input.game === "ej"
    ? { game: "ej", date: input.date, main, euro: [...input.euro].sort((a, b) => a - b), euroPool: euroPoolOn(input.date), source: "user" }
    : { game: "649", date: input.date, main, superzahl: input.superzahl, source: "user" };
}
