/**
 * Smart tips: which tip applies to a screen, which one is shown, and how long a dismissed one
 * stays hidden. Everything here is a pure function: the input is the data of the user and of the
 * app, the output is a list of candidates (guide-copy.md section 7). No React, no storage, no clock:
 * `now` and `today` come in as arguments.
 *
 * Rules (7.1):
 * - one tip per screen: lowest priority number first (1 = money, deadlines, unchecked data;
 *   2 = an action that changes the outcome; 3 = reference), ties by the order of the table;
 * - none while the tour is open, before it was finished or skipped, or with tips switched off;
 * - "Got it" hides a tip for N days, but only while its context is unchanged (new ticket, other
 *   draw, other game or other combination show it again); "do not show again" hides it for good;
 * - no tip depends on frequencies, "hot" or "cold" numbers.
 */
import { GAMES, type GameId } from "./games";
import { addDays, isDrawDay, toDate } from "./drawCalendar";
import { EJ_JACKPOT_CAP } from "./ev";
import { formatChanges, type Change, type EvaluateSuggestions } from "./hintChanges";
import type { PopularityReport } from "./popularity";
import type { Ticket } from "./storage/validate";
import type { TicketEvaluation } from "./ticketStatus";
import type { HintRecord, HintsState } from "./hintsState";

export { parseHintsState, parseHintsUsage, EMPTY_USAGE, type HintRecord, type HintsState, type HintsUsage } from "./hintsState";

/* ---------- catalogue (table 7.2, in table order) ---------- */

export type HintScreen = "generator" | "evaluate" | "tickets" | "draws" | "odds" | "stats" | "backtest";
type Priority = 1 | 2 | 3;
/** Days a dismissed tip stays hidden; "forever" = shown once. */
type Hide = number | "forever";

interface Meta {
  screen: HintScreen | "any";
  priority: Priority;
  hide: Hide;
}

export const HINTS = {
  "hint.gen.firstRun": { screen: "generator", priority: 3, hide: "forever" },
  "hint.gen.saveFirst": { screen: "generator", priority: 3, hide: 7 },
  "hint.gen.popular": { screen: "generator", priority: 2, hide: 7 },
  "hint.gen.randomMode": { screen: "generator", priority: 3, hide: 14 },
  "hint.gen.manyFields": { screen: "generator", priority: 2, hide: 7 },
  "hint.gen.szAfterSave": { screen: "generator", priority: 2, hide: 30 },
  "hint.eval.fix.dates": { screen: "evaluate", priority: 2, hide: 30 },
  "hint.eval.fix.progression": { screen: "evaluate", priority: 2, hide: 30 },
  "hint.eval.fix.ticketPattern": { screen: "evaluate", priority: 2, hide: 30 },
  "hint.eval.fix.pastWinning": { screen: "evaluate", priority: 2, hide: 30 },
  "hint.eval.mediumOnly": { screen: "evaluate", priority: 3, hide: 30 },
  "hint.eval.low": { screen: "evaluate", priority: 3, hide: 30 },
  "hint.tickets.empty": { screen: "tickets", priority: 2, hide: 30 },
  "hint.tickets.waiting": { screen: "tickets", priority: 2, hide: 30 },
  "hint.tickets.drawMissing": { screen: "tickets", priority: 1, hide: 1 },
  "hint.tickets.won": { screen: "tickets", priority: 1, hide: "forever" },
  "hint.tickets.sz": { screen: "tickets", priority: 2, hide: 7 },
  "hint.tickets.deadlineSoon": { screen: "tickets", priority: 1, hide: 7 },
  "hint.tickets.deadlineGrey": { screen: "tickets", priority: 1, hide: 3 },
  "hint.tickets.expired": { screen: "tickets", priority: 2, hide: "forever" },
  "hint.tickets.old": { screen: "tickets", priority: 3, hide: 90 },
  "hint.tickets.export": { screen: "tickets", priority: 3, hide: 30 },
  "hint.draws.stale": { screen: "draws", priority: 1, hide: 1 },
  "hint.draws.open": { screen: "draws", priority: 3, hide: "forever" },
  "hint.odds.year": { screen: "odds", priority: 2, hide: 30 },
  "hint.odds.jackpot.below": { screen: "odds", priority: 3, hide: 14 },
  "hint.odds.jackpot.notBelow": { screen: "odds", priority: 3, hide: 14 },
  "hint.stats.frequency": { screen: "stats", priority: 2, hide: 30 },
  "hint.stats.pLow": { screen: "stats", priority: 3, hide: 30 },
  "hint.backtest.none": { screen: "backtest", priority: 3, hide: 30 },
  "hint.backtest.popularity": { screen: "backtest", priority: 2, hide: 30 },
  "hint.global.tooMany": { screen: "any", priority: 3, hide: "forever" },
} as const satisfies Record<string, Meta>;

