/**
 * Popularity estimate of a combination: transparent rules, no numeric weights.
 * Rules and strengths follow texts/site-structure.md 2.1 (Henze 1997,
 * Henze/Riedwyl 1998, Simon 1998; "dates" and "multiples" are heuristics).
 *
 * Scale: any strong rule triggered → high; only weak → medium; none → low.
 * Euro numbers are never evaluated (no research on how players pick them).
 */
import { GAMES, type GameConfig, type GameId } from "./games";

export type RuleId =
  | "dates"
  | "almostDates"
  | "progression"
  | "consecutive"
  | "ticketPattern"
  | "multiples"
  | "lastDigit"
  | "pastWinning";

export type RuleStrength = "strong" | "weak";
export type RuleStatus = "triggered" | "notTriggered" | "notChecked" | "disabledBlank";
export type PopularityLevel = "low" | "medium" | "high";
export type RuleSource = "henze1997" | "henzeRiedwyl" | "simon1998" | "heuristic" | "guides";

export interface RuleResult {
  id: RuleId;
  strength: RuleStrength;
  status: RuleStatus;
  sources: RuleSource[];
  /** Values for the explanation text: numbers, step, n, digit, line, date. */
  params: Record<string, string | number>;
}

export interface PopularityReport {
  level: PopularityLevel;
  rules: RuleResult[];
}

/** Lookup of past winning main-number sets → latest draw date. */
export type PastWinningIndex = Map<string, string>;

export const comboKey = (nums: readonly number[]): string => [...nums].sort((a, b) => a - b).join("-");

export const RULE_ORDER: RuleId[] = [
  "pastWinning",
  "dates",
  "progression",
  "ticketPattern",
  "almostDates",
  "consecutive",
  "multiples",
  "lastDigit",
];

const STRENGTH: Record<RuleId, RuleStrength> = {
  dates: "strong",
  almostDates: "weak",
  progression: "strong",
  consecutive: "weak",
  ticketPattern: "strong",
  multiples: "weak",
  lastDigit: "weak",
  pastWinning: "strong",
};

const SOURCES: Record<RuleId, RuleSource[]> = {
  dates: ["guides"],
  almostDates: ["guides"],
  progression: ["henze1997", "henzeRiedwyl"],
  consecutive: ["henze1997", "simon1998"],
  ticketPattern: ["henze1997"],
  multiples: ["heuristic"],
  lastDigit: ["heuristic"],
  pastWinning: ["henze1997"],
};

const list = (nums: number[]) => nums.join(", ");

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

/** Longest run of consecutive integers in a sorted list. */
export function longestRun(sorted: number[]): number[] {
  let best: number[] = sorted.length ? [sorted[0]!] : [];
  let cur: number[] = best;
  for (let i = 1; i < sorted.length; i++) {
    cur = sorted[i] === sorted[i - 1]! + 1 ? [...cur, sorted[i]!] : [sorted[i]!];
    if (cur.length > best.length) best = cur;
  }
  return best;
}

/** Common step if the sorted numbers form an arithmetic progression, else null. */
export function progressionStep(sorted: number[]): number | null {
  if (sorted.length < 3) return null;
  const d = sorted[1]! - sorted[0]!;
  for (let i = 2; i < sorted.length; i++) if (sorted[i]! - sorted[i - 1]! !== d) return null;
  return d;
}

/** Line of the play slip shared by all numbers (row / column / diagonal), else null. */
export function slipLine(sorted: number[], columns: number): "row" | "column" | "diagonal" | null {
  const pos = sorted.map((n) => ({ r: Math.floor((n - 1) / columns), c: (n - 1) % columns }));
  const same = (f: (p: { r: number; c: number }) => number) => pos.every((p) => f(p) === f(pos[0]!));
  if (same((p) => p.r)) return "row";
  if (same((p) => p.c)) return "column";
  if (same((p) => p.r - p.c) || same((p) => p.r + p.c)) return "diagonal";
  return null;
}

export interface EvaluateOptions {
  /** Past winning sets; `null` = no draw data loaded → rule "not checked". */
  pastWinning: PastWinningIndex | null;
}

export function evaluatePopularity(
  gameOrId: GameConfig | GameId,
  mainNumbers: readonly number[],
  { pastWinning }: EvaluateOptions,
): PopularityReport {
  const game = typeof gameOrId === "string" ? GAMES[gameOrId] : gameOrId;
  const sorted = [...mainNumbers].sort((a, b) => a - b);
  const k = sorted.length;
  const results = new Map<RuleId, RuleResult>();
  const put = (id: RuleId, status: RuleStatus, params: Record<string, string | number> = {}) =>
    results.set(id, { id, strength: STRENGTH[id], status, sources: SOURCES[id], params });

  // Past winning numbers
  if (!pastWinning || pastWinning.size === 0) put("pastWinning", "notChecked");
  else {
    const date = pastWinning.get(comboKey(sorted));
    put("pastWinning", date ? "triggered" : "notTriggered", date ? { date } : {});
  }

  // Dates / almost dates
  const low = sorted.filter((n) => n <= 31);
  if (low.length === k) put("dates", "triggered", { numbers: list(sorted) });
  else put("dates", "notTriggered");
  if (low.length === k - 1) put("almostDates", "triggered", { numbers: list(low) });
  else put("almostDates", "notTriggered");

  // Arithmetic progression
  const step = progressionStep(sorted);
  if (step !== null) put("progression", "triggered", { step, numbers: list(sorted) });
  else put("progression", "notTriggered");

  // Consecutive numbers (>= 3)
  const run = longestRun(sorted);
  if (run.length >= 3) put("consecutive", "triggered", { n: run.length, numbers: list(run) });
  else put("consecutive", "notTriggered");

  // Pattern on the play slip
  if (game.slipColumns === null) put("ticketPattern", "disabledBlank");
  else {
    const line = slipLine(sorted, game.slipColumns);
    if (line) put("ticketPattern", "triggered", { line });
    else put("ticketPattern", "notTriggered");
  }

  // Multiples of a common divisor >= 2
  const g = sorted.reduce((a, b) => gcd(a, b), 0);
  if (g >= 2) put("multiples", "triggered", { step: g, numbers: list(sorted) });
  else put("multiples", "notTriggered");

  // Same last digit
  const digits = new Set(sorted.map((n) => n % 10));
  if (digits.size === 1) put("lastDigit", "triggered", { digit: sorted[0]! % 10, numbers: list(sorted) });
  else put("lastDigit", "notTriggered");

  const rules = RULE_ORDER.map((id) => results.get(id)!);
  const hit = rules.filter((r) => r.status === "triggered");
  const level: PopularityLevel = hit.some((r) => r.strength === "strong")
    ? "high"
    : hit.length > 0
      ? "medium"
      : "low";
  return { level, rules };
}
