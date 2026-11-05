/**
 * Draw-day calendar and completeness check. Dates are ISO strings
 * (YYYY-MM-DD) for the draw day in Germany; arithmetic is done in UTC so
 * the user's time zone cannot shift a date.
 *
 * Schedules (research-company.md 4.1/4.2, confirmed by the imported data):
 * - Lotto 6aus49: Wednesday + Saturday since 2000-12-06 (earlier: mostly Saturday,
 *   so completeness is only checked from that date).
 * - EuroJackpot: Friday since 2012-03-23; Tuesday + Friday since 2022-03-29.
 */
import type { GameId } from "./games";

interface ScheduleSegment {
  from: string;
  to: string | null;
  days: number[];
}

export const SCHEDULES: Record<GameId, ScheduleSegment[]> = {
  "649": [{ from: "2000-12-06", to: null, days: [3, 6] }],
  ej: [
    { from: "2012-03-23", to: "2022-03-28", days: [5] },
    { from: "2022-03-29", to: null, days: [2, 5] },
  ],
};

/** Hour (Europe/Berlin) after which today's draw counts as closed for new tickets. Approximation. */
export const ACCEPTANCE_CLOSE_HOUR = 18;

const DAY = 86_400_000;

export function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  return toIso(new Date(toDate(iso).getTime() + n * DAY));
}

export function weekday(iso: string): number {
  return toDate(iso).getUTCDay();
}

export function isValidIsoDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = toDate(iso);
  return !Number.isNaN(d.getTime()) && toIso(d) === iso;
}

function segmentFor(game: GameId, iso: string): ScheduleSegment | undefined {
  return SCHEDULES[game].find((s) => iso >= s.from && (s.to === null || iso <= s.to));
}

/** True if the date is a regular draw day of the game (current or historical schedule). */
export function isDrawDay(game: GameId, iso: string): boolean {
  const seg = segmentFor(game, iso);
  if (seg) return seg.days.includes(weekday(iso));
  // Before the checked schedule: accept the current weekdays (historic data comes from the archive).
  return SCHEDULES[game][0]!.days.includes(weekday(iso));
}

/** Current date and hour in Europe/Berlin. */
export function berlinNow(now: Date = new Date()): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

/** Next draw date on or after `fromIso` (inclusive). */
export function nextDrawOnOrAfter(game: GameId, fromIso: string): string {
  let d = fromIso;
  for (let i = 0; i < 14; i++) {
    if (isDrawDay(game, d)) return d;
    d = addDays(d, 1);
  }
  throw new Error("No draw day within two weeks");
}

/** The next draw a new ticket can still take part in. */
export function nextDraw(game: GameId, now: Date = new Date()): string {
  const { date, hour } = berlinNow(now);
  if (isDrawDay(game, date) && hour < ACCEPTANCE_CLOSE_HOUR) return date;
  return nextDrawOnOrAfter(game, addDays(date, 1));
}

/** `count` consecutive draw dates starting on or after `startIso`. */
export function drawSeries(game: GameId, startIso: string, count: number): string[] {
  const out: string[] = [];
  let d = nextDrawOnOrAfter(game, startIso);
  while (out.length < count) {
    out.push(d);
    d = nextDrawOnOrAfter(game, addDays(d, 1));
  }
  return out;
}

/** All expected draw dates between two dates (inclusive), within the checked schedule. */
export function expectedDrawDates(game: GameId, fromIso: string, toIso_: string): string[] {
  const start = SCHEDULES[game][0]!.from > fromIso ? SCHEDULES[game][0]!.from : fromIso;
  const out: string[] = [];
  for (let d = start; d <= toIso_; d = addDays(d, 1)) {
    const seg = segmentFor(game, d);
    if (seg && seg.days.includes(weekday(d))) out.push(d);
  }
  return out;
}

export interface Completeness {
  /** First date of the checked period. */
  checkedFrom: string;
  checkedTo: string;
  expected: number;
  missing: string[];
}

/** Compares stored dates with the schedule between the schedule start and the last stored date. */
export function completeness(game: GameId, dates: string[]): Completeness | null {
  if (dates.length === 0) return null;
  const sorted = [...dates].sort();
  const last = sorted[sorted.length - 1]!;
  const from = SCHEDULES[game][0]!.from > sorted[0]! ? SCHEDULES[game][0]!.from : sorted[0]!;
  const have = new Set(sorted);
  const expected = expectedDrawDates(game, from, last);
  return { checkedFrom: from, checkedTo: last, expected: expected.length, missing: expected.filter((d) => !have.has(d)) };
}

/** Closest draw days around a non-draw date (one before, one after). */
export function nearestDrawDays(game: GameId, iso: string): string[] {
  let before = addDays(iso, -1);
  for (let i = 0; i < 14 && !isDrawDay(game, before); i++) before = addDays(before, -1);
  return [before, nextDrawOnOrAfter(game, addDays(iso, 1))];
}

/** First draw of each game (start of the built-in archives). Earlier dates had no draw. */
export const GAME_START: Record<GameId, string> = { "649": "1955-10-09", ej: "2012-03-23" };

export type DrawDateError = "date" | "future" | "drawDay";

/**
 * Checks a date entered for a draw result (manual entry, CSV import, stored user draws).
 * `today` is the current date in Europe/Berlin; a draw dated later than today cannot
 * have taken place yet. Today itself is allowed (the evening draw may already be known).
 */
export function drawDateError(game: GameId, iso: string, today: string = berlinNow().date): DrawDateError | null {
  if (!isValidIsoDate(iso)) return "date";
  if (iso > today) return "future";
  if (!isDrawDay(game, iso)) return "drawDay";
  return null;
}
