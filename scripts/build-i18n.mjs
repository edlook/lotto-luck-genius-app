#!/usr/bin/env node
/**
 * Builds src/i18n/{ru,en,de}.json from the copy deck texts/site-copy.md
 * (tables `| key | RU | EN | DE |`). Keys must be identical in all three
 * languages; duplicate keys abort the build.
 *
 * Usage: node scripts/build-i18n.mjs [PATH_TO_site-copy.md]
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = process.argv[2] ?? path.join(root, "..", "texts", "site-copy.md");
const md = await readFile(src, "utf8");

const dicts = { ru: {}, en: {}, de: {} };
const KEY = /^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)+$/;

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
  if (key in dicts.ru) throw new Error(`Duplicate key ${key}`);
  dicts.ru[key] = ru;
  dicts.en[key] = en;
  dicts.de[key] = de;
}

const outDir = path.join(root, "src", "i18n");
await mkdir(outDir, { recursive: true });
for (const [lang, dict] of Object.entries(dicts)) {
  await writeFile(path.join(outDir, `${lang}.json`), JSON.stringify(dict, null, 2) + "\n");
}
console.log(`Keys: ${Object.keys(dicts.ru).length}`);
