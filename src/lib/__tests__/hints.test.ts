import { describe, expect, it } from "vitest";
import {
  HINTS,
  addYears,
  backtestHints,
  candidatesFor,
  daysBetween,
  deadlinesFor,
  dismiss,
  dismissForever,
  drawsHints,
  evaluateHints,
  expectedLastDraw,
  generatorHints,
  globalHints,
  isHidden,
  oddsHints,
  parseHintsState,
  parseHintsUsage,
  pickHint,
  statsHints,
  ticketsHints,
  type GeneratorHintInput,
  type HintCandidate,
  type HintId,
  type TicketEntry,
  type TicketsHintInput,
} from "../hints";
import { evaluatePopularity, comboKey } from "../popularity";
import type { EvaluateSuggestions } from "../hintChanges";
import { evaluateTicket } from "../ticketStatus";
import type { Draw } from "../ticketCheck";
import type { Ticket } from "../storage/validate";

const ids = (c: HintCandidate[]): HintId[] => c.map((x) => x.id);
const NOW = Date.parse("2026-11-06T12:00:00Z");
const TODAY = "2026-11-06";

/* ---------- Generator ---------- */

const gen = (o: Partial<GeneratorHintInput> = {}): GeneratorHintInput => ({
  game: "ej",
  mode: "rare",
  fieldCount: 1,
  hasResult: false,
  resultSaved: false,
  generatedBefore: false,
  ticketCount: 0,
  popularField: null,
  switchedToRandom: false,
  justSaved: null,
  szSaves: 0,
  ...o,
});

describe("generator tips", () => {
  it("firstRun: before the first result only", () => {
    expect(ids(generatorHints(gen()))).toContain("hint.gen.firstRun");
    expect(ids(generatorHints(gen({ generatedBefore: true })))).not.toContain("hint.gen.firstRun");
    expect(ids(generatorHints(gen({ hasResult: true })))).not.toContain("hint.gen.firstRun");
  });

  it("saveFirst: a set that is not saved while there are no tickets", () => {
    expect(ids(generatorHints(gen({ hasResult: true })))).toContain("hint.gen.saveFirst");
    expect(ids(generatorHints(gen({ hasResult: true, resultSaved: true })))).not.toContain("hint.gen.saveFirst");
    expect(ids(generatorHints(gen({ hasResult: true, ticketCount: 1 })))).not.toContain("hint.gen.saveFirst");
    expect(ids(generatorHints(gen()))).not.toContain("hint.gen.saveFirst");
  });

  it("popular: only in 'random' mode, names the field", () => {
    const popularField = { index: 1, key: "1-2-3-4-5" };
    const c = generatorHints(gen({ mode: "random", hasResult: true, popularField })).find((x) => x.id === "hint.gen.popular");
    expect(c?.params.n).toBe(2);
    expect(c?.actions[0]).toMatchObject({ id: "replaceField", n: 1, labelParams: { n: 2 } });
    expect(ids(generatorHints(gen({ mode: "rare", hasResult: true, popularField })))).not.toContain("hint.gen.popular");
    expect(ids(generatorHints(gen({ mode: "random", hasResult: true })))).not.toContain("hint.gen.popular");
  });

  it("popular: another set is another context", () => {
    const pop = (key: string) =>
      generatorHints(gen({ mode: "random", hasResult: true, popularField: { index: 0, key } })).find((x) => x.id === "hint.gen.popular")!;
    const a = pop("a");
    const b = pop("b");
    const state = dismiss({}, a, NOW);
    expect(isHidden(state, a, NOW + 1000)).toBe(true);
    expect(isHidden(state, b, NOW + 1000)).toBe(false);
  });

  it("randomMode: right after switching to 'random'", () => {
    expect(ids(generatorHints(gen({ mode: "random", switchedToRandom: true })))).toContain("hint.gen.randomMode");
    expect(ids(generatorHints(gen({ mode: "rare", switchedToRandom: true })))).not.toContain("hint.gen.randomMode");
    expect(ids(generatorHints(gen({ mode: "random" })))).not.toContain("hint.gen.randomMode");
  });

  it("manyFields: more than 6 fields, yearly cost = n x 2 x 52 x price", () => {
    const ej = generatorHints(gen({ fieldCount: 7 })).find((x) => x.id === "hint.gen.manyFields")!;
    expect(ej.params).toEqual({ n: 7, year: 7 * 2 * 52 * 2 });
    const l = generatorHints(gen({ game: "649", fieldCount: 8 })).find((x) => x.id === "hint.gen.manyFields")!;
    expect(l.params.year).toBeCloseTo(8 * 2 * 52 * 1.2, 6);
    expect(ids(generatorHints(gen({ fieldCount: 6 })))).not.toContain("hint.gen.manyFields");
  });

  it("manyFields: a new number of fields is a new context", () => {
    const a = generatorHints(gen({ fieldCount: 7 })).find((x) => x.id === "hint.gen.manyFields")!;
    const b = generatorHints(gen({ fieldCount: 9 })).find((x) => x.id === "hint.gen.manyFields")!;
    const state = dismiss({}, a, NOW);
    expect(isHidden(state, a, NOW + 6 * 86_400_000)).toBe(true);
    expect(isHidden(state, a, NOW + 8 * 86_400_000)).toBe(false); // 7 days
    expect(isHidden(state, b, NOW + 1000)).toBe(false);
  });

  it("szAfterSave: 6aus49, saved without Superzahl, first three saves", () => {
    const base = { game: "649" as const, justSaved: { ticketId: "t1", withoutSuperzahl: true }, szSaves: 1 };
    expect(ids(generatorHints(gen(base)))).toContain("hint.gen.szAfterSave");
    expect(ids(generatorHints(gen({ ...base, szSaves: 3 })))).toContain("hint.gen.szAfterSave");
    expect(ids(generatorHints(gen({ ...base, szSaves: 4 })))).not.toContain("hint.gen.szAfterSave");
    expect(ids(generatorHints(gen({ ...base, justSaved: { ticketId: "t1", withoutSuperzahl: false } })))).not.toContain(
      "hint.gen.szAfterSave",
    );
    expect(ids(generatorHints(gen({ ...base, game: "ej" })))).not.toContain("hint.gen.szAfterSave");
  });
});

