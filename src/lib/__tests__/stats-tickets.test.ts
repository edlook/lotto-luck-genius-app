import { describe, expect, it } from "vitest";
import {
  bucketize,
  chiSquare,
  evenCountDistribution,
  frequencies,
  lastDigitExpected,
  monteCarloUniformity,
  sumDistribution,
} from "../stats";
import { checkField, type Draw } from "../ticketCheck";
import { parseDrawCsv } from "../csvImport";
import { completeness, drawSeries, isDrawDay, nextDraw, nextDrawOnOrAfter } from "../drawCalendar";
import { ejEraOn } from "../eras";
import { createCryptoRandomInt, sampleDistinct } from "../rng";

describe("frequencies", () => {
  it("counts and expected value E = D·k/N", () => {
    const rows = frequencies(
      [
        { date: "2026-01-01", numbers: [1, 2, 3] },
        { date: "2026-01-02", numbers: [1, 4, 5] },
      ],
      3,
      10,
    );
    expect(rows[0]).toMatchObject({ number: 1, observed: 2, expected: 0.6, lastDrawn: "2026-01-02" });
    expect(rows[9]).toMatchObject({ number: 10, observed: 0, lastDrawn: null });
  });

  it("zero-based pool for the Superzahl", () => {
    const rows = frequencies([{ date: "2026-01-01", numbers: [0] }], 1, 10, true);
    expect(rows[0]).toMatchObject({ number: 0, observed: 1 });
  });
});

