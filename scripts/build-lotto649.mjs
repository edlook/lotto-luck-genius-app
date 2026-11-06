#!/usr/bin/env node
/**
 * Converts the Lotto 6 aus 49 CSV from github.com/daowa89/lottery-archive
 * (de/lotto_6aus49/results.csv, header `date,n1,n2,n3,n4,n5,n6,superzahl`)
 * into the static file public/data/lotto649.json used by the app.
 *
 * Usage: node scripts/build-lotto649.mjs <PATH_TO_results.csv> [--commit=<sha>] [--fetched-at=<ISO>]
 *
 * Every row is validated: ISO date, strictly increasing dates, 6 distinct
 * integers 1..49, Superzahl empty (draws before 1992) or 0..9. Any invalid row
 * aborts the build: nothing is guessed or repaired.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const csvPath = args.find((a) => !a.startsWith("--"));
if (!csvPath) {
  console.error("Usage: node scripts/build-lotto649.mjs <results.csv> [--commit=<sha>] [--fetched-at=<ISO>]");
  process.exit(1);
}
const opt = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");

const text = await readFile(csvPath, "utf8");
const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
const header = lines.shift();
if (header.trim() !== "date,n1,n2,n3,n4,n5,n6,superzahl") {
  throw new Error(`Unexpected header: ${header}`);
}

const draws = [];
let prev = "";
lines.forEach((line, i) => {
  const row = i + 2;
  const cols = line.split(",");
  if (cols.length !== 8) throw new Error(`Row ${row}: expected 8 columns, got ${cols.length}`);
  const [date, ...rest] = cols;
  // The date must exist in the calendar (30 February passes Date.parse in V8) and, from the
  // Wednesday + Saturday schedule on, fall on a draw weekday.
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00Z`) : null;
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`Row ${row}: bad date ${date}`);
  }
  if (date >= "2000-12-06" && ![3, 6].includes(parsed.getUTCDay())) {
    throw new Error(`Row ${row}: ${date} is not a Wednesday or Saturday`);
  }
  if (date <= prev) throw new Error(`Row ${row}: dates not strictly increasing (${prev} -> ${date})`);
  prev = date;
  const nums = rest.slice(0, 6).map((v) => {
    if (!/^\d+$/.test(v)) throw new Error(`Row ${row}: bad number "${v}"`);
    return Number(v);
  });
  if (nums.some((n) => n < 1 || n > 49)) throw new Error(`Row ${row}: number out of range`);
  if (new Set(nums).size !== 6) throw new Error(`Row ${row}: duplicate numbers`);
  const szRaw = rest[6].trim();
  let sz = null;
  if (szRaw !== "") {
    if (!/^\d$/.test(szRaw)) throw new Error(`Row ${row}: bad Superzahl "${szRaw}"`);
    sz = Number(szRaw);
  }
  if (sz === null && date >= "1992-01-01") throw new Error(`Row ${row}: missing Superzahl after 1992`);
  draws.push([date, [...nums].sort((a, b) => a - b), sz]);
});

const out = {
  schema: "llg.draws.v1",
  game: "lotto649",
  source: {
    name: "daowa89/lottery-archive (GitHub)",
    url: "https://github.com/daowa89/lottery-archive/blob/main/de/lotto_6aus49/results.csv",
    origin: "lottozahlenonline.de",
    originUrl: "https://www.lottozahlenonline.de/statistik/beide-spieltage/lottozahlen-archiv.php",
    commit: opt("commit") ?? null,
    license:
      "Scripts: MIT. Data: third-party (lottozahlenonline.de), subject to its terms. The archive is intended for personal, non-commercial use only.",
  },
  fetchedAt: opt("fetched-at") ?? new Date().toISOString(),
  count: draws.length,
  firstDate: draws[0][0],
  lastDate: draws[draws.length - 1][0],
  superzahlFrom: draws.find((d) => d[2] !== null)?.[0] ?? null,
  fields: ["date", "main", "superzahl"],
  draws,
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "public", "data", "lotto649.json");
await mkdir(path.dirname(target), { recursive: true });
await writeFile(target, JSON.stringify(out));
console.log(`Wrote ${target}: ${out.count} draws ${out.firstDate}..${out.lastDate}, Superzahl from ${out.superzahlFrom}`);
