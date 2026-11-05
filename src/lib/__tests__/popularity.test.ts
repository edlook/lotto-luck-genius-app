import { describe, expect, it } from "vitest";
import { comboKey, evaluatePopularity, longestRun, progressionStep, slipLine } from "../popularity";
import { generateField, generateFields, type GeneratedField } from "../generator";
import { createCryptoRandomInt, sampleDistinct, type RandomInt } from "../rng";

const status = (nums: number[], id: string, game: "ej" | "649" = "649", past: Map<string, string> | null = null) =>
  evaluatePopularity(game, nums, { pastWinning: past }).rules.find((r) => r.id === id)!;

describe("popularity rules", () => {
  it("dates: all numbers ≤ 31 → strong, level high", () => {
    const r = evaluatePopularity("649", [3, 7, 12, 19, 25, 31], { pastWinning: null });
    expect(r.rules.find((x) => x.id === "dates")!.status).toBe("triggered");
    expect(r.level).toBe("high");
  });

  it("almost dates: exactly one number > 31 → weak", () => {
    expect(status([2, 9, 14, 20, 27, 44], "almostDates").status).toBe("triggered");
    expect(status([2, 9, 14, 20, 27, 44], "dates").status).toBe("notTriggered");
    expect(status([2, 9, 14, 20, 37, 44], "almostDates").status).toBe("notTriggered");
  });

  it("progression and consecutive", () => {
    expect(progressionStep([5, 10, 15, 20, 25, 30])).toBe(5);
    expect(progressionStep([1, 2, 3, 4, 5, 7])).toBeNull();
    expect(status([5, 10, 15, 20, 25, 30], "progression").params.step).toBe(5);
    expect(longestRun([3, 4, 5, 20, 40, 41])).toEqual([3, 4, 5]);
    expect(status([3, 4, 5, 20, 40, 41], "consecutive").status).toBe("triggered");
    expect(status([3, 4, 20, 22, 40, 47], "consecutive").status).toBe("notTriggered");
  });

  it("slip pattern on the 7×7 slip of 6aus49", () => {
    expect(slipLine([8, 9, 10, 11, 12, 13], 7)).toBe("row");
    expect(slipLine([2, 9, 16, 23, 30, 37], 7)).toBe("column");
    expect(slipLine([1, 9, 17, 25, 33, 41], 7)).toBe("diagonal");
    expect(slipLine([7, 13, 19, 25, 31, 37], 7)).toBe("diagonal");
    expect(slipLine([1, 2, 3, 4, 5, 13], 7)).toBeNull();
    expect(status([2, 9, 16, 23, 30, 37], "ticketPattern").params.line).toBe("column");
  });

  it("slip pattern is disabled for EuroJackpot (layout not verified)", () => {
    expect(status([1, 2, 3, 4, 5], "ticketPattern", "ej").status).toBe("disabledBlank");
  });

  it("multiples and last digit", () => {
    expect(status([4, 8, 16, 32, 40, 48], "multiples").params.step).toBe(4);
    expect(status([3, 13, 23, 33, 43, 49], "lastDigit").status).toBe("notTriggered");
    expect(status([3, 13, 23, 33, 43], "lastDigit", "ej").params.digit).toBe(3);
  });

  it("past winning: not checked without data, triggered on exact match", () => {
    expect(status([3, 13, 16, 28, 44, 49], "pastWinning").status).toBe("notChecked");
    const past = new Map([[comboKey([3, 13, 16, 28, 44, 49]), "2026-11-04"]]);
    const r = status([49, 44, 28, 16, 13, 3], "pastWinning", "649", past);
    expect(r.status).toBe("triggered");
    expect(r.params.date).toBe("2026-11-04");
  });

  it("a spread combination is low", () => {
    const r = evaluatePopularity("649", [4, 17, 29, 36, 42, 48], { pastWinning: new Map() });
    expect(r.level).toBe("low");
  });
});

describe("rng", () => {
  it("sampleDistinct returns k sorted distinct numbers in range", () => {
    const rnd = createCryptoRandomInt();
    for (let i = 0; i < 500; i++) {
      const s = sampleDistinct(6, 49, rnd);
      expect(s).toHaveLength(6);
      expect(new Set(s).size).toBe(6);
      expect(s.every((n) => n >= 1 && n <= 49)).toBe(true);
      expect([...s].sort((a, b) => a - b)).toEqual(s);
    }
  });

  it("randomInt is unbiased (chi-square sanity check on 60 000 values)", () => {
    const rnd = createCryptoRandomInt();
    const n = 6;
    const counts = new Array(n).fill(0);
    const N = 60_000;
    for (let i = 0; i < N; i++) counts[rnd(n)]++;
    const e = N / n;
    const x2 = counts.reduce((s, o) => s + ((o - e) ** 2) / e, 0);
    // df = 5: P(X² > 25.7) ≈ 0.0001
    expect(x2).toBeLessThan(25.7);
  });

  it("rejects out-of-range bound", () => {
    const rnd = createCryptoRandomInt();
    expect(() => rnd(0)).toThrow();
  });
});

describe("generator", () => {
  it("rare mode only returns low-popularity combinations", () => {
    const past = new Map<string, string>();
    for (let i = 0; i < 200; i++) {
      const f = generateField("649", { mode: "rare", pastWinning: past });
      expect(f.report.level).toBe("low");
      expect(f.euro).toBeUndefined();
    }
  });

  it("EuroJackpot fields have 5 + 2 numbers", () => {
    const [f] = generateFields("ej", 1, { mode: "random", pastWinning: null }) as [GeneratedField];
    expect(f.main).toHaveLength(5);
    expect(f.euro).toHaveLength(2);
    expect(f.euro!.every((n) => n >= 1 && n <= 12)).toBe(true);
  });

  it("rare mode rejects a forced popular combination and keeps drawing", () => {
    // Deterministic source: first yields 1..6 (popular), then a spread set.
    // Partial Fisher–Yates offsets: first attempt picks 1..6, second picks 4 17 29 36 42 48.
    const seq = [0, 0, 0, 0, 0, 0, 3, 15, 26, 32, 37, 42];
    let call = 0;
    const scripted: RandomInt = () => seq[call++ % seq.length]!;
    const f = generateField("649", { mode: "rare", pastWinning: null, rnd: scripted });
    expect(call).toBe(12);
    expect(f.main).toEqual([4, 17, 29, 36, 42, 48]);
    expect(f.report.level).toBe("low");
  });

  it("generateFields returns the requested count", () => {
    expect(generateFields("649", 12, { mode: "rare", pastWinning: null })).toHaveLength(12);
  });
});