export type HintId = keyof typeof HINTS;
const ORDER = Object.keys(HINTS) as HintId[];

/* ---------- candidates ---------- */

/** Actions handled by the screen itself (the rest are plain links via `to`). */
export type HintActionId =
  | "replaceField"
  | "enableRare"
  | "openYear"
  | "applyChanges"
  | "saveSet"
  | "saveEvaluated"
  | "specifySz"
  | "claimed"
  | "export";

export interface HintAction {
  /** i18n key of the button label. */
  labelKey: string;
  labelParams?: Record<string, string | number>;
  /** Router target. */
  to?: string;
  /** Action performed by the screen. */
  id?: HintActionId;
  /** Ticket the action is about. */
  ticketId?: string;
  /** Number the action is about (field index, count of fields). */
  n?: number;
  /** Replacements to apply ("applyChanges"). */
  changes?: Change[];
}

/** How the `Hint` component formats a raw parameter before it goes into the text. */
export type ParamFormat = "date" | "money" | "p" | "line" | "game" | "index";

export interface HintCandidate {
  id: HintId;
  priority: Priority;
  /** Position in the table: tie-break between equal priorities. */
  order: number;
  /** Dismissal slot: the id, or `id:entity` for tips about one ticket. */
  key: string;
  /** The tip is hidden after "Got it" only while this value is unchanged. */
  ctx: string;
  hide: Hide;
  /** Raw values for the text placeholders. */
  params: Record<string, string | number>;
  format: Record<string, ParamFormat>;
  actions: HintAction[];
  /** Replaces the label of the dismiss button (the "Keep as it is" of the evaluation tips). */
  dismissKey?: string;
  /** Warning look for money, deadlines and unchecked data. */
  tone: "tip" | "alert";
}

interface Make {
  entity?: string;
  ctx?: string;
  params?: Record<string, string | number>;
  format?: Record<string, ParamFormat>;
  actions?: HintAction[];
  dismissKey?: string;
}

function make(id: HintId, o: Make = {}): HintCandidate {
  const meta: Meta = HINTS[id];
  return {
    id,
    priority: meta.priority,
    order: ORDER.indexOf(id),
    key: o.entity ? `${id}:${o.entity}` : id,
    ctx: o.ctx ?? "",
    hide: meta.hide,
    params: o.params ?? {},
    format: o.format ?? {},
    actions: o.actions ?? [],
    ...(o.dismissKey ? { dismissKey: o.dismissKey } : {}),
    tone: meta.priority === 1 ? "alert" : "tip",
  };
}

/* ---------- dates ---------- */

const DAY_MS = 86_400_000;

/** `iso` plus whole years; 29 February in a non-leap target year becomes 28 February. */
export function addYears(iso: string, years: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const ty = y + years;
  const lastDay = new Date(Date.UTC(ty, m, 0)).getUTCDate();
  return `${String(ty).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(Math.min(d, lastDay)).padStart(2, "0")}`;
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY_MS);
}

export interface Deadlines {
  /** Draw day plus three years, same day and month. */
  strict: string;
  /** 31 December of the year of the draw plus three (the "end of the year" reading). */
  lenient: string;
}

/**
 * The two readings of the three-year limit (guide-copy.md 7.3 and "could not verify" 1): the
 * companies word it differently, so both edges are used and the guide says to count from the draw day.
 */
export function deadlinesFor(drawDate: string): Deadlines {
  return { strict: addYears(drawDate, 3), lenient: `${Number(drawDate.slice(0, 4)) + 3}-12-31` };
}

