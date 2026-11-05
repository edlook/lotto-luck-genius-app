/**
 * Unbiased random integers from crypto.getRandomValues.
 *
 * `randomInt(n)` uses rejection sampling: 32-bit values at or above the
 * largest multiple of n are discarded, so every result 0..n-1 is equally likely
 * (plain `x % n` would favour small values).
 */

export type RandomInt = (n: number) => number;

const BUF_SIZE = 1024;

function getCrypto(): Crypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c || typeof c.getRandomValues !== "function") {
    throw new Error("crypto.getRandomValues is not available");
  }
  return c;
}

/** Creates a buffered, unbiased integer generator backed by crypto.getRandomValues. */
export function createCryptoRandomInt(requestedSize = BUF_SIZE): RandomInt {
  const crypto = getCrypto();
  // getRandomValues accepts at most 65 536 bytes per call (16 384 x 32 bit).
  const bufferSize = Math.max(1, Math.min(16384, Math.floor(requestedSize)));
  const buf = new Uint32Array(bufferSize);
  let pos = bufferSize;
  const next = (): number => {
    if (pos >= bufferSize) {
      crypto.getRandomValues(buf);
      pos = 0;
    }
    return buf[pos++]!;
  };
  return (n: number) => {
    if (!Number.isInteger(n) || n <= 0 || n > 2 ** 32) throw new RangeError(`randomInt: bad bound ${n}`);
    const limit = 2 ** 32 - (2 ** 32 % n);
    let x = next();
    while (x >= limit) x = next();
    return x % n;
  };
}

let shared: RandomInt | null = null;

/** Shared crypto-backed generator. */
export function randomInt(n: number): number {
  if (!shared) shared = createCryptoRandomInt();
  return shared(n);
}

/**
 * Draws k distinct numbers from 1..pool (partial Fisher–Yates), sorted ascending.
 * Every k-subset is equally likely.
 */
export function sampleDistinct(k: number, pool: number, rnd: RandomInt = randomInt): number[] {
  if (k > pool || k < 0) throw new RangeError(`sampleDistinct: k=${k} pool=${pool}`);
  const arr = Array.from({ length: pool }, (_, i) => i + 1);
  for (let i = 0; i < k; i++) {
    const j = i + rnd(pool - i);
    const t = arr[i];
    arr[i] = arr[j]!;
    arr[j] = t!;
  }
  return arr.slice(0, k).sort((a, b) => a - b);
}
