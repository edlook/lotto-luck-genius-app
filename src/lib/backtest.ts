/**
 * Walk-forward check of "strategies" on a real draw archive.
 *
 * For draw N a strategy sees ONLY draws 0..N-1 and picks one ticket of k numbers from 1..pool.
 * The ticket is compared with draw N. Under independence the number of matches X of every single
 * ticket is hypergeometric whatever the history was:
 *     P(X = j) = C(k, j) · C(pool − k, k − j) / C(pool, k),
 *     E[X] = k² / pool,   Var[X] = k · (k/pool) · (1 − k/pool) · (pool − k) / (pool − 1).
 * The tickets depend on the past but each X is conditionally hypergeometric given the past, so the
 * sum over T draws has exactly variance T · Var[X] (martingale differences). The 95 % band of the
 * mean under pure chance is therefore  E[X] ± 1.96 · sd / sqrt(T).
 *
 * Only the main numbers are evaluated (EuroJackpot: Euro numbers are ignored).
 */
import { binom } from "./odds";
import { createSeededInt } from "./seededRng";

export type StrategyId = "hot" | "hot100" | "cold" | "cold100" | "overdue" | "repeat" | "random";

/** Strategies that use the history, in display order; "random" is the control and comes last. */
export const HISTORY_STRATEGIES = ["hot", "hot100", "cold", "cold100", "overdue", "repeat"] as const;
export type HistoryStrategyId = (typeof HISTORY_STRATEGIES)[number];
export const STRATEGY_ORDER: StrategyId[] = [...HISTORY_STRATEGIES, "random"];

/** Window for the "last 100 draws" variants. */
export const WINDOW = 100;
/** Draws that are only used as history, never scored: every strategy is scored on the same draws. */
export const WARMUP = 100;
export const DEFAULT_RANDOM_RUNS = 200;
export const DEFAULT_SEED = 20261106;
/** Two-sided 95 % normal quantile. */
export const Z95 = 1.959964;

/** P(X = j), j = 0..k, for a ticket of k numbers against a draw of k from 1..pool. */
export function matchDistribution(pool: number, k: number): number[] {
  const total = binom(pool, k);
  return Array.from({ length: k + 1 }, (_, j) => (binom(k, j) * binom(pool - k, k - j)) / total);
}

export const expectedMatches = (pool: number, k: number): number => (k * k) / pool;

export function matchVariance(pool: number, k: number): number {
  const p = k / pool;
  return (k * p * (1 - p) * (pool - k)) / (pool - 1);
}

/** P(X >= j). */
export function matchTail(pool: number, k: number, j: number): number {
  return matchDistribution(pool, k)
    .slice(Math.max(0, j))
    .reduce((a, b) => a + b, 0);
}

/** Thresholds of the "hits by class" table; below them the main numbers alone win nothing. */
export const tailThresholds = (k: number): number[] => (k === 5 ? [2, 3, 4] : [3, 4, 5]);

/** Numbers 1..pool ordered by score (descending or ascending), ties by the smaller number. */
function topK(scores: ArrayLike<number>, pool: number, k: number, descending: boolean): number[] {
  const idx = Array.from({ length: pool }, (_, i) => i);
  idx.sort((a, b) => {
    const d = descending ? scores[b]! - scores[a]! : scores[a]! - scores[b]!;
    return d !== 0 ? d : a - b;
  });
  return idx
    .slice(0, k)
    .map((i) => i + 1)
    .sort((a, b) => a - b);
}

/** Everything a strategy may know: the draws before the one being predicted. */
export class History {
  private counts: Int32Array;
  private windowCounts: Int32Array;
  private lastSeen: Int32Array;
  private recent: number[][] = [];
  private last: number[] = [];
  n = 0;

  constructor(
    private readonly pool: number,
    private readonly k: number,
  ) {
    this.counts = new Int32Array(pool);
    this.windowCounts = new Int32Array(pool);
    this.lastSeen = new Int32Array(pool).fill(-1);
  }