describe("exact distributions", () => {
  it("even count distribution sums to 1 and matches the hypergeometric formula", () => {
    const d = evenCountDistribution(6, 49);
    expect(d.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    // P(0 even) = C(24,0)·C(25,6)/C(49,6) = 177100/13983816
    expect(d[0]).toBeCloseTo(177_100 / 13_983_816, 12);
  });

  it("sum distribution: total 1, mean k(N+1)/2, symmetric", () => {
    const p = sumDistribution(6, 49);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    const mean = p.reduce((s, v, i) => s + v * i, 0);
    expect(mean).toBeCloseTo(150, 9);
    expect(p[21]).toBeCloseTo(1 / 13_983_816, 15); // 1+2+…+6
    expect(p[21]).toBeCloseTo(p[279]!, 15); // 44+…+49
    const buckets = bucketize(p, 20);
    expect(buckets.reduce((s, b) => s + b.p, 0)).toBeCloseTo(1, 12);
  });

  it("last digit shares", () => {
    const e = lastDigitExpected(49);
    expect(e[0]).toBeCloseTo(4 / 49, 12); // 10,20,30,40
    expect(e[9]).toBeCloseTo(5 / 49, 12); // 9..49
  });
});

describe("Monte Carlo uniformity test", () => {
  it("p is not small for genuinely random data", () => {
    const rnd = createCryptoRandomInt();
    const draws = 300;
    const counts = new Array(49).fill(0);
    for (let i = 0; i < draws; i++) for (const n of sampleDistinct(6, 49, rnd)) counts[n - 1]++;
    const r = monteCarloUniformity(counts, draws, 6, 49, 400);
    expect(r.pValue).toBeGreaterThan(0.001);
    expect(r.statistic).toBeCloseTo(chiSquare(counts, (draws * 6) / 49), 9);
  });

  it("p is tiny for heavily biased data", () => {
    const draws = 300;
    const counts = new Array(49).fill(0);
    for (let i = 0; i < draws; i++) for (const n of [1, 2, 3, 4, 5, 6]) counts[n - 1]++;
    const r = monteCarloUniformity(counts, draws, 6, 49, 200);
    expect(r.pValue).toBeLessThanOrEqual(1 / 201 + 1e-12);
  });
});

const ejDraw: Draw = {
  game: "ej",
  date: "2026-11-03",
  main: [2, 5, 12, 32, 43],
  euro: [1, 3],
  euroPool: 12,
  source: "archive",
  quotes: [
    ["5+2", 0, 0],
    ["5+1", 1, 1509389.7],
    ["5+0", 1, 851225.5],
    ["4+2", 34, 4129.6],
    ["4+1", 530, 331.1],
    ["3+2", 1140, 169.3],
    ["4+0", 1252, 112.1],
    ["2+2", 16758, 26.7],
    ["3+1", 25266, 19.7],
    ["3+0", 56523, 16.7],
    ["1+2", 87365, 13.5],
    ["2+1", 362812, 9.8],
  ],
};

const l649Draw: Draw = { game: "649", date: "2026-11-04", main: [3, 13, 16, 28, 44, 49], superzahl: 2, source: "archive" };

describe("ticket check", () => {
  it("EuroJackpot 3 + 1 = class 9 with official quota", () => {
    const r = checkField({ main: [2, 5, 12, 20, 30], euro: [1, 9] }, ejDraw);
    expect(r.label).toBe("3 + 1");
    expect(r.cls).toBe(9);
    expect(r.amount).toBe(19.7);
  });

  it("EuroJackpot no win", () => {
    const r = checkField({ main: [1, 6, 7, 8, 9], euro: [2, 4] }, ejDraw);
    expect(r.cls).toBeNull();
  });

  it("EuroJackpot without quotas falls back to the class table", () => {
    const r = checkField({ main: [2, 5, 12, 32, 43], euro: [1, 3] }, { ...ejDraw, quotes: undefined });
    expect(r.cls).toBe(1);
  });

  it("6aus49: 2 + SZ = class 9 (fixed 6 €)", () => {
    const r = checkField({ main: [3, 13, 1, 2, 4, 5] }, l649Draw, 2);
    expect(r.cls).toBe(9);
    expect(r.label).toBe("2 + SZ");
    expect(r.amount).toBe(6);
  });

  it("6aus49: 3 without SZ = class 8; missing ticket SZ is flagged", () => {
    const r = checkField({ main: [3, 13, 16, 1, 2, 4] }, l649Draw, null);
    expect(r.cls).toBe(8);
    expect(r.szUnknown).toBe(true);
    expect(r.szMatch).toBeNull();
  });

  it("6aus49: 6 + SZ = class 1, 6 without SZ = class 2", () => {
    expect(checkField({ main: l649Draw.main }, l649Draw, 2).cls).toBe(1);
    expect(checkField({ main: l649Draw.main }, l649Draw, 7).cls).toBe(2);
  });
});

describe("CSV import", () => {
  it("parses the daowa89 archive format with header", () => {
    const r = parseDrawCsv("649", "date,n1,n2,n3,n4,n5,n6,superzahl\n2026-11-04,3,13,16,28,44,49,2\n1990-01-06,1,2,3,4,5,6,\n");
    expect(r.errors).toEqual([]);
    expect(r.draws).toHaveLength(2);
    expect(r.draws[1]!.superzahl).toBeNull();
  });

  it("parses EuroJackpot with German dates and semicolons", () => {
    const r = parseDrawCsv("ej", "03.11.2026;43;2;5;12;32;3;1");
    expect(r.errors).toEqual([]);
    expect(r.draws[0]).toMatchObject({ date: "2026-11-03", main: [2, 5, 12, 32, 43], euro: [1, 3], euroPool: 12 });
  });

  it("reports row errors instead of guessing", () => {
    const r = parseDrawCsv(
      "ej",
      ["2026-11-03,2,5,12,32,51,1,3", "2026-11-04,2,5,12,32,43,1,3", "2026-10-30,2,2,12,32,43,1,3", "2026-10-27,1,2,3,4,5,1", "xx,1,2,3,4,5,1,2", "2026-10-23,1,2,3,4,5,1,2", "2026-10-23,1,2,3,4,6,1,2"].join("\n"),
    );
    expect(r.errors.map((e) => e.code)).toEqual(["range", "drawDay", "duplicateNumber", "count", "date", "duplicateDate"]);
    expect(r.draws).toHaveLength(1);
  });

  it("uses the era pool for old EuroJackpot draws", () => {
    expect(ejEraOn("2013-05-03").euroPool).toBe(8);
    const r = parseDrawCsv("ej", "2013-05-03,1,2,3,4,5,9,10");
    expect(r.errors[0]!.code).toBe("range");
  });
});

describe("draw calendar", () => {
  it("draw days", () => {
    expect(isDrawDay("649", "2026-11-04")).toBe(true); // Wednesday
    expect(isDrawDay("649", "2026-11-03")).toBe(false);
    expect(isDrawDay("ej", "2026-11-03")).toBe(true); // Tuesday
    expect(isDrawDay("ej", "2019-05-07")).toBe(false); // Tuesday before 2022: no draw
    expect(isDrawDay("ej", "2019-05-10")).toBe(true);
  });

  it("next draw respects the acceptance hour in Berlin", () => {
    // 2026-11-04 is a Wednesday. 08:00 UTC = 09:00 Berlin → today; 20:00 UTC → Saturday.
    expect(nextDraw("649", new Date("2026-11-04T08:00:00Z"))).toBe("2026-11-04");
    expect(nextDraw("649", new Date("2026-11-04T20:00:00Z"))).toBe("2026-11-07");
    expect(nextDrawOnOrAfter("ej", "2026-11-04")).toBe("2026-11-06");
  });

  it("series and completeness", () => {
    expect(drawSeries("649", "2026-11-05", 3)).toEqual(["2026-11-07", "2026-11-11", "2026-11-14"]);
    const c = completeness("649", ["2026-10-28", "2026-11-04"]);
    expect(c?.missing).toEqual(["2026-10-31"]);
  });
});
