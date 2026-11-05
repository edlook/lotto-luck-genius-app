import { describe, expect, it } from "vitest";
import type { Ticket } from "../storage/validate";
import { parseTicket } from "../storage/validate";
import type { Draw } from "../ticketCheck";
import { evaluateTicket } from "../ticketStatus";
import { countWaitingForData, matchesFilter, mergeImportedTickets, summarize } from "../ticketSummary";
import { draftToTicket, emptyDraft, hasErrors, ticketToDraft, validateDraft } from "../ticketDraft";
import { classifyDrawDate, eraDividerBetween, neighbours, ticketDates, ticketsForDate } from "../drawsView";
import { drawsInEra, evenCountObserved, lastDigitObserved, selectPeriod, sumObserved } from "../statsView";
import { addUserDraws, manualDrawError, manualToDraw, planDrawImport } from "../userDrawOps";

const d649 = (date: string, main: number[], superzahl: number | null = 2): Draw => ({
  game: "649",
  date,
  main,
  superzahl,
  source: "archive",
});

const ticket = (over: Partial<Ticket> = {}): Ticket => ({
  id: "t1",
  game: "649",
  fields: [{ main: [3, 13, 16, 28, 44, 49] }],
  superzahl: 2,
  drawDates: ["2026-11-04"],
  createdAt: "2026-11-01T10:00:00.000Z",
  source: "manual",
  ...over,
});

const byDate = (draws: Draw[]) => new Map(draws.map((d) => [d.date, d]));
const TODAY = "2026-11-05";

describe("ticket filters and summary", () => {
  const draws = byDate([d649("2026-11-04", [3, 13, 16, 28, 44, 49], 2), d649("2026-10-31", [1, 2, 3, 4, 5, 6], 0)]);
  const won = evaluateTicket(ticket(), draws, TODAY);
  const lost = evaluateTicket(ticket({ id: "t2", fields: [{ main: [7, 8, 9, 10, 11, 12] }], drawDates: ["2026-10-31"] }), draws, TODAY);
  const pending = evaluateTicket(ticket({ id: "t3", drawDates: ["2026-11-07"] }), draws, TODAY);
  const series = evaluateTicket(ticket({ id: "t4", drawDates: ["2026-10-31", "2026-11-07"] }), draws, TODAY);

  it("'checked' includes winning tickets (QA B6)", () => {
    expect(matchesFilter(won, "checked")).toBe(true);
    expect(matchesFilter(won, "won")).toBe(true);
    expect(matchesFilter(lost, "checked")).toBe(true);
    expect(matchesFilter(lost, "won")).toBe(false);
    expect(matchesFilter(pending, "waiting")).toBe(true);
    expect(matchesFilter(pending, "checked")).toBe(false);
  });

  it("a partly checked series is both waiting and checked", () => {
    expect(matchesFilter(series, "waiting")).toBe(true);
    expect(matchesFilter(series, "checked")).toBe(true);
  });

  it("summarises wins by class", () => {
    const s = summarize([won, lost, pending, series]);
    expect(s).toMatchObject({ tickets: 4, checked: 3 });
    expect(s.byClass[0]).toEqual([1, 1]); // 6 + SZ on 04.11
    expect(s.wins).toBe(s.byClass.reduce((a, [, n]) => a + n, 0));
  });

  it("counts tickets waiting for draw data (badge)", () => {
    const tickets = [ticket({ drawDates: ["2026-10-28"] }), ticket({ id: "x", drawDates: ["2026-11-07"] })];
    expect(countWaitingForData(tickets, "649", draws, TODAY)).toBe(1);
    expect(countWaitingForData(tickets, "ej", draws, TODAY)).toBe(0);
  });

  it("merges an import: new on top, replaced in place", () => {
    const a = ticket({ id: "a" });
    const b = ticket({ id: "b" });
    const b2 = ticket({ id: "b", note: "changed" });
    const c = ticket({ id: "c" });
    expect(mergeImportedTickets([a, b], [c], [b2]).map((t) => [t.id, t.note])).toEqual([
      ["c", undefined],
      ["a", undefined],
      ["b", "changed"],
    ]);
  });
});

