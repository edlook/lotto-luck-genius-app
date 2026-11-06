#!/usr/bin/env node
/**
 * Builds the dictionaries from the copy decks texts/site-copy.md and texts/guide-copy.md
 * (tables `| key | RU | EN | DE |`). Keys must be identical in all three languages; duplicate
 * keys (also across the two files) abort the build.
 *
 * - src/i18n/{ru,en,de}.json         every key except `guide.*` (loaded with the app shell)
 * - src/i18n/guide/{ru,en,de}.json   the `guide.*` keys: the /guide page only, loaded with its chunk
 *
 * Only table rows with a dotted key are read; list items such as the "could not verify" section
 * of guide-copy.md never reach the dictionaries.
 *
 * Usage: node scripts/build-i18n.mjs [PATH_TO_copy.md ...]
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sources = process.argv.length > 2
  ? process.argv.slice(2)
  : [path.join(root, "..", "texts", "site-copy.md"), path.join(root, "..", "texts", "guide-copy.md")];

const dicts = { ru: {}, en: {}, de: {} };
const guide = { ru: {}, en: {}, de: {} };
const seen = new Set();
const KEY = /^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)+$/;

for (const src of sources) {
const md = await readFile(src, "utf8");
for (const line of md.split(/\r?\n/)) {
  if (!line.startsWith("|")) continue;
  // split on pipes that are not escaped
  const cells = line
    .slice(1, line.trimEnd().endsWith("|") ? line.trimEnd().length - 1 : undefined)
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, "|"));
  if (cells.length !== 4) continue;
  const [key, ru, en, de] = cells;
  if (!KEY.test(key)) continue;
  if (seen.has(key)) throw new Error(`Duplicate key ${key} (${path.basename(src)})`);
  seen.add(key);
  // Copy deck §0: numbers must not break across lines. Digit-group spaces ("139 838 160")
  // and the space before € / % become non-breaking.
  const nb = (v) => v.replace(/(\d) (?=\d{3}(?!\d))/g, "$1\u00A0").replace(/(\d) (?=[€%])/g, "$1\u00A0");
  const target = key.startsWith("guide.") ? guide : dicts;
  target.ru[key] = nb(ru);
  target.en[key] = nb(en);
  target.de[key] = nb(de);
}
}

const outDir = path.join(root, "src", "i18n");
await mkdir(path.join(outDir, "guide"), { recursive: true });
for (const [lang, dict] of Object.entries(dicts)) {
  await writeFile(path.join(outDir, `${lang}.json`), JSON.stringify(dict, null, 2) + "\n");
}
for (const [lang, dict] of Object.entries(guide)) {
  await writeFile(path.join(outDir, "guide", `${lang}.json`), JSON.stringify(dict, null, 2) + "\n");
}
console.log(`Keys: ${Object.keys(dicts.ru).length} + guide ${Object.keys(guide.ru).length}`);
