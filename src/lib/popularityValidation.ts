/**
 * Does the "popularity" of the drawn numbers show up in the real prize payouts of EuroJackpot?
 *
 * For one draw and one prize class "k+m":
 *   fields   = stake of the main lottery / price of one field            (games.ts: 2 €)
 *   expected = fields · P(class)       P from the exact counting of ./odds for the Euro pool of the era
 *   index    = observed winners / expected                              (1 = as many as pure chance of picks)
 * If many players choose "calendar" numbers (1..31), a draw with many numbers ≤ 31 has more winners
 * in the lower classes, so its index is above 1; a draw of high numbers has fewer.
 *
 * The primary class is fixed in advance (see PRIMARY_CLASS); the other classes are shown only as a
 * consistency check and never decide the verdict. Resampling uses a fixed seed: same data, same result.
 */
import { classCombinations, binom } from "./odds";
import { GAMES } from "./games";
import { evaluatePopularity } from "./popularity";
import { createSeededRandom } from "./seededRng";

/**
 * "3 main numbers, no Euro number": ~55 000 winners per draw (Poisson noise below 1 %) and the
 * only well-populated class that does not depend on which Euro numbers were drawn.
 */
export const PRIMARY_CLASS = "3+0";
/** Shown as a consistency check; 4+0 has few winners, the others depend on the Euro numbers too. */
export const CHECK_CLASSES = ["3+0", "4+0", "3+1", "2+1", "2+2", "1+2"] as const;

/** Numbers up to this value can be birthdays (day of month). */
export const CALENDAR_MAX = 31;
/** "Popular look": at least this many of the 5 numbers are ≤ 31. */
export const POPULAR_MIN_LOW = 4;
/** "Unpopular look": at most this many of the 5 numbers are ≤ 31. */
export const UNPOPULAR_MAX_LOW = 2;
/** Standardised difference from which a significant effect counts as "confirmed" (medium effect). */
export const CONFIRMED_D = 0.5;

export const DEFAULT_BOOTSTRAPS = 5000;
export const DEFAULT_VALIDATION_SEED = 20261106;

export interface ValidationDraw {
  date: string;
  main: number[];
  euroPool: number;
  /** Stake of the main lottery in EUR. */
  stake: number | null | undefined;
  /** [label "k+m", winners, amount EUR] */
  quotes: [string, number, number][] | undefined;
}

/** Probability of one field landing in class "k+m" when Euro numbers are 2 of `euroPool`. */
export function classProbability(label: string, euroPool: number): number {
  const [main, euro] = label.split("+").map(Number) as [number, number];
  const game = { ...GAMES.ej, extraPool: euroPool };
  const total = binom(game.mainPool, game.mainCount) * binom(euroPool, game.extraCount);
  return classCombinations(game, main, euro) / total;
}

export interface DrawRow {
  date: string;
  low: number;
  fields: number;
  /** observed / expected per class label */
  index: Record<string, number>;
  /** winners per class label */
  winners: Record<string, number>;
  /** amount per winner (EUR) per class label */
  payout: Record<string, number>;
  /** Rare rules of popularity.ts met by the drawn main numbers. */
  progression: boolean;
  consecutive: boolean;
  multiples: boolean;
}

/** Draws without a usable stake or quota table are skipped (their number is reported). */
export function buildRows(draws: readonly ValidationDraw[], labels: readonly string[] = CHECK_CLASSES): {
  rows: DrawRow[];
  skipped: number;
} {
  const rows: DrawRow[] = [];
  let skipped = 0;
  const price = GAMES.ej.price;
  for (const d of draws) {
    const stake = d.stake ?? 0;
    const quotes = new Map((d.quotes ?? []).map(([l, w, a]) => [l, { w, a }]));
    if (!(stake > 0) || labels.some((l) => !quotes.has(l))) {
      skipped++;
      continue;
    }
    const fields = stake / price;
    const index: Record<string, number> = {};
    const payout: Record<string, number> = {};
    const winners: Record<string, number> = {};
    for (const l of labels) {
      winners[l] = quotes.get(l)!.w;
      index[l] = quotes.get(l)!.w / (fields * classProbability(l, d.euroPool));
      payout[l] = quotes.get(l)!.a;
    }
    const report = evaluatePopularity("ej", d.main, { pastWinning: null });
    const hit = (id: string) => report.rules.find((r) => r.id === id)?.status === "triggered";
    rows.push({
      date: d.date,
      low: d.main.filter((n) => n <= CALENDAR_MAX).length,
      fields,
      index,
      winners,
      payout,
      progression: hit("progression"),
      consecutive: hit("consecutive"),
      multiples: hit("multiples"),
    });
  }
  return { rows, skipped };
}

