/**
 * Descriptive statistics of past draws and a Monte Carlo uniformity test.
 *
 * Expected count per number: E = D · k / N (D draws, k numbers per draw, pool N).
 * X² = Σ (O − E)² / E. Numbers inside one draw are drawn without replacement,
 * so the classic χ²(N−1) is only approximate; the p-value is therefore
 * computed by simulating `sims` random histories of the same length with the
 * same unbiased generator: p = (1 + #{X²_sim ≥ X²_obs}) / (1 + sims).
 */
import { binom } from "./odds";
import { createCryptoRandomInt, type RandomInt } from "./rng";

export interface FrequencyRow {
  number: number;
  observed: number;
  expected: number;
  difference: number;
  /** Latest draw date containing the number, null if never drawn. */
  lastDrawn: string | null;
}

/**
 * @param draws list of [date, numbers] in chronological order
 * @param k numbers per draw, @param pool numbers 1..pool (or 0..pool-1 when zeroBased)
 */
export function frequencies(
  draws: { date: string; numbers: number[] }[],
  k: number,
  pool: number,
  zeroBased = false,
): FrequencyRow[] {
  const offset = zeroBased ? 0 : 1;
  const counts = new Array<number>(pool).fill(0);
  const last = new Array<string | null>(pool).fill(null);
  for (const d of draws) {
    for (const n of d.numbers) {
      const i = n - offset;
      if (i < 0 || i >= pool) continue;
      counts[i]!++;
      if (last[i] === null || d.date > (last[i] as string)) last[i] = d.date;
    }
  }
  const expected = (draws.length * k) / pool;
  return counts.map((observed, i) => ({
    number: i + offset,
    observed,
    expected,
    difference: observed - expected,
    lastDrawn: last[i] ?? null,
  }));
}

export function chiSquare(observed: number[], expected: number): number {
  if (expected <= 0) return 0;
  let s = 0;
  for (const o of observed) s += ((o - expected) * (o - expected)) / expected;
  return s;
}

export interface UniformityResult {
  statistic: number;
  pValue: number;
  sims: number;
  draws: number;
}

/**
 * Monte Carlo p-value for the uniformity of number frequencies.
 * Simulates `sims` histories of `draws` draws of k distinct numbers from `pool`.
 * Optional `onProgress(done)` is called every 100 simulations.
 */
export function monteCarloUniformity(
  observed: number[],
  draws: number,
  k: number,
  pool: number,
  sims = 2000,
  rnd: RandomInt = createCryptoRandomInt(16384),
  onProgress?: (done: number) => void,
): UniformityResult {
  const expected = (draws * k) / pool;
  const obsStat = chiSquare(observed, expected);
  const counts = new Float64Array(pool);
  const arr = new Int32Array(pool);
  let atLeast = 0;
  // A partial Fisher–Yates shuffle yields a uniform k-subset from any starting
  // permutation, so the array is initialised once and reused across draws.
  for (let i = 0; i < pool; i++) arr[i] = i;
  for (let s = 0; s < sims; s++) {
    counts.fill(0);
    for (let d = 0; d < draws; d++) {
      for (let i = 0; i < k; i++) {
        const j = i + rnd(pool - i);
        const t = arr[i];
        arr[i] = arr[j]!;
        arr[j] = t!;
        counts[arr[i]!]!++;
      }
    }
    let stat = 0;
    for (let i = 0; i < pool; i++) stat += ((counts[i]! - expected) * (counts[i]! - expected)) / expected;
    if (stat >= obsStat - 1e-9) atLeast++;
    if (onProgress && (s + 1) % 100 === 0) onProgress(s + 1);
  }
  return { statistic: obsStat, pValue: (1 + atLeast) / (1 + sims), sims, draws };
}

/** Number of simulations that keeps the work bounded (~2·10^7 random picks). */
export function suggestedSims(draws: number, k: number): number {
  if (draws <= 0) return 0;
  return Math.max(200, Math.min(2000, Math.floor(2e7 / (draws * k) / 100) * 100));
}

/** Exact distribution of the number of even numbers among k drawn from 1..pool. */
export function evenCountDistribution(k: number, pool: number): number[] {
  const evens = Math.floor(pool / 2);
  const odds = pool - evens;
  const total = binom(pool, k);
  return Array.from({ length: k + 1 }, (_, e) => (binom(evens, e) * binom(odds, k - e)) / total);
}

/**
 * Exact distribution of the sum of k distinct numbers from 1..pool.
 * Returns probabilities indexed by sum (0..maxSum).
 */
export function sumDistribution(k: number, pool: number): number[] {
  const maxSum = (k * (2 * pool - k + 1)) / 2;
  // ways[j][s] = number of j-subsets with sum s, built number by number
  let ways: number[][] = Array.from({ length: k + 1 }, () => new Array<number>(maxSum + 1).fill(0));
  ways[0]![0] = 1;
  for (let n = 1; n <= pool; n++) {
    const next = ways.map((row) => row.slice());
    for (let j = 1; j <= k; j++) {
      const prev = ways[j - 1]!;
      const cur = next[j]!;
      for (let s = n; s <= maxSum; s++) cur[s]! += prev[s - n]!;
    }
    ways = next;
  }
  const total = binom(pool, k);
  return ways[k]!.map((w) => w / total);
}

/** Groups an exact sum distribution into buckets of `width` starting at `min`. */
export function bucketize(probBySum: number[], width: number): { from: number; to: number; p: number }[] {
  const first = probBySum.findIndex((p) => p > 0);
  const out: { from: number; to: number; p: number }[] = [];
  for (let from = first; from < probBySum.length; from += width) {
    const to = Math.min(from + width - 1, probBySum.length - 1);
    let p = 0;
    for (let s = from; s <= to; s++) p += probBySum[s]!;
    out.push({ from, to, p });
  }
  return out;
}

/** Share of numbers in 1..pool ending in each digit 0..9 (= expected share among drawn numbers). */
export function lastDigitExpected(pool: number): number[] {
  const c = new Array<number>(10).fill(0);
  for (let n = 1; n <= pool; n++) c[n % 10]!++;
  return c.map((x) => x / pool);
}

/** Typical range of a single count under random draws: E ± 2·sd (hypergeometric marginal). */
export function typicalBand(draws: number, k: number, pool: number): { low: number; high: number } {
  const p = k / pool;
  const mean = draws * p;
  const sd = Math.sqrt(draws * p * (1 - p));
  return { low: Math.max(0, mean - 2 * sd), high: mean + 2 * sd };
}
