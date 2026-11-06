/**
 * The ticket form (add / edit) as plain data: validation and conversion to a stored Ticket.
 * Kept out of the component so the rules are unit-tested.
 */
import { GAMES, type GameId } from "./games";
import { GAME_START, drawSeries, isDrawDay, isValidIsoDate } from "./drawCalendar";
import type { Ticket } from "./storage/validate";

export type DrawMode = "next" | "date" | "series";

export interface DraftField {
  main: number[];
  euro: number[];
}

export interface TicketDraft {
  game: GameId;
  fields: DraftField[];
  mode: DrawMode;
  /** ISO date for "date" and "series" (start). */
  date: string;
  /** Number of consecutive draws for "series". */
  count: number | null;
  superzahl: number | null;
  note: string;
}

export const MAX_TICKET_FIELDS = 12;
/** Same limit as the stored-ticket validator (two years of two draws a week). */
export const MAX_SERIES = 104;

export interface DraftMessage {
  key: string;
  params?: Record<string, string | number>;
}

export interface DraftErrors {
  fields?: DraftMessage;
  /** Index → message for incomplete fields. */
  field: Record<number, DraftMessage>;
  date?: DraftMessage;
  count?: DraftMessage;
  superzahl?: DraftMessage;
}

export const emptyField = (): DraftField => ({ main: [], euro: [] });

export function emptyDraft(game: GameId): TicketDraft {
  return { game, fields: [emptyField()], mode: "next", date: "", count: 2, superzahl: null, note: "" };
}

export function isFieldComplete(game: GameId, f: DraftField): boolean {
  const g = GAMES[game];
  return f.main.length === g.mainCount && f.euro.length === g.extraCount;
}

/** `formatDate` formats an ISO date for the "not a draw day" message. */
export function validateDraft(draft: TicketDraft, formatDate: (iso: string) => string = (d) => d): DraftErrors {
  const errors: DraftErrors = { field: {} };
  if (draft.fields.length === 0) errors.fields = { key: "tickets.drawer.error.fields" };
  draft.fields.forEach((f, i) => {
    if (!isFieldComplete(draft.game, f))
      errors.field[i] = { key: "tickets.drawer.error.fieldIncomplete", params: { n: i + 1 } };
  });
  if (draft.mode !== "next") {
    if (!isValidIsoDate(draft.date) || draft.date < GAME_START[draft.game])
      errors.date = { key: "tickets.drawer.error.date" };
    else if (draft.mode === "date" && !isDrawDay(draft.game, draft.date))
      errors.date = { key: "tickets.drawer.error.dateNotDrawDay", params: { date: formatDate(draft.date) } };
  }
  if (draft.mode === "series" && (draft.count === null || draft.count < 1 || draft.count > MAX_SERIES))
    errors.count = { key: "tickets.drawer.error.count", params: { max: MAX_SERIES } };
  if (GAMES[draft.game].hasSuperzahl && draft.superzahl !== null && !(draft.superzahl >= 0 && draft.superzahl <= 9))
    errors.superzahl = { key: "tickets.drawer.error.sz" };
  return errors;
}

export function hasErrors(e: DraftErrors): boolean {
  return Boolean(e.fields || e.date || e.count || e.superzahl || Object.keys(e.field).length);
}

/** Draw dates of a valid draft. `nextDrawIso` is the next draw a new ticket can still join. */
export function draftDrawDates(draft: TicketDraft, nextDrawIso: string): string[] {
  if (draft.mode === "next") return [nextDrawIso];
  if (draft.mode === "date") return [draft.date];
  return drawSeries(draft.game, draft.date, draft.count ?? 1);
}

export function draftToTicket(
  draft: TicketDraft,
  base: Pick<Ticket, "id" | "createdAt" | "source">,
  nextDrawIso: string,
): Ticket {
  const g = GAMES[draft.game];
  const t: Ticket = {
    ...base,
    game: draft.game,
    fields: draft.fields.map((f) => {
      const main = [...f.main].sort((a, b) => a - b);
      return g.extraCount ? { main, euro: [...f.euro].sort((a, b) => a - b) } : { main };
    }),
    drawDates: draftDrawDates(draft, nextDrawIso),
  };
  if (g.hasSuperzahl) t.superzahl = draft.superzahl;
  const note = draft.note.trim();
  if (note) t.note = note.slice(0, 500);
  return t;
}

/** Form state for editing a stored ticket. Several dates become a series from the first one. */
export function ticketToDraft(t: Ticket): TicketDraft {
  const dates = [...t.drawDates].sort();
  return {
    game: t.game,
    fields: t.fields.map((f) => ({ main: [...f.main], euro: [...(f.euro ?? [])] })),
    mode: dates.length > 1 ? "series" : "date",
    date: dates[0] ?? "",
    count: dates.length > 1 ? dates.length : 2,
    superzahl: t.superzahl ?? null,
    note: t.note ?? "",
  };
}
