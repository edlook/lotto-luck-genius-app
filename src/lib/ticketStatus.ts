/**
 * Evaluates a saved ticket against the available draws.
 * Per draw date: "pending" (draw not yet held), "notLoaded" (held, no data
 * yet), or "checked" (with a FieldCheck per field).
 */
import { checkField, type Draw, type FieldCheck } from "./ticketCheck";
import type { Ticket } from "./storage/stores";

export type DrawState = "pending" | "notLoaded" | "checked";

export interface TicketDrawResult {
  date: string;
  state: DrawState;
  draw?: Draw;
  fields: FieldCheck[];
}

export interface TicketEvaluation {
  results: TicketDrawResult[];
  /** Overall: waiting (nothing checked yet), checked (some checked), won (any class). */
  status: "waiting" | "checked" | "won";
  /** Best (lowest number) class over all checked dates and fields. */
  bestClass: number | null;
  /** Dates that already took place but have no data. */
  notLoaded: string[];
  /** Next pending date. */
  nextPending: string | null;
}

/**
 * @param today ISO date in Europe/Berlin. A draw on `today` without data counts as pending
 *              (draws are in the evening).
 */
export function evaluateTicket(ticket: Ticket, byDate: Map<string, Draw>, today: string): TicketEvaluation {
  const results: TicketDrawResult[] = [...ticket.drawDates].sort().map((date) => {
    const draw = byDate.get(date);
    if (draw) {
      return { date, state: "checked" as const, draw, fields: ticket.fields.map((f) => checkField(f, draw, ticket.superzahl ?? null)) };
    }
    return { date, state: date >= today ? ("pending" as const) : ("notLoaded" as const), fields: [] };
  });
  let bestClass: number | null = null;
  for (const r of results) for (const f of r.fields) if (f.cls !== null && (bestClass === null || f.cls < bestClass)) bestClass = f.cls;
  const anyChecked = results.some((r) => r.state === "checked");
  return {
    results,
    status: bestClass !== null ? "won" : anyChecked ? "checked" : "waiting",
    bestClass,
    notLoaded: results.filter((r) => r.state === "notLoaded").map((r) => r.date),
    nextPending: results.find((r) => r.state === "pending")?.date ?? null,
  };
}
