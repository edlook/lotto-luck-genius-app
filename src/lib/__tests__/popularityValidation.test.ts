import { describe, expect, it } from "vitest";
import {
  PRIMARY_CLASS,
  analysePopularity,
  buildRows,
  classProbability,
  compareGroups,
  correlate,
  pearson,
  verdictOf,
  type ValidationDraw,
} from "../popularityValidation";
import { classOdds } from "../odds";
import { createSeededInt, createSeededRandom } from "../seededRng";
import { sampleDistinct } from "../rng";
import { EJ_ERAS } from "../eras";

/**
 * Synthetic EuroJackpot draws. Winners of "3+0" = fields · p · (1 + effect · (low − 3.1)) · noise,
 * where low = how many drawn numbers are ≤ 31. effect = 0 means no popularity effect at all.
 */
function synthetic(n: number, effect: number, seed: number): ValidationDraw[] {
  const rnd = createSeededInt(seed);
  const unit = createSeededRandom(seed + 1);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - unit())) * Math.cos(2 * Math.PI * unit());
  return Array.from({ length: n }, (_, i) => {
    const main = sampleDistinct(5, 50, rnd);
    const low = main.filter((x) => x <= 31).length;
    const euroPool = EJ_ERAS[i % 3]!.euroPool;
    const stake = 40_000_000;
    const fields = stake / 2;
    const factor = Math.max(0.05, 1 + effect * (low - 3.1) + 0.06 * gauss());
    const winners = (label: string) => Math.round(fields * classProbability(label, euroPool) * (label === PRIMARY_CLASS ? factor : 1 + 0.06 * gauss()));
    const quotes: [string, number, number][] = ["3+0", "4+0", "3+1", "2+1", "2+2", "1+2"].map((l) => [l, winners(l), 20]);
    return { date: `2020-01-${String((i % 28) + 1).padStart(2, "0")}`, main, euroPool, stake, quotes };
  });
}

describe("class probabilities", () => {
  it("match the 12-number table of odds.ts for the current era", () => {
    const rows = classOdds("ej");
    expect(classProbability("3+0", 12)).toBeCloseTo(rows.find((r) => r.main === 3 && r.extra === 0)!.probability, 14);
    expect(classProbability("2+1", 12)).toBeCloseTo(rows.find((r) => r.main === 2 && r.extra === 1)!.probability, 14);
  });
  it("depend on the Euro pool: 3+0 is less likely when the pool is 8 (a Euro hit is likelier)", () => {
    expect(classProbability("3+0", 8)).toBeLessThan(classProbability("3+0", 12));
    // by hand: C(5,3)·C(45,2) · C(2,0)·C(6,2) / (C(50,5)·C(8,2)) = 9900 · 15 / (2118760 · 28)
    expect(classProbability("3+0", 8)).toBeCloseTo((9900 * 15) / (2118760 * 28), 12);
  });
});

describe("rows", () => {
  it("skips draws without stake or quotas and counts them", () => {
    const d = synthetic(5, 0, 1);
    const bad: ValidationDraw[] = [
      { ...d[0]!, stake: null },
      { ...d[1]!, quotes: undefined },
      { ...d[2]!, quotes: d[2]!.quotes!.filter(([l]) => l !== "3+0") },
    ];
    const { rows, skipped } = buildRows([...d, ...bad]);
    expect(rows.length).toBe(5);
    expect(skipped).toBe(3);
  });
  it("index 1 means exactly the expected number of winners", () => {
    const stake = 20_000_000;
    const fields = stake / 2;
    const d: ValidationDraw = {
      date: "2024-01-02",
      main: [3, 14, 25, 36, 47],
      euroPool: 12,
      stake,
      quotes: ["3+0", "4+0", "3+1", "2+1", "2+2", "1+2"].map((l) => [l, fields * classProbability(l, 12), 10] as [string, number, number]),
    };
    const { rows } = buildRows([d]);
    expect(rows[0]!.index["3+0"]).toBeCloseTo(1, 12);
    expect(rows[0]!.low).toBe(3);
  });
});

describe("statistics helpers", () => {
  it("pearson of a perfect line is 1", () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 12);
  });
  it("compareGroups: identical groups give an interval around 0 and a large p", () => {
    const r = createSeededRandom(1);
    const a = Array.from({ length: 300 }, () => r());
    const b = Array.from({ length: 300 }, () => r());
    const res = compareGroups(a, b, createSeededRandom(2), 2000);
    expect(res.low).toBeLessThan(0);
    expect(res.high).toBeGreaterThan(0);
    expect(res.pPerm).toBeGreaterThan(0.05);
  });
  it("correlate finds a planted dependence", () => {
    const r = createSeededRandom(3);
    const x = Array.from({ length: 300 }, () => Math.floor(r() * 6));
    const y = x.map((v) => v + r());
    const res = correlate(x, y, createSeededRandom(4), 1000);
    expect(res.r).toBeGreaterThan(0.8);
    expect(res.low).toBeGreaterThan(0.7);
    expect(res.pPerm).toBeLessThan(0.01);
  });
});

describe("verdicts", () => {
  it("follow the interval and the effect size", () => {
    expect(verdictOf({ low: 0.1, high: 0.3, d: 1 })).toBe("confirmed");
    expect(verdictOf({ low: 0.01, high: 0.05, d: 0.2 })).toBe("weak");
    expect(verdictOf({ low: -0.05, high: 0.05, d: 0.1 })).toBe("notDetected");
    expect(verdictOf({ low: -0.3, high: -0.1, d: -1 })).toBe("opposite");
  });
});

describe("analysePopularity", () => {
  it("finds a planted effect", () => {
    const res = analysePopularity(synthetic(900, 0.1, 21), { boots: 1500 })!;
    expect(res.difference.value).toBeGreaterThan(0.1);
    expect(res.difference.low).toBeGreaterThan(0);
    expect(res.correlation.r).toBeGreaterThan(0.5);
    expect(res.verdict).toBe("confirmed");
    expect(res.n).toBe(900);
  });

  it("does not find an effect in data without one (many seeds, few false alarms)", () => {
    let flagged = 0;
    for (let s = 0; s < 12; s++) {
      const res = analysePopularity(synthetic(600, 0, 100 + s), { boots: 600 })!;
      expect(Math.abs(res.difference.value)).toBeLessThan(0.05);
      if (res.verdict !== "notDetected") flagged++;
    }
    expect(flagged).toBeLessThanOrEqual(2);
  });

  it("is deterministic for a fixed seed and changes with another", () => {
    const d = synthetic(400, 0.05, 5);
    const a = analysePopularity(d, { boots: 500, seed: 9 })!;
    expect(analysePopularity(d, { boots: 500, seed: 9 })).toEqual(a);
    const b = analysePopularity(d, { boots: 500, seed: 10 })!;
    expect(b.difference.value).toBe(a.difference.value); // data statistics do not depend on the seed
    expect(b.difference.low).not.toBe(a.difference.low); // the resampled interval does, slightly
  });

  it("returns null when a group is too small", () => {
    expect(analysePopularity(synthetic(8, 0, 1))).toBeNull();
  });
});