// ---- small statistics -------------------------------------------------------------------------

export const mean = (a: readonly number[]): number => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);

export function variance(a: readonly number[]): number {
  if (a.length < 2) return NaN;
  const m = mean(a);
  return a.reduce((s, v) => s + (v - m) * (v - m), 0) / (a.length - 1);
}

export function pearson(x: readonly number[], y: readonly number[]): number {
  const mx = mean(x);
  const my = mean(y);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < x.length; i++) {
    const dx = x[i]! - mx;
    const dy = y[i]! - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
}

function percentiles(sorted: Float64Array, lo: number, hi: number): [number, number] {
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * sorted.length)))]!;
  return [at(lo), at(hi)];
}

export interface DifferenceResult {
  /** mean(a) − mean(b) */
  value: number;
  low: number;
  high: number;
  /** Standardised difference (Cohen's d, pooled sd). */
  d: number;
  /** Two-sided permutation p-value. */
  pPerm: number;
  nA: number;
  nB: number;
}

/** Difference of two group means: percentile bootstrap 95 % interval (each group resampled on its own) + permutation test. */
export function compareGroups(
  a: readonly number[],
  b: readonly number[],
  rnd: () => number,
  boots = DEFAULT_BOOTSTRAPS,
  withPermutation = true,
): DifferenceResult {
  const value = mean(a) - mean(b);
  const pooledVar = ((a.length - 1) * variance(a) + (b.length - 1) * variance(b)) / (a.length + b.length - 2);
  const d = pooledVar > 0 ? value / Math.sqrt(pooledVar) : 0;
  const diffs = new Float64Array(boots);
  for (let i = 0; i < boots; i++) {
    let sa = 0;
    for (let j = 0; j < a.length; j++) sa += a[Math.floor(rnd() * a.length)]!;
    let sb = 0;
    for (let j = 0; j < b.length; j++) sb += b[Math.floor(rnd() * b.length)]!;
    diffs[i] = sa / a.length - sb / b.length;
  }
  diffs.sort();
  const [low, high] = percentiles(diffs, 0.025, 0.975);
  let pPerm = NaN;
  if (withPermutation) {
    const all = [...a, ...b];
    let extreme = 0;
    for (let i = 0; i < boots; i++) {
      for (let j = all.length - 1; j > 0; j--) {
        const r = Math.floor(rnd() * (j + 1));
        const t = all[j]!;
        all[j] = all[r]!;
        all[r] = t;
      }
      let sa = 0;
      for (let j = 0; j < a.length; j++) sa += all[j]!;
      const diff = sa / a.length - (all.reduce((s, v) => s + v, 0) - sa) / b.length;
      if (Math.abs(diff) >= Math.abs(value) - 1e-12) extreme++;
    }
    pPerm = (1 + extreme) / (1 + boots);
  }
  return { value, low, high, d, pPerm, nA: a.length, nB: b.length };
}

export interface CorrelationResult {
  r: number;
  low: number;
  high: number;
  pPerm: number;
  n: number;
}

/** Pearson r with a pair-resampling bootstrap interval and a permutation p-value. */
export function correlate(x: readonly number[], y: readonly number[], rnd: () => number, boots = DEFAULT_BOOTSTRAPS): CorrelationResult {
  const n = x.length;
  const r = pearson(x, y);
  const rs = new Float64Array(boots);
  const bx = new Array<number>(n);
  const by = new Array<number>(n);
  for (let i = 0; i < boots; i++) {
    for (let j = 0; j < n; j++) {
      const q = Math.floor(rnd() * n);
      bx[j] = x[q]!;
      by[j] = y[q]!;
    }
    rs[i] = pearson(bx, by);
  }
  rs.sort();
  const [low, high] = percentiles(rs, 0.025, 0.975);
  const shuffled = [...y];
  let extreme = 0;
  for (let i = 0; i < boots; i++) {
    for (let j = n - 1; j > 0; j--) {
      const q = Math.floor(rnd() * (j + 1));
      const t = shuffled[j]!;
      shuffled[j] = shuffled[q]!;
      shuffled[q] = t;
    }
    if (Math.abs(pearson(x, shuffled)) >= Math.abs(r) - 1e-12) extreme++;
  }
  return { r, low, high, pPerm: (1 + extreme) / (1 + boots), n };
}

// ---- verdict ----------------------------------------------------------------------------------

export type PopularityVerdict = "confirmed" | "weak" | "notDetected" | "opposite";

/**
 * Decided only by the primary comparison, with thresholds fixed in advance:
 * interval above 0 and d ≥ 0.5 → confirmed; interval above 0 and smaller d → weak;
 * interval contains 0 → not detected; interval below 0 → opposite (against the rule).
 */
