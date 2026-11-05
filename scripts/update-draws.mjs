#!/usr/bin/env node
/**
 * One command to bring both draw archives up to date:
 *
 *   npm run data:update
 *
 * 1. EuroJackpot: fetches only the draw dates missing from .data-cache/eurojackpot/
 *    (official eurojackpot.com JSON service, polite delay), then rebuilds
 *    public/data/eurojackpot.json. If the cache is empty, the first run downloads
 *    the full history (~1000 requests, ~12 min).
 * 2. Lotto 6aus49: downloads the current results.csv of github.com/daowa89/lottery-archive
 *    into .data-cache/lotto649/ and rebuilds public/data/lotto649.json (pinned to the
 *    archive's latest commit), then spot-checks 10 random draws + the latest one against
 *    the official WestLotto service and records the result under `verification`.
 *
 * Both builds validate every row and abort on anything suspicious; nothing is guessed.
 * Prints old → new draw counts and last dates. Personal, non-commercial use only.
 */
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cache = path.join(root, ".data-cache");
const dataFile = (name) => path.join(root, "public", "data", name);

async function summary(name) {
  try {
    const d = JSON.parse(await readFile(dataFile(name), "utf8"));
    return { count: d.count, lastDate: d.lastDate };
  } catch {
    return { count: 0, lastDate: "—" };
  }
}
const run = (script, args) =>
  execFileSync(process.execPath, [path.join(root, "scripts", script), ...args], { stdio: "inherit" });

const before = { ej: await summary("eurojackpot.json"), l649: await summary("lotto649.json") };

// --- EuroJackpot -----------------------------------------------------------
const ejDir = path.join(cache, "eurojackpot");
await mkdir(ejDir, { recursive: true });
const year = new Date().getFullYear();
// Only the current (and, in early January, previous) year can hold new dates.
const fromYear = before.ej.count > 0 ? (new Date().getMonth() === 0 ? year - 1 : year) : 2012;
console.log(`\nEuroJackpot: fetching missing dates from ${fromYear} …`);
run("fetch-eurojackpot.mjs", [ejDir, `--from-year=${fromYear}`]);
run("build-eurojackpot.mjs", [ejDir]);

// --- Lotto 6aus49 ----------------------------------------------------------
const l649Dir = path.join(cache, "lotto649");
await mkdir(l649Dir, { recursive: true });
const REPO = "daowa89/lottery-archive";
const FILE = "de/lotto_6aus49/results.csv";
console.log(`\nLotto 6aus49: downloading ${REPO}/${FILE} …`);
const headers = { "User-Agent": "Lotto-Luck-Genius personal archive" };
const commits = await fetch(`https://api.github.com/repos/${REPO}/commits?path=${FILE}&per_page=1`, { headers });
if (!commits.ok) throw new Error(`GitHub API: HTTP ${commits.status}`);
const sha = (await commits.json())[0]?.sha;
if (!sha) throw new Error("GitHub API: no commit found for the CSV");
const csv = await fetch(`https://raw.githubusercontent.com/${REPO}/${sha}/${FILE}`, { headers });
if (!csv.ok) throw new Error(`CSV download: HTTP ${csv.status}`);
const csvPath = path.join(l649Dir, "results.csv");
await writeFile(csvPath, await csv.text());
run("build-lotto649.mjs", [csvPath, `--commit=${sha}`, `--fetched-at=${new Date().toISOString()}`]);
// Third-party archive: spot-check a random sample + the latest draw against official WestLotto data.
console.log("\nLotto 6aus49: spot-check against WestLotto …");
run("verify-lotto649.mjs", ["--n=10", "--delay=800", "--write"]);
const verification = JSON.parse(await readFile(dataFile("lotto649.json"), "utf8")).verification;
if (verification?.mismatches) {
  console.warn(`WARNING: ${verification.mismatches} mismatch(es) with WestLotto — do not commit before checking.`);
  process.exitCode = 1;
}

// --- Summary ---------------------------------------------------------------
const after = { ej: await summary("eurojackpot.json"), l649: await summary("lotto649.json") };
const line = (label, b, a) =>
  `${label}: ${b.count} → ${a.count} draws (+${a.count - b.count}), last ${b.lastDate} → ${a.lastDate}`;
console.log("\n" + line("EuroJackpot ", before.ej, after.ej));
console.log(line("Lotto 6aus49", before.l649, after.l649));
if (after.ej.count < before.ej.count || after.l649.count < before.l649.count) {
  console.warn("WARNING: an archive shrank — check the source before committing.");
  process.exitCode = 1;
}
