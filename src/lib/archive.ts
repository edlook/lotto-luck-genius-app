/**
 * Static draw archives (/data/*.json): shipped with the app, cached at runtime by the
 * service worker (StaleWhileRevalidate), parsed into Draw objects here.
 */
import { GAMES, type GameId } from "./games";
import type { Draw } from "./ticketCheck";

export interface ArchiveMeta {
  sourceName: string;
  sourceUrl: string;
  origin?: string;
  license: string;
  fetchedAt: string;
  count: number;
  firstDate: string;
  lastDate: string;
  verification?: { sampleSize: number; mismatches: number; checkedAt: string };
  /** EuroJackpot only: actual payout share computed from official quotas and stakes. */
  payout?: PayoutShare | null;
}

export interface PayoutShare {
  share: number;
  draws: number;
  from: string;
  to: string;
}

export interface Archive {
  meta: ArchiveMeta;
  draws: Draw[];
}

type Raw649 = [string, number[], number | null];
type RawEj = [string, number[], number[], number, [string, number, number][], number | null, number | null];

interface RawArchive {
  game: "lotto649" | "eurojackpot";
  source: { name: string; url: string; origin?: string; license: string };
  fetchedAt: string;
  count: number;
  firstDate: string;
  lastDate: string;
  eras?: { id: number; euroPool: number }[];
  verification?: { sampleSize: number; mismatches: number; checkedAt: string };
  payout?: PayoutShare | null;
  draws: unknown[];
}

export async function fetchArchive(game: GameId): Promise<Archive> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${GAMES[game].dataFile}`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = (await res.json()) as RawArchive;
  const eraPool = new Map((raw.eras ?? []).map((e) => [e.id, e.euroPool]));
  const draws: Draw[] =
    game === "649"
      ? (raw.draws as Raw649[]).map(([date, main, sz]) => ({ game, date, main, superzahl: sz, source: "archive" as const }))
      : (raw.draws as RawEj[]).map(([date, main, euro, era, quotes, jackpot]) => ({
          game,
          date,
          main,
          euro,
          euroPool: eraPool.get(era) ?? 12,
          quotes,
          jackpot,
          source: "archive" as const,
        }));
  return {
    meta: {
      sourceName: raw.source.name,
      sourceUrl: raw.source.url,
      origin: raw.source.origin,
      license: raw.source.license,
      fetchedAt: raw.fetchedAt,
      count: raw.count,
      firstDate: raw.firstDate,
      lastDate: raw.lastDate,
      verification: raw.verification,
      payout: raw.payout ?? null,
    },
    draws,
  };
}

