/**
 * Period selection and observed distributions for the statistics screen (pure, tested).
 * Theory comes from ./stats (exact distributions); this file only counts the past.
 */
import { EJ_ERAS, ejEraOn } from "./eras";
import type { Draw } from "./ticketCheck";

export type StatsPeriod = "all" | "last100" | "last500";
export const STATS_PERIODS: StatsPeriod[] = ["all", "last100", "last500"];

/** `draws` chronological; returns the chosen tail. */
export function selectPeriod(draws: Draw[], period: StatsPeriod): Draw[] {
  if (period === "last100") return draws.slice(-100);
  if (period === "last500") return draws.slice(-500);
  return draws;
}

/** Euro numbers are only ever counted within one format era (pools 8, 10, 12). */
export function drawsInEra(draws: Draw[], eraId: number): Draw[] {
  const era = EJ_ERAS.find((e) => e.id === eraId);
  if (!era) return [];
  return draws.filter(
    (d) => d.date >= era.from && (era.to === null || d.date <= era.to) && ejEraOn(d.date).id === eraId,
  );
}

/** Observed share of draws with e even main numbers, e = 0..k. */
export function evenCountObserved(draws: Draw[], k: number): number[] {
  const c = new Array<number>(k + 1).fill(0);
  for (const d of draws) {
    const e = d.main.filter((n) => n % 2 === 0).length;
    if (e <= k) c[e]!++;
  }
  return c.map((x) => (draws.length ? x / draws.length : 0));
}

/** Observed share of draws per sum bucket (same buckets as the exact distribution). */
export function sumObserved(draws: Draw[], buckets: { from: number; to: number }[]): number[] {
  const c = new Array<number>(buckets.length).fill(0);
  for (const d of draws) {
    const s = d.main.reduce((a, b) => a + b, 0);
    const i = buckets.findIndex((b) => s >= b.from && s <= b.to);
    if (i >= 0) c[i]!++;
  }
  return c.map((x) => (draws.length ? x / draws.length : 0));
}

/** Observed share of drawn main numbers ending in 0..9. */
export function lastDigitObserved(draws: Draw[]): number[] {
  const c = new Array<number>(10).fill(0);
  let total = 0;
  for (const d of draws)
    for (const n of d.main) {
      c[n % 10]!++;
      total++;
    }
  return c.map((x) => (total ? x / total : 0));
}
