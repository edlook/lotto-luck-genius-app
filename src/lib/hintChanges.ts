/**
 * Replacement suggestions for the tips of the "Check yours" tab: which one or two numbers of a
 * combination could be swapped so that a popularity rule stops applying (guide-copy.md 7.2 / 7.3).
 *
 * Only the popularity estimate is used (`evaluatePopularity`): the suggestion says how often other
 * players tend to choose a combination, never that its chance of winning changes. Among all valid
 * replacements one is picked at random (crypto-backed, injectable for tests).
 */
import { GAMES, type GameConfig, type GameId } from "./games";
import { evaluatePopularity, type PastWinningIndex, type PopularityLevel, type RuleId } from "./popularity";
import { randomInt, type RandomInt } from "./rng";

export interface Change {
  from: number;
  to: number;
}

/** "7 → 38, 19 → 44": the `{changes}` placeholder of the tips. */
export const formatChanges = (changes: readonly Change[]): string => changes.map((c) => `${c.from} → ${c.to}`).join(", ");

/** What the suggestion has to achieve. `medium` = from "medium" down to "low". */
export type ChangeTarget = "dates" | "progression" | "ticketPattern" | "pastWinning" | "medium";

const RANK: Record<PopularityLevel, number> = { low: 0, medium: 1, high: 2 };
/** Numbers above this value are not birthdays. */
const CALENDAR_MAX = 31;

/** Applies replacements to a combination (sorted result). */
export function applyChanges(main: readonly number[], changes: readonly Change[]): number[] {
  const map = new Map(changes.map((c) => [c.from, c.to]));
  return main.map((n) => map.get(n) ?? n).sort((a, b) => a - b);
}

/**
 * One valid replacement set, or null when there is none (the tip is then not shown).
 *
 * Rules (guide-copy.md 7.2):
 * - one replaced number first, two only when one is not enough;
 * - the result must not trigger the target rule or any other strong rule, and the level must go
 *   down: the best level found (preferably "low") is kept;
 * - target `dates`: a number of 1…31 is replaced by one above 31 that is not in the combination.
 */
export function suggestChanges(
  gameOrId: GameConfig | GameId,
  main: readonly number[],
  target: ChangeTarget,
  pastWinning: PastWinningIndex | null,
  rnd: RandomInt = randomInt,
): Change[] | null {
  const game = typeof gameOrId === "string" ? GAMES[gameOrId] : gameOrId;
  const base = evaluatePopularity(game, main, { pastWinning });
  const rule = (report: ReturnType<typeof evaluatePopularity>, id: RuleId) =>
    report.rules.find((r) => r.id === id)?.status === "triggered";
  const targetRule: RuleId | null = target === "medium" ? null : target;
  // Nothing to fix: the rule does not apply to this combination.
  if (targetRule ? !rule(base, targetRule) : base.level !== "medium") return null;

  const sorted = [...main].sort((a, b) => a - b);
  const free: number[] = [];
  for (let n = 1; n <= game.mainPool; n++) if (!sorted.includes(n)) free.push(n);
  const allowed = (n: number) => (target === "dates" ? n > CALENDAR_MAX : true);
  const pool = free.filter(allowed);
  const replaceable = sorted.filter((n) => target !== "dates" || n <= CALENDAR_MAX);

  const search = (count: 1 | 2): { changes: Change[]; level: PopularityLevel }[] => {
    const found: { changes: Change[]; level: PopularityLevel }[] = [];
    const test = (changes: Change[]) => {
      const report = evaluatePopularity(game, applyChanges(sorted, changes), { pastWinning });
      if (RANK[report.level] >= RANK[base.level]) return;
      if (targetRule && rule(report, targetRule)) return;
      found.push({ changes, level: report.level });
    };
    for (let i = 0; i < replaceable.length; i++) {
      for (const a of pool) {
        if (count === 1) test([{ from: replaceable[i]!, to: a }]);
        else
          for (let j = i + 1; j < replaceable.length; j++)
            for (const b of pool) if (b !== a) test([{ from: replaceable[i]!, to: a }, { from: replaceable[j]!, to: b }]);
      }
    }
    return found;
  };

  for (const count of [1, 2] as const) {
    const found = search(count);
    if (!found.length) continue;
    // Prefer replacements that end at "low"; accept "medium" only when nothing reaches "low".
    const best = Math.min(...found.map((f) => RANK[f.level]));
    const options = found.filter((f) => RANK[f.level] === best);
    // For the "medium → low" and "dates" targets only "low" is a success.
    if ((target === "medium" || target === "dates") && best !== RANK.low) continue;
    const pick = options[rnd(options.length)]!;
    return [...pick.changes].sort((x, y) => x.from - y.from);
  }
  return null;
}
