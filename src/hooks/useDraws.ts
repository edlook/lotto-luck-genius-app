/**
 * Draw data for one game = static archive (/data/*.json, shipped with the app
 * and cached by the service worker) + draws the user added in this browser
 * (localStorage). On the same date the archive wins.
 */
import { useMemo } from "react";
import type { GameId } from "@/lib/games";
import type { Draw } from "@/lib/ticketCheck";
import type { ArchiveMeta } from "@/lib/archive";
import { comboKey, type PastWinningIndex } from "@/lib/popularity";
import { berlinNow, completeness, type Completeness } from "@/lib/drawCalendar";
import { activeUserDraws, userDrawsStore, userDrawToDraw, type UserDraw } from "@/lib/storage/stores";
import { useLocalStore } from "@/lib/storage/localStore";
import { useArchive } from "./useArchive";

export { fetchArchive, type Archive, type ArchiveMeta, type PayoutShare } from "@/lib/archive";

export interface DrawSet {
  game: GameId;
  /** Chronological (oldest first). */
  draws: Draw[];
  byDate: Map<string, Draw>;
  meta: ArchiveMeta | null;
  userCount: number;
  pastWinning: PastWinningIndex | null;
  completeness: Completeness | null;
  lastDate: string | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

type Derived = Omit<DrawSet, "isLoading" | "isError" | "refetch">;

/**
 * Sorting, the past-winning index and the completeness walk (~9 500 days for 6aus49) are the
 * expensive part. Every component calling useDraws shares one result per game for the same
 * inputs (QA B18).
 */
const derivedCache = new Map<GameId, { data: unknown; userDraws: UserDraw[]; today: string; value: Derived }>();

function derive(game: GameId, data: ReturnType<typeof useArchive>["data"], userDraws: UserDraw[], today: string): Derived {
  const hit = derivedCache.get(game);
  if (hit && hit.data === data && hit.userDraws === userDraws && hit.today === today) return hit.value;
  const archive = data?.draws ?? [];
  const byDate = new Map<string, Draw>();
  for (const d of archive) byDate.set(d.date, d);
  let userCount = 0;
  // Future or non-draw-day entries are ignored (see activeUserDraws).
  for (const u of activeUserDraws(userDraws, today)) {
    if (u.game !== game || byDate.has(u.date)) continue;
    byDate.set(u.date, userDrawToDraw(u));
    userCount++;
  }
  const draws = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let pastWinning: PastWinningIndex | null = null;
  if (draws.length) {
    pastWinning = new Map();
    for (const d of draws) pastWinning.set(comboKey(d.main), d.date); // later dates overwrite → latest date
  }
  const value: Derived = {
    game,
    draws,
    byDate,
    meta: data?.meta ?? null,
    userCount,
    pastWinning,
    completeness: completeness(
      game,
      draws.map((d) => d.date),
    ),
    lastDate: draws.length ? draws[draws.length - 1]!.date : null,
  };
  derivedCache.set(game, { data, userDraws, today, value });
  return value;
}

/** @param enabled false = use cached data only, do not fetch (see useArchive). */
export function useDraws(game: GameId, enabled = true): DrawSet {
  const q = useArchive(game, enabled);
  const userDraws = useLocalStore(userDrawsStore);
  const { data, isLoading, isError, refetch } = q;
  const today = berlinNow().date;

  return useMemo(
    () => ({ ...derive(game, data, userDraws, today), isLoading, isError, refetch }),
    [game, data, isLoading, isError, refetch, userDraws, today],
  );
}
