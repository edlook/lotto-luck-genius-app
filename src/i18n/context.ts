import { createContext, useContext } from "react";
import type { Lang, Params } from "./format";

export interface I18n {
  lang: Lang;
  locale: string;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Params) => string;
  /** Plural: key without or with ".plural"; `{n}` is filled automatically. */
  tp: (key: string, n: number, params?: Params) => string;
  has: (key: string) => boolean;
  num: (v: number, opts?: Intl.NumberFormatOptions) => string;
  money: (v: number) => string;
  percent: (fraction: number, digits?: number) => string;
  date: (iso: string, opts?: Intl.DateTimeFormatOptions) => string;
  weekday: (iso: string) => string;
}

export const I18nContext = createContext<I18n | null>(null);

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
