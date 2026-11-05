/**
 * Combination generator.
 *
 * - "random": uniform over all combinations (crypto.getRandomValues).
 * - "rare": rejection sampling — draw uniformly, discard the combination if
 *   ANY popularity rule fires, repeat. The result is uniform over the
 *   accepted ("low popularity") set. The chance of winning is unchanged.
 * The Superzahl is never generated (it is the last digit of the slip number).
 */
import { GAMES, type GameConfig, type GameId } from "./games";
import { evaluatePopularity, type PastWinningIndex, type PopularityReport } from "./popularity";
import { randomInt, sampleDistinct, type RandomInt } from "./rng";

export type GeneratorMode = "rare" | "random";

export interface GeneratedField {
  main: number[];
  /** Euro numbers (EuroJackpot only). */
  euro?: number[];
  report: PopularityReport;
}

export interface GenerateOptions {
  mode: GeneratorMode;
  pastWinning: PastWinningIndex | null;
  rnd?: RandomInt;
  /** Safety cap for rejection sampling. The acceptance rate is far above 1/1000. */
  maxAttempts?: number;
}

export class GenerationError extends Error {}

export function generateField(gameOrId: GameConfig | GameId, opts: GenerateOptions): GeneratedField {
  const game = typeof gameOrId === "string" ? GAMES[gameOrId] : gameOrId;
  const rnd = opts.rnd ?? randomInt;
  const max = opts.maxAttempts ?? 10_000;
  for (let i = 0; i < max; i++) {
    const main = sampleDistinct(game.mainCount, game.mainPool, rnd);
    const report = evaluatePopularity(game, main, { pastWinning: opts.pastWinning });
    if (opts.mode === "random" || report.level === "low") {
      const euro = game.extraCount > 0 ? sampleDistinct(game.extraCount, game.extraPool, rnd) : undefined;
      return euro ? { main, euro, report } : { main, report };
    }
  }
  throw new GenerationError("No combination passed the popularity rules");
}

export function generateFields(gameOrId: GameConfig | GameId, count: number, opts: GenerateOptions): GeneratedField[] {
  const out: GeneratedField[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (out.length < count) {
    const f = generateField(gameOrId, opts);
    const key = `${f.main.join("-")}|${f.euro?.join("-") ?? ""}`;
    if (!seen.has(key) || ++guard > 100) {
      seen.add(key);
      out.push(f);
    }
  }
  return out;
}

/** Text form used for "copy": "3 14 22 31 40 | Euro 2 9". */
export function fieldToText(field: { main: number[]; euro?: number[] }, euroLabel = "Euro"): string {
  const main = field.main.join(" ");
  return field.euro?.length ? `${main} | ${euroLabel} ${field.euro.join(" ")}` : main;
}