describe("ticket form", () => {
  it("reports incomplete fields, a missing date and a bad series count", () => {
    const d = { ...emptyDraft("649"), mode: "series" as const, count: 0 };
    const e = validateDraft(d);
    expect(e.field[0]?.key).toBe("tickets.drawer.error.fieldIncomplete");
    expect(e.date?.key).toBe("tickets.drawer.error.date");
    expect(e.count?.params).toEqual({ max: 104 });
    expect(hasErrors(e)).toBe(true);
  });

  it("rejects a non-draw day for a single date", () => {
    const d = { ...emptyDraft("ej"), fields: [{ main: [1, 2, 3, 4, 5], euro: [1, 2] }], mode: "date" as const, date: "2026-11-05" };
    expect(validateDraft(d).date?.key).toBe("tickets.drawer.error.dateNotDrawDay");
    expect(hasErrors(validateDraft({ ...d, date: "2026-11-06" }))).toBe(false);
  });

  it("builds a valid stored ticket and round-trips a series", () => {
    const d = {
      ...emptyDraft("649"),
      fields: [{ main: [49, 1, 2, 3, 4, 5], euro: [] }],
      mode: "series" as const,
      date: "2026-11-05",
      count: 3,
      superzahl: 7,
      note: "  kiosk ",
    };
    const t = draftToTicket(d, { id: "z", createdAt: "2026-11-05T00:00:00Z", source: "manual" }, "2026-11-07");
    expect(t.drawDates).toEqual(["2026-11-07", "2026-11-11", "2026-11-14"]);
    expect(t.fields[0]).toEqual({ main: [1, 2, 3, 4, 5, 49] });
    expect(t).toMatchObject({ superzahl: 7, note: "kiosk" });
    expect(parseTicket(t)).toEqual(t);
    const back = ticketToDraft(t);
    expect(back).toMatchObject({ mode: "series", date: "2026-11-07", count: 3, superzahl: 7 });
  });

  it("'next draw' mode uses the given next draw date", () => {
    const d = { ...emptyDraft("ej"), fields: [{ main: [1, 2, 3, 4, 5], euro: [1, 2] }] };
    const t = draftToTicket(d, { id: "z", createdAt: "x", source: "generator" }, "2026-11-06");
    expect(t.drawDates).toEqual(["2026-11-06"]);
    expect(t.superzahl).toBeUndefined();
  });
});

describe("draw detail dates", () => {
  const data = byDate([d649("2026-11-04", [1, 2, 3, 4, 5, 6])]);
  it("classifies found, future, before start, non-draw days and missing draws", () => {
    expect(classifyDrawDate("649", "2026-11-04", TODAY, data).kind).toBe("found");
    expect(classifyDrawDate("649", "2026-11-07", TODAY, data).kind).toBe("future");
    expect(classifyDrawDate("ej", "2010-01-01", TODAY, data)).toEqual({ kind: "beforeStart", start: "2012-03-23" });
    expect(classifyDrawDate("649", "1990-01-03", TODAY, data).kind).toBe("noSuchDraw");
    expect(classifyDrawDate("649", "2026-10-31", TODAY, data).kind).toBe("missing");
    const nd = classifyDrawDate("649", "2026-11-05", TODAY, data);
    expect(nd).toEqual({ kind: "noDrawDay", nearest: ["2026-11-04"] }); // 07.11 is in the future
  });

  it("finds neighbours by stored data", () => {
    const list = [d649("2026-10-28", [1, 2, 3, 4, 5, 6]), d649("2026-10-31", [1, 2, 3, 4, 5, 6]), d649("2026-11-04", [1, 2, 3, 4, 5, 6])];
    expect(neighbours(list, "2026-10-31")).toEqual({ prev: "2026-10-28", next: "2026-11-04" });
    expect(neighbours(list, "2026-11-04")).toEqual({ prev: "2026-10-31", next: null });
    expect(neighbours(list, "2026-11-01")).toEqual({ prev: "2026-10-31", next: "2026-11-04" });
  });

  it("puts EuroJackpot era dividers between the right rows", () => {
    expect(eraDividerBetween("ej", "2022-03-25", "2022-03-18")).toBe("2022-03-25");
    expect(eraDividerBetween("ej", "2014-10-10", "2014-10-03")).toBe("2014-10-10");
    expect(eraDividerBetween("ej", "2022-04-01", "2022-03-25")).toBeNull();
    expect(eraDividerBetween("649", "2022-03-25", "2022-03-18")).toBeNull();
  });

  it("tickets for a date and per-date counts", () => {
    const ts = [ticket(), ticket({ id: "b", drawDates: ["2026-11-04", "2026-11-07"] }), ticket({ id: "c", game: "ej" })];
    expect(ticketsForDate(ts, "649", "2026-11-04").map((t) => t.id)).toEqual(["t1", "b"]);
    expect(ticketDates(ts, "649").get("2026-11-04")).toBe(2);
  });
});

