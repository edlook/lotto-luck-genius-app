/**
 * App data kept in this browser:
 * - tickets            llg.tickets.v1   (checked by ./validate.ts)
 * - user-added draws   llg.userDraws.v1 (manual entry / CSV import)
 * - default game       llg.game
 * - odds inputs        llg.odds.v1
 */
import { berlinNow, drawDateError } from "../drawCalendar";
import { euroPoolOn } from "../eras";
import type { Draw } from "../ticketCheck";
import { createLocalStore } from "./localStore";
import { parseOddsSettings, parseTicket, parseUserDraw, type OddsSettings, type Ticket, type UserDraw } from "./validate";

/* ---------- tickets ---------- */

export {
  parseTicket,
  parseUserDraw,
  parseOddsSettings,
  type Ticket,
  type TicketField,
  type UserDraw,
  type OddsSettings,
} from "./validate";

const ticketsParse = (raw: unknown): Ticket[] => {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((t) => {
    const r = parseTicket(t);
    return r ? [r] : [];
  });
};

// Anything that does not survive validation (broken JSON, a non-list, dropped entries) is backed up
// before the next write and announced on the tickets screen (QA B3).
export const ticketsStore = createLocalStore<Ticket[]>("llg.tickets.v1", ticketsParse, [], {
  isLossy: (parsed, value) => !Array.isArray(parsed) || parsed.length !== (value as Ticket[]).length,
});

export function newId(): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export const TICKETS_EXPORT_SCHEMA = "llg.tickets.v1";

export function exportTickets(tickets: Ticket[]): string {
  return JSON.stringify({ schema: TICKETS_EXPORT_SCHEMA, exportedAt: new Date().toISOString(), tickets }, null, 2);
}

export interface ImportAnalysis {
  valid: Ticket[];
  skipped: number;
  /** Valid tickets whose id already exists with different content. */
  conflicts: Ticket[];
  /** Valid tickets that are new. */
  fresh: Ticket[];
  /**
   * Why nothing can be imported (translated in the UI, never shown raw):
   * - "json":   the file is not valid JSON;
   * - "empty":  valid JSON, but the ticket list is empty;
   * - "format": valid JSON, but not a ticket export (no ticket list, or no entry passed validation).
   */
  error: TicketImportError | null;
}

export type TicketImportError = "json" | "empty" | "format";

export function analyzeTicketImport(text: string, existing: Ticket[]): ImportAnalysis {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { valid: [], skipped: 0, conflicts: [], fresh: [], error: "json" };
  }
  const list: unknown[] | null = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { tickets?: unknown }).tickets)
      ? ((data as { tickets: unknown[] }).tickets)
      : null;
  if (list === null) return { valid: [], skipped: 0, conflicts: [], fresh: [], error: "format" };
  if (!list.length) return { valid: [], skipped: 0, conflicts: [], fresh: [], error: "empty" };
  const valid: Ticket[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const item of list) {
    const r = parseTicket(item);
    // A second entry with the same id inside one file is skipped (QA B8).
    if (r && !seen.has(r.id)) {
      seen.add(r.id);
      valid.push(r);
    } else skipped++;
  }
  if (!valid.length) return { valid: [], skipped, conflicts: [], fresh: [], error: "format" };
  const byId = new Map(existing.map((t) => [t.id, t]));
  const conflicts: Ticket[] = [];
  const fresh: Ticket[] = [];
  for (const t of valid) {
    const old = byId.get(t.id);
    if (!old) fresh.push(t);
    else if (JSON.stringify(old) !== JSON.stringify(t)) conflicts.push(t);
    else skipped++; // identical, nothing to do
  }
  return { valid, skipped, conflicts, fresh, error: null };
}

/* ---------- user-added draws ---------- */

export const userDrawsStore = createLocalStore<UserDraw[]>(
  "llg.userDraws.v1",
  (raw) =>
    Array.isArray(raw)
      ? raw.flatMap((d) => {
          const r = parseUserDraw(d);
          return r ? [r] : [];
        })
      : [],
  [],
);

/**
 * User draws that may take part in statistics and ticket checks. Entries dated later than
 * today (Europe/Berlin) or not on a draw day are ignored, even if they are already stored
 * (e.g. saved by an older version). They stay in localStorage and can be cleared in Settings.
 */
export function activeUserDraws(list: UserDraw[], today: string = berlinNow().date): UserDraw[] {
  return list.filter((d) => drawDateError(d.game, d.date, today) === null);
}

export function userDrawToDraw(d: UserDraw): Draw {
  return d.game === "ej"
    ? { game: "ej", date: d.date, main: d.main, euro: d.euro, euroPool: euroPoolOn(d.date), source: "user" }
    : { game: "649", date: d.date, main: d.main, superzahl: d.superzahl ?? null, source: "user" };
}

export function drawToUserDraw(d: Draw): UserDraw {
  return d.game === "ej"
    ? { game: "ej", date: d.date, main: d.main, euro: d.euro, addedAt: new Date().toISOString() }
    : { game: "649", date: d.date, main: d.main, superzahl: d.superzahl ?? null, addedAt: new Date().toISOString() };
}

/* ---------- settings ---------- */

// The game store lives in ./gameStore.ts; re-exported for compatibility.
export { gameStore } from "./gameStore";

export const oddsStore = createLocalStore<OddsSettings>("llg.odds.v1", parseOddsSettings, {});
