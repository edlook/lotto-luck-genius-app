/**
 * EuroJackpot format eras, confirmed by the official draw data
 * ("spielformel" field of eurojackpot.com, imported 2026-11-05):
 *   2012-03-23 … 2014-10-03  5 aus 50 und 2 aus 8
 *   2014-10-10 … 2022-03-18  5 aus 50 und 2 aus 10
 *   2022-03-25 …             5 aus 50 und 2 aus 12
 * Euro-number statistics must never mix eras.
 */
export interface EjEra {
  id: number;
  from: string;
  /** Inclusive last date, null for the current era. */
  to: string | null;
  euroPool: number;
}

export const EJ_ERAS: EjEra[] = [
  { id: 0, from: "2012-03-23", to: "2014-10-09", euroPool: 8 },
  { id: 1, from: "2014-10-10", to: "2022-03-24", euroPool: 10 },
  { id: 2, from: "2022-03-25", to: null, euroPool: 12 },
];

export const CURRENT_EJ_ERA: EjEra = EJ_ERAS[EJ_ERAS.length - 1]!;

export function ejEraOn(iso: string): EjEra {
  for (let i = EJ_ERAS.length - 1; i >= 0; i--) if (iso >= EJ_ERAS[i]!.from) return EJ_ERAS[i]!;
  return EJ_ERAS[0]!;
}

export function euroPoolOn(iso: string): number {
  return ejEraOn(iso).euroPool;
}
