#!/usr/bin/env node
/**
 * WCAG 2.x contrast check for the colour tokens in src/index.css (:root, HSL triples).
 *
 *   npm run contrast
 *
 * Every pair below is a real combination used by the UI components. Thresholds:
 * 4.5:1 normal text (AA 1.4.3), 3:1 large/bold text and non-text UI parts such as
 * control borders, focus rings and icons (AA 1.4.11). Exits with code 1 on failure.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const css = await readFile(path.join(root, "src", "index.css"), "utf8");
const block = /:root\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
const tokens = {};
for (const m of block.matchAll(/--([\w-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*;/g)) {
  tokens[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])];
}

function hslToRgb([h, s, l]) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (rgb) => {
  const [r, g, b] = rgb.map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
function ratio(a, b) {
  const [l1, l2] = [luminance(hslToRgb(a)), luminance(hslToRgb(b))].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const TEXT = 4.5;
const UI = 3;
// [foreground token, background token, minimum, where]
const PAIRS = [
  ["foreground", "background", TEXT, "body text"],
  ["foreground", "card", TEXT, "text on cards"],
  ["foreground", "surface-2", TEXT, "text in sheets, menus, toasts"],
  ["muted-foreground", "background", TEXT, "secondary text"],
  ["muted-foreground", "card", TEXT, "secondary text on cards"],
  ["muted-foreground", "surface-2", TEXT, "secondary text in sheets"],
  ["primary", "background", TEXT, "gold text / active nav label"],
  ["primary", "card", TEXT, "gold text on cards"],
  ["primary", "surface-2", TEXT, "active nav in sidebar / segmented control"],
  ["primary-foreground", "primary", TEXT, "primary button label"],
  ["primary-foreground", "primary-strong", TEXT, "digit on the gradient end of a main ball"],
  ["secondary-foreground", "secondary", TEXT, "secondary fill label"],
  ["accent-foreground", "accent", TEXT, "Euro / Superzahl ball digit"],
  ["accent", "background", TEXT, "green text (win)"],
  ["accent", "card", TEXT, "green text on cards"],
  ["success-foreground", "success", TEXT, "success badge"],
  ["warning", "background", TEXT, "warning text"],
  ["warning", "card", TEXT, "warning text on cards"],
  ["warning-foreground", "warning", TEXT, "warning badge"],
  ["danger", "background", TEXT, "error text"],
  ["danger", "card", TEXT, "error text on cards"],
  ["danger", "surface-2", TEXT, "error text in sheets"],
  ["danger-foreground", "danger", TEXT, "danger button label"],
  ["foreground", "muted", TEXT, "text on muted chips / hover fills"],
  ["muted-foreground", "ball-empty", TEXT, "digit of an empty / unmatched ball"],
  ["border-strong", "background", UI, "input and control borders"],
  ["border-strong", "card", UI, "input borders on cards"],
  ["border-strong", "surface-2", UI, "control borders in sheets"],
  ["ring", "background", UI, "focus ring"],
  ["ring", "card", UI, "focus ring on cards"],
  ["ring", "surface-2", UI, "focus ring in sheets"],
];

let failed = 0;
const rows = PAIRS.map(([fg, bg, min, where]) => {
  if (!tokens[fg] || !tokens[bg]) throw new Error(`Unknown token: ${tokens[fg] ? bg : fg}`);
  const r = ratio(tokens[fg], tokens[bg]);
  const ok = r >= min;
  if (!ok) failed++;
  return `${ok ? "ok  " : "FAIL"}  ${r.toFixed(2).padStart(5)}:1  (min ${min}:1)  ${fg} on ${bg}  — ${where}`;
});
console.log(rows.join("\n"));
console.log(failed ? `\n${failed} pair(s) below the threshold.` : `\nAll ${PAIRS.length} pairs pass WCAG AA.`);
if (failed) process.exitCode = 1;
