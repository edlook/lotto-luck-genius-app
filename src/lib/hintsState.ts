/**
 * Stored state of the tips, without any logic that needs the tip engine: the shapes and the
 * defensive parsers of `llg.hints.v1` and `llg.hints.usage.v1`. Kept apart so the app shell
 * (which reads the tour flag) does not pull the whole engine into the first chunk.
 */

export interface HintRecord {
  /** ISO time until which the tip stays hidden. */
  until?: string;
  forever?: true;
  ctx?: string;
}
export type HintsState = Record<string, HintRecord>;

export function parseHintsState(raw: unknown): HintsState {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const out: HintsState = {};
  for (const [key, v] of Object.entries(raw)) {
    if (typeof v !== "object" || v === null || Array.isArray(v)) continue;
    const r = v as Record<string, unknown>;
    const rec: HintRecord = {};
    if (r.forever === true) rec.forever = true;
    if (typeof r.until === "string" && !Number.isNaN(Date.parse(r.until))) rec.until = r.until;
    if (typeof r.ctx === "string") rec.ctx = r.ctx;
    if (rec.forever || rec.until) out[key] = rec;
  }
  return out;
}

export interface HintsUsage {
  /** "Generate" pressed at least once. */
  generated: boolean;
  /** Saves of a 6aus49 set without Superzahl (the Superzahl tip is shown for the first three). */
  szSaves: number;
  /** The draws screen was opened before. */
  drawsVisited: boolean;
}

export const EMPTY_USAGE: HintsUsage = { generated: false, szSaves: 0, drawsVisited: false };

export function parseHintsUsage(raw: unknown): HintsUsage {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return EMPTY_USAGE;
  const r = raw as Record<string, unknown>;
  return {
    generated: r.generated === true,
    szSaves: typeof r.szSaves === "number" && Number.isInteger(r.szSaves) && r.szSaves >= 0 ? r.szSaves : 0,
    drawsVisited: r.drawsVisited === true,
  };
}
