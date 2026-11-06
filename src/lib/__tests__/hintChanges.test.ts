import { describe, expect, it } from "vitest";
import { applyChanges, formatChanges, suggestChanges } from "../hintChanges";
import { comboKey, evaluatePopularity } from "../popularity";
import { ejFieldEvAtJackpot, EJ_JACKPOT_CAP } from "../ev";
import { parseTicket } from "../storage/validate";
import { draftToTicket, ticketToDraft } from "../ticketDraft";
import type { Draw } from "../ticketCheck";

const first = () => 0;
const level = (game: "ej" | "649", main: number[], pastWinning = null as Map<string, string> | null) =>
  evaluatePopularity(game, main, { pastWinning }).level;

describe("replacement suggestions", () => {
  it("formats changes as 'old → new'", () => {
    expect(formatChanges([{ from: 7, to: 38 }, { from: 19, to: 44 }])).toBe("7 → 38, 19 → 44");
  });

  it("dates: needs two replacements above 31 and ends at 'low'", () => {
    const main = [3, 9, 14, 22, 30];
    for (const rnd of [first, () => 5, (n: number) => n - 1]) {
      const c = suggestChanges("ej", main, "dates", null, rnd)!;
      expect(c).toHaveLength(2);
      for (const x of c) {
        expect(main).toContain(x.from);
        expect(x.to).toBeGreaterThan(31);
        expect(main).not.toContain(x.to);
      }
      expect(level("ej", applyChanges(main, c))).toBe("low");
    }
  });

  it("dates (6aus49): replacements stay within 32…49", () => {
    const c = suggestChanges("649", [2, 7, 11, 19, 25, 30], "dates", null)!;
    expect(c).toHaveLength(2);
    for (const x of c) {
      expect(x.to).toBeGreaterThanOrEqual(32);
      expect(x.to).toBeLessThanOrEqual(49);
    }
    expect(level("649", applyChanges([2, 7, 11, 19, 25, 30], c))).toBe("low");
  });

  it("progression: one replacement removes the sequence and lowers the level", () => {
    const main = [5, 15, 25, 35, 45];
    const c = suggestChanges("ej", main, "progression", null)!;
    expect(c).toHaveLength(1);
    const after = evaluatePopularity("ej", applyChanges(main, c), { pastWinning: null });
    expect(after.rules.find((r) => r.id === "progression")!.status).toBe("notTriggered");
    expect(after.level).not.toBe("high");
  });

  it("ticketPattern: removes the line on the slip (6aus49)", () => {
    const main = [1, 8, 15, 22, 29, 36];
    const c = suggestChanges("649", main, "ticketPattern", null)!;
    expect(c).toHaveLength(1);
    expect(evaluatePopularity("649", applyChanges(main, c), { pastWinning: null }).rules.find((r) => r.id === "ticketPattern")!.status).toBe(
      "notTriggered",
    );
  });

  it("pastWinning: a different combination that is not in the archive", () => {
    const main = [4, 17, 33, 41, 48];
    const past = new Map([[comboKey(main), "2019-05-03"]]);
    const c = suggestChanges("ej", main, "pastWinning", past)!;
    expect(c).toHaveLength(1);
    expect(level("ej", applyChanges(main, c), past)).toBe("low");
  });

  it("medium: from weak rules down to 'low'", () => {
    const main = [10, 11, 12, 33, 45];
    const c = suggestChanges("ej", main, "medium", null)!;
    expect(level("ej", applyChanges(main, c))).toBe("low");
  });

  it("returns null when the rule does not apply", () => {
    expect(suggestChanges("ej", [4, 17, 33, 41, 48], "dates", null)).toBeNull();
    expect(suggestChanges("ej", [3, 9, 14, 22, 30], "medium", null)).toBeNull();
    expect(suggestChanges("ej", [4, 17, 33, 41, 48], "progression", null)).toBeNull();
  });
});

