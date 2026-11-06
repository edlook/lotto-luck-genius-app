import { describe, expect, it } from "vitest";
import ru from "../ru.json";
import en from "../en.json";
import de from "../de.json";
import guideRu from "../guide/ru.json";
import guideEn from "../guide/en.json";
import guideDe from "../guide/de.json";
import { interpolate, pickPlural } from "../format";

type Dict = Record<string, string>;
// The app shell dictionaries and the /guide namespace (loaded with its own chunk) follow the same rules.
const SETS: [string, Dict, Dict, Dict][] = [
  ["app", ru, en, de],
  ["guide", guideRu, guideEn, guideDe],
];

describe.each(SETS)("dictionaries (%s)", (_name, dru, den, dde) => {
  it("have identical keys in all languages and no empty values", () => {
    const k = Object.keys(dru).sort();
    expect(Object.keys(den).sort()).toEqual(k);
    expect(Object.keys(dde).sort()).toEqual(k);
    for (const d of [dru, den, dde]) {
      for (const key of k) expect(d[key]!.trim().length, key).toBeGreaterThan(0);
    }
  });

  it("use the same placeholders in every language", () => {
    for (const key of Object.keys(dru)) {
      const r = new Set(dru[key]!.match(/\{\w+\}/g) ?? []);
      for (const d of [den, dde]) {
        const o = new Set(d[key]!.match(/\{\w+\}/g) ?? []);
        expect([...o].sort(), key).toEqual([...r].sort());
      }
    }
  });

  it("contain no forbidden promises", () => {
    const text = Object.values(dru).join(" ").toLowerCase();
    expect(text).not.toMatch(/гарантированно выиграе|гарантированно|konfidenz|повышает шанс выиграть|повышает шанс/);
    expect(Object.values(den).join(" ").toLowerCase()).not.toMatch(/guaranteed|raises (your|the) chance|increases (your|the) chance/);
    expect(Object.values(dde).join(" ").toLowerCase()).not.toMatch(/garantiert|erhöht (ihre|die) (gewinn)?chance/);
  });

  it("keep the guide namespace out of the app dictionaries", () => {
    expect(Object.keys(dru).every((k) => k.startsWith("guide.") === (_name === "guide"))).toBe(true);
  });
});

describe("format helpers", () => {
  it("interpolates", () => {
    expect(interpolate("Поле {n} из {m}", { n: 2, m: 5 })).toBe("Поле 2 из 5");
  });

  it("picks Russian plural forms", () => {
    const s = "one: {n} билет / few: {n} билета / many: {n} билетов";
    expect(pickPlural(s, 1, "ru-RU")).toBe("{n} билет");
    expect(pickPlural(s, 3, "ru-RU")).toBe("{n} билета");
    expect(pickPlural(s, 11, "ru-RU")).toBe("{n} билетов");
    expect(pickPlural("one: {n} ticket / other: {n} tickets", 2, "en-GB")).toBe("{n} tickets");
  });
});
