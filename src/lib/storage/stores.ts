/**
 * App data kept in this browser:
 * - tickets            llg.tickets.v1   (schema checked with zod)
 * - user-added draws   llg.userDraws.v1 (manual entry / CSV import)
 * - default game       llg.game
 * - odds inputs        llg.odds.v1
 */
import { z } from "zod";
import { GAMES, type GameId } from "../games";
import { berlinNow, drawDateError, isValidIsoDate } from "../drawCalendar";
import { euroPoolOn } from "../eras";
import type { Draw } from "../ticketCheck";
import { createLocalStore } from "./localStore";

/* ---------- tickets ---------- */

const gameSchema = z.enum(["ej", "649"]);
const isoDate = z.string().refine(isValidIsoDate, "ISO date");

const fieldSchema = z.object({
  main: z.array(z.number().int()),
  euro: z.array(z.number().int()).optional(),
});

export const ticketSchema = z
  .object({
    id: z.string().min(1).max(64),
    game: gameSchema,
    fields: z.array(fieldSchema).min(1).max(24),
    superzahl: z.number().int().min(0).max(9).nullable().optional(),
    drawDates: z.array(isoDate).min(1).max(104),
    createdAt: z.string(),
    note: z.string().max(500).optional(),
    source: z.enum(["generator", "manual"]),
  })
  .superRefine((t, ctx) => {
    const g = GAMES[t.game];
    t.fields.forEach((f, i) => {
      const okMain =
        f.main.length === g.mainCount &&
        new Set(f.main).size === g.mainCount &&
        f.main.every((n) => n >= 1 && n <= g.mainPool);
      const euro = f.euro ?? [];
      const okEuro =
        g.extraCount === 0
          ? euro.length === 0
          : euro.length === g.extraCount && new Set(euro).size === g.extraCount && euro.every((n) => n >= 1 && n <= g.extraPool);
      if (!okMain || !okEuro) ctx.addIssue({ code: "custom", message: `field ${i + 1}`, path: ["fields", i] });
    });
  });

/* Explicit interfaces (instead of z.infer) keep the public types readable and stable. */
export interface TicketField {
  main: number[];
  euro?: number[];
}

export interface Ticket {
  id: string;
  game: GameId;
  fields: TicketField[];
  superzahl?: number | null;
  drawDates: string[];
  createdAt: string;
  note?: string;
  source: "generator" | "manual";
}

const ticketsParse = (raw: unknown): Ticket[] => {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((t) => {
    const r = ticketSchema.safeParse(t);
    return r.success ? [r.data as Ticket] : [];
  });
};

export const ticketsStore = createLocalStore<Ticket[]>("llg.tickets.v1", ticketsParse, []);

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
  let skipped = 0;
  for (const item of list) {
    const r = ticketSchema.safeParse(item);
    if (r.success) valid.push(r.data as Ticket);
    else skipped++;
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

const userDrawSchema = z
  .object({
    game: gameSchema,
    date: isoDate,
    main: z.array(z.number().int()),
    euro: z.array(z.number().int()).optional(),
    superzahl: z.number().int().min(0).max(9).nullable().optional(),
    addedAt: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    const g = GAMES[d.game];
    const pool = g.extraCount ? euroPoolOn(d.date) : 0;
    const okMain = d.main.length === g.mainCount && new Set(d.main).size === g.mainCount && d.main.every((n) => n >= 1 && n <= g.mainPool);
    const euro = d.euro ?? [];
    const okEuro = g.extraCount === 0 ? euro.length === 0 : euro.length === 2 && new Set(euro).size === 2 && euro.every((n) => n >= 1 && n <= pool);
    if (!okMain || !okEuro) ctx.addIssue({ code: "custom", message: "numbers" });
  });

export interface UserDraw {
  game: GameId;
  date: string;
  main: number[];
  euro?: number[];
  superzahl?: number | null;
  addedAt?: string;
}

export const userDrawsStore = createLocalStore<UserDraw[]>(
  "llg.userDraws.v1",
  (raw) =>
    Array.isArray(raw)
      ? raw.flatMap((d) => {
          const r = userDrawSchema.safeParse(d);
          return r.success ? [r.data as UserDraw] : [];
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

// The game store lives in ./gameStore.ts (no zod, so the app shell stays small); re-exported for compatibility.
export { gameStore } from "./gameStore";

const oddsSchema = z.object({
  price: z.record(z.string(), z.number().nonnegative()).optional(),
  share: z.record(z.string(), z.number().min(0).max(100).nullable()).optional(),
  fee: z.record(z.string(), z.number().nonnegative()).optional(),
  year: z
    .object({
      fieldsPerDraw: z.number().int().positive(),
      drawsPerWeek: z.number().int().min(1).max(2),
      weeks: z.number().int().positive().max(53),
    })
    .optional(),
});

export interface OddsSettings {
  price?: Record<string, number>;
  share?: Record<string, number | null>;
  fee?: Record<string, number>;
  year?: { fieldsPerDraw: number; drawsPerWeek: number; weeks: number };
}

export const oddsStore = createLocalStore<OddsSettings>("llg.odds.v1", (raw) => oddsSchema.parse(raw) as OddsSettings, {});