describe("expected return at a jackpot", () => {
  // 52 identical draws: stake 40 000 000 € = 20 000 000 fields, fixed quotas
  const quotes: [string, number, number][] = [
    ["5+2", 0, 0],
    ["5+1", 2, 600_000],
    ["5+0", 4, 150_000],
    ["4+2", 30, 4_500],
    ["4+1", 500, 340],
    ["3+2", 1000, 180],
    ["4+0", 1200, 115],
    ["2+2", 15000, 28],
    ["3+1", 20000, 22],
    ["3+0", 55000, 17],
    ["1+2", 70000, 14],
    ["2+1", 300000, 10],
  ];
  const draws: Draw[] = Array.from({ length: 60 }, (_, i) => ({
    game: "ej" as const,
    date: `2026-${String(1 + Math.floor(i / 8)).padStart(2, "0")}-${String(1 + (i % 8) * 3).padStart(2, "0")}`,
    main: [1, 2, 3, 4, 5],
    euro: [1, 2],
    euroPool: 12,
    quotes,
    jackpot: 50_000_000,
    stake: 40_000_000,
    source: "archive" as const,
  }));

  it("follows the formula of guide-copy.md 7.3", () => {
    const r = ejFieldEvAtJackpot(draws, EJ_JACKPOT_CAP)!;
    const fields = 20_000_000;
    const lambda = fields / 139_838_160;
    expect(r.fields).toBe(fields);
    expect(r.lambda).toBeCloseTo(lambda, 12);
    expect(r.jackpotTerm).toBeCloseTo((EJ_JACKPOT_CAP * (1 - Math.exp(-lambda))) / fields, 9);
    // sharing makes the term smaller than J / 139 838 160 = 0.858 €
    expect(r.jackpotTerm).toBeLessThan(EJ_JACKPOT_CAP / 139_838_160);
    // classes 2…12: combinations of the 2-of-12 era
    const total = 139_838_160;
    const comb: Record<string, number> = {
      "5+1": 1 * 2 * 10, "5+0": 45 * 1, "4+2": 5 * 45, "4+1": 5 * 45 * 2 * 10, "3+2": 10 * 990,
      "4+0": 5 * 45 * 45, "2+2": 10 * 14190, "3+1": 10 * 990 * 20, "3+0": 10 * 990 * 45, "1+2": 5 * 148995, "2+1": 10 * 14190 * 20,
    };
    const expectedOther = quotes.slice(1).reduce((s, [l, , a]) => s + ((comb[l] ?? NaN) / total) * a, 0);
    expect(r.otherTerm).toBeCloseTo(expectedOther, 6);
    expect(r.ev).toBeCloseTo(r.otherTerm + r.jackpotTerm, 12);
    expect(r.quotaDraws).toBe(52);
  });

  it("is higher for a higher jackpot and ignores nothing else", () => {
    const a = ejFieldEvAtJackpot(draws, 60_000_000)!;
    const b = ejFieldEvAtJackpot(draws, 120_000_000)!;
    expect(b.ev).toBeGreaterThan(a.ev);
    expect(b.otherTerm).toBeCloseTo(a.otherTerm, 12);
  });

  it("is null without enough data", () => {
    expect(ejFieldEvAtJackpot([], 1e8)).toBeNull();
    expect(ejFieldEvAtJackpot(draws, 0)).toBeNull();
    expect(ejFieldEvAtJackpot(draws.map((d) => ({ ...d, stake: null })), 1e8)).toBeNull();
    // a class without any quota in the window
    const noClass = draws.map((d) => ({ ...d, quotes: d.quotes!.map(([l, w, a]) => (l === "3+0" ? ([l, 0, 0] as [string, number, number]) : [l, w, a] as [string, number, number])) }));
    expect(ejFieldEvAtJackpot(noClass, 1e8)).toBeNull();
    // fewer than 12 classes (older format)
    expect(ejFieldEvAtJackpot(draws.map((d) => ({ ...d, quotes: d.quotes!.slice(0, 9) })), 1e8)).toBeNull();
  });
});

describe("claimed ticket mark", () => {
  const base = {
    id: "a",
    game: "ej",
    fields: [{ main: [1, 2, 3, 4, 5], euro: [1, 2] }],
    drawDates: ["2026-11-03"],
    createdAt: "2026-11-01T00:00:00Z",
    source: "manual",
  };

  it("old tickets without the field stay valid", () => {
    const t = parseTicket(base)!;
    expect(t).not.toBeNull();
    expect("claimed" in t).toBe(false);
  });

  it("keeps true, drops false, rejects other types", () => {
    expect(parseTicket({ ...base, claimed: true })!.claimed).toBe(true);
    expect("claimed" in parseTicket({ ...base, claimed: false })!).toBe(false);
    expect(parseTicket({ ...base, claimed: "yes" })).toBeNull();
    expect(parseTicket({ ...base, claimed: 1 })).toBeNull();
  });

  it("round-trips through the editor draft and through JSON", () => {
    const t = parseTicket({ ...base, claimed: true })!;
    const draft = ticketToDraft(t);
    expect(draft.claimed).toBe(true);
    const saved = draftToTicket(draft, { id: t.id, createdAt: t.createdAt, source: t.source }, "2026-11-07");
    expect(saved.claimed).toBe(true);
    expect(parseTicket(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    const cleared = draftToTicket({ ...draft, claimed: false }, { id: t.id, createdAt: t.createdAt, source: t.source }, "2026-11-07");
    expect("claimed" in cleared).toBe(false);
  });
});