/* ---------- Check yours ---------- */

const none: EvaluateSuggestions = { dates: null, progression: null, ticketPattern: null, pastWinning: null, medium: null };
const ch = [{ from: 7, to: 38 }];

describe("evaluation tips", () => {
  const dates = evaluatePopularity("ej", [3, 9, 14, 22, 30], { pastWinning: null });
  const progression = evaluatePopularity("ej", [5, 15, 25, 35, 45], { pastWinning: null });
  const pattern = evaluatePopularity("649", [1, 8, 15, 22, 29, 36], { pastWinning: null });
  const past = evaluatePopularity("ej", [4, 17, 33, 41, 48], { pastWinning: new Map([[comboKey([4, 17, 33, 41, 48]), "2019-05-03"]]) });
  const medium = evaluatePopularity("ej", [10, 11, 12, 33, 45], { pastWinning: null });
  const low = evaluatePopularity("ej", [4, 17, 33, 41, 48], { pastWinning: null });

  it("fixtures have the levels the tests assume", () => {
    expect([dates.level, progression.level, pattern.level, past.level, medium.level, low.level]).toEqual([
      "high",
      "high",
      "high",
      "high",
      "medium",
      "low",
    ]);
  });

  it("fix.dates: dates rule + a replacement; not without one or without the rule", () => {
    const c = evaluateHints({ report: dates, comboKey: "k", suggestions: { ...none, dates: [{ from: 3, to: 40 }, { from: 9, to: 44 }] } });
    expect(ids(c)).toEqual(["hint.eval.fix.dates"]);
    expect(c[0]!.params.changes).toBe("3 → 40, 9 → 44");
    expect(c[0]!.dismissKey).toBe("hint.eval.keep");
    expect(ids(evaluateHints({ report: dates, comboKey: "k", suggestions: none }))).toEqual([]);
    expect(ids(evaluateHints({ report: low, comboKey: "k", suggestions: { ...none, dates: ch } }))).not.toContain("hint.eval.fix.dates");
  });

  it("fix.progression: carries the step", () => {
    const c = evaluateHints({ report: progression, comboKey: "k", suggestions: { ...none, progression: ch } });
    expect(ids(c)).toEqual(["hint.eval.fix.progression"]);
    expect(c[0]!.params.step).toBe(10);
    expect(ids(evaluateHints({ report: progression, comboKey: "k", suggestions: none }))).toEqual([]);
    expect(ids(evaluateHints({ report: medium, comboKey: "k", suggestions: { ...none, progression: ch } }))).not.toContain(
      "hint.eval.fix.progression",
    );
  });

  it("fix.ticketPattern: carries the line", () => {
    const c = evaluateHints({ report: pattern, comboKey: "k", suggestions: { ...none, ticketPattern: ch } });
    expect(ids(c)).toEqual(["hint.eval.fix.ticketPattern"]);
    expect(c[0]!.params.line).toBe("column");
    expect(c[0]!.format.line).toBe("line");
    expect(ids(evaluateHints({ report: low, comboKey: "k", suggestions: { ...none, ticketPattern: ch } }))).toEqual(["hint.eval.low"]);
  });

  it("fix.pastWinning: carries the date", () => {
    const c = evaluateHints({ report: past, comboKey: "k", suggestions: { ...none, pastWinning: ch } });
    expect(ids(c)).toEqual(["hint.eval.fix.pastWinning"]);
    expect(c[0]!.params.date).toBe("2019-05-03");
    expect(ids(evaluateHints({ report: past, comboKey: "k", suggestions: none }))).toEqual([]);
  });

  it("mediumOnly: weak rules only", () => {
    expect(ids(evaluateHints({ report: medium, comboKey: "k", suggestions: { ...none, medium: ch } }))).toEqual(["hint.eval.mediumOnly"]);
    expect(ids(evaluateHints({ report: medium, comboKey: "k", suggestions: none }))).toEqual([]);
    expect(ids(evaluateHints({ report: dates, comboKey: "k", suggestions: { ...none, medium: ch } }))).not.toContain("hint.eval.mediumOnly");
  });

  it("low: no rule applied; saves as a ticket", () => {
    const c = evaluateHints({ report: low, comboKey: "k", suggestions: none });
    expect(ids(c)).toEqual(["hint.eval.low"]);
    expect(c[0]!.actions[0]).toMatchObject({ labelKey: "evaluate.report.save", id: "saveEvaluated" });
    expect(ids(evaluateHints({ report: medium, comboKey: "k", suggestions: none }))).not.toContain("hint.eval.low");
  });

  it("no report (before 'Evaluate'): nothing", () => {
    expect(evaluateHints({ report: null, comboKey: "", suggestions: none })).toEqual([]);
  });

  it("the first strong rule in table order wins when several apply", () => {
    // dates + progression: [5,10,15,20,25]
    const both = evaluatePopularity("ej", [5, 10, 15, 20, 25], { pastWinning: null });
    const c = evaluateHints({ report: both, comboKey: "k", suggestions: { ...none, dates: ch, progression: ch } });
    expect(ids(c)).toEqual(["hint.eval.fix.dates", "hint.eval.fix.progression"]);
    const pick = pickHint(c, { enabled: true, tourDone: true, tourOpen: false, now: NOW, state: {} });
    expect(pick?.id).toBe("hint.eval.fix.dates");
  });
});

