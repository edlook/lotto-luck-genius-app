import { describe, expect, it } from "vitest";
import { parseOddsSettings, parseTicket, parseUserDraw } from "../storage/validate";

const ticket649 = {
  id: "a1",
  game: "649",
  fields: [{ main: [3, 14, 22, 31, 40, 45] }],
  superzahl: 7,
  drawDates: ["2026-11-04"],
  createdAt: "2026-11-01T10:00:00.000Z",
  source: "manual",
};
const ticketEj = {
  id: "b2",
  game: "ej",
  fields: [{ main: [1, 9, 23, 37, 50], euro: [2, 12] }],
  drawDates: ["2026-11-03", "2026-11-06"],
  createdAt: "2026-11-01T10:00:00.000Z",
  source: "generator",
  note: "office pool",
};

describe("parseTicket", () => {
  it("accepts valid tickets of both games and drops unknown keys", () => {
    expect(parseTicket({ ...ticket649, extra: 1 })).toEqual(ticket649);
    expect(parseTicket(ticketEj)).toEqual(ticketEj);
    expect(parseTicket({ ...ticket649, superzahl: null })?.superzahl).toBeNull();
  });

  it("rejects wrong numbers, sizes and types", () => {
    expect(parseTicket({ ...ticket649, fields: [{ main: [1, 2, 3, 4, 5, 50] }] })).toBeNull(); // out of range
    expect(parseTicket({ ...ticket649, fields: [{ main: [1, 1, 2, 3, 4, 5] }] })).toBeNull(); // duplicate
    expect(parseTicket({ ...ticket649, fields: [{ main: [1, 2, 3, 4, 5, 6], euro: [1, 2] }] })).toBeNull();
    expect(parseTicket({ ...ticketEj, fields: [{ main: [1, 2, 3, 4, 5], euro: [1, 13] }] })).toBeNull();
    expect(parseTicket({ ...ticket649, superzahl: 10 })).toBeNull();
    expect(parseTicket({ ...ticket649, drawDates: ["2026-02-30"] })).toBeNull();
    expect(parseTicket({ ...ticket649, drawDates: [] })).toBeNull();
    expect(parseTicket({ ...ticket649, id: "" })).toBeNull();
    expect(parseTicket({ ...ticket649, source: "import" })).toBeNull();
    expect(parseTicket({ ...ticket649, note: "x".repeat(501) })).toBeNull();
    expect(parseTicket([ticket649])).toBeNull();
    expect(parseTicket(null)).toBeNull();
  });
});

describe("parseUserDraw", () => {
  it("checks Euro numbers against the era of the draw date", () => {
    const base = { game: "ej", main: [1, 2, 3, 4, 5] };
    expect(parseUserDraw({ ...base, date: "2013-05-03", euro: [1, 8] })).not.toBeNull();
    expect(parseUserDraw({ ...base, date: "2013-05-03", euro: [1, 9] })).toBeNull(); // 2 of 8 then
    expect(parseUserDraw({ ...base, date: "2026-10-30", euro: [11, 12] })).not.toBeNull();
  });

  it("accepts a 6aus49 draw without Superzahl", () => {
    const d = { game: "649", date: "1980-01-05", main: [1, 2, 3, 4, 5, 6], superzahl: null };
    expect(parseUserDraw(d)).toEqual(d);
  });
});

describe("parseOddsSettings", () => {
  it("keeps valid inputs and throws on invalid ones", () => {
    const ok = { price: { ej: 2 }, share: { ej: null, "649": 50 }, year: { fieldsPerDraw: 4, drawsPerWeek: 2, weeks: 52 } };
    expect(parseOddsSettings({ ...ok, junk: true })).toEqual(ok);
    expect(() => parseOddsSettings({ share: { ej: 101 } })).toThrow();
    expect(() => parseOddsSettings({ year: { fieldsPerDraw: 1, drawsPerWeek: 3, weeks: 52 } })).toThrow();
    expect(() => parseOddsSettings("x")).toThrow();
  });
});
