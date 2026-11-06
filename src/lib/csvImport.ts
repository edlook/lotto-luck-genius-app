/**
 * Parses a user-supplied CSV of draws (Settings → Import).
 *
 * Accepted:
 * - separators: comma, semicolon or tab;
 * - dates: YYYY-MM-DD or DD.MM.YYYY;
 * - optional header line (any first line whose first cell is not a date);
 * - Lotto 6aus49: date, n1..n6[, superzahl]  (format of daowa89/lottery-archive);
 * - EuroJackpot:  date, n1..n5, e1, e2.
 * - dates later than today (Europe/Berlin) are rejected: such a draw has not happened yet.
 * Every problem is reported per row; invalid rows are never "repaired".
 */
import { GAMES, type GameId } from "./games";
import { berlinNow, drawDateError, isValidIsoDate } from "./drawCalendar";
import { euroPoolOn } from "./eras";
import type { Draw } from "./ticketCheck";

export type RowErrorCode = "date" | "range" | "count" | "duplicateNumber" | "drawDay" | "future" | "duplicateDate";

export interface RowError {
  row: number;
  code: RowErrorCode;
  value?: string;
  date?: string;
}

export interface ParseResult {
  found: number;
  draws: Draw[];
  errors: RowError[];
  /** True when no line looked like a draw at all. */
  unrecognized: boolean;
}

export function parseDate(raw: string): string | null {
  const v = raw.trim();
  let iso: string | null = null;
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (m) iso = `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(v);
  if (m) iso = `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  return iso && isValidIsoDate(iso) ? iso : null;
}

/** `today` (ISO, Europe/Berlin) is injectable for tests. */
export function parseDrawCsv(game: GameId, text: string, today: string = berlinNow().date): ParseResult {
  const cfg = GAMES[game];
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const draws: Draw[] = [];
  const errors: RowError[] = [];
  const seenDates = new Set<string>();
  let found = 0;
  let looksLikeData = 0;
  let firstLine = true;

  lines.forEach((line, i) => {
    const row = i + 1;
    if (line.trim() === "") return;
    const isFirst = firstLine;
    firstLine = false;
    const cells = line.split(/[;,\t]/).map((c) => c.trim());
    const date = parseDate(cells[0] ?? "");
    if (!date) {
      // Only the first non-empty line may be a header, and only if its first cell has no digits
      // ("Datum", "date"); an unreadable date such as 31.02.2024 is reported (QA B11).
      if (isFirst && !/\d/.test(cells[0] ?? "")) return;
      found++;
      errors.push({ row, code: "date", value: cells[0] ?? "" });
      return;
    }
    looksLikeData++;
    found++;
    const rest = cells.slice(1);
    // drop trailing empty cells, except the optional empty Superzahl column
    while (rest.length && rest[rest.length - 1] === "" && rest.length > cfg.mainCount) rest.pop();

    const needed = cfg.mainCount + cfg.extraCount;
    const okCount = cfg.hasSuperzahl
      ? rest.length === cfg.mainCount || rest.length === cfg.mainCount + 1
      : rest.length === needed;
    if (!okCount) {
      errors.push({ row, code: "count" });
      return;
    }
    const nums: number[] = [];
    for (const c of rest.slice(0, needed)) {
      if (!/^\d{1,2}$/.test(c)) {
        errors.push({ row, code: "range", value: c });
        return;
      }
      nums.push(Number(c));
    }
    const main = nums.slice(0, cfg.mainCount);
    const euro = nums.slice(cfg.mainCount, needed);
    const euroPool = cfg.extraCount ? euroPoolOn(date) : 0;
    const badMain = main.find((n) => n < 1 || n > cfg.mainPool);
    if (badMain !== undefined) {
      errors.push({ row, code: "range", value: String(badMain) });
      return;
    }
    const badEuro = euro.find((n) => n < 1 || n > euroPool);
    if (badEuro !== undefined) {
      errors.push({ row, code: "range", value: String(badEuro) });
      return;
    }
    const dupMain = main.find((n, j) => main.indexOf(n) !== j);
    const dupEuro = euro.find((n, j) => euro.indexOf(n) !== j);
    if (dupMain !== undefined || dupEuro !== undefined) {
      errors.push({ row, code: "duplicateNumber", value: String(dupMain ?? dupEuro) });
      return;
    }
    let superzahl: number | null = null;
    if (cfg.hasSuperzahl && rest.length === cfg.mainCount + 1 && rest[cfg.mainCount] !== "") {
      const sz = rest[cfg.mainCount]!;
      if (!/^\d$/.test(sz)) {
        errors.push({ row, code: "range", value: sz });
        return;
      }
      superzahl = Number(sz);
    }
    const dateError = drawDateError(game, date, today);
    if (dateError === "future" || dateError === "drawDay") {
      errors.push({ row, code: dateError, date });
      return;
    }
    if (seenDates.has(date)) {
      errors.push({ row, code: "duplicateDate", date });
      return;
    }
    seenDates.add(date);
    const sortedMain = [...main].sort((a, b) => a - b);
    draws.push(
      cfg.hasSuperzahl
        ? { game, date, main: sortedMain, superzahl, source: "user" }
        : { game, date, main: sortedMain, euro: [...euro].sort((a, b) => a - b), euroPool, source: "user" },
    );
  });

  return { found, draws, errors, unrecognized: looksLikeData === 0 };
}