/* ---------- Tickets ---------- */

const draw649 = (date: string, main: number[], sz: number): Draw => ({ game: "649", date, main, superzahl: sz, source: "archive" });
const drawEj = (date: string, main: number[], euro: number[]): Draw => ({ game: "ej", date, main, euro, euroPool: 12, source: "archive" });

function entry(ticket: Partial<Ticket> & Pick<Ticket, "id">, draws: Draw[], today = TODAY): TicketEntry {
  const full: Ticket = {
    game: "ej",
    fields: [{ main: [1, 2, 3, 4, 5], euro: [1, 2] }],
    drawDates: ["2026-11-03"],
    createdAt: "2026-11-01T00:00:00Z",
    source: "manual",
    ...ticket,
  };
  return { ticket: full, ev: evaluateTicket(full, new Map(draws.map((d) => [d.date, d])), today) };
}

const tk = (o: Partial<TicketsHintInput> = {}): TicketsHintInput => ({
  game: "ej",
  today: TODAY,
  now: NOW,
  totalTickets: 1,
  entries: [],
  archiveReady: true,
  lastExportAt: null,
  ...o,
});

describe("tickets tips", () => {
  it("empty: only without tickets in the storage", () => {
    expect(ids(ticketsHints(tk({ totalTickets: 0 })))).toContain("hint.tickets.empty");
    expect(ids(ticketsHints(tk({ totalTickets: 1 })))).not.toContain("hint.tickets.empty");
    // The archive state does not matter for this one.
    expect(ids(ticketsHints(tk({ totalTickets: 0, archiveReady: false })))).toContain("hint.tickets.empty");
  });

  it("waiting: a draw ahead within 7 days, with the earliest date", () => {
    const e = [entry({ id: "a", drawDates: ["2026-11-10"] }, []), entry({ id: "b", drawDates: ["2026-11-07"] }, [])];
    const c = ticketsHints(tk({ entries: e })).find((x) => x.id === "hint.tickets.waiting")!;
    expect(c.params).toEqual({ game: "ej", date: "2026-11-07" });
    const far = [entry({ id: "a", drawDates: ["2026-11-20"] }, [])];
    expect(ids(ticketsHints(tk({ entries: far })))).not.toContain("hint.tickets.waiting");
    // exactly 7 days is still "within"
    const edge = [entry({ id: "a", drawDates: ["2026-11-13"] }, [])];
    expect(ids(ticketsHints(tk({ entries: edge })))).toContain("hint.tickets.waiting");
    expect(ids(ticketsHints(tk({ entries: e, archiveReady: false })))).not.toContain("hint.tickets.waiting");
  });

  it("waiting: the next draw date is a new context", () => {
    const a = ticketsHints(tk({ entries: [entry({ id: "a", drawDates: ["2026-11-07"] }, [])] })).find((x) => x.id === "hint.tickets.waiting")!;
    const b = ticketsHints(tk({ entries: [entry({ id: "a", drawDates: ["2026-11-10"] }, [])] })).find((x) => x.id === "hint.tickets.waiting")!;
    const state = dismiss({}, a, NOW);
    expect(isHidden(state, a, NOW + 1000)).toBe(true);
    expect(isHidden(state, b, NOW + 1000)).toBe(false);
  });

  it("drawMissing: a past draw date without data; earliest date; not while the archive is not ready", () => {
    const e = [entry({ id: "a", drawDates: ["2026-11-03"] }, []), entry({ id: "b", drawDates: ["2026-10-30"] }, [])];
    const c = ticketsHints(tk({ entries: e })).find((x) => x.id === "hint.tickets.drawMissing")!;
    expect(c.params.date).toBe("2026-10-30");
    expect(c.priority).toBe(1);
    expect(c.actions.map((a) => a.to)).toEqual(["/settings#import", "/settings#manual-draw"]);
    expect(ids(ticketsHints(tk({ entries: e, archiveReady: false })))).not.toContain("hint.tickets.drawMissing");
    const present = [entry({ id: "a", drawDates: ["2026-11-03"] }, [drawEj("2026-11-03", [10, 20, 30, 40, 50], [3, 4])])];
    expect(ids(ticketsHints(tk({ entries: present })))).not.toContain("hint.tickets.drawMissing");
    // a draw today is still pending, not missing
    const today = [entry({ id: "a", drawDates: [TODAY] }, [])];
    expect(ids(ticketsHints(tk({ entries: today })))).not.toContain("hint.tickets.drawMissing");
  });

  const won = (id: string, extra: Partial<Ticket> = {}, date = "2026-11-03") =>
    entry({ id, drawDates: [date], ...extra }, [drawEj(date, [1, 2, 3, 4, 5], [1, 2])]);

  it("won: a checked winning ticket, once per ticket; not when marked as paid out", () => {
    const c = ticketsHints(tk({ entries: [won("a")] })).find((x) => x.id === "hint.tickets.won")!;
    expect(c.params.class).toBe(1);
    expect(c.key).toBe("hint.tickets.won:a");
    expect(c.actions[0]!.to).toBe("/guide#won");
    expect(ids(ticketsHints(tk({ entries: [won("a", { claimed: true })] })))).not.toContain("hint.tickets.won");
    const lost = entry({ id: "z", fields: [{ main: [6, 7, 8, 9, 10], euro: [3, 4] }] }, [drawEj("2026-11-03", [1, 2, 3, 4, 5], [1, 2])]);
    expect(ids(ticketsHints(tk({ entries: [lost] })))).not.toContain("hint.tickets.won");
    // dismissing one ticket does not hide another
    const two = ticketsHints(tk({ entries: [won("a"), won("b")] })).filter((x) => x.id === "hint.tickets.won");
    const state = dismiss({}, two[0]!, NOW);
    expect(isHidden(state, two[0]!, NOW + 10 ** 9)).toBe(true);
    expect(isHidden(state, two[1]!, NOW)).toBe(false);
  });

  it("sz: 6aus49 ticket without Superzahl and at least two matches", () => {
    const draws = [draw649("2026-11-04", [1, 2, 3, 20, 30, 40], 5)];
    const t = (o: Partial<Ticket>) =>
      entry({ id: "s", game: "649", fields: [{ main: [1, 2, 8, 9, 10, 11] }], drawDates: ["2026-11-04"], ...o }, draws);
    const c = ticketsHints(tk({ game: "649", entries: [t({})] })).find((x) => x.id === "hint.tickets.sz")!;
    expect(c.params).toEqual({ n: 2, class: 9 });
    expect(c.actions[0]).toMatchObject({ id: "specifySz", ticketId: "s" });
    expect(ids(ticketsHints(tk({ game: "649", entries: [t({ superzahl: 1 })] })))).not.toContain("hint.tickets.sz");
    expect(ids(ticketsHints(tk({ game: "649", entries: [t({ fields: [{ main: [1, 8, 9, 10, 11, 12] }] })] })))).not.toContain(
      "hint.tickets.sz",
    );
    // three matches: class 7 with a matching Superzahl
    const three = t({ fields: [{ main: [1, 2, 3, 9, 10, 11] }] });
    expect(ticketsHints(tk({ game: "649", entries: [three] })).find((x) => x.id === "hint.tickets.sz")!.params.class).toBe(7);
    // EuroJackpot has no Superzahl
    expect(ids(ticketsHints(tk({ game: "ej", entries: [t({})] })))).not.toContain("hint.tickets.sz");
  });

  describe("limitation period", () => {
    // winning draw on 2023-11-10: strict 2026-11-10, lenient 2026-12-31
    const wonOn = (date: string, extra: Partial<Ticket> = {}) => won("w", extra, date);
    const at = (today: string, extra: Partial<Ticket> = {}) =>
      ids(ticketsHints(tk({ today, entries: [wonOn("2023-11-10", extra)] }))).filter((i) => /deadline|expired/.test(i));

    it("both edges are computed from the draw date", () => {
      expect(deadlinesFor("2023-11-10")).toEqual({ strict: "2026-11-10", lenient: "2026-12-31" });
      expect(deadlinesFor("2024-02-29")).toEqual({ strict: "2027-02-28", lenient: "2027-12-31" });
    });

    it("soon: from 90 days before the strict date to that date", () => {
      expect(at("2026-11-10")).toEqual(["hint.tickets.deadlineSoon"]);
      expect(at("2026-08-12")).toEqual(["hint.tickets.deadlineSoon"]); // exactly 90 days before
      expect(at("2026-08-11")).toEqual([]); // 91 days
    });

    it("grey: after the strict date up to the end of that year", () => {
      expect(at("2026-11-11")).toEqual(["hint.tickets.deadlineGrey"]);
      expect(at("2026-12-31")).toEqual(["hint.tickets.deadlineGrey"]);
    });

    it("expired: after the lenient date", () => {
      expect(at("2027-01-01")).toEqual(["hint.tickets.expired"]);
      const c = ticketsHints(tk({ today: "2027-01-01", entries: [wonOn("2023-11-10")] })).find((x) => x.id === "hint.tickets.expired")!;
      expect(c.params.deadline).toBe("2026-12-31");
    });

    it("grey shows the strict date", () => {
      const c = ticketsHints(tk({ today: "2026-11-20", entries: [wonOn("2023-11-10")] })).find((x) => x.id === "hint.tickets.deadlineGrey")!;
      expect(c.params).toEqual({ date: "2023-11-10", deadline: "2026-11-10" });
    });

    it("none for a ticket marked as paid out, or without a win", () => {
      for (const today of ["2026-11-01", "2026-11-20", "2027-02-01"]) expect(at(today, { claimed: true })).toEqual([]);
      const lost = entry({ id: "l", fields: [{ main: [6, 7, 8, 9, 10], euro: [3, 4] }], drawDates: ["2023-11-10"] }, [
        drawEj("2023-11-10", [1, 2, 3, 4, 5], [1, 2]),
      ]);
      expect(ids(ticketsHints(tk({ today: "2026-11-10", entries: [lost] })))).not.toContain("hint.tickets.deadlineSoon");
    });

    it("offers 'already paid out' and the guide", () => {
      const c = ticketsHints(tk({ today: "2026-11-10", entries: [wonOn("2023-11-10")] })).find((x) => x.id === "hint.tickets.deadlineSoon")!;
      expect(c.actions).toEqual([
        { labelKey: "hint.tickets.deadline.action", to: "/guide#won-deadline" },
        { labelKey: "hint.tickets.claimed.action", id: "claimed", ticketId: "w" },
      ]);
    });

    it("dismissal lasts 7 / 3 days and one ticket at a time", () => {
      const soon = ticketsHints(tk({ today: "2026-11-10", entries: [wonOn("2023-11-10")] })).find((x) => x.id === "hint.tickets.deadlineSoon")!;
      const s = dismiss({}, soon, NOW);
      expect(isHidden(s, soon, NOW + 6 * 86_400_000)).toBe(true);
      expect(isHidden(s, soon, NOW + 7 * 86_400_000 + 1)).toBe(false);
      const grey = ticketsHints(tk({ today: "2026-11-20", entries: [wonOn("2023-11-10")] })).find((x) => x.id === "hint.tickets.deadlineGrey")!;
      expect(grey.hide).toBe(3);
      expect(HINTS["hint.tickets.expired"].hide).toBe("forever");
    });
  });

  it("old: checked tickets without a win, last draw more than three years ago", () => {
    const lostOld = (date: string) =>
      entry({ id: "o", fields: [{ main: [6, 7, 8, 9, 10], euro: [3, 4] }], drawDates: [date] }, [drawEj(date, [1, 2, 3, 4, 5], [1, 2])]);
    expect(ids(ticketsHints(tk({ entries: [lostOld("2023-11-03")] })))).toContain("hint.tickets.old");
    expect(ids(ticketsHints(tk({ entries: [lostOld("2023-11-06")] })))).not.toContain("hint.tickets.old"); // exactly 3 years: not older
    expect(ids(ticketsHints(tk({ entries: [lostOld("2025-11-03")] })))).not.toContain("hint.tickets.old");
    const wonOld = entry({ id: "w", drawDates: ["2022-11-04"] }, [drawEj("2022-11-04", [1, 2, 3, 4, 5], [1, 2])]);
    expect(ids(ticketsHints(tk({ entries: [wonOld] })))).not.toContain("hint.tickets.old");
  });

  it("export: three tickets and no export in the last 30 days", () => {
    expect(ids(ticketsHints(tk({ totalTickets: 3 })))).toContain("hint.tickets.export");
    expect(ids(ticketsHints(tk({ totalTickets: 2 })))).not.toContain("hint.tickets.export");
    expect(ids(ticketsHints(tk({ totalTickets: 3, lastExportAt: "2026-10-20T00:00:00Z" })))).not.toContain("hint.tickets.export");
    expect(ids(ticketsHints(tk({ totalTickets: 3, lastExportAt: "2026-10-01T00:00:00Z" })))).toContain("hint.tickets.export");
    expect(ids(ticketsHints(tk({ totalTickets: 3, lastExportAt: "garbage" })))).toContain("hint.tickets.export");
    // not tied to the archive
    expect(ids(ticketsHints(tk({ totalTickets: 3, archiveReady: false })))).toContain("hint.tickets.export");
  });
});