/** Days before `strict` from which the "turns three years old" tip appears. */
export const DEADLINE_LEAD_DAYS = 90;

/**
 * Date of the draw whose prize expires first: the earliest checked draw in which some field won.
 * null for a ticket without a win.
 */
export function winningDrawDate(ev: TicketEvaluation): string | null {
  const dates = ev.results.filter((r) => r.fields.some((f) => f.cls !== null)).map((r) => r.date);
  return dates.length ? dates.sort()[0]! : null;
}

/** Holidays on which a regular draw may be moved: a missing draw is not reported right away. */
const HOLIDAY_RISK = new Set(["12-24", "12-25", "12-26", "12-31", "01-01"]);
/** Days after a scheduled draw before the archive is expected to have it (archive updates the same night). */
export const ARCHIVE_GRACE_DAYS = 2;
/** The same for draws on a holiday-risk date. */
export const HOLIDAY_GRACE_DAYS = 4;

/**
 * The latest scheduled draw the archive should already contain, or null. Draws of the last
 * two days are not expected yet (evening draw, nightly update), nor are those around Christmas and
 * New Year for four days, because holiday shifts are not verified (guide-copy.md "could not verify" 9).
 */
export function expectedLastDraw(game: GameId, today: string): string | null {
  for (let i = ARCHIVE_GRACE_DAYS; i <= ARCHIVE_GRACE_DAYS + 14; i++) {
    const d = addDays(today, -i);
    if (!isDrawDay(game, d)) continue;
    if (HOLIDAY_RISK.has(d.slice(5)) && i < HOLIDAY_GRACE_DAYS) continue;
    return d;
  }
  return null;
}

/* ---------- Generator ---------- */

export interface GeneratorHintInput {
  game: GameId;
  mode: "rare" | "random";
  /** Value of the "fields" input. */
  fieldCount: number;
  hasResult: boolean;
  /** The shown set was saved as a ticket. */
  resultSaved: boolean;
  /** "Generate" was pressed at least once (stored). */
  generatedBefore: boolean;
  /** Tickets in the storage, all games. */
  ticketCount: number;
  /** First field of the shown set rated "high" (index and a key of its numbers), only meaningful in "random" mode. */
  popularField: { index: number; key: string } | null;
  /** The user has just switched the mode to "random". */
  switchedToRandom: boolean;
  /** Set that was just saved as a ticket (no Superzahl), with how many saves of this kind happened. */
  justSaved: { ticketId: string; withoutSuperzahl: boolean } | null;
  szSaves: number;
}

/** Draws per week of both games (Tue/Fri, Wed/Sat). */
export const DRAWS_PER_WEEK = 2;
export const FIELDS_MANY = 6;

export function generatorHints(i: GeneratorHintInput): HintCandidate[] {
  const out: HintCandidate[] = [];
  const cfg = GAMES[i.game];
  if (!i.hasResult && !i.generatedBefore)
    out.push(make("hint.gen.firstRun", { actions: [{ labelKey: "common.learnMore", to: "/about#generator" }] }));
  if (i.hasResult && !i.resultSaved && i.ticketCount === 0)
    out.push(make("hint.gen.saveFirst", { actions: [{ labelKey: "generator.result.save", id: "saveSet" }] }));
  if (i.mode === "random" && i.hasResult && i.popularField)
    out.push(
      make("hint.gen.popular", {
        ctx: `${i.game}:${i.popularField.key}`,
        params: { n: i.popularField.index + 1 },
        actions: [
          {
            labelKey: "hint.gen.popular.action",
            labelParams: { n: i.popularField.index + 1 },
            id: "replaceField",
            n: i.popularField.index,
          },
        ],
      }),
    );
  if (i.mode === "random" && i.switchedToRandom)
    out.push(make("hint.gen.randomMode", { actions: [{ labelKey: "hint.gen.randomMode.action", id: "enableRare" }] }));
  if (i.fieldCount > FIELDS_MANY) {
    const year = i.fieldCount * DRAWS_PER_WEEK * 52 * cfg.price;
    out.push(
      make("hint.gen.manyFields", {
        ctx: `${i.game}:${i.fieldCount}`,
        params: { n: i.fieldCount, year },
        format: { year: "money" },
        actions: [{ labelKey: "hint.gen.manyFields.action", id: "openYear", n: i.fieldCount }],
      }),
    );
  }
  if (i.justSaved && i.game === "649" && i.justSaved.withoutSuperzahl && i.szSaves <= 3)
    out.push(
      make("hint.gen.szAfterSave", {
        entity: i.justSaved.ticketId,
        ctx: i.justSaved.ticketId,
        actions: [{ labelKey: "generator.saved.open", to: "/tickets" }],
      }),
    );
  return out;
}

