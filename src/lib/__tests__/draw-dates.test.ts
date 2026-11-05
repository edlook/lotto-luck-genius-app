import { describe, expect, it } from "vitest";
import { parseDrawCsv } from "../csvImport";
import { drawDateError, GAME_START, isDrawDay } from "../drawCalendar";
import { activeUserDraws, analyzeTicketImport, type UserDraw } from "../storage/stores";

// 2026-11-05 is a Thursday. EJ: Tue/Fri, 6aus49: Wed/Sat.
const TODAY = "2026-11-05";

describe("drawDateError (manual entry, CSV, stored draws)", () => {
  it("accepts past draw days and today", () => {
    expect(drawDateError("ej", "2026-11-03", TODAY)).toBeNull(); // Tuesday
    expect(drawDateError("649", "2026-11-04", TODAY)).toBeNull(); // Wednesday
    expect(drawDateError("649", "2026-11-07", "2026-11-07")).toBeNull(); // draw today (Saturday)
  });

  it("rejects dates later than today (Berlin)", () => {
    expect(drawDateError("ej", "2026-11-06", TODAY)).toBe("future"); // next Friday
    expect(drawDateError("ej", "2026-12-25", TODAY)).toBe("future"); // the QA case
    expect(drawDateError("649", "2099-01-03", TODAY)).toBe("future");
  });

  it("reports the future before the weekday", () => {
    expect(drawDateError("ej", "2026-11-08", TODAY)).toBe("future"); // Sunday, also not a draw day
  });

  it("rejects non-draw days and invalid dates", () => {
    expect(drawDateError("ej", "2026-11-04", TODAY)).toBe("drawDay"); // Wednesday
    expect(drawDateError("649", "2026-11-03", TODAY)).toBe("drawDay"); // Tuesday
    expect(drawDateError("ej", "2026-02-30", TODAY)).toBe("date");
    expect(drawDateError("ej", "", TODAY)).toBe("date");
  });

  it("game start dates are draw days of the archives", () => {
    expect(isDrawDay("ej", GAME_START.ej)).toBe(true);
    expect(GAME_START["649"] < GAME_START.ej).toBe(true);
  });
});

describe("parseDrawCsv rejects future draws", () => {
  it("marks a future row as an error and does not import it", () => {
    const r = parseDrawCsv("ej", ["2026-11-03;2;5;12;32;43;1;3", "2026-11-17;10;20;30;40;50;11;12"].join("\n"), TODAY);
    expect(r.found).toBe(2);
    expect(r.draws.map((d) => d.date)).toEqual(["2026-11-03"]);
    expect(r.errors).toEqual([{ row: 2, code: "future", date: "2026-11-17" }]);
  });

  it("6aus49: future Saturday is rejected, past Wednesday accepted", () => {
    const r = parseDrawCsv("649", "07.11.2026,1,2,3,4,5,6,7\n04.11.2026,3,13,16,28,44,49,2", TODAY);
    expect(r.draws.map((d) => d.date)).toEqual(["2026-11-04"]);
    expect(r.errors[0]).toMatchObject({ row: 1, code: "future" });
  });

  it("non-draw day in the past is still a drawDay error", () => {
    const r = parseDrawCsv("ej", "2026-11-04;1;2;3;4;5;1;2", TODAY);
    expect(r.errors[0]).toMatchObject({ code: "drawDay", date: "2026-11-04" });
  });
});

describe("activeUserDraws ignores stored future draws", () => {
  const draws: UserDraw[] = [
    { game: "ej", date: "2026-11-03", main: [1, 2, 3, 4, 5], euro: [1, 2] },
    { game: "ej", date: "2026-12-25", main: [1, 2, 3, 4, 5], euro: [1, 2] },
    { game: "649", date: "2026-11-03", main: [1, 2, 3, 4, 5, 6], superzahl: 1 }, // Tuesday: not a 6aus49 day
    { game: "649", date: "2026-11-04", main: [1, 2, 3, 4, 5, 6], superzahl: 1 },
  ];
  it("keeps only past (or today's) draw days", () => {
    expect(activeUserDraws(draws, TODAY).map((d) => `${d.game}:${d.date}`)).toEqual(["ej:2026-11-03", "649:2026-11-04"]);
  });
  it("a draw becomes active once its day has come", () => {
    expect(activeUserDraws(draws, "2026-12-25").map((d) => d.date)).toContain("2026-12-25");
  });
});

describe("analyzeTicketImport error codes (no raw exception text)", () => {
  it("invalid JSON", () => {
    expect(analyzeTicketImport("{not json", []).error).toBe("json");
  });
  it("empty ticket list", () => {
    expect(analyzeTicketImport('{"tickets":[]}', []).error).toBe("empty");
    expect(analyzeTicketImport("[]", []).error).toBe("empty");
  });
  it("wrong format: no ticket list or nothing valid", () => {
    expect(analyzeTicketImport('{"foo":1}', []).error).toBe("format");
    expect(analyzeTicketImport("42", []).error).toBe("format");
    const r = analyzeTicketImport('{"tickets":[{"id":"x"},{"bad":true}]}', []);
    expect(r).toMatchObject({ error: "format", skipped: 2 });
  });
  it("valid export has no error", () => {
    const tk = {
      id: "a1",
      game: "ej",
      fields: [{ main: [1, 2, 3, 4, 5], euro: [1, 2] }],
      drawDates: ["2026-11-06"],
      createdAt: "2026-11-05T10:00:00Z",
      source: "manual",
    };
    const r = analyzeTicketImport(JSON.stringify({ tickets: [tk, { bad: true }] }), []);
    expect(r.error).toBeNull();
    expect(r.fresh).toHaveLength(1);
    expect(r.skipped).toBe(1);
  });
});