  add(draw: readonly number[]): void {
    for (const x of draw) {
      this.counts[x - 1]!++;
      this.windowCounts[x - 1]!++;
      this.lastSeen[x - 1] = this.n;
    }
    this.recent.push([...draw]);
    if (this.recent.length > WINDOW) {
      for (const x of this.recent.shift()!) this.windowCounts[x - 1]!--;
    }
    this.last = [...draw].sort((a, b) => a - b);
    this.n++;
  }

  pick(id: HistoryStrategyId): number[] {
    const { pool, k } = this;
    switch (id) {
      case "hot":
        return topK(this.counts, pool, k, true);
      case "cold":
        return topK(this.counts, pool, k, false);
      case "hot100":
        return topK(this.windowCounts, pool, k, true);
      case "cold100":
        return topK(this.windowCounts, pool, k, false);
      case "overdue": {
        // gap = draws since the number last appeared; a number never seen has the longest gap
        const gaps = Array.from(this.lastSeen, (s) => this.n - s);
        return topK(gaps, pool, k, true);
      }
      case "repeat":
        return [...this.last];
    }
  }
}

/** The ticket a strategy plays for the draw after `history` (rebuilds the state from scratch). */
export function pickTicket(id: HistoryStrategyId, history: readonly (readonly number[])[], pool: number, k: number): number[] {
  const h = new History(pool, k);
  for (const d of history) h.add(d);
  return h.pick(id);
}

export function countMatches(ticket: readonly number[], draw: readonly number[]): number {
  let m = 0;
  for (const a of ticket) for (const b of draw) if (a === b) m++;
  return m;
}

export interface TailRow {
  atLeast: number;
  /** Draws with at least this many matches (random control: average per run). */
  observed: number;
  expected: number;
}

export interface StrategyResult {
  id: StrategyId;
  /** Scored tickets (random control: draws × runs). */
  tickets: number;
  mean: number;
  /** mean − expected value under chance. */
  diff: number;
  z: number;
  band: { low: number; high: number };
  /** True when the mean lies inside the 95 % band of pure chance. */
  within: boolean;
  shareAtLeast3: number;
  expectedShareAtLeast3: number;
  tails: TailRow[];
}

export interface RandomSummary {
  runs: number;
  minMean: number;
  maxMean: number;
  /** Share of single random runs outside their own 95 % band (about 5 % is expected). */
  outsideShare: number;
}

export interface BacktestResult {
  pool: number;
  k: number;
  /** Scored draws per strategy. */
  draws: number;
  warmup: number;
  expectedMean: number;
  sd: number;
  expectedShareAtLeast3: number;
  /** 95 % band of a single strategy's mean. */
  band: { low: number; high: number };
  strategies: StrategyResult[];
  random: RandomSummary;
  /** Chance that at least one of the strategies lands outside its band by luck alone. */
  anyOutsideByChance: number;
}

export interface BacktestOptions {
  warmup?: number;
  randomRuns?: number;
  seed?: number;
  /** 0..1 */
  onProgress?: (fraction: number) => void;
}

function summarize(
  id: StrategyId,
  hist: number[],
  tickets: number,
  perN: number,
  pool: number,
  k: number,
): StrategyResult {
  const mu = expectedMatches(pool, k);
  const sd = Math.sqrt(matchVariance(pool, k));
  const mean = hist.reduce((s, c, j) => s + c * j, 0) / tickets;
  const se = sd / Math.sqrt(tickets);
  const z = (mean - mu) / se;
  const p3 = matchTail(pool, k, 3);
  const ge = (j: number) => hist.slice(j).reduce((a, b) => a + b, 0);
  return {
    id,
    tickets,
    mean,
    diff: mean - mu,
    z,
    band: { low: mu - Z95 * se, high: mu + Z95 * se },
    within: Math.abs(z) <= Z95,
    shareAtLeast3: ge(3) / tickets,
    expectedShareAtLeast3: p3,
    tails: tailThresholds(k).map((t) => ({
      atLeast: t,
      observed: (ge(t) / tickets) * perN,
      expected: matchTail(pool, k, t) * perN,
    })),
  };
}

