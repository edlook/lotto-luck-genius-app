/**
 * Helpers for the draw list and the draw detail screen (pure, tested).
 */
import type { GameId } from "./games";
import { GAME_START, SCHEDULES, isDrawDay, isValidIsoDate, nearestDrawDays } from "./drawCalendar";
import { EJ_ERAS } from "./eras";
import type { Ticket } from "./storage/validate";
import type { Draw } from "./ticketCheck";

/**
 * EuroJackpot era change between two neighbouring rows of the list (newest first):
 * returns the start date of the era that begins after `older` and on or before `newer`.
 */
export function eraDividerBetween(game: GameId, newer: string, older: string): string | null {
  if (game !== "ej") return null;
  for (const era of EJ_ERAS) if (era.id > 0 && older < era.from && era.from <= newer) return era.from;
  return null;
}

export type DrawDateKind =
  | { kind: "found"; draw: Draw }
  /** Later than today (Europe/Berlin): the draw has not taken place. */
  | { kind: "future" }
  /** Before the first draw of the game. */
  | { kind: "beforeStart"; start: string }
  /** Not a draw day; nearest draw days before/after (only those that are not in the future). */
  | { kind: "noDrawDay"; nearest: string[] }
  /** A past draw day without data (not loaded yet / missing in the archive). */
  | { kind: "missing" }
  /** Before the checked schedule and not in the archive: no draw took place that day. */
  | { kind: "noSuchDraw" };

export function classifyDrawDate(game: GameId, iso: string, today: string, byDate: Map<string, Draw>): DrawDateKind {
  const draw = byDate.get(iso);
  if (draw) return { kind: "found", draw };
  if (!isValidIsoDate(iso)) return { kind: "noSuchDraw" };
  if (iso > today) return { kind: "future" };
  if (iso < GAME_START[game]) return { kind: "beforeStart", start: GAME_START[game] };
  if (iso < SCHEDULES[game][0]!.from) return { kind: "noSuchDraw" };
  if (!isDrawDay(game, iso)) {
    const nearest = nearestDrawDays(game, iso).filter((d) => d <= today && d >= GAME_START[game]);
    return { kind: "noDrawDay", nearest };
  }
  return { kind: "missing" };
}

/** Previous and next draw (by stored data) around a date; `draws` is chronological. */
export function neighbours(draws: Draw[], iso: string): { prev: string | null; next: string | null } {
  let lo = 0;
  let hi = draws.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (draws[mid]!.date < iso) lo = mid + 1;
    else hi = mid;
  }
  // lo = first index with date >= iso
  const prev = lo > 0 ? draws[lo - 1]!.date : null;
  const at = draws[lo]?.date === iso ? lo + 1 : lo;
  const next = draws[at]?.date ?? null;
  return { prev, next };
}

export function ticketsForDate(tickets: Ticket[], game: GameId, iso: string): Ticket[] {
  return tickets.filter((t) => t.game === game && t.drawDates.includes(iso));
}

/** Count of tickets per draw date for one game (for the "my tickets" mark in the list). */
export function ticketDates(tickets: Ticket[], game: GameId): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tickets) if (t.game === game) for (const d of t.drawDates) m.set(d, (m.get(d) ?? 0) + 1);
  return m;
}
