import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { parseDrawCsv } from "../csvImport";
import { drawDateError } from "../drawCalendar";
import { EJ_CLASS_LABELS, ejClassOn } from "../eras";
import { createLocalStore, parseRecovery } from "../storage/localStore";
import { analyzeTicketImport, parseTicket, type Ticket } from "../storage/stores";
import { validateDraft, emptyDraft } from "../ticketDraft";
import { checkField, type Draw } from "../ticketCheck";
import { evaluateTicket } from "../ticketStatus";
import { matchesFilter, mergeImportedTickets, summarize } from "../ticketSummary";

const draw649 = (date: string, main: number[], superzahl: number | null): Draw => ({
  game: "649",
  date,
  main,
  superzahl,
  source: "archive",
});

describe("B2: 6aus49 ticket without a Superzahl", () => {
  const d = draw649("2026-11-04", [3, 13, 16, 28, 44, 49], 2);

  it("two matches are a possible class 9, not a win and not 'no win'", () => {
    const c = checkField({ main: [3, 13, 20, 21, 22, 23] }, d, null);
    expect(c).toMatchObject({ cls: null, szUnknown: true, possibleCls: 9, possibleAmount: 6, classUnavailable: false });
  });

  it("counts as a possibility in the filter and summary, never as a win", () => {
    const ticket = parseTicket({
      id: "t1",
      game: "649",
      fields: [{ main: [3, 13, 20, 21, 22, 23] }],
      superzahl: null,
      drawDates: ["2026-11-04"],
      createdAt: "2026-11-01T10:00:00.000Z",
      source: "manual",
    })!;
    const ev = evaluateTicket(ticket, new Map([[d.date, d]]), "2026-11-05");
    expect(ev.possibleCount).toBe(1);
    expect(ev.status).toBe("checked");
    expect(matchesFilter(ev, "possible")).toBe(true);
    expect(matchesFilter(ev, "won")).toBe(false);
    expect(summarize([ev])).toMatchObject({ wins: 0, possible: 1, byClass: [] });
  });

  it("with a Superzahl the result is definite", () => {
    expect(checkField({ main: [3, 13, 20, 21, 22, 23] }, d, 2)).toMatchObject({ cls: 9, possibleCls: null });
    expect(checkField({ main: [3, 13, 20, 21, 22, 23] }, d, 5)).toMatchObject({ cls: null, possibleCls: null });
  });

  it("three matches without Superzahl keep their class 8 and no extra possibility", () => {
    const c = checkField({ main: [3, 13, 16, 21, 22, 23] }, d, null);
    expect(c).toMatchObject({ cls: 8, szUnknown: true, possibleCls: null });
  });

  it("zero or one match cannot become a win", () => {
    expect(checkField({ main: [3, 20, 21, 22, 23, 24] }, d, null).possibleCls).toBeNull();
  });
});

describe("B7: 6aus49 before the current class system", () => {
  it("gives no class for draws before 2013-05-04", () => {
    const c = checkField({ main: [1, 2, 10, 11, 12, 13] }, draw649("2010-01-02", [1, 2, 20, 21, 22, 23], 4), 4);
    expect(c).toMatchObject({ cls: null, classUnavailable: true, possibleCls: null, amount: null });
    expect(c.mainHits).toEqual([1, 2]);
  });

  it("claims the fixed 6 € only for draws on or after 2020-09-23", () => {
    const f = { main: [1, 2, 10, 11, 12, 13] };
    expect(checkField(f, draw649("2020-09-26", [1, 2, 20, 21, 22, 23], 4), 4)).toMatchObject({ cls: 9, amount: 6 });
    expect(checkField(f, draw649("2015-01-03", [1, 2, 20, 21, 22, 23], 4), 4)).toMatchObject({ cls: 9, amount: null });
  });
});

describe("B6: EuroJackpot class by era without published quotas", () => {
  const ej = (date: string): Draw => ({ game: "ej", date, main: [1, 2, 3, 4, 5], euro: [1, 2], source: "user" });

  it("4+0 was class 6 in 2015 and is class 7 today; 3+1 was class 8 in 2013", () => {
    expect(ejClassOn("2015-01-02", 4, 0)).toBe(6);
    expect(ejClassOn("2026-11-03", 4, 0)).toBe(7);
    expect(ejClassOn("2013-01-04", 3, 1)).toBe(8);
    expect(ejClassOn("2026-11-03", 0, 0)).toBeNull();
  });

  it("checkField uses the era of the draw", () => {
    const hit = { main: [1, 2, 3, 4, 9], euro: [8, 9] };
    expect(checkField(hit, ej("2015-01-02")).cls).toBe(6);
    expect(checkField(hit, ej("2026-11-03")).cls).toBe(7);
  });

  it("the era tables match the published quota order of every archived draw", () => {
    const file = JSON.parse(readFileSync(new URL("../../../public/data/eurojackpot.json", import.meta.url), "utf8")) as {
      draws: [string, number[], number[], number, [string, number, number][]][];
    };
    for (const [, , , era, quotes] of file.draws) expect(quotes.map((q) => q[0])).toEqual(EJ_CLASS_LABELS[era]);
  });
});