export function verdictOf(diff: Pick<DifferenceResult, "low" | "high" | "d">): PopularityVerdict {
  if (diff.low > 0) return diff.d >= CONFIRMED_D ? "confirmed" : "weak";
  if (diff.high < 0) return "opposite";
  return "notDetected";
}

// ---- the analysis -----------------------------------------------------------------------------

export interface ClassCheck {
  label: string;
  /** Mean winners per draw in the class. */
  meanWinners: number;
  popularMean: number;
  unpopularMean: number;
  diff: DifferenceResult;
}

export interface GroupStat {
  n: number;
  meanIndex: number;
}

export interface PopularityValidation {
  n: number;
  skipped: number;
  from: string;
  to: string;
  seed: number;
  boots: number;
  primaryClass: string;
  meanIndex: number;
  sdIndex: number;
  popular: GroupStat;
  unpopular: GroupStat;
  middle: GroupStat;
  difference: DifferenceResult;
  correlation: CorrelationResult;
  verdict: PopularityVerdict;
  byLow: { low: number; n: number; meanIndex: number }[];
  /** How many draws met each rare rule: too few to measure anything. */
  rare: { progression: number; consecutive: number; multiples: number };
  checks: ClassCheck[];
  /** Second metric: amount per winner of the primary class, in EUR. */
  payout: { popularMean: number; unpopularMean: number; overallMean: number; diff: DifferenceResult };
}

export interface AnalyseOptions {
  seed?: number;
  boots?: number;
  onProgress?: (fraction: number) => void;
}

export function analysePopularity(
  draws: readonly ValidationDraw[],
  { seed = DEFAULT_VALIDATION_SEED, boots = DEFAULT_BOOTSTRAPS, onProgress }: AnalyseOptions = {},
): PopularityValidation | null {
  const { rows, skipped } = buildRows(draws);
  const popular = rows.filter((r) => r.low >= POPULAR_MIN_LOW);
  const unpopular = rows.filter((r) => r.low <= UNPOPULAR_MAX_LOW);
  if (popular.length < 10 || unpopular.length < 10) return null;
  const rnd = createSeededRandom(seed);
  const idx = (rs: DrawRow[], l: string) => rs.map((r) => r.index[l]!);
  const P = PRIMARY_CLASS;

  const difference = compareGroups(idx(popular, P), idx(unpopular, P), rnd, boots);
  onProgress?.(0.25);
  const correlation = correlate(
    rows.map((r) => r.low),
    idx(rows, P),
    rnd,
    boots,
  );
  onProgress?.(0.55);

  const small = Math.max(500, Math.round(boots / 5));
  const checks: ClassCheck[] = CHECK_CLASSES.map((label, i) => {
    const out: ClassCheck = {
      label,
      meanWinners: mean(rows.map((r) => r.winners[label]!)),
      popularMean: mean(idx(popular, label)),
      unpopularMean: mean(idx(unpopular, label)),
      diff: compareGroups(idx(popular, label), idx(unpopular, label), rnd, small, false),
    };
    onProgress?.(0.55 + (0.35 * (i + 1)) / CHECK_CLASSES.length);
    return out;
  });

  const pay = (rs: DrawRow[]) => rs.map((r) => r.payout[P]!);
  const payout = {
    popularMean: mean(pay(popular)),
    unpopularMean: mean(pay(unpopular)),
    overallMean: mean(pay(rows)),
    diff: compareGroups(pay(popular), pay(unpopular), rnd, small, false),
  };

  const all = idx(rows, P);
  const group = (rs: DrawRow[]): GroupStat => ({ n: rs.length, meanIndex: mean(idx(rs, P)) });
  onProgress?.(1);
  return {
    n: rows.length,
    skipped,
    from: rows[0]!.date,
    to: rows[rows.length - 1]!.date,
    seed,
    boots,
    primaryClass: P,
    meanIndex: mean(all),
    sdIndex: Math.sqrt(variance(all)),
    popular: group(popular),
    unpopular: group(unpopular),
    middle: group(rows.filter((r) => r.low > UNPOPULAR_MAX_LOW && r.low < POPULAR_MIN_LOW)),
    difference,
    correlation,
    verdict: verdictOf(difference),
    byLow: [0, 1, 2, 3, 4, 5].map((low) => {
      const rs = rows.filter((r) => r.low === low);
      return { low, n: rs.length, meanIndex: rs.length ? mean(idx(rs, P)) : NaN };
    }),
    rare: {
      progression: rows.filter((r) => r.progression).length,
      consecutive: rows.filter((r) => r.consecutive).length,
      multiples: rows.filter((r) => r.multiples).length,
    },
    checks,
    payout,
  };
}