/* ---------- Draws ---------- */

describe("draws tips", () => {
  const base = { game: "ej" as const, today: "2026-11-10", lastArchiveDate: "2026-11-03", archiveReady: true, firstVisit: false, totalTickets: 0 };

  it("stale: a scheduled draw older than two days is missing from the archive", () => {
    // Friday 2026-11-06 was a draw day; on Tuesday the 10th it is 4 days old and missing
    const c = drawsHints(base).find((x) => x.id === "hint.draws.stale")!;
    expect(c.params).toEqual({ game: "ej", last: "2026-11-03", expected: "2026-11-06" });
    expect(drawsHints({ ...base, lastArchiveDate: "2026-11-06" })).toEqual([]);
  });

  it("stale: the last two days are not expected yet (evening draw, nightly update)", () => {
    // Saturday the 7th: the Friday draw is one day old -> the expected one is Tuesday 3rd, which is there
    expect(drawsHints({ ...base, today: "2026-11-07" })).toEqual([]);
    // Sunday the 8th: Friday is two days old -> expected
    expect(ids(drawsHints({ ...base, today: "2026-11-08" }))).toContain("hint.draws.stale");
  });

  it("stale: no false alarm around Christmas and New Year", () => {
    // 2026-12-25 is a Friday (EuroJackpot draw day). On the 27th it is only two days old: still waiting.
    const xmas = { ...base, lastArchiveDate: "2026-12-22", today: "2026-12-27" };
    expect(drawsHints(xmas)).toEqual([]);
    expect(ids(drawsHints({ ...xmas, today: "2026-12-29" }))).toContain("hint.draws.stale");
    // an ordinary Friday is reported after two days
    expect(ids(drawsHints({ ...base, lastArchiveDate: "2026-11-03", today: "2026-11-08" }))).toContain("hint.draws.stale");
  });

  it("stale: not while loading or offline, not without data", () => {
    expect(drawsHints({ ...base, archiveReady: false })).toEqual([]);
    expect(drawsHints({ ...base, lastArchiveDate: null })).toEqual([]);
  });

  it("stale: 6aus49 follows Wednesday/Saturday", () => {
    expect(expectedLastDraw("649", "2026-11-10")).toBe("2026-11-07"); // Saturday
    expect(expectedLastDraw("ej", "2026-11-10")).toBe("2026-11-06"); // Friday
    expect(expectedLastDraw("649", "2026-11-09")).toBe("2026-11-07");
  });

  it("open: first visit with at least one ticket", () => {
    expect(ids(drawsHints({ ...base, lastArchiveDate: "2026-11-06", firstVisit: true, totalTickets: 1 }))).toEqual(["hint.draws.open"]);
    expect(drawsHints({ ...base, lastArchiveDate: "2026-11-06", firstVisit: false, totalTickets: 1 })).toEqual([]);
    expect(drawsHints({ ...base, lastArchiveDate: "2026-11-06", firstVisit: true, totalTickets: 0 })).toEqual([]);
  });
});