describe("B8: duplicate ids inside one import file", () => {
  const raw = {
    id: "abc",
    game: "649",
    fields: [{ main: [3, 14, 22, 31, 40, 45] }],
    superzahl: 7,
    drawDates: ["2026-11-04"],
    createdAt: "2026-11-01T10:00:00.000Z",
    source: "manual",
  };

  it("imports the first and skips the repeat", () => {
    const a = analyzeTicketImport(JSON.stringify({ tickets: [raw, { ...raw, superzahl: 1 }] }), []);
    expect(a.fresh).toHaveLength(1);
    expect(a.skipped).toBe(1);
  });

  it("merge never adds one id twice", () => {
    const t = parseTicket(raw) as Ticket;
    expect(mergeImportedTickets([], [t, t], [])).toHaveLength(1);
  });
});

describe("B10/B11: dates before the game, header detection", () => {
  it("rejects dates before the first draw of the game", () => {
    expect(drawDateError("ej", "2010-01-01", "2026-11-05")).toBe("drawDay");
    expect(drawDateError("649", "1955-10-01", "2026-11-05")).toBe("drawDay");
    expect(drawDateError("ej", "2012-03-23", "2026-11-05")).toBeNull();
    const draft = { ...emptyDraft("ej"), mode: "date" as const, date: "2010-01-01" };
    expect(validateDraft(draft).date).toBeDefined();
  });

  it("an unreadable first date is an error, a text header is skipped", () => {
    const row = "5;8;21;37;46;6;8";
    const bad = parseDrawCsv("ej", `31.02.2024;${row}\n03.11.2026;1;2;3;4;5;1;2`, "2026-11-05");
    expect(bad.errors[0]).toMatchObject({ row: 1, code: "date" });
    const withHeader = parseDrawCsv("ej", `Datum;Z1;Z2;Z3;Z4;Z5;E1;E2\n03.11.2026;1;2;3;4;5;1;2`, "2026-11-05");
    expect(withHeader.errors).toEqual([]);
    expect(withHeader.draws).toHaveLength(1);
  });
});

/** Minimal in-memory localStorage; `quota` makes writes of the given key fail like a full disk. */
class FakeStorage {
  data = new Map<string, string>();
  failKeys = new Set<string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.failKeys.has(k)) throw new DOMException("quota", "QuotaExceededError");
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

describe("B3/B9: stored data that cannot be read in full", () => {
  let ls: FakeStorage;
  const parseList = (raw: unknown): number[] => (Array.isArray(raw) ? raw.filter((x): x is number => typeof x === "number") : []);
  const make = () =>
    createLocalStore<number[]>("k", parseList, [], {
      isLossy: (parsed, value) => !Array.isArray(parsed) || parsed.length !== (value as number[]).length,
    });

  beforeEach(() => {
    ls = new FakeStorage();
    (globalThis as { localStorage?: unknown }).localStorage = ls;
  });

  it("broken JSON is announced and copied before the first write", () => {
    ls.data.set("k", "[1,2,");
    const store = make();
    expect(store.get()).toEqual([]);
    expect(parseRecovery(store.recovery.snapshot())[0]?.raw).toBe("[1,2,");
    expect(ls.data.has("k.recovery")).toBe(false); // nothing written while only reading
    expect(store.set([9])).toBe("ok");
    expect(parseRecovery(ls.data.get("k.recovery") ?? null)[0]?.raw).toBe("[1,2,");
    expect(ls.data.get("k")).toBe("[9]");
    expect(parseRecovery(store.recovery.snapshot())).toHaveLength(1); // still offered for download
  });

  it("entries dropped by validation are preserved", () => {
    ls.data.set("k", JSON.stringify([1, "bad", 3]));
    const store = make();
    expect(store.get()).toEqual([1, 3]);
    store.set((p) => [...p, 4]);
    expect(parseRecovery(ls.data.get("k.recovery") ?? null)[0]?.raw).toBe(JSON.stringify([1, "bad", 3]));
    store.recovery.clear();
    expect(store.recovery.snapshot()).toBeNull();
  });

  it("clean data creates no backup", () => {
    ls.data.set("k", "[1,2]");
    const store = make();
    store.set([1, 2, 3]);
    expect(ls.data.has("k.recovery")).toBe(false);
    expect(store.recovery.snapshot()).toBeNull();
  });

  it("does not overwrite unreadable data when the backup cannot be written", () => {
    ls.data.set("k", "{oops");
    ls.failKeys.add("k.recovery");
    const store = make();
    expect(store.set([1])).toBe("full");
    expect(ls.data.get("k")).toBe("{oops");
  });

  it("a refused write ('full') is reported and not applied", () => {
    const store = make();
    store.set([1]);
    ls.failKeys.add("k");
    expect(store.set((p) => [...p, 2])).toBe("full");
    expect(store.get()).toEqual([1]);
  });
});