/**
 * @param draws main numbers of every draw, oldest first, each k distinct numbers from 1..pool
 */
export function runBacktest(
  draws: readonly (readonly number[])[],
  pool: number,
  k: number,
  { warmup = WARMUP, randomRuns = DEFAULT_RANDOM_RUNS, seed = DEFAULT_SEED, onProgress }: BacktestOptions = {},
): BacktestResult {
  const total = draws.length;
  const scored = total - warmup;
  if (scored < 1) throw new RangeError(`backtest: need more than ${warmup} draws, got ${total}`);

  const history = new History(pool, k);
  const hists = new Map<HistoryStrategyId, number[]>(HISTORY_STRATEGIES.map((s) => [s, new Array<number>(k + 1).fill(0)]));
  const randHist = new Array<number>(k + 1).fill(0);
  const runSums = new Float64Array(randomRuns);
  const rnd = createSeededInt(seed);
  const arr = Int32Array.from({ length: pool }, (_, i) => i);
  const mark = new Uint8Array(pool + 1);

  for (let i = 0; i < total; i++) {
    const draw = draws[i]!;
    if (i >= warmup) {
      for (const s of HISTORY_STRATEGIES) {
        hists.get(s)![countMatches(history.pick(s), draw)]!++;
      }
      for (const x of draw) mark[x] = 1;
      for (let r = 0; r < randomRuns; r++) {
        // partial Fisher–Yates: a uniform k-subset from any starting order
        let m = 0;
        for (let a = 0; a < k; a++) {
          const j = a + rnd(pool - a);
          const t = arr[a]!;
          arr[a] = arr[j]!;
          arr[j] = t;
          if (mark[arr[a]! + 1]) m++;
        }
        randHist[m]!++;
        runSums[r]! += m;
      }
      for (const x of draw) mark[x] = 0;
    }
    // only now does the draw become history, i.e. visible to the NEXT prediction
    history.add(draw);
    if (onProgress && i % 50 === 0) onProgress(i / total);
  }

  const mu = expectedMatches(pool, k);
  const sd = Math.sqrt(matchVariance(pool, k));
  const strategies: StrategyResult[] = HISTORY_STRATEGIES.map((s) => summarize(s, hists.get(s)!, scored, scored, pool, k));
  strategies.push(summarize("random", randHist, scored * randomRuns, scored, pool, k));

  const se1 = sd / Math.sqrt(scored);
  const runMeans = Array.from(runSums, (s) => s / scored);
  const outside = runMeans.filter((m) => Math.abs(m - mu) > Z95 * se1).length;
  onProgress?.(1);
  return {
    pool,
    k,
    draws: scored,
    warmup,
    expectedMean: mu,
    sd,
    expectedShareAtLeast3: matchTail(pool, k, 3),
    band: { low: mu - Z95 * se1, high: mu + Z95 * se1 },
    strategies,
    random: {
      runs: randomRuns,
      minMean: Math.min(...runMeans),
      maxMean: Math.max(...runMeans),
      outsideShare: outside / randomRuns,
    },
    anyOutsideByChance: 1 - 0.95 ** HISTORY_STRATEGIES.length,
  };
}

/** Matches of every history strategy for every scored draw (for the no-peeking test). */
export function walkForwardMatches(
  draws: readonly (readonly number[])[],
  pool: number,
  k: number,
  id: HistoryStrategyId,
  warmup = WARMUP,
): number[] {
  const h = new History(pool, k);
  const out: number[] = [];
  draws.forEach((d, i) => {
    if (i >= warmup) out.push(countMatches(h.pick(id), d));
    h.add(d);
  });
  return out;
}
