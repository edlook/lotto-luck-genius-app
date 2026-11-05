/**
 * Generator state that survives switching screens and games during the session (not stored):
 * the last result per game, mode and number of fields.
 */
import type { GameId } from "@/lib/games";
import type { GeneratorMode } from "@/lib/generator";

export interface Generated {
  /** Changes on every generation: rows re-mount and play the short entrance. */
  run: number;
  fields: { main: number[]; euro?: number[] }[];
}

const results = new Map<GameId, Generated>();
let mode: GeneratorMode = "rare";
let count = 1;
let run = 0;

export const generatorSession = {
  results: (): Map<GameId, Generated> => new Map(results),
  save(game: GameId, fields: Generated["fields"]): Map<GameId, Generated> {
    results.set(game, { run: ++run, fields });
    return new Map(results);
  },
  mode: () => mode,
  setMode: (m: GeneratorMode) => void (mode = m),
  count: () => count,
  setCount: (n: number) => void (count = n),
};
