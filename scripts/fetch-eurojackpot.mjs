#!/usr/bin/env node
/**
 * Downloads the official EuroJackpot draw history (numbers + prize quotas)
 * from the JSON service that powers https://www.eurojackpot.com
 * (`/wlinfo/WL_InfoService?gruppe=ZahlenUndQuoten`).
 *
 * One raw JSON file per draw date is written into OUT_DIR. Existing files are
 * skipped, so the script can be re-run after every draw to fetch only new dates.
 * Requests are sequential with a polite delay (default 700 ms).
 *
 * Usage:  node scripts/fetch-eurojackpot.mjs <OUT_DIR> [--delay=700] [--from-year=2012]
 * Then:   node scripts/build-eurojackpot.mjs <OUT_DIR>
 *
 * Personal, non-commercial use only. The operator states "Alle Angaben ohne Gewähr".
 */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";

const BASE = "https://www.eurojackpot.com/wlinfo/WL_InfoService";
const COMMON = "client=jsn&gruppe=ZahlenUndQuoten&ewGewsum=ja&historie=ja&spielart=EJ&adg=ja&lang=de";
const UA = "Lotto-Luck-Genius personal archive (one-time import; contact: owner)";

const args = process.argv.slice(2);
const outDir = args.find((a) => !a.startsWith("--"));
if (!outDir) {
  console.error("Usage: node scripts/fetch-eurojackpot.mjs <OUT_DIR> [--delay=700] [--from-year=2012]");
  process.exit(1);
}
const delay = Number((args.find((a) => a.startsWith("--delay=")) ?? "--delay=700").split("=")[1]);
const fromYear = Number((args.find((a) => a.startsWith("--from-year=")) ?? "--from-year=2012").split("=")[1]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** True when the stored raw file holds all 12 prize classes with numeric winners and quotas and a stake. */
async function isComplete(p) {
  try {
    const doc = JSON.parse(await readFile(p, "utf8"));
    const classes = doc.auswertung?.quoten?.hauptlotterie?.ziehungen?.[0]?.gewinnklassen;
    const stake = Number(doc.auswertung?.spieleinsatz?.hauptlotterie);
    return (
      Array.isArray(classes) &&
      classes.length === 12 &&
      classes.every((c) => Number.isFinite(Number(c.anzahl)) && c.anzahl !== "" && Number.isFinite(Number(c.quote)) && c.quote !== "") &&
      Number.isFinite(stake) &&
      stake > 0
    );
  } catch {
    return false;
  }
}
const REFRESH_LATEST = 3;

async function getJson(url, attempt = 1) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) {
    if (attempt < 4 && (res.status === 429 || res.status >= 500)) {
      await sleep(delay * 4 * attempt);
      return getJson(url, attempt + 1);
    }
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.json();
}

await mkdir(outDir, { recursive: true });

const latest = await getJson(`${BASE}?${COMMON}`);
const years = (latest.history?.jahre ?? []).filter((y) => y >= fromYear).sort((a, b) => a - b);
console.log(`Years: ${years.join(", ")}`);

let fetched = 0;
let skipped = 0;
for (const year of years) {
  await sleep(delay);
  const yearDoc = await getJson(`${BASE}?${COMMON}&jahr=${year}`);
  const dates = [...(yearDoc.history?.tage ?? [])].sort();
  for (const date of dates) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const file = path.join(outDir, `${date}.json`);
    const newest = year === years[years.length - 1] && dates.indexOf(date) >= dates.length - REFRESH_LATEST;
    if (!newest && (await isComplete(file))) {
      skipped++;
      continue;
    }
    await sleep(delay);
    const doc = await getJson(`${BASE}?${COMMON}&datum=${date}`);
    if (doc.error) throw new Error(`Service error for ${date}: ${JSON.stringify(doc.error)}`);
    if (doc.head?.datum !== date) throw new Error(`Date mismatch: asked ${date}, got ${doc.head?.datum}`);
    await writeFile(file, JSON.stringify(doc));
    fetched++;
    if (fetched % 50 === 0) console.log(`… ${fetched} fetched (last ${date})`);
  }
}
await writeFile(
  path.join(outDir, "_meta.json"),
  JSON.stringify({ fetchedAt: new Date().toISOString(), endpoint: BASE, years }, null, 2),
);
console.log(`Done. fetched=${fetched} skipped(existing)=${skipped}`);
