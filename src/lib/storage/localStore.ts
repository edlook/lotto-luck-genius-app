/**
 * Tiny reactive wrapper around localStorage (useSyncExternalStore).
 * Values are validated with a parser on read; invalid or missing data falls
 * back to the default. Writes report failures (storage disabled or full)
 * instead of silently losing data.
 */
import { useSyncExternalStore } from "react";

export type WriteResult = "ok" | "unavailable" | "full";

/** A copy of stored data that failed to parse or lost entries in validation (QA B3). */
export interface RecoveryCopy {
  /** ISO time of detection. */
  at: string;
  /** The raw stored text, byte for byte. */
  raw: string;
}

export interface LocalStore<T> {
  key: string;
  get: () => T;
  /** "full" = the write was refused and NOT applied: the previous value stays. */
  set: (next: T | ((prev: T) => T)) => WriteResult;
  subscribe: (cb: () => void) => () => void;
  /**
   * Raw copies of data that could not be read in full. Snapshot is a stable string (JSON array of
   * RecoveryCopy, newest first) or null, so it works with useSyncExternalStore.
   */
  recovery: {
    snapshot: () => string | null;
    clear: () => void;
  };
}

export interface StoreOptions {
  /**
   * True when `value` (from `parsed`) lost part of the stored data: e.g. entries that did not
   * pass validation. Unparseable JSON always counts as lossy. Lossy data is backed up before the
   * next write instead of being overwritten silently.
   */
  isLossy?: (parsed: unknown, value: unknown) => boolean;
}

const MAX_RECOVERY_COPIES = 3;

export function parseRecovery(snapshot: string | null): RecoveryCopy[] {
  if (!snapshot) return [];
  try {
    const v: unknown = JSON.parse(snapshot);
    return Array.isArray(v)
      ? v.filter(
          (c): c is RecoveryCopy =>
            !!c && typeof c === "object" && typeof (c as RecoveryCopy).raw === "string" && typeof (c as RecoveryCopy).at === "string",
        )
      : [];
  } catch {
    return [];
  }
}

export function storageAvailable(): boolean {
  try {
    const k = "__llg_probe__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export function createLocalStore<T>(
  key: string,
  parse: (raw: unknown) => T,
  fallback: T,
  options: StoreOptions = {},
): LocalStore<T> {
  let cache: { raw: string | null; value: T } | null = null;
  const listeners = new Set<() => void>();
  // Holds the data only while localStorage refuses writes altogether ("unavailable"). After a
  // "full" error nothing is kept here: the write is reported as not done (QA B9).
  let memory: string | null = null;
  const backupKey = `${key}.recovery`;
  // Unreadable stored text seen by get(); written to the backup key before the next write.
  let pending: RecoveryCopy | null = null;
  let pendingSnapshot: string | null = null;

  const readRaw = (): string | null => {
    if (memory !== null) return memory;
    try {
      return localStorage.getItem(key);
    } catch {
      return memory;
    }
  };

  const readBackup = (): string | null => {
    try {
      return localStorage.getItem(backupKey);
    } catch {
      return null;
    }
  };

  const get = (): T => {
    const raw = readRaw();
    if (cache && cache.raw === raw) return cache.value;
    let value = fallback;
    let lossy = false;
    if (raw !== null) {
      try {
        const parsed: unknown = JSON.parse(raw);
        value = parse(parsed);
        lossy = options.isLossy?.(parsed, value) ?? false;
      } catch {
        value = fallback;
        lossy = true;
      }
    }
    if (lossy && raw !== null) {
      if (pending?.raw !== raw) {
        pending = { at: new Date().toISOString(), raw };
        pendingSnapshot = JSON.stringify([pending]);
      }
    } else if (raw !== null || pending) {
      pending = null;
      pendingSnapshot = null;
    }
    cache = { raw, value };
    return value;
  };

  const emit = () => listeners.forEach((l) => l());

  /** Keeps the unreadable original before it is overwritten. Returns false when it could not be saved. */
  const flushPending = (): boolean => {
    if (!pending) return true;
    const copies = parseRecovery(readBackup());
    if (!copies.some((c) => c.raw === pending!.raw)) copies.unshift(pending);
    try {
      localStorage.setItem(backupKey, JSON.stringify(copies.slice(0, MAX_RECOVERY_COPIES)));
    } catch {
      return false;
    }
    pending = null;
    pendingSnapshot = null;
    return true;
  };

  const set = (next: T | ((prev: T) => T)): WriteResult => {
    const prev = get(); // also detects unreadable stored data, even when `next` is a plain value
    const value = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
    const raw = JSON.stringify(value);
    // Never overwrite data we could not read in full unless its copy is safe.
    if (!flushPending()) return "full";
    let result: WriteResult = "ok";
    try {
      localStorage.setItem(key, raw);
      memory = null;
    } catch (e) {
      if (e instanceof DOMException && /quota/i.test(e.name + e.message)) return "full";
      memory = raw;
      result = "unavailable";
    }
    cache = { raw, value };
    emit();
    return result;
  };

  const recovery = {
    snapshot: (): string | null => readBackup() ?? (get(), pendingSnapshot),
    clear: () => {
      try {
        localStorage.removeItem(backupKey);
      } catch {
        /* nothing to clear */
      }
      emit();
    },
  };

  const subscribe = (cb: () => void) => {
    listeners.add(cb);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) cb();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(cb);
      window.removeEventListener("storage", onStorage);
    };
  };

  return { key, get, set, subscribe, recovery };
}

export function useLocalStore<T>(store: LocalStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** Reactive access to the recovery copies of a store (see LocalStore.recovery). */
export function useRecoveryCopies<T>(store: LocalStore<T>): RecoveryCopy[] {
  const snap = useSyncExternalStore(store.subscribe, store.recovery.snapshot, store.recovery.snapshot);
  return parseRecovery(snap);
}