/* ---------- Check yours ---------- */

export interface EvaluateHintInput {
  /** Report of the evaluated, complete combination; null before "Evaluate" was pressed. */
  report: PopularityReport | null;
  /** Key of the evaluated combination (the context of every tip here). */
  comboKey: string;
  suggestions: EvaluateSuggestions;
}

export function evaluateHints(i: EvaluateHintInput): HintCandidate[] {
  const r = i.report;
  if (!r) return [];
  const out: HintCandidate[] = [];
  const rule = (id: string) => r.rules.find((x) => x.id === id && x.status === "triggered");
  const fix = (id: HintId, changes: Change[], params: Record<string, string | number>, format: Record<string, ParamFormat> = {}) =>
    out.push(
      make(id, {
        ctx: i.comboKey,
        params: { ...params, changes: formatChanges(changes) },
        format,
        actions: [{ labelKey: "hint.eval.apply", id: "applyChanges", changes }],
        dismissKey: "hint.eval.keep",
      }),
    );

  const dates = rule("dates");
  if (dates && i.suggestions.dates) fix("hint.eval.fix.dates", i.suggestions.dates, {});
  const progression = rule("progression");
  if (progression && i.suggestions.progression)
    fix("hint.eval.fix.progression", i.suggestions.progression, { step: progression.params.step ?? "" });
  const pattern = rule("ticketPattern");
  if (pattern && i.suggestions.ticketPattern)
    fix("hint.eval.fix.ticketPattern", i.suggestions.ticketPattern, { line: pattern.params.line ?? "" }, { line: "line" });
  const past = rule("pastWinning");
  if (past && i.suggestions.pastWinning)
    fix("hint.eval.fix.pastWinning", i.suggestions.pastWinning, { date: past.params.date ?? "" }, { date: "date" });
  if (r.level === "medium" && i.suggestions.medium) fix("hint.eval.mediumOnly", i.suggestions.medium, {});
  if (r.level === "low")
    out.push(
      make("hint.eval.low", { ctx: i.comboKey, actions: [{ labelKey: "evaluate.report.save", id: "saveEvaluated" }] }),
    );
  return out;
}

/* ---------- Tickets ---------- */

export interface TicketEntry {
  ticket: Ticket;
  ev: TicketEvaluation;
}

export interface TicketsHintInput {
  game: GameId;
  /** Today in Europe/Berlin (ISO). */
  today: string;
  /** Current time, ms. */
  now: number;
  /** Tickets in the storage, all games. */
  totalTickets: number;
  /** Tickets of the shown game with their evaluation. */
  entries: TicketEntry[];
  /** The archive of the game is loaded (not loading, not failed). Without it nothing about draws is said. */
  archiveReady: boolean;
  /** ISO time of the last JSON export of the tickets, null = never. */
  lastExportAt: string | null;
}

export const EXPORT_AFTER_DAYS = 30;
export const WAITING_WITHIN_DAYS = 7;
export const OLD_AFTER_YEARS = 3;

/** Matches of the best checked draw of a 6aus49 ticket without Superzahl: [matches, draw date]. */
function bestMatches(ev: TicketEvaluation): { n: number; date: string } | null {
  let best: { n: number; date: string } | null = null;
  for (const r of ev.results)
    for (const f of r.fields) {
      const n = f.mainHits.length;
      if (!best || n > best.n || (n === best.n && r.date > best.date)) best = { n, date: r.date };
    }
  return best;
}

