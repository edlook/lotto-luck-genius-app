import { describe, expect, it } from "vitest";
import { anyWin, atLeastOnce, binom, classOdds, totalCombinations } from "../odds";
import { GAMES } from "../games";
import { fieldEv, yearCost } from "../ev";

describe("binom", () => {
  it("matches known values", () => {
    expect(binom(49, 6)).toBe(13_983_816);
    expect(binom(50, 5)).toBe(2_118_760);
    expect(binom(12, 2)).toBe(66);
    expect(binom(5, 0)).toBe(1);
    expect(binom(5, 6)).toBe(0);
  });
});

// Tables from texts/research-company.md 4.1 / 4.2 (official lotto.de values, rounded)
const EJ_TABLE: [number, number, number][] = [
  // class, combinations, official "1 in"
  [1, 1, 139_838_160],
  [2, 20, 6_991_908],
  [3, 45, 3_107_515],
  [4, 225, 621_503],
  [5, 4_500, 31_075],
  [6, 9_900, 14_125],
  [7, 10_125, 13_811],
  [8, 141_900, 985],
  [9, 198_000, 706],
  [10, 445_500, 314],
  [11, 744_975, 188],
  [12, 2_838_000, 49],
];

const L649_TABLE: [number, number, number][] = [
  [1, 1, 139_838_160],
  [2, 9, 15_537_573],
  [3, 258, 542_008],
  [4, 2_322, 60_223],
  [5, 13_545, 10_324],
  [6, 121_905, 1_147],
  [7, 246_820, 567],
  [8, 2_221_380, 63],
  [9, 1_851_150, 76],
];

describe("class odds", () => {
  it("both games have 139 838 160 combinations", () => {
    expect(totalCombinations(GAMES.ej)).toBe(139_838_160);
    expect(totalCombinations(GAMES["649"])).toBe(139_838_160);
  });

  it.each(EJ_TABLE)("EuroJackpot class %i", (cls, combos, oneIn) => {
    const row = classOdds("ej").find((r) => r.cls === cls)!;
    expect(row.combinations).toBe(combos);
    // official tables round to whole numbers (class 8: 985.5 is published as 985)
    expect(Math.abs(row.oneIn - oneIn)).toBeLessThan(1);
  });

  it.each(L649_TABLE)("Lotto 6aus49 class %i", (cls, combos, oneIn) => {
    const row = classOdds("649").find((r) => r.cls === cls)!;
    expect(row.combinations).toBe(combos);
    expect(Math.abs(row.oneIn - oneIn)).toBeLessThan(1);
  });

  it("any win: EJ 4 393 191 (≈3.14 %, 1 in 31.8)", () => {
    const a = anyWin("ej");
    expect(a.combinations).toBe(4_393_191);
    expect(a.probability * 100).toBeCloseTo(3.14, 2);
    expect(a.oneIn).toBeCloseTo(31.8, 1);
  });

  it("any win: 6aus49 4 457 390 (≈3.19 %, 1 in 31.4)", () => {
    const a = anyWin("649");
    expect(a.combinations).toBe(4_457_390);
    expect(a.probability * 100).toBeCloseTo(3.19, 2);
    expect(a.oneIn).toBeCloseTo(31.4, 1);
  });

  it("probabilities of all outcomes sum to 1 (incl. losing)", () => {
    for (const g of ["ej", "649"] as const) {
      const game = GAMES[g];
      let sum = 0;
      if (game.hasSuperzahl) {
        for (let k = 0; k <= 6; k++) for (const e of [0, 1]) sum += classOddsAll(g, k, e);
      } else {
        for (let k = 0; k <= 5; k++) for (let m = 0; m <= 2; m++) sum += classOddsAll(g, k, m);
      }
      expect(sum).toBe(139_838_160);
    }
  });
});

import { classCombinations } from "../odds";
function classOddsAll(g: "ej" | "649", k: number, e: number) {
  return classCombinations(GAMES[g], k, e);
}

describe("atLeastOnce", () => {
  it("is stable for tiny probabilities", () => {
    const p = 1 / 139_838_160;
    const exact = atLeastOnce(p, 416);
    // 1 − (1 − p)^n is slightly below n·p (second-order term), relative difference ≈ (n−1)p/2
    expect(exact).toBeLessThan(416 * p);
    expect(Math.abs(exact / (416 * p) - 1)).toBeLessThan(1e-5);
    expect(exact).toBeGreaterThan(0);
    expect(atLeastOnce(0.5, 2)).toBeCloseTo(0.75, 12);
    expect(atLeastOnce(0.1, 0)).toBe(0);
  });
});

describe("EV and yearly cost", () => {
  it("6aus49: 50 % of 1.20 € = 0.60 €", () => {
    const r = fieldEv({ price: 1.2, payoutShare: 0.5 });
    expect(r.expectedReturn).toBeCloseTo(0.6, 10);
    expect(r.expectedLoss).toBeCloseTo(0.6, 10);
  });

  it("fee lowers the return one-to-one", () => {
    const r = fieldEv({ price: 1.2, payoutShare: 0.5, feePerField: 0.1 });
    expect(r.expectedReturnAfterFee).toBeCloseTo(0.5, 10);
    expect(r.expectedLoss).toBeCloseTo(0.7, 10);
  });

  it("unknown payout share gives no EV", () => {
    expect(fieldEv({ price: 2, payoutShare: null }).expectedReturn).toBeNull();
  });

  it("copy example: 4 fields, 2 draws/week, 52 weeks = 416 fields, 499.20 €, ≈1 in 336 000", () => {
    const y = yearCost({ game: "649", fieldsPerDraw: 4, drawsPerWeek: 2, weeks: 52, price: 1.2, feePerDraw: 0, payoutShare: 0.5 });
    expect(y.fields).toBe(416);
    expect(y.spent).toBe(499.2);
    expect(y.expectedReturn).toBe(249.6);
    expect(Math.round(1 / y.pJackpot / 1000)).toBe(336);
  });

  it("year without payout share still reports spending and probabilities", () => {
    const y = yearCost({ game: "ej", fieldsPerDraw: 1, drawsPerWeek: 2, weeks: 52, price: 2, feePerDraw: 0.5, payoutShare: null });
    expect(y.spent).toBe(260);
    expect(y.expectedReturn).toBeNull();
    expect(y.pAnyWin).toBeGreaterThan(0.95);
  });
});
