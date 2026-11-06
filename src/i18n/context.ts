import { createContext, useContext, useEffect } from "react";
import type { Lang, Params } from "./format";
import type { Namespace } from "./namespaces";

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
  /** Starts loading an on-demand dictionary for the shown language (no-op when it is there). */
  loadNamespace: (ns: Namespace) => void;
  /** True when the on-demand dictionary of the shown language is loaded. */
  hasNamespace: (ns: Namespace) => boolean;
}

export const I18nContext = createContext<I18n | null>(null);

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

/**
 * Makes sure an on-demand dictionary (guide, coach) is loaded for the shown language and tells
 * whether it is there yet. Until it is, `t()` would return raw keys: render nothing or a
 * skeleton, as the callers do.
 */
export function useNamespace(ns: Namespace): boolean {
  const { loadNamespace, hasNamespace, lang } = useI18n();
  useEffect(() => {
    loadNamespace(ns);
  }, [ns, lang, loadNamespace]);
  return hasNamespace(ns);
}