export function ticketsHints(i: TicketsHintInput): HintCandidate[] {
  const out: HintCandidate[] = [];
  const cfg = GAMES[i.game];

  if (i.totalTickets === 0)
    out.push(make("hint.tickets.empty", { actions: [{ labelKey: "tickets.empty.toGenerator", to: "/" }] }));

  if (i.archiveReady) {
    // Earliest date of a draw that is still ahead, within a week.
    const pending = i.entries.map((e) => e.ev.nextPending).filter((d): d is string => d !== null).sort();
    const nextDate = pending[0];
    if (nextDate && daysBetween(i.today, nextDate) <= WAITING_WITHIN_DAYS)
      out.push(
        make("hint.tickets.waiting", {
          ctx: nextDate,
          params: { game: i.game, date: nextDate },
          format: { game: "game", date: "date" },
          actions: [{ labelKey: "hint.tickets.waiting.action", to: "/draws" }],
        }),
      );

    // Earliest draw that took place without data.
    const missing = i.entries
      .flatMap((e) => e.ev.notLoaded)
      .sort()[0];
    if (missing)
      out.push(
        make("hint.tickets.drawMissing", {
          ctx: `${i.game}:${missing}`,
          params: { game: i.game, date: missing },
          format: { game: "game", date: "date" },
          actions: [
            { labelKey: "common.toImport", to: "/settings#import" },
            { labelKey: "tickets.card.manualDraw", to: "/settings#manual-draw" },
          ],
        }),
      );

    for (const { ticket, ev } of i.entries) {
      if (ev.status !== "won" || ev.bestClass === null || ticket.claimed) continue;
      out.push(
        make("hint.tickets.won", {
          entity: ticket.id,
          ctx: String(ev.bestClass),
          params: { class: ev.bestClass },
          actions: [{ labelKey: "hint.tickets.won.action", to: "/guide#won" }],
        }),
      );
    }

    for (const { ticket, ev } of i.entries) {
      if (i.game !== "649" || (ticket.superzahl !== undefined && ticket.superzahl !== null)) continue;
      const best = bestMatches(ev);
      if (!best || best.n < 2) continue;
      const cls = cfg.classes.find((c) => c.main === best.n && c.extra === 1)?.cls;
      if (cls === undefined) continue;
      out.push(
        make("hint.tickets.sz", {
          entity: ticket.id,
          ctx: `${best.date}:${best.n}`,
          params: { n: best.n, class: cls },
          actions: [{ labelKey: "tickets.card.specifySz", id: "specifySz", ticketId: ticket.id }],
        }),
      );
    }

    for (const { ticket, ev } of i.entries) {
      if (ev.status !== "won" || ticket.claimed) continue;
      const drawDate = winningDrawDate(ev);
      if (!drawDate) continue;
      const { strict, lenient } = deadlinesFor(drawDate);
      const actions: HintAction[] = [
        { labelKey: "hint.tickets.deadline.action", to: "/guide#won-deadline" },
        { labelKey: "hint.tickets.claimed.action", id: "claimed", ticketId: ticket.id },
      ];
      const common = { entity: ticket.id, ctx: strict, actions, format: { date: "date", deadline: "date" } as const };
      if (i.today <= strict && daysBetween(i.today, strict) <= DEADLINE_LEAD_DAYS)
        out.push(make("hint.tickets.deadlineSoon", { ...common, params: { date: drawDate, deadline: strict } }));
      else if (i.today > strict && i.today <= lenient)
        out.push(make("hint.tickets.deadlineGrey", { ...common, params: { date: drawDate, deadline: strict } }));
      else if (i.today > lenient)
        out.push(make("hint.tickets.expired", { ...common, ctx: lenient, params: { date: drawDate, deadline: lenient } }));
    }

    const oldBefore = addYears(i.today, -OLD_AFTER_YEARS);
    const hasOld = i.entries.some(({ ticket, ev }) => {
      const last = [...ticket.drawDates].sort().pop();
      return ev.status === "checked" && last !== undefined && last < oldBefore;
    });
    if (hasOld) out.push(make("hint.tickets.old", { actions: [{ labelKey: "tickets.menu.export", id: "export" }] }));
  }

  if (i.totalTickets >= 3) {
    const last = i.lastExportAt ? Date.parse(i.lastExportAt) : NaN;
    if (Number.isNaN(last) || i.now - last > EXPORT_AFTER_DAYS * DAY_MS)
      out.push(make("hint.tickets.export", { actions: [{ labelKey: "tickets.menu.export", id: "export" }] }));
  }
  return out;
}