/* ---------- Odds ---------- */

describe("odds tips", () => {
  const year = { spent: 832, back: 414.84, loss: 417.16, signature: "4:2:52" };

  it("year: when the payout share is known; a new calculation is a new context", () => {
    const c = oddsHints({ game: "ej", year, jackpot: null }).find((x) => x.id === "hint.odds.year")!;
    expect(c.params).toEqual({ spent: 832, back: 414.84, loss: 417.16 });
    expect(oddsHints({ game: "ej", year: null, jackpot: null })).toEqual([]);
    const other = oddsHints({ game: "ej", year: { ...year, signature: "5:2:52" }, jackpot: null })[0]!;
    expect(isHidden(dismiss({}, c, NOW), other, NOW + 1000)).toBe(false);
  });

  const jp = (amount: number, ev: number) => ({ amount, ev, price: 2, drawDate: "2026-11-03" });

  it("jackpot: 'below' when the calculated return is under the price", () => {
    expect(ids(oddsHints({ game: "ej", year: null, jackpot: jp(120_000_000, 1.48) }))).toEqual(["hint.odds.jackpot.below"]);
  });

  it("jackpot: 'notBelow' when it is not", () => {
    expect(ids(oddsHints({ game: "ej", year: null, jackpot: jp(120_000_000, 2) }))).toEqual(["hint.odds.jackpot.notBelow"]);
    expect(ids(oddsHints({ game: "ej", year: null, jackpot: jp(120_000_000, 2.6) }))).toEqual(["hint.odds.jackpot.notBelow"]);
  });

  it("jackpot: from 60 million only, EuroJackpot only", () => {
    expect(ids(oddsHints({ game: "ej", year: null, jackpot: jp(60_000_000, 1.07) }))).toEqual(["hint.odds.jackpot.below"]);
    expect(oddsHints({ game: "ej", year: null, jackpot: jp(59_999_999, 1.07) })).toEqual([]);
    expect(oddsHints({ game: "649", year: null, jackpot: jp(100_000_000, 1) })).toEqual([]);
    expect(oddsHints({ game: "ej", year: null, jackpot: null })).toEqual([]);
  });
});

