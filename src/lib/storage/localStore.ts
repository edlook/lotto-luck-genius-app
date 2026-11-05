/**
 * Tiny reactive wrapper around localStorage (useSyncExternalStore).
 * Values are validated with a parser on read; invalid or missing data falls
 * back to the default. Writes report failures (storage disabled or full)
 * instead of silently losing data.
 */
import { useSyncExternalStore } from "react";

export type WriteResult = "ok" | "unavailable" | "full";

export interface LocalStore<T> {
  key: string;
  get: () => T;
  set: (next: T | ((prev: T) => T)) => WriteResult;
  subscribe: (cb: () => void) => () => void;
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

export function createLocalStore<T>(key: string, parse: (raw: unknown) => T, fallback: T): LocalStore<T> {
  let cache: { raw: string | null; value: T } | null = null;
  const listeners = new Set<() => void>();
  let memory: string | null = null; // used when localStorage is unavailable

  const readRaw = (): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return memory;
    }
  };

  const get = (): T => {
    const raw = readRaw();
    if (cache && cache.raw === raw) return cache.value;
    let value = fallback;
    if (raw !== null) {
      try {
        value = parse(JSON.parse(raw));
      } catch {
        value = fallback;
      }
    }
    cache = { raw, value };
    return value;
  };

  const emit = () => listeners.forEach((l) => l());

  const set = (next: T | ((prev: T) => T)): WriteResult => {
    const value = typeof next === "function" ? (next as (p: T) => T)(get()) : next;
    const raw = JSON.stringify(value);
    let result: WriteResult = "ok";
    try {
      localStorage.setItem(key, raw);
    } catch (e) {
      memory = raw;
      result = e instanceof DOMException && /quota/i.test(e.name + e.message) ? "full" : "unavailable";
    }
    cache = { raw, value };
    emit();
    return result;
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

  return { key, get, set, subscribe };
}

export function useLocalStore<T>(store: LocalStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