/* ---------- Draws ---------- */

export interface DrawsHintInput {
  game: GameId;
  today: string;
  /** Date of the newest draw in the archive (and user draws); null = no data. */
  lastArchiveDate: string | null;
  archiveReady: boolean;
  /** First visit of the screen (read once when the screen opens). */
  firstVisit: boolean;
  totalTickets: number;
}

export function drawsHints(i: DrawsHintInput): HintCandidate[] {
  const out: HintCandidate[] = [];
  if (i.archiveReady && i.lastArchiveDate) {
    const expected = expectedLastDraw(i.game, i.today);
    if (expected && i.lastArchiveDate < expected)
      out.push(
        make("hint.draws.stale", {
          ctx: `${i.game}:${expected}`,
          params: { game: i.game, last: i.lastArchiveDate, expected },
          format: { game: "game", last: "date", expected: "date" },
          actions: [
            { labelKey: "common.toImport", to: "/settings#import" },
            { labelKey: "tickets.card.manualDraw", to: "/settings#manual-draw" },
          ],
        }),
      );
  }
  if (i.firstVisit && i.totalTickets >= 1) out.push(make("hint.draws.open"));
  return out;
}

/* ---------- Odds ---------- */

export interface OddsHintInput {
  game: GameId;
  /** Yearly calculator result, null while the payout share is unknown. */
  year: { spent: number; back: number; loss: number; signature: string } | null;
  /** Latest jackpot in the pot and the expected return of a field at that jackpot (EuroJackpot only). */
  jackpot: { amount: number; ev: number; price: number; drawDate: string } | null;
}

export function oddsHints(i: OddsHintInput): HintCandidate[] {
  const out: HintCandidate[] = [];
  if (i.year)
    out.push(
      make("hint.odds.year", {
        ctx: `${i.game}:${i.year.signature}`,
        params: { spent: i.year.spent, back: i.year.back, loss: i.year.loss },
        format: { spent: "money", back: "money", loss: "money" },
      }),
    );
  const j = i.jackpot;
  if (i.game === "ej" && j && j.amount >= 0.5 * EJ_JACKPOT_CAP) {
    out.push(
      make(j.ev < j.price ? "hint.odds.jackpot.below" : "hint.odds.jackpot.notBelow", {
        ctx: `${j.drawDate}:${Math.round(j.amount)}`,
        params: { jackpot: j.amount, ev: j.ev, price: j.price },
        format: { jackpot: "money", ev: "money", price: "money" },
        actions: [{ labelKey: "odds.source.link", to: "/about#odds" }],
      }),
    );
  }
  return out;
}

/* ---------- Statistics and strategy check ---------- */

export interface StatsHintInput {
  game: GameId;
  period: string;
  /** The user sorted a frequency table by frequency. */
  sortedByFrequency: boolean;
  /** p-value of the uniformity test of the chosen period, null while it runs. */
  pValue: number | null;
}

export const P_LOW = 0.05;

export function statsHints(i: StatsHintInput): HintCandidate[] {
  const out: HintCandidate[] = [];
  if (i.sortedByFrequency)
    out.push(make("hint.stats.frequency", { actions: [{ labelKey: "stats.backtest.link", to: "/backtest" }] }));
  if (i.pValue !== null && i.pValue < P_LOW)
    out.push(make("hint.stats.pLow", { ctx: `${i.game}:${i.period}`, params: { p: i.pValue }, format: { p: "p" } }));
  return out;
}

export interface BacktestHintInput {
  game: GameId;
  /** Strategies tab: the run finished and no strategy left the band of chance. */
  strategiesNone: boolean;
  /** Popularity tab (EuroJackpot): the run finished; verdict and the figures of the two groups. */
  popularity: {
    verdict: "confirmed" | "weak" | "notDetected" | "opposite";
    popular: number;
    unpopular: number;
    payPop: number;
    payUnpop: number;
    to: string;
  } | null;
}

