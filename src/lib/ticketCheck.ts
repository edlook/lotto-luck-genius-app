/**
 * Checks one field of a ticket against one draw and returns the prize class.
 *
 * EuroJackpot: class from (main hits, Euro hits). For draws of older format
 * eras the published quota labels ("k+m") are used when available.
 * Lotto 6aus49: if the ticket has no Superzahl, only classes without SZ can
 * be determined; the result is flagged `szUnknown` (class 9 "2 + SZ" and the
 * "+ SZ" upgrades cannot be confirmed).
 */
import { GAMES, type GameId } from "./games";

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
    const extra = szMatch ? 1 : 0;
    const cls = game.classes.find((c) => c.main === k && c.extra === extra)?.cls ?? null;
    const label = szMatch ? `${k} + SZ` : `${k}`;
    const amount = cls !== null ? (game.fixedPrizes[cls] ?? null) : null;
    return {
      mainHits,
      euroHits,
      szMatch,
      cls,
      label,
      szUnknown: ticketSuperzahl === undefined || ticketSuperzahl === null,
      amount,
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
    cls = game.classes.find((c) => c.main === k && c.extra === m)?.cls ?? null;
  }
  return { mainHits, euroHits, szMatch: null, cls, label, szUnknown: false, amount };
}
