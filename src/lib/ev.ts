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
import { anyWin, atLeastOnce, totalCombinations } from "./odds";
import { GAMES, type GameId } from "./games";

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