/* ---------- Stats and backtest ---------- */

describe("stats and backtest tips", () => {
  it("frequency: only after sorting by frequency", () => {
    expect(ids(statsHints({ game: "ej", period: "all", sortedByFrequency: true, pValue: null }))).toEqual(["hint.stats.frequency"]);
    expect(statsHints({ game: "ej", period: "all", sortedByFrequency: false, pValue: null })).toEqual([]);
  });

  it("pLow: p below 0.05", () => {
    const c = statsHints({ game: "ej", period: "all", sortedByFrequency: false, pValue: 0.0312 });
    expect(ids(c)).toEqual(["hint.stats.pLow"]);
    expect(c[0]!.params.p).toBe(0.0312);
    expect(statsHints({ game: "ej", period: "all", sortedByFrequency: false, pValue: 0.05 })).toEqual([]);
    expect(statsHints({ game: "ej", period: "all", sortedByFrequency: false, pValue: 0.4 })).toEqual([]);
    expect(statsHints({ game: "ej", period: "all", sortedByFrequency: false, pValue: null })).toEqual([]);
  });

  it("frequency outranks pLow", () => {
    const c = statsHints({ game: "ej", period: "all", sortedByFrequency: true, pValue: 0.01 });
    expect(pickHint(c, { enabled: true, tourDone: true, tourOpen: false, now: NOW, state: {} })?.id).toBe("hint.stats.frequency");
  });

  it("backtest.none: strategies finished, none outside the band", () => {
    expect(ids(backtestHints({ game: "ej", strategiesNone: true, popularity: null }))).toEqual(["hint.backtest.none"]);
    expect(backtestHints({ game: "ej", strategiesNone: false, popularity: null })).toEqual([]);
  });

  const pop = (verdict: "confirmed" | "weak" | "notDetected" | "opposite") => ({
    verdict,
    popular: 1.088,
    unpopular: 0.901,
    payPop: 14.82,
    payUnpop: 17.45,
    to: "2026-11-03",
  });

  it("backtest.popularity: verdict confirmed or weak, EuroJackpot", () => {
    const c = backtestHints({ game: "ej", strategiesNone: false, popularity: pop("confirmed") });
    expect(ids(c)).toEqual(["hint.backtest.popularity"]);
    expect(c[0]!.params).toEqual({ popular: 1.088, unpopular: 0.901, payPop: 14.82, payUnpop: 17.45 });
    expect(ids(backtestHints({ game: "ej", strategiesNone: false, popularity: pop("weak") }))).toEqual(["hint.backtest.popularity"]);
    expect(backtestHints({ game: "ej", strategiesNone: false, popularity: pop("notDetected") })).toEqual([]);
    expect(backtestHints({ game: "ej", strategiesNone: false, popularity: pop("opposite") })).toEqual([]);
    expect(backtestHints({ game: "649", strategiesNone: false, popularity: pop("confirmed") })).toEqual([]);
  });
});

