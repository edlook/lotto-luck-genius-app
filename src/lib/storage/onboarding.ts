/**
 * Tour and tip state kept in this browser:
 * - tour finished or skipped   llg.tour.v1
 * - dismissed tips             llg.hints.v1        ({ [tip or tip:ticket]: { until?, forever?, ctx? } })
 * - tips switched on/off       llg.hints.enabled   (false = off)
 * - small usage counters       llg.hints.usage.v1
 * - last ticket export         llg.lastExportAt    (ISO time)
 */
import { EMPTY_USAGE, parseHintsState, parseHintsUsage, type HintsState, type HintsUsage } from "../hintsState";
import { createLocalStore } from "./localStore";

export interface TourState {
  done: boolean;
  /** ISO time of finishing or skipping. */
  at?: string;
}

const NOT_DONE: TourState = { done: false };

export const tourStore = createLocalStore<TourState>(
  "llg.tour.v1",
  (raw) => {
    if (typeof raw !== "object" || raw === null) throw new TypeError("tour state");
    const r = raw as Record<string, unknown>;
    return r.done === true ? { done: true, ...(typeof r.at === "string" ? { at: r.at } : {}) } : NOT_DONE;
  },
  NOT_DONE,
);

export const hintsStore = createLocalStore<HintsState>("llg.hints.v1", parseHintsState, {});

export const hintsEnabledStore = createLocalStore<boolean>("llg.hints.enabled", (raw) => raw !== false, true);

export const hintsUsageStore = createLocalStore<HintsUsage>("llg.hints.usage.v1", parseHintsUsage, EMPTY_USAGE);

export const lastExportStore = createLocalStore<string | null>(
  "llg.lastExportAt",
  (raw) => (typeof raw === "string" && !Number.isNaN(Date.parse(raw)) ? raw : null),
  null,
);

/** Marks the usage flag once; no write when it is already set. */
export function markUsed(flag: "generated" | "drawsVisited"): void {
  if (!hintsUsageStore.get()[flag]) hintsUsageStore.set((u) => ({ ...u, [flag]: true }));
}