export function backtestHints(i: BacktestHintInput): HintCandidate[] {
  const out: HintCandidate[] = [];
  if (i.strategiesNone)
    out.push(make("hint.backtest.none", { ctx: i.game, actions: [{ labelKey: "hint.backtest.none.action", to: "/guide" }] }));
  const p = i.popularity;
  if (i.game === "ej" && p && (p.verdict === "confirmed" || p.verdict === "weak"))
    out.push(
      make("hint.backtest.popularity", {
        ctx: p.to,
        params: { popular: p.popular, unpopular: p.unpopular, payPop: p.payPop, payUnpop: p.payUnpop },
        format: { popular: "index", unpopular: "index", payPop: "money", payUnpop: "money" },
        actions: [{ labelKey: "hint.backtest.popularity.action", to: "/" }],
      }),
    );
  return out;
}

/* ---------- global ---------- */

export const TOO_MANY_AFTER = 3;

/** "Tips in the way?": once, after "Got it" was pressed on three tips in one session. */
export function globalHints(i: { dismissedThisSession: number }): HintCandidate[] {
  return i.dismissedThisSession >= TOO_MANY_AFTER
    ? [make("hint.global.tooMany", { actions: [{ labelKey: "nav.settings", to: "/settings" }] })]
    : [];
}

/* ---------- screens ---------- */

export interface HintInputs {
  generator: GeneratorHintInput;
  evaluate: EvaluateHintInput;
  tickets: TicketsHintInput;
  draws: DrawsHintInput;
  odds: OddsHintInput;
  stats: StatsHintInput;
  backtest: BacktestHintInput;
}

const BUILDERS: { [S in HintScreen]: (i: HintInputs[S]) => HintCandidate[] } = {
  generator: generatorHints,
  evaluate: evaluateHints,
  tickets: ticketsHints,
  draws: drawsHints,
  odds: oddsHints,
  stats: statsHints,
  backtest: backtestHints,
};

export function candidatesFor<S extends HintScreen>(screen: S, input: HintInputs[S]): HintCandidate[] {
  return (BUILDERS[screen] as (i: HintInputs[S]) => HintCandidate[])(input);
}

/* ---------- dismissal state (`llg.hints.v1`) ---------- */

/** A tip is hidden after "Got it" while the time has not run out and its context is unchanged. */
export function isHidden(state: HintsState, c: Pick<HintCandidate, "key" | "ctx">, now: number): boolean {
  const rec = state[c.key];
  if (!rec) return false;
  if (rec.forever) return true;
  return rec.until !== undefined && Date.parse(rec.until) > now && (rec.ctx ?? "") === c.ctx;
}

/** State after "Got it": hidden for the tip's number of days (or for good). */
export function dismiss(state: HintsState, c: Pick<HintCandidate, "key" | "ctx" | "hide">, now: number): HintsState {
  const rec: HintRecord =
    c.hide === "forever" ? { forever: true } : { until: new Date(now + c.hide * DAY_MS).toISOString(), ctx: c.ctx };
  return { ...prune(state, now), [c.key]: rec };
}

/** State after "Do not show again". */
export function dismissForever(state: HintsState, c: Pick<HintCandidate, "key">, now: number): HintsState {
  return { ...prune(state, now), [c.key]: { forever: true } };
}

/** Drops records whose time has run out, so the stored object does not grow forever. */
export function prune(state: HintsState, now: number): HintsState {
  const out: HintsState = {};
  for (const [k, r] of Object.entries(state)) if (r.forever || (r.until && Date.parse(r.until) > now)) out[k] = r;
  return out;
}

/* ---------- selection ---------- */

export interface SelectContext {
  /** Tips switched on in the settings. */
  enabled: boolean;
  /** The tour was finished or skipped. */
  tourDone: boolean;
  /** The tour is open right now (also when reopened from the settings). */
  tourOpen: boolean;
  now: number;
  state: HintsState;
}

/** The one tip to show, or null. */
export function pickHint(candidates: readonly HintCandidate[], ctx: SelectContext): HintCandidate | null {
  if (!ctx.enabled || !ctx.tourDone || ctx.tourOpen) return null;
  const visible = candidates.filter((c) => !isHidden(ctx.state, c, ctx.now));
  visible.sort((a, b) => a.priority - b.priority || a.order - b.order);
  return visible[0] ?? null;
}