describe("statistics views", () => {
  const draws = [d649("2026-01-03", [2, 4, 6, 8, 10, 11]), d649("2026-01-07", [1, 3, 5, 7, 9, 12])];
  it("periods take the tail", () => {
    const many = Array.from({ length: 150 }, (_, i) => d649(`2026-01-${String((i % 28) + 1).padStart(2, "0")}`, [1, 2, 3, 4, 5, 6]));
    expect(selectPeriod(many, "last100")).toHaveLength(100);
    expect(selectPeriod(many, "all")).toHaveLength(150);
  });
  it("even counts, sums and last digits", () => {
    expect(evenCountObserved(draws, 6)).toEqual([0, 0.5, 0, 0, 0, 0.5, 0]);
    expect(sumObserved(draws, [{ from: 0, to: 40 }, { from: 41, to: 100 }])).toEqual([0.5, 0.5]);
    const ld = lastDigitObserved(draws);
    expect(ld.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(ld[1]).toBeCloseTo(2 / 12, 12); // 11, 1
  });
  it("Euro numbers stay inside one era", () => {
    const ej: Draw[] = [
      { game: "ej", date: "2022-03-18", main: [1, 2, 3, 4, 5], euro: [1, 10], source: "archive" },
      { game: "ej", date: "2022-03-25", main: [1, 2, 3, 4, 5], euro: [1, 12], source: "archive" },
    ];
    expect(drawsInEra(ej, 2).map((d) => d.date)).toEqual(["2022-03-25"]);
    expect(drawsInEra(ej, 1).map((d) => d.date)).toEqual(["2022-03-18"]);
  });
});

describe("adding draws in the browser", () => {
  const known = byDate([d649("2026-11-04", [1, 2, 3, 4, 5, 6])]);
  it("rejects future dates, non-draw days, existing and incomplete draws (QA B1)", () => {
    const base = { game: "649" as const, main: [1, 2, 3, 4, 5, 6], euro: [], superzahl: 3 };
    expect(manualDrawError({ ...base, date: "" }, TODAY, known)?.key).toBe("settings.manual.error.date");
    expect(manualDrawError({ ...base, date: "2026-12-26" }, TODAY, known)?.key).toBe("settings.manual.error.future");
    expect(manualDrawError({ ...base, date: "2026-11-05" }, TODAY, known)?.key).toBe("settings.manual.error.drawDay");
    expect(manualDrawError({ ...base, date: "2026-11-04" }, TODAY, known)?.key).toBe("settings.manual.error.exists");
    expect(manualDrawError({ ...base, date: "2026-10-31", main: [1, 2] }, TODAY, known)?.key).toBe(
      "settings.manual.error.incomplete",
    );
    expect(manualDrawError({ ...base, date: "2026-10-31" }, TODAY, known)).toBeNull();
  });
  it("Euro numbers must fit the era of the date", () => {
    const ej = { game: "ej" as const, main: [1, 2, 3, 4, 5], euro: [1, 12], superzahl: null };
    expect(manualDrawError({ ...ej, date: "2022-03-18" }, TODAY, new Map())?.key).toBe("settings.manual.error.incomplete");
    expect(manualDrawError({ ...ej, date: "2026-11-03" }, TODAY, new Map())).toBeNull();
  });
  it("plans an import and stores draws without duplicates", () => {
    const parsed = [d649("2026-11-04", [1, 2, 3, 4, 5, 6]), d649("2026-10-31", [7, 8, 9, 10, 11, 12])];
    const plan = planDrawImport(parsed, known);
    expect(plan).toMatchObject({ duplicates: 1 });
    expect(plan.fresh.map((d) => d.date)).toEqual(["2026-10-31"]);
    const stored = addUserDraws([], plan.fresh);
    expect(addUserDraws(stored, [manualToDraw({ game: "649", date: "2026-10-31", main: [6, 5, 4, 3, 2, 1], euro: [], superzahl: 1 })])).toHaveLength(1);
  });
});
