#!/usr/bin/env node
/**
 * Spot-checks public/data/lotto649.json against the official WestLotto
 * service (same WL_InfoService that powers westlotto.de). Picks N random draw
 * dates (default 25) plus the latest one, compares the 6 numbers and the
 * Superzahl, prints mismatches and writes the result into the JSON file under
 * `verification`.
 *
 * Usage: node scripts/verify-lotto649.mjs [--n=25] [--delay=1000] [--write]
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";

const args = process.argv.slice(2);
const n = Number(args.find((a) => a.startsWith("--n="))?.split("=")[1] ?? 25);
const delay = Number(args.find((a) => a.startsWith("--delay="))?.split("=")[1] ?? 1000);
const write = args.includes("--write");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "public", "data", "lotto649.json");
const data = JSON.parse(await readFile(file, "utf8"));
const BASE = "https://www.westlotto.de/wlinfo/WL_InfoService";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const pool = data.draws.filter((d) => d[0] >= "1992-01-01");
const picks = new Set([pool.length - 1]);
const buf = new Uint32Array(1);
while (picks.size < Math.min(n + 1, pool.length)) {
  webcrypto.getRandomValues(buf);
  picks.add(buf[0] % pool.length);
}

const checked = [];
const mismatches = [];
for (const idx of [...picks].sort((a, b) => a - b)) {
  const [date, main, sz] = pool[idx];
  await sleep(delay);
  let doc;
  try {
    const res = await fetch(
      `${BASE}?client=jsn&gruppe=ZahlenUndQuoten&spielart=LOTTO&historie=ja&lang=de&datum=${date}`,
    );
    if (!res.ok) {
      mismatches.push({ date, reason: `HTTP ${res.status}` });
      continue;
    }
    doc = await res.json();
  } catch (e) {
    // A network failure is a failed check, never a silently unverified file (QA B12).
    mismatches.push({ date, reason: `request failed: ${e instanceof Error ? e.message : e}` });
    continue;
  }
  const z = doc?.zahlen?.hauptlotterie?.ziehungen?.[0];
  const offMain = (z?.zahlenSortiert ?? []).map(Number);
  const offSz = z?.superzahl === "" || z?.superzahl == null ? null : Number(z.superzahl);
  const ok = doc?.head?.datum === date && JSON.stringify(offMain) === JSON.stringify(main) && offSz === sz;
  checked.push(date);
  if (!ok) mismatches.push({ date, ours: [main, sz], official: [offMain, offSz, doc?.head?.datum] });
  console.log(`${ok ? "ok  " : "DIFF"} ${date} ${main.join(" ")} SZ ${sz}`);
}

console.log(`Checked ${checked.length}, mismatches ${mismatches.length}`);
if (mismatches.length) console.log(JSON.stringify(mismatches, null, 2));
if (write) {
  data.verification = {
    method: "Random sample compared with the official WestLotto WL_InfoService (numbers + Superzahl)",
    url: "https://www.westlotto.de/",
    checkedAt: new Date().toISOString(),
    sampleSize: checked.length,
    mismatches: mismatches.length,
    dates: checked,
  };
  await writeFile(file, JSON.stringify(data));
  console.log("verification written");
}
