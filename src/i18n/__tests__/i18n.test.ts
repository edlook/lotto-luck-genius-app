import { describe, expect, it } from "vitest";
import ru from "../ru.json";
import en from "../en.json";
import de from "../de.json";
import { interpolate, pickPlural } from "../format";

describe("dictionaries", () => {
  it("have identical keys in all languages and no empty values", () => {
    const k = Object.keys(ru).sort();
    expect(Object.keys(en).sort()).toEqual(k);
    expect(Object.keys(de).sort()).toEqual(k);
    for (const d of [ru, en, de] as Record<string, string>[]) {
      for (const key of k) expect(d[key]!.trim().length, key).toBeGreaterThan(0);
    }
  });

  it("use the same placeholders in every language", () => {
    for (const key of Object.keys(ru)) {
      const r = new Set((ru as Record<string, string>)[key]!.match(/\{\w+\}/g) ?? []);
      for (const d of [en, de] as Record<string, string>[]) {
        const o = new Set(d[key]!.match(/\{\w+\}/g) ?? []);
        expect([...o].sort(), key).toEqual([...r].sort());
      }
    }
  });

  it("contain no forbidden promises", () => {
    const text = Object.values(ru as Record<string, string>).join(" ").toLowerCase();
    expect(text).not.toMatch(/гарантированно выиграе|konfidenz|повышает шанс выиграть/);
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
