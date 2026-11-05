/**
 * Tiny cache for the static draw archives (replaces @tanstack/react-query, ~13 KB gzip).
 *
 * - One entry per game, shared by every component (module-level store + useSyncExternalStore).
 * - Fresh for 1 hour; after that the next mount refetches in the background and keeps
 *   showing the old data meanwhile (stale-while-revalidate, like the service worker).
 * - One automatic retry on failure; `refetch()` forces a new request.
 * - Concurrent requests for the same game are de-duplicated.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { GameId } from "@/lib/games";
import { fetchArchive, type Archive } from "@/lib/archive";

const STALE_MS = 60 * 60 * 1000;
const RETRIES = 1;

type Status = "idle" | "loading" | "success" | "error";

interface Entry {
  status: Status;
  data: Archive | null;
  error: unknown;
  /** Time of the last successful load (ms). */
  updatedAt: number;
}

const IDLE: Entry = { status: "idle", data: null, error: null, updatedAt: 0 };
const entries = new Map<GameId, Entry>();
const inflight = new Map<GameId, Promise<void>>();
const listeners = new Set<() => void>();

function setEntry(game: GameId, patch: Partial<Entry>) {
  entries.set(game, { ...(entries.get(game) ?? IDLE), ...patch });
  listeners.forEach((l) => l());
}

async function fetchWithRetry(game: GameId): Promise<Archive> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      return await fetchArchive(game);
    } catch (e) {
      lastError = e;
      if (attempt < RETRIES) await new Promise((r) => setTimeout(r, 800));
    }
  }
  throw lastError;
}

/** Loads the archive unless a fresh copy is cached. `force` ignores freshness. */
export function loadArchive(game: GameId, force = false): Promise<void> {
  const running = inflight.get(game);
  if (running) return running;
  const cur = entries.get(game) ?? IDLE;
  if (!force && cur.status === "success" && Date.now() - cur.updatedAt < STALE_MS) return Promise.resolve();
  setEntry(game, { status: "loading", error: null });
  const p = fetchWithRetry(game)
    .then((data) => setEntry(game, { status: "success", data, updatedAt: Date.now() }))
    .catch((error: unknown) => setEntry(game, { status: "error", error }))
    .finally(() => inflight.delete(game));
  inflight.set(game, p);
  return p;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export interface ArchiveState {
  data: Archive | null;
  /** First load without any data yet. */
  isLoading: boolean;
  /** Background refresh while older data is shown. */
  isFetching: boolean;
  /** The last request failed (data may still hold an older copy). */
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

/**
 * @param enabled false = only read what is already cached (another screen may have loaded it),
 *                never start a request. Used by the app shell so that screens without draws
 *                (/odds, /about) do not download the archive for the navigation badge.
 */
export function useArchive(game: GameId, enabled = true): ArchiveState {
  const entry = useSyncExternalStore(
    subscribe,
    () => entries.get(game) ?? IDLE,
    () => IDLE,
  );
  useEffect(() => {
    if (enabled) void loadArchive(game);
  }, [game, enabled]);
  const refetch = useCallback(() => void loadArchive(game, true), [game]);
  return {
    data: entry.data,
    isLoading: entry.data === null && (entry.status === "loading" || entry.status === "idle"),
    isFetching: entry.status === "loading",
    isError: entry.status === "error",
    error: entry.error,
    refetch,
  };
}
