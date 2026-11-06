#!/usr/bin/env node
/**
 * Converts raw per-date JSON files written by fetch-eurojackpot.mjs into the
 * static file public/data/eurojackpot.json used by the app.
 *
 * Usage: node scripts/build-eurojackpot.mjs <RAW_DIR>
 *
 * Validation (any failure aborts, nothing is repaired or guessed):
 * - file name date == head.datum, dates strictly increasing;
 * - "spielformel" parsed into a format era (main pool / euro pool);
 * - 5 distinct main numbers within 1..mainPool, 2 distinct Euro numbers within 1..euroPool.
 * - quotas: exactly the 12 classes of the game (each label once), winners an integer >= 0,
 *   amount a finite number >= 0, published stake > 0. A missing or incomplete quota table
 *   (e.g. a draw fetched before the operator published it) aborts: delete that raw file and
 *   run the fetch again (the fetch script re-downloads incomplete files itself).
 * Prize quotas are kept as published: [label "k + m", winners, amount EUR] per class,
 * plus the jackpot amount when class 1 had no winner.
 * `payout.share` = actual long-run payout share computed from those quotas and stakes.
 */
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rawDir = process.argv[2];
if (!rawDir) {
  console.error("Usage: node scripts/build-eurojackpot.mjs <RAW_DIR>");
  process.exit(1);
}

const files = (await readdir(rawDir)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
let meta = {};
try {
  meta = JSON.parse(await readFile(path.join(rawDir, "_meta.json"), "utf8"));
} catch {
  /* optional */
}

const CLASS_LABELS = ["5+2", "5+1", "5+0", "4+2", "4+1", "4+0", "3+2", "3+1", "2+2", "3+0", "1+2", "2+1"];
const draws = [];
const eras = [];
let prev = "";
for (const f of files) {
  const date = f.slice(0, 10);
  const doc = JSON.parse(await readFile(path.join(rawDir, f), "utf8"));
  if (doc.head?.datum !== date) throw new Error(`${f}: head.datum ${doc.head?.datum}`);
  if (date <= prev) throw new Error(`${f}: dates not increasing`);
  prev = date;
  const formula = String(doc.head?.spielformel ?? "");
  const m = /^5 aus (\d+) und 2 aus (\d+)$/.exec(formula.trim());
  if (!m) throw new Error(`${f}: unknown formula "${formula}"`);
  const mainPool = Number(m[1]);
  const euroPool = Number(m[2]);
  const z = doc.zahlen?.hauptlotterie?.ziehungen ?? [];
  if (z.length !== 2) throw new Error(`${f}: expected 2 number groups, got ${z.length}`);
  const main = z[0].zahlenSortiert.map(Number);
  const euro = z[1].zahlenSortiert.map(Number);
  if (main.length !== 5 || new Set(main).size !== 5 || main.some((x) => !Number.isInteger(x) || x < 1 || x > mainPool)) {
    throw new Error(`${f}: invalid main numbers ${main}`);
  }
  if (euro.length !== 2 || new Set(euro).size !== 2 || euro.some((x) => !Number.isInteger(x) || x < 1 || x > euroPool)) {
    throw new Error(`${f}: invalid Euro numbers ${euro}`);
  }
  let era = eras[eras.length - 1];
  if (!era || era.formula !== formula) {
    if (era) era.to = draws[draws.length - 1][0];
    era = { id: eras.length, formula, mainPool, euroPool, from: date, to: null };
    eras.push(era);
  }
  const classes = doc.auswertung?.quoten?.hauptlotterie?.ziehungen?.[0]?.gewinnklassen;
  if (!Array.isArray(classes) || classes.length !== CLASS_LABELS.length) {
    throw new Error(`${f}: expected ${CLASS_LABELS.length} prize classes, got ${Array.isArray(classes) ? classes.length : "none"}`);
  }
  const quotes = classes.map((c) => {
    const label = String(c.kurzbeschreibung ?? "").replace(/\s+/g, "");
    const winners = Number(c.anzahl);
    const amount = Number(c.quote);
    if (c.anzahl === undefined || c.anzahl === null || c.anzahl === "" || !Number.isInteger(winners) || winners < 0)
      throw new Error(`${f}: class ${label}: invalid winners ${JSON.stringify(c.anzahl)}`);
    if (c.quote === undefined || c.quote === null || c.quote === "" || !Number.isFinite(amount) || amount < 0)
      throw new Error(`${f}: class ${label}: invalid quota ${JSON.stringify(c.quote)}`);
    return [label, winners, amount];
  });
  if ([...quotes.map((q) => q[0])].sort().join() !== [...CLASS_LABELS].sort().join())
    throw new Error(`${f}: prize class labels differ from the game: ${quotes.map((q) => q[0]).join(" ")}`);
  const jackpot = classes.find((c) => c.klasse === 1)?.jackpot ?? null;
  const stake = Number(doc.auswertung?.spieleinsatz?.hauptlotterie);
  if (!Number.isFinite(stake) || stake <= 0) throw new Error(`${f}: invalid stake ${JSON.stringify(doc.auswertung?.spieleinsatz?.hauptlotterie)}`);
  draws.push([date, [...main].sort((a, b) => a - b), [...euro].sort((a, b) => a - b), era.id, quotes, jackpot, stake]);
}
eras[eras.length - 1].to = null; // current era is open-ended

// Actual payout share = Σ(winners × quota) / Σ(stakes) over all draws with a published stake.
// Uses only the operator's own figures; jackpot rollovers even out over the long run.
let paid = 0;
let staked = 0;
let withStake = 0;
for (const d of draws) {
  if (!d[6]) continue;
  paid += d[4].reduce((sum, [, winners, amount]) => sum + winners * amount, 0);
  staked += d[6];
  withStake++;
}
const payout = withStake
  ? {
      share: Math.round((paid / staked) * 10000) / 10000,
      draws: withStake,
      from: draws.find((d) => d[6])[0],
      to: [...draws].reverse().find((d) => d[6])[0],
      method: "Sum of winners × published quota over sum of published stakes (main lottery), all draws",
    }
  : null;

const out = {
  schema: "llg.draws.v1",
  game: "eurojackpot",
  source: {
    name: "eurojackpot.com (official), JSON service WL_InfoService",
    url: "https://www.eurojackpot.com/",
    endpoint: "https://www.eurojackpot.com/wlinfo/WL_InfoService?gruppe=ZahlenUndQuoten&spielart=EJ",
    license:
      "Official operator data, published without warranty (\"Alle Angaben ohne Gewähr\"). No explicit reuse licence found; imported once for personal, non-commercial use.",
  },
  fetchedAt: meta.fetchedAt ?? new Date().toISOString(),
  count: draws.length,
  firstDate: draws[0][0],
  lastDate: draws[draws.length - 1][0],
  eras,
  payout,
  fields: ["date", "main", "euro", "era", "quotes[label,winners,amountEUR]", "jackpotEUR", "stakeEUR"],
  draws,
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "public", "data", "eurojackpot.json");
await mkdir(path.dirname(target), { recursive: true });
await writeFile(target, JSON.stringify(out));
console.log(`Wrote ${target}: ${out.count} draws ${out.firstDate}..${out.lastDate}`);
console.log("Eras:", JSON.stringify(eras));
console.log("Payout:", JSON.stringify(payout));
