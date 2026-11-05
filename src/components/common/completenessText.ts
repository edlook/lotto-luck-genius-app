import type { Completeness } from "@/lib/drawCalendar";

interface Tr {
  t: (key: string, params?: Record<string, string | number>) => string;
  tp: (key: string, n: number, params?: Record<string, string | number>) => string;
}

/**
 * Completeness as words. `short` drops the leading "completeness:" for places whose own
 * label already says it (QA: no "Completeness: completeness: …").
 */
export function completenessText(c: Completeness | null, i18n: Tr, short = false): string {
  if (!c) return i18n.t("common.noData");
  if (c.missing.length === 0) return i18n.t(short ? "completeness.ok.short" : "draws.status.complete.ok");
  return i18n.tp("draws.status.complete.gap", c.missing.length);
}
