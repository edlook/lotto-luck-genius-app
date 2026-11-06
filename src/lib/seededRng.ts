/**
 * Small deterministic generator (mulberry32) for analyses that must be reproducible:
 * the same seed always gives the same numbers, so a result can be checked again.
 * Not for the ticket generator, which uses crypto.getRandomValues (see ./rng).
 */
import type { RandomInt } from "./rng";

/** Uniform floats in [0, 1). */
export function createSeededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integers 0..n-1; the modulo-free scaling is accurate enough for n far below 2^32. */
export function createSeededInt(seed: number): RandomInt {
  const next = createSeededRandom(seed);
  return (n: number) => Math.floor(next() * n);
}
