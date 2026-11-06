/**
 * Checks one field of a ticket against one draw and returns the prize class.
 *
 * EuroJackpot: class from (main hits, Euro hits). For draws of older format
 * eras the published quota labels ("k+m") are used when available.
 * Lotto 6aus49: if the ticket has no Superzahl, only classes without SZ can
 * be determined; the result is flagged `szUnknown`. Two matches then give
 * `possibleCls` (class 9 if the Superzahl matched), never a confirmed win.
 */
import { ejClassOn } from "./eras";
import { GAMES, type GameId } from "./games";

/**
 * Lotto 6aus49 classes as in games.ts (9 classes, Superzahl, class 9 = "2 + SZ") exist from this
 * draw on; earlier draws used another system (Zusatzzahl), so no class is derived for them (QA B7).
 */
export const LOTTO649_SYSTEM_FROM = "2013-05-04";
/**
 * The fixed 6 € of class 9 is confirmed for the class table valid since this date
 * (lotto.de, research 4.2); for earlier draws no amount is claimed.
 */
export const LOTTO649_FIXED_PRIZE_FROM = "2020-09-23";

export interface Draw {
  game: GameId;
  /** ISO date YYYY-MM-DD (Europe/Berlin draw date). */
  date: string;
  main: number[];
  /** EuroJackpot Euro numbers. */
  euro?: number[];
  /** Lotto 6aus49 Superzahl (null before 1992). */
  superzahl?: number | null;
  /** EuroJackpot pool size of Euro numbers in this draw's era. */
  euroPool?: number;
  /** Published quotas: [label "k+m", winners, amount EUR]. */
  quotes?: [string, number, number][];
  jackpot?: number | null;
  /** EuroJackpot: stake of the main lottery of this draw in EUR (official data), null if unknown. */
  stake?: number | null;
  source: "archive" | "user";
}

export interface FieldInput {
  main: number[];
  euro?: number[];
}

export interface FieldCheck {
  mainHits: number[];
  euroHits: number[];
  /** 6aus49: true/false when known, null when the ticket has no Superzahl. */
  szMatch: boolean | null;
  /** Prize class number, null = no win (or not determinable). */
  cls: number | null;
  /** Label as on the official tables: "3 + 1", "4 + SZ", "3". */
  label: string;
  /** 6aus49 only: true when the ticket's Superzahl is missing. */
  szUnknown: boolean;
  /** Published quota in EUR for this class and draw, when available. */
  amount: number | null;
  /**
   * 6aus49 without a Superzahl on the ticket: the class the field would win if the Superzahl
   * matched (e.g. 9 for two matches). Set only when `cls` is null: not a win, only a possibility.
   */
  possibleCls: number | null;
  /** Fixed prize of `possibleCls` in EUR, when known. */
  possibleAmount: number | null;
  /** 6aus49 draws before the current class system: only the number of matches is meaningful. */
  classUnavailable: boolean;
}

export function checkField(field: FieldInput, draw: Draw, ticketSuperzahl?: number | null): FieldCheck {
  const game = GAMES[draw.game];
  const drawMain = new Set(draw.main);
  const mainHits = field.main.filter((n) => drawMain.has(n));
  const drawEuro = new Set(draw.euro ?? []);
  const euroHits = (field.euro ?? []).filter((n) => drawEuro.has(n));

  if (game.hasSuperzahl) {
    const szKnown = ticketSuperzahl !== undefined && ticketSuperzahl !== null && draw.superzahl != null;
    const szMatch = szKnown ? ticketSuperzahl === draw.superzahl : null;
    const k = mainHits.length;
    const szUnknown = ticketSuperzahl === undefined || ticketSuperzahl === null;
    const label = szMatch ? `${k} + SZ` : `${k}`;
    if (draw.date < LOTTO649_SYSTEM_FROM) {
      return {
        mainHits,
        euroHits,
        szMatch,
        cls: null,
        label,
        szUnknown,
        amount: null,
        possibleCls: null,
        possibleAmount: null,
        classUnavailable: true,
      };
    }
    const extra = szMatch ? 1 : 0;
    const classFor = (e: number) => game.classes.find((c) => c.main === k && c.extra === e)?.cls ?? null;
    const prizeFor = (c: number | null) =>
      c !== null && draw.date >= LOTTO649_FIXED_PRIZE_FROM ? (game.fixedPrizes[c] ?? null) : null;
    const cls = classFor(extra);
    // No Superzahl on the ticket and no class without it (two matches): "2 + SZ" would be class 9.
    const possibleCls = szUnknown && cls === null ? classFor(1) : null;
    return {
      mainHits,
      euroHits,
      szMatch,
      cls,
      label,
      szUnknown,
      amount: prizeFor(cls),
      possibleCls,
      possibleAmount: prizeFor(possibleCls),
      classUnavailable: false,
    };
  }

  const k = mainHits.length;
  const m = euroHits.length;
  const label = `${k} + ${m}`;
  let cls: number | null = null;
  let amount: number | null = null;
  if (draw.quotes && draw.quotes.length) {
    const idx = draw.quotes.findIndex(([l]) => l === `${k}+${m}`);
    if (idx >= 0) {
      cls = idx + 1;
      amount = draw.quotes[idx]![2] || null;
    }
  } else {
    // No published quotas (user-added draw): the class table of that draw's era.
    cls = ejClassOn(draw.date, k, m);
  }
  return {
    mainHits,
    euroHits,
    szMatch: null,
    cls,
    label,
    szUnknown: false,
    amount,
    possibleCls: null,
    possibleAmount: null,
    classUnavailable: false,
  };
}
