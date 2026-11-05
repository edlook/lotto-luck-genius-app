/**
 * Game configuration. All constants come from texts/research-company.md
 * (sections 4.1 and 4.2, sources: lotto.de rules and odds pages).
 */

export type GameId = "ej" | "649";

export const GAME_IDS: GameId[] = ["ej", "649"];

export interface PrizeClass {
  /** Official class number (1 = jackpot). */
  cls: number;
  /** Matched main numbers. */
  main: number;
  /** EuroJackpot: matched Euro numbers. Lotto 6aus49: 1 if the Superzahl matched, else 0. */
  extra: number;
}

export interface GameConfig {
  id: GameId;
  /** File name in /public/data. */
  dataFile: string;
  mainCount: number;
  mainPool: number;
  /** EuroJackpot: Euro numbers. Lotto 6aus49: none (the Superzahl is not chosen by the player). */
  extraCount: number;
  extraPool: number;
  hasSuperzahl: boolean;
  /** Stake per field in EUR, without the slip fee. */
  price: number;
  /** Share of stakes paid out as prizes, 0..1. `null` = not confirmed by a source. */
  payoutShare: number | null;
  /** Draw weekdays (0 = Sunday) in the current schedule. */
  drawDays: number[];
  /** Prize classes, best first. */
  classes: PrizeClass[];
  /** Grid layout of the official play slip, `null` when not verified. */
  slipColumns: number | null;
  /** Fixed prize per class in EUR, where the rules define one. */
  fixedPrizes: Partial<Record<number, number>>;
}

export const GAMES: Record<GameId, GameConfig> = {
  ej: {
    id: "ej",
    dataFile: "eurojackpot.json",
    mainCount: 5,
    mainPool: 50,
    extraCount: 2,
    extraPool: 12,
    hasSuperzahl: false,
    price: 2,
    payoutShare: null,
    drawDays: [2, 5],
    classes: [
      { cls: 1, main: 5, extra: 2 },
      { cls: 2, main: 5, extra: 1 },
      { cls: 3, main: 5, extra: 0 },
      { cls: 4, main: 4, extra: 2 },
      { cls: 5, main: 4, extra: 1 },
      { cls: 6, main: 3, extra: 2 },
      { cls: 7, main: 4, extra: 0 },
      { cls: 8, main: 2, extra: 2 },
      { cls: 9, main: 3, extra: 1 },
      { cls: 10, main: 3, extra: 0 },
      { cls: 11, main: 1, extra: 2 },
      { cls: 12, main: 2, extra: 1 },
    ],
    // The EuroJackpot slip layout has not been verified (site-structure.md 2.1).
    slipColumns: null,
    fixedPrizes: {},
  },
  "649": {
    id: "649",
    dataFile: "lotto649.json",
    mainCount: 6,
    mainPool: 49,
    extraCount: 0,
    extraPool: 0,
    hasSuperzahl: true,
    price: 1.2,
    payoutShare: 0.5,
    drawDays: [3, 6],
    classes: [
      { cls: 1, main: 6, extra: 1 },
      { cls: 2, main: 6, extra: 0 },
      { cls: 3, main: 5, extra: 1 },
      { cls: 4, main: 5, extra: 0 },
      { cls: 5, main: 4, extra: 1 },
      { cls: 6, main: 4, extra: 0 },
      { cls: 7, main: 3, extra: 1 },
      { cls: 8, main: 3, extra: 0 },
      { cls: 9, main: 2, extra: 1 },
    ],
    slipColumns: 7,
    fixedPrizes: { 9: 6 },
  },
};

/** EuroJackpot: date from which Euro numbers are drawn from 12 (research 4.1). */
export const EJ_EURO12_FROM = "2022-03-25";

export function isGameId(v: unknown): v is GameId {
  return v === "ej" || v === "649";
}
