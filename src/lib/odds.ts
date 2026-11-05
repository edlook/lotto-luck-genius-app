/**
 * Exact prize-class probabilities (hypergeometric counting).
 *
 * EuroJackpot, class "k + m":  C(5,k)·C(P-5,5-k) · C(2,m)·C(E-2,2-m),  total C(P,5)·C(E,2)
 * Lotto 6aus49, class "k + SZ": C(6,k)·C(43,6-k)·1, class "k": ·9,      total C(49,6)·10
 * (research-company.md 4.1 / 4.2; the results match the official lotto.de tables).
 */
import { GAMES, type GameConfig, type GameId, type PrizeClass } from "./games";

/** Binomial coefficient, exact for every value used here (all < 2^53). */
export function binom(n: number, k: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(k)) throw new RangeError("binom: integers only");
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let r = 1;
  for (let i = 1; i <= k; i++) {
    // r * (n - k + i) is divisible by i at every step
    r = (r * (n - k + i)) / i;
  }
  return Math.round(r);
}

export interface ClassOdds extends PrizeClass {
  /** Number of favourable combinations. */
  combinations: number;
  /** Total number of combinations. */
  total: number;
  probability: number;
  /** "1 in …" = total / combinations. */
  oneIn: number;
}

export function totalCombinations(game: GameConfig): number {
  const main = binom(game.mainPool, game.mainCount);
  if (game.hasSuperzahl) return main * 10;
  return main * binom(game.extraPool, game.extraCount);
}

export function classCombinations(game: GameConfig, main: number, extra: number): number {
  const mainWays = binom(game.mainCount, main) * binom(game.mainPool - game.mainCount, game.mainCount - main);
  if (game.hasSuperzahl) return mainWays * (extra === 1 ? 1 : 9);
  return (
    mainWays * binom(game.extraCount, extra) * binom(game.extraPool - game.extraCount, game.extraCount - extra)
  );
}

export function classOdds(gameOrId: GameConfig | GameId): ClassOdds[] {
  const game = typeof gameOrId === "string" ? GAMES[gameOrId] : gameOrId;
  const total = totalCombinations(game);
  return game.classes.map((c) => {
    const combinations = classCombinations(game, c.main, c.extra);
    return { ...c, combinations, total, probability: combinations / total, oneIn: total / combinations };
  });
}

export interface AnyWin {
  combinations: number;
  total: number;
  probability: number;
  oneIn: number;
}

/** Probability that one field wins in any class (sum of all classes). */
export function anyWin(gameOrId: GameConfig | GameId): AnyWin {
  const rows = classOdds(gameOrId);
  const combinations = rows.reduce((s, r) => s + r.combinations, 0);
  const total = rows[0]!.total;
  return { combinations, total, probability: combinations / total, oneIn: total / combinations };
}

/** P(at least one success in n independent tries), numerically stable for tiny p. */
export function atLeastOnce(p: number, n: number): number {
  if (n <= 0 || p <= 0) return 0;
  if (p >= 1) return 1;
  return -Math.expm1(n * Math.log1p(-p));
}
