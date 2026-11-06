import { describe, expect, it } from "vitest";
import {
  History,
  HISTORY_STRATEGIES,
  countMatches,
  expectedMatches,
  matchDistribution,
  matchTail,
  matchVariance,
  pickTicket,
  runBacktest,
  walkForwardMatches,
} from "../backtest";
import { createSeededRandom, createSeededInt } from "../seededRng";
import { sampleDistinct } from "../rng";

/** Independent draws of k from 1..pool, reproducible. */
function synthetic(count: number, pool: number, k: number, seed: number): number[][] {
  const rnd = createSeededInt(seed);
  return Array.from({ length: count }, () => sampleDistinct(k, pool, rnd));
}

describe("exact expectations", () => {
  it("EuroJackpot main numbers: 5 · 5 / 50 = 0.5", () => {
    expect(expectedMatches(50, 5)).toBe(0.5);
  });
  it("Lotto 6aus49: 6 · 6 / 49 ≈ 0.7347", () => {
    expect(expectedMatches(49, 6)).toBeCloseTo(0.734694, 6);
  });
  it("distribution sums to 1 and reproduces mean and variance", () => {
    for (const [pool, k] of [
      [50, 5],
      [49, 6],
    ] as const) {
      const d = matchDistribution(pool, k);
      expect(d.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
      const m = d.reduce((s, p, j) => s + p * j, 0);
      const v = d.reduce((s, p, j) => s + p * (j - m) ** 2, 0);
      expect(m).toBeCloseTo(expectedMatches(pool, k), 12);
      expect(v).toBeCloseTo(matchVariance(pool, k), 12);
    }
  });
  it("known tail: 3 or more of 6 in 6aus49 = 1 − P(0) − P(1) − P(2) ≈ 0.01864", () => {
    expect(matchTail(49, 6, 3)).toBeCloseTo(0.0186375, 5);
    expect(matchTail(49, 6, 6)).toBeCloseTo(1 / 13983816, 12);
  });
});

describe("strategies", () => {
  const draws = [
    [1, 2, 3, 4, 5],
    [1, 2, 3, 6, 7],
    [1, 2, 8, 9, 10],
  ];
  it("hot / cold / repeat on a tiny history", () => {
    // counts: 1 and 2 three times, 3 twice, 4..10 once; ties go to the smaller number
    expect(pickTicket("hot", draws, 10, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pickTicket("cold", draws, 10, 5)).toEqual([4, 5, 6, 7, 8]);
    expect(pickTicket("repeat", draws, 10, 5)).toEqual([1, 2, 8, 9, 10]);
  });
  it("overdue picks the longest gaps, never-seen numbers first", () => {
    // pool 12: 11 and 12 never drawn (gap 4), 4 and 5 last seen in the first draw (gap 3), then the gap-2 group 3, 6, 7
    expect(pickTicket("overdue", draws, 12, 5)).toEqual([3, 4, 5, 11, 12]);
  });
  it("window variants forget draws older than 100", () => {
    const old = Array.from({ length: 150 }, () => [1, 2, 3, 4, 5]);
    const recent = Array.from({ length: 100 }, () => [6, 7, 8, 9, 10]);
    expect(pickTicket("hot", [...old, ...recent], 20, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pickTicket("hot100", [...old, ...recent], 20, 5)).toEqual([6, 7, 8, 9, 10]);
  });
  it("incremental state equals a rebuild from scratch at every step", () => {
    const d = synthetic(260, 30, 5, 7);
    const h = new History(30, 5);
    d.forEach((draw, i) => {
      if (i > 3) for (const s of HISTORY_STRATEGIES) expect(h.pick(s)).toEqual(pickTicket(s, d.slice(0, i), 30, 5));
      h.add(draw);
    });
  });
});

describe("no peeking", () => {
  it("results for draws up to N do not change when later draws change", () => {
    const base = synthetic(400, 50, 5, 11);
    const N = 250;
    const altered = base.map((d, i) => (i > N ? synthetic(1, 50, 5, 1000 + i)[0]! : d));
    for (const s of HISTORY_STRATEGIES) {
      const a = walkForwardMatches(base, 50, 5, s);
      const b = walkForwardMatches(altered, 50, 5, s);
      // scored draw j corresponds to archive index j + 100
      const upto = N - 100 + 1;
      expect(b.slice(0, upto)).toEqual(a.slice(0, upto));
      expect(b.slice(upto + 5)).not.toEqual(a.slice(upto + 5)); // sanity: later part really differs
    }
  });
  it("a ticket for draw N is the same whatever follows", () => {
    const d = synthetic(300, 49, 6, 5);
    const other = [...d.slice(0, 200), ...synthetic(100, 49, 6, 99)];
    for (const s of HISTORY_STRATEGIES) {
      expect(pickTicket(s, d.slice(0, 200), 49, 6)).toEqual(pickTicket(s, other.slice(0, 200), 49, 6));
    }
  });
});

describe("independent synthetic draws: strategies stay inside the chance band", () => {
  for (const [pool, k] of [
    [50, 5],
    [49, 6],
  ] as const) {
    it(`${k} of ${pool}`, () => {
      const r = runBacktest(synthetic(3000, pool, k, 20260101), pool, k, { randomRuns: 100, seed: 1 });
      expect(r.draws).toBe(2900);
      expect(r.expectedMean).toBeCloseTo((k * k) / pool, 12);
      for (const s of r.strategies) {
        expect(Math.abs(s.z), s.id).toBeLessThan(3);
        expect(s.tails.length).toBe(3);
      }
      // the random control is calibrated: roughly 5 % of single runs leave the band
      expect(r.random.outsideShare).toBeLessThan(0.2);
      expect(r.band.low).toBeLessThan(r.expectedMean);
      expect(r.band.high).toBeGreaterThan(r.expectedMean);
    });
  }

  it("false alarms stay near 5 % over many independent worlds", () => {
    let outside = 0;
    let total = 0;
    for (let w = 0; w < 40; w++) {
      const r = runBacktest(synthetic(700, 49, 6, 500 + w), 49, 6, { randomRuns: 1, warmup: 100 });
      for (const s of r.strategies.slice(0, 6)) {
        total++;
        if (!s.within) outside++;
      }
    }
    expect(outside / total).toBeLessThan(0.12);
  });

  it("detects a planted bias (numbers 1..5 are drawn twice as often)", () => {
    const rnd = createSeededRandom(3);
    const draws: number[][] = [];
    for (let i = 0; i < 3000; i++) {
      const set = new Set<number>();
      while (set.size < 5) {
        const biased = rnd() < 0.5;
        set.add(biased ? 1 + Math.floor(rnd() * 5) : 1 + Math.floor(rnd() * 50));
      }
      draws.push([...set]);
    }
    const r = runBacktest(draws, 50, 5, { randomRuns: 50 });
    const hot = r.strategies.find((s) => s.id === "hot")!;
    expect(hot.within).toBe(false);
    expect(hot.diff).toBeGreaterThan(0);
    // and the control still is not flagged on average
    expect(r.strategies.find((s) => s.id === "random")!.z).toBeLessThan(3);
  });

  it("is deterministic for a fixed seed", () => {
    const d = synthetic(500, 49, 6, 8);
    expect(runBacktest(d, 49, 6, { randomRuns: 20, seed: 4 })).toEqual(runBacktest(d, 49, 6, { randomRuns: 20, seed: 4 }));
  });

  it("rejects archives that are too short", () => {
    expect(() => runBacktest(synthetic(50, 49, 6, 1), 49, 6)).toThrow(RangeError);
  });
});

describe("countMatches", () => {
  it("counts the overlap", () => {
    expect(countMatches([1, 2, 3], [3, 4, 1])).toBe(2);
  });
});
