/**
 * Expected value of a field and the yearly spending calculator.
 *
 * Assumptions (shown in the UI next to the result):
 * - EV ≈ payoutShare × price. This is the long-run average over all draws.
 *   The real value of a single draw depends on the jackpot, rollovers, the
 *   number of winners and fixed prizes (6aus49 class 9 = 6 €).
 * - The slip fee is a cost with no return: it lowers EV one-to-one.
 * - Yearly fee is entered "per draw" (one slip per draw day).
 * - Probabilities for the year assume independent draws and distinct fields.
 */
import { anyWin, atLeastOnce, classCombinations, totalCombinations } from "./odds";
import { GAMES, type GameId } from "./games";
import { CURRENT_EJ_ERA } from "./eras";
import type { Draw } from "./ticketCheck";

export interface EvInput {
  price: number;
  /** 0..1, or null when not confirmed. */
  payoutShare: number | null;
  /** Slip fee per field, EUR (optional). */
  feePerField?: number;
}

export interface EvResult {
  /** Expected return per field without fee, EUR. null when payoutShare is unknown. */
  expectedReturn: number | null;
  /** Expected return per field after the fee, EUR. */
  expectedReturnAfterFee: number | null;
  /** Expected loss per field including fee, EUR. */
  expectedLoss: number | null;
}

export function fieldEv({ price, payoutShare, feePerField = 0 }: EvInput): EvResult {
  if (payoutShare === null || !Number.isFinite(payoutShare)) {
    return { expectedReturn: null, expectedReturnAfterFee: null, expectedLoss: null };
  }
  const expectedReturn = payoutShare * price;
  return {
    expectedReturn,
    expectedReturnAfterFee: expectedReturn - feePerField,
    expectedLoss: price + feePerField - expectedReturn,
  };
}

export interface YearInput {
  game: GameId;
  fieldsPerDraw: number;
  drawsPerWeek: number;
  weeks: number;
  price: number;
  /** Slip fee per draw, EUR. */
  feePerDraw: number;
  payoutShare: number | null;
}

export interface YearResult {
  fields: number;
  draws: number;
  stakes: number;
  fees: number;
  spent: number;
  expectedReturn: number | null;
  expectedLoss: number | null;
  pJackpot: number;
  pAnyWin: number;
}

export function yearCost(input: YearInput): YearResult {
  const draws = input.drawsPerWeek * input.weeks;
  const fields = input.fieldsPerDraw * draws;
  const stakes = round2(fields * input.price);
  const fees = round2(draws * input.feePerDraw);
  const spent = round2(stakes + fees);
  const expectedReturn = input.payoutShare === null ? null : round2(stakes * input.payoutShare);
  const expectedLoss = expectedReturn === null ? null : round2(spent - expectedReturn);
  const pJack = 1 / totalCombinations(GAMES[input.game]);
  return {
    fields,
    draws,
    stakes,
    fees,
    spent,
    expectedReturn,
    expectedLoss,
    pJackpot: atLeastOnce(pJack, fields),
    pAnyWin: atLeastOnce(anyWin(input.game).probability, fields),
  };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/* ---------- EuroJackpot: expected return of a field at a given jackpot ---------- */

/** Largest EuroJackpot jackpot (lotto.de rules page, research-company.md 4.1). */
export const EJ_JACKPOT_CAP = 120_000_000;
/** Number of recent draws whose official quotas are averaged for classes 2…12. */
export const QUOTA_WINDOW = 52;

export interface JackpotEv {
  /** Jackpot assumed in the calculation, EUR. */
  jackpot: number;
  /** Price of one field, EUR. */
  price: number;
  /** Expected return of one field, EUR: otherTerm + jackpotTerm. */
  ev: number;
  /** Share of the jackpot in the expected return, with the sharing between winners. */
  jackpotTerm: number;
  /** Classes 2…12: Σ p_c · mean quota of class c. */
  otherTerm: number;
  /** Fields of the latest draw (stake / price) and the expected number of jackpot winners. */
  fields: number;
  lambda: number;
  /** Draws averaged for the quotas. */
  quotaDraws: number;
}

/**
 * Expected return of one EuroJackpot field when the jackpot is `jackpot` (guide-copy.md 7.3):
 *
 *   p1          = 1 / 139 838 160
 *   F           = stake of the latest draw / price of a field        (≈ number of fields played)
 *   λ           = F · p1                                            (expected jackpot winners)
 *   jackpotTerm = J · (1 − e^−λ) / F        = p1 · J · (1 − e^−λ) / λ
 *                 (a field that wins shares the jackpot with the other winners; with Poisson
 *                 winners the mean prize per field is J (1 − e^−λ) / F, close to J · p1 for small λ)
 *   otherTerm   = Σ over classes 2…12 of p_c · Q_c
 *                 Q_c = mean official quota of class c over the last 52 draws of the current era,
 *                 taken over draws where the class had winners (the quota is the prize per winner,
 *                 a draw without winners has none to average).
 *   ev          = otherTerm + jackpotTerm
 *
 * Returns null when the data is not enough (no stake in the latest draw, fewer than the full
 * 12 classes in the quotas, or a class without any quota in the window): no number is better
 * than a wrong one.
 */
export function ejFieldEvAtJackpot(draws: readonly Draw[], jackpot: number): JackpotEv | null {
  if (!(jackpot > 0)) return null;
  const era = CURRENT_EJ_ERA;
  const price = GAMES.ej.price;
  const recent = draws.filter((d) => d.game === "ej" && d.date >= era.from && (d.quotes?.length ?? 0) === 12).slice(-QUOTA_WINDOW);
  const last = recent[recent.length - 1];
  if (!last || !(last.stake && last.stake > 0)) return null;

  const fields = last.stake / price;
  const p1 = 1 / totalCombinations(GAMES.ej);
  const lambda = fields * p1;
  const jackpotTerm = (jackpot * (1 - Math.exp(-lambda))) / fields;

  // Probabilities of the classes of the current era (2 Euro numbers out of 12).
  const game = { ...GAMES.ej, extraPool: era.euroPool };
  const total = totalCombinations(game);
  const sums = new Map<string, { sum: number; n: number }>();
  for (const d of recent)
    for (const [label, , amount] of d.quotes ?? []) {
      if (label === "5+2" || !(amount > 0)) continue;
      const s = sums.get(label) ?? { sum: 0, n: 0 };
      s.sum += amount;
      s.n++;
      sums.set(label, s);
    }
  if (sums.size !== 11) return null;
  let otherTerm = 0;
  for (const [label, { sum, n }] of sums) {
    const [main, euro] = label.split("+").map(Number) as [number, number];
    otherTerm += (classCombinations(game, main, euro) / total) * (sum / n);
  }
  return { jackpot, price, ev: otherTerm + jackpotTerm, jackpotTerm, otherTerm, fields, lambda, quotaDraws: recent.length };
}