/* ---------- global, state, selection ---------- */

describe("tips about tips", () => {
  it("tooMany: after three dismissals in a session", () => {
    expect(ids(globalHints({ dismissedThisSession: 3 }))).toEqual(["hint.global.tooMany"]);
    expect(globalHints({ dismissedThisSession: 2 })).toEqual([]);
  });
});

describe("dismissal state and selection", () => {
  const c = (o: Partial<HintCandidate> = {}): HintCandidate => ({
    id: "hint.gen.saveFirst",
    priority: 3,
    order: 1,
    key: "hint.gen.saveFirst",
    ctx: "",
    hide: 7,
    params: {},
    format: {},
    actions: [],
    tone: "tip",
    ...o,
  });
  const ctx = { enabled: true, tourDone: true, tourOpen: false, now: NOW, state: {} };

  it("hides for the given number of days", () => {
    const s = dismiss({}, c({ hide: 30 }), NOW);
    expect(isHidden(s, c(), NOW + 29 * 86_400_000)).toBe(true);
    expect(isHidden(s, c(), NOW + 30 * 86_400_000 + 1)).toBe(false);
  });

  it("forever hides for good, also in another context", () => {
    const s = dismiss({}, c({ hide: "forever" }), NOW);
    expect(isHidden(s, c({ ctx: "other" }), NOW + 10 ** 12)).toBe(true);
    expect(isHidden(dismissForever({}, c(), NOW), c({ ctx: "x" }), NOW + 10 ** 12)).toBe(true);
  });

  it("a changed context shows the tip again", () => {
    const s = dismiss({}, c({ ctx: "a" }), NOW);
    expect(isHidden(s, c({ ctx: "a" }), NOW)).toBe(true);
    expect(isHidden(s, c({ ctx: "b" }), NOW)).toBe(false);
  });

  it("dismissing drops expired records", () => {
    const old = { "x": { until: "2020-01-01T00:00:00.000Z", ctx: "" }, "y": { forever: true as const } };
    expect(Object.keys(dismiss(old, c(), NOW)).sort()).toEqual(["hint.gen.saveFirst", "y"]);
  });

  it("picks the lowest priority number, then the table order", () => {
    const list = [c({ id: "hint.gen.firstRun", key: "a", order: 0, priority: 3 }), c({ key: "b", order: 5, priority: 1 }), c({ key: "c", order: 2, priority: 1 })];
    expect(pickHint(list, ctx)?.key).toBe("c");
  });

  it("skips dismissed tips and falls through to the next", () => {
    const list = [c({ key: "a", priority: 1 }), c({ key: "b", priority: 2 })];
    const state = dismiss({}, list[0]!, NOW);
    expect(pickHint(list, { ...ctx, state })?.key).toBe("b");
  });

  it("shows nothing while the tour is open or unfinished, or with tips off", () => {
    const list = [c()];
    expect(pickHint(list, { ...ctx, tourOpen: true })).toBeNull();
    expect(pickHint(list, { ...ctx, tourDone: false })).toBeNull();
    expect(pickHint(list, { ...ctx, enabled: false })).toBeNull();
    expect(pickHint(list, ctx)).not.toBeNull();
  });

  it("every tip of the table has a screen, a priority and a rule to hide", () => {
    expect(Object.keys(HINTS)).toHaveLength(32);
    for (const m of Object.values(HINTS)) {
      expect([1, 2, 3]).toContain(m.priority);
      expect(m.hide === "forever" || m.hide > 0).toBe(true);
    }
  });

  it("candidatesFor routes to the screen builder", () => {
    expect(ids(candidatesFor("generator", gen()))).toEqual(["hint.gen.firstRun"]);
  });

  it("parses stored state defensively", () => {
    expect(parseHintsState(null)).toEqual({});
    expect(parseHintsState([])).toEqual({});
    expect(parseHintsState({ a: { forever: true }, b: { until: "nonsense" }, c: 5, d: { until: "2030-01-01T00:00:00Z", ctx: "k" } })).toEqual({
      a: { forever: true },
      d: { until: "2030-01-01T00:00:00Z", ctx: "k" },
    });
    expect(parseHintsUsage({ generated: true, szSaves: 2, drawsVisited: 1 })).toEqual({ generated: true, szSaves: 2, drawsVisited: false });
    expect(parseHintsUsage("x")).toEqual({ generated: false, szSaves: 0, drawsVisited: false });
  });
});

describe("date helpers", () => {
  it("adds years without leaving the month", () => {
    expect(addYears("2023-11-10", 3)).toBe("2026-11-10");
    expect(addYears("2024-02-29", 3)).toBe("2027-02-28");
    expect(addYears("2026-11-06", -3)).toBe("2023-11-06");
  });
  it("counts days", () => {
    expect(daysBetween("2026-11-06", "2026-11-13")).toBe(7);
    expect(daysBetween("2026-11-13", "2026-11-06")).toBe(-7);
  });
});
