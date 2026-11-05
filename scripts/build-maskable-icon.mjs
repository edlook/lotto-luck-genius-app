#!/usr/bin/env node
/**
 * Draws all PWA/app icons in the brief palette (was: only the maskable one):
 *   pwa-maskable-512x512.png (purpose "maskable", ball r = 160 px, inside the 40 % safe zone),
 *   pwa-512x512.png, pwa-192x192.png (purpose "any"), apple-touch-icon.png (180),
 *   favicon-32x32.png. "any" icons use a larger ball (r = 44 % of the size).
 * No dependencies: shapes are rasterised with 4×4 supersampling and written as PNG
 * with node:zlib.
 *
 * Design (brief.md palette): full-bleed background #151c28 (hsl 220 30% 12%), a gold
 * ball with the gradient hsl(45 93% 58%) → hsl(38 92% 50%) at 135°, and the "1" of
 * public/mask-icon.svg cut out in the background colour. The ball has a radius of
 * 160 px, inside the maskable safe zone (circle of radius 40 % = 204.8 px), so no
 * launcher mask can clip it.
 *
 * Usage: node scripts/build-maskable-icon.mjs
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const SS = 4; // supersampling per axis
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let SIZE = 512;
let SCALE = 160 / 7;

function hsl(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

const BG = [0x15, 0x1c, 0x28];
const GOLD_FROM = hsl(45, 93, 58);
const GOLD_TO = hsl(38, 92, 50);

// Geometry in mask-icon.svg units (viewBox 0 0 16 16), scaled so the ball radius is 160 px.
const toUnits = (px) => (px - SIZE / 2) / SCALE + 8;

/** Distance from p to segment ab. */
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Colour of one sample point (x, y in px). */
function sample(x, y) {
  const u = toUnits(x);
  const v = toUnits(y);
  if (Math.hypot(u - 8, v - 8) > 7) return BG;
  // The "1": stem 8,5.2 → 8,11 and flag 5.95,6.52 → 8,5.33, both 2 units wide with round caps.
  const inOne = segDist(u, v, 8, 5.2, 8, 11) <= 1 || segDist(u, v, 5.95, 6.52, 8, 5.33) <= 1;
  if (inOne) return BG;
  // 135° gradient across the ball, top-left → bottom-right: u + v runs over 16 ± 7·√2.
  const span = 7 * Math.SQRT2;
  const t = Math.max(0, Math.min(1, (u + v - (16 - span)) / (2 * span)));
  return GOLD_FROM.map((c, i) => c + (GOLD_TO[i] - c) * t);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

async function render(size, ballRadiusPx, file) {
  SIZE = size;
  SCALE = ballRadiusPx / 7;
  const raw = Buffer.alloc(SIZE * (SIZE * 3 + 1));
  for (let y = 0; y < SIZE; y++) {
    const row = y * (SIZE * 3 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < SIZE; x++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const c = sample(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS);
          acc[0] += c[0];
          acc[1] += c[1];
          acc[2] += c[2];
        }
      const o = row + 1 + x * 3;
      for (let i = 0; i < 3; i++) raw[o + i] = Math.round(acc[i] / (SS * SS));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  const out = path.join(root, "public", file);
  await writeFile(out, png);
  console.log(`${path.relative(root, out)}: ${SIZE}x${SIZE}, ${png.length} bytes`);
}

await render(512, 160, "pwa-maskable-512x512.png");
await render(512, 512 * 0.44, "pwa-512x512.png");
await render(192, 192 * 0.44, "pwa-192x192.png");
await render(180, 180 * 0.44, "apple-touch-icon.png");
await render(32, 32 * 0.47, "favicon-32x32.png");
