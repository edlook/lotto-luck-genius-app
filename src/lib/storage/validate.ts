/**
 * Hand-written validators for data kept in localStorage or imported from JSON.
 * They replace the former zod schemas one-to-one (same rules, unknown keys dropped),
 * which keeps ~22 KB gzip of validator code out of the first load.
 *
 * Each parser returns a clean object (only known keys) or null when anything is wrong.
 */
import { GAMES, isGameId, type GameId } from "../games";
import { isValidIsoDate } from "../drawCalendar";
import { euroPoolOn } from "../eras";

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isIntArray = (v: unknown): v is number[] => Array.isArray(v) && v.every(isInt);
const isIsoDate = (v: unknown): v is string => typeof v === "string" && isValidIsoDate(v);

/** `undefined` (absent) is allowed; `null` and 0..9 are valid values. */
const isOptionalSuperzahl = (v: unknown): v is number | null | undefined =>
  v === undefined || v === null || (isInt(v) && v >= 0 && v <= 9);

/** k distinct integers in 1..pool. */
function isSet(nums: number[], k: number, pool: number): boolean {
  return nums.length === k && new Set(nums).size === k && nums.every((n) => n >= 1 && n <= pool);
}

/* ---------- tickets ---------- */

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
  /** The user marked the prize as paid out (silences the limitation-period hints). Optional: older tickets have none. */
  claimed?: boolean;
  source: "generator" | "manual";
}

function parseField(raw: unknown, game: GameId): TicketField | null {
  if (!isObj(raw) || !isIntArray(raw.main)) return null;
  if (raw.euro !== undefined && !isIntArray(raw.euro)) return null;
  const g = GAMES[game];
  const euro = (raw.euro as number[] | undefined) ?? [];
  const okMain = isSet(raw.main, g.mainCount, g.mainPool);
  const okEuro = g.extraCount === 0 ? euro.length === 0 : isSet(euro, g.extraCount, g.extraPool);
  if (!okMain || !okEuro) return null;
  return raw.euro !== undefined ? { main: raw.main, euro: raw.euro as number[] } : { main: raw.main };
}

export function parseTicket(raw: unknown): Ticket | null {
  if (!isObj(raw)) return null;
  const { id, game, fields, superzahl, drawDates, createdAt, note, claimed, source } = raw;
  if (typeof id !== "string" || id.length < 1 || id.length > 64) return null;
  if (!isGameId(game)) return null;
  if (!Array.isArray(fields) || fields.length < 1 || fields.length > 24) return null;
  if (!isOptionalSuperzahl(superzahl)) return null;
  if (!Array.isArray(drawDates) || drawDates.length < 1 || drawDates.length > 104 || !drawDates.every(isIsoDate))
    return null;
  if (typeof createdAt !== "string") return null;
  if (note !== undefined && (typeof note !== "string" || note.length > 500)) return null;
  if (claimed !== undefined && typeof claimed !== "boolean") return null;
  if (source !== "generator" && source !== "manual") return null;
  const parsed: TicketField[] = [];
  for (const f of fields) {
    const pf = parseField(f, game);
    if (!pf) return null;
    parsed.push(pf);
  }
  const t: Ticket = { id, game, fields: parsed, drawDates: [...drawDates], createdAt, source };
  if (superzahl !== undefined) t.superzahl = superzahl;
  if (note !== undefined) t.note = note;
  // Only the "true" state is kept: absent means not marked.
  if (claimed === true) t.claimed = true;
  return t;
}

/* ---------- user-added draws ---------- */

export interface UserDraw {
  game: GameId;
  date: string;
  main: number[];
  euro?: number[];
  superzahl?: number | null;
  addedAt?: string;
}

export function parseUserDraw(raw: unknown): UserDraw | null {
  if (!isObj(raw)) return null;
  const { game, date, main, euro, superzahl, addedAt } = raw;
  if (!isGameId(game) || !isIsoDate(date) || !isIntArray(main)) return null;
  if (euro !== undefined && !isIntArray(euro)) return null;
  if (!isOptionalSuperzahl(superzahl)) return null;
  if (addedAt !== undefined && typeof addedAt !== "string") return null;
  const g = GAMES[game];
  const pool = g.extraCount ? euroPoolOn(date) : 0;
  const e = euro ?? [];
  const okMain = isSet(main, g.mainCount, g.mainPool);
  const okEuro = g.extraCount === 0 ? e.length === 0 : isSet(e, 2, pool);
  if (!okMain || !okEuro) return null;
  const d: UserDraw = { game, date, main };
  if (euro !== undefined) d.euro = euro;
  if (superzahl !== undefined) d.superzahl = superzahl;
  if (addedAt !== undefined) d.addedAt = addedAt;
  return d;
}

/* ---------- odds screen inputs ---------- */

export interface OddsSettings {
  price?: Record<string, number>;
  share?: Record<string, number | null>;
  fee?: Record<string, number>;
  year?: { fieldsPerDraw: number; drawsPerWeek: number; weeks: number };
}

function parseRecord<T>(raw: unknown, ok: (v: unknown) => v is T): Record<string, T> | null {
  if (!isObj(raw)) return null;
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!ok(v)) return null;
    out[k] = v;
  }
  return out;
}

const nonNegative = (v: unknown): v is number => isNum(v) && v >= 0;
const shareValue = (v: unknown): v is number | null => v === null || (isNum(v) && v >= 0 && v <= 100);

/** Throws on invalid input (the local store then falls back to the default). */
export function parseOddsSettings(raw: unknown): OddsSettings {
  if (!isObj(raw)) throw new TypeError("odds settings: not an object");
  const out: OddsSettings = {};
  for (const key of ["price", "fee"] as const) {
    if (raw[key] === undefined) continue;
    const r = parseRecord(raw[key], nonNegative);
    if (!r) throw new TypeError(`odds settings: ${key}`);
    out[key] = r;
  }
  if (raw.share !== undefined) {
    const r = parseRecord(raw.share, shareValue);
    if (!r) throw new TypeError("odds settings: share");
    out.share = r;
  }
  if (raw.year !== undefined) {
    const y = raw.year;
    if (
      !isObj(y) ||
      !isInt(y.fieldsPerDraw) ||
      y.fieldsPerDraw <= 0 ||
      !isInt(y.drawsPerWeek) ||
      y.drawsPerWeek < 1 ||
      y.drawsPerWeek > 2 ||
      !isInt(y.weeks) ||
      y.weeks <= 0 ||
      y.weeks > 53
    )
      throw new TypeError("odds settings: year");
    out.year = { fieldsPerDraw: y.fieldsPerDraw, drawsPerWeek: y.drawsPerWeek, weeks: y.weeks };
  }
  return out;
}
