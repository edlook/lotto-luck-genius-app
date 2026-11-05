/**
 * Aggregates for the tickets screen and the navigation badge (pure functions, tested).
 */
import type { GameId } from "./games";
import type { Ticket } from "./storage/validate";
import type { Draw } from "./ticketCheck";
import { evaluateTicket, type TicketEvaluation } from "./ticketStatus";

export type TicketFilter = "all" | "waiting" | "checked" | "won";
export const TICKET_FILTERS: TicketFilter[] = ["all", "waiting", "checked", "won"];

/**
 * Filters overlap on purpose:
 * - waiting: at least one draw date is not checked yet (still ahead, or held but not loaded);
 * - checked: at least one draw date was checked, whether it won or not (QA B6: winners count too);
 * - won:     some field won in some checked draw.
 */
export function matchesFilter(ev: TicketEvaluation, filter: TicketFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "waiting":
      return ev.results.some((r) => r.state !== "checked");
    case "checked":
      return ev.results.some((r) => r.state === "checked");
    case "won":
      return ev.status === "won";
  }
}

export interface TicketsSummary {
  tickets: number;
  /** Tickets with at least one checked draw. */
  checked: number;
  /** Winning results: one per field and draw that hit a prize class. */
  wins: number;
  /** [class, times], best class first. */
  byClass: [number, number][];
}

export function summarize(evaluations: TicketEvaluation[]): TicketsSummary {
  const byClass = new Map<number, number>();
  let checked = 0;
  let wins = 0;
  for (const ev of evaluations) {
    if (ev.results.some((r) => r.state === "checked")) checked++;
    for (const r of ev.results)
      for (const f of r.fields)
        if (f.cls !== null) {
          wins++;
          byClass.set(f.cls, (byClass.get(f.cls) ?? 0) + 1);
        }
  }
  return { tickets: evaluations.length, checked, wins, byClass: [...byClass.entries()].sort((a, b) => a[0] - b[0]) };
}

/** Tickets of `game` whose draw already took place but is not loaded yet (navigation badge). */
export function countWaitingForData(tickets: Ticket[], game: GameId, byDate: Map<string, Draw>, today: string): number {
  let n = 0;
  for (const tk of tickets) if (tk.game === game && evaluateTicket(tk, byDate, today).notLoaded.length > 0) n++;
  return n;
}

/**
 * Result of a JSON import: new tickets go first (newest on top, as when saving), replaced
 * tickets keep their position, everything else is unchanged.
 */
export function mergeImportedTickets(existing: Ticket[], fresh: Ticket[], replace: Ticket[]): Ticket[] {
  const byId = new Map(replace.map((t) => [t.id, t]));
  const known = new Set(existing.map((t) => t.id));
  const added = fresh.filter((t) => !known.has(t.id));
  return [...added, ...existing.map((t) => byId.get(t.id) ?? t)];
}
