/**
 * Minimal i18n without dependencies.
 * - Dictionaries: src/i18n/{ru,en,de}.json, generated from texts/site-copy.md
 *   by scripts/build-i18n.mjs. RU is bundled; EN/DE are loaded on demand.
 * - Placeholders `{name}`; plural keys `*.plural` with forms "one: … / few: … / many: …"
 *   (RU) or "one: … / other: …" (EN/DE), chosen with Intl.PluralRules.
 * - Language is stored in localStorage (`llg.lang`) and mirrored to <html lang>.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import ru from "./ru.json";
import { interpolate, pickPlural, type Dict, type Lang } from "./format";
import { toast } from "@/components/ui/toastStore";
import { I18nContext, type I18n } from "./context";
import { cachedNamespace, loadNamespaceDict, type Namespace } from "./namespaces";

const STORAGE_KEY = "llg.lang";
const LOCALES: Record<Lang, string> = { ru: "ru-RU", en: "en-GB", de: "de-DE" };

const loaders: Record<Lang, () => Promise<Dict>> = {
  ru: async () => ru as Dict,
  en: async () => (await import("./en.json")).default as Dict,
  de: async () => (await import("./de.json")).default as Dict,
};

function readStoredLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "ru" || v === "en" || v === "de") return v;
  } catch {
    /* storage unavailable */
  }
  return "ru";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang);
  const [dict, setDict] = useState<Dict>(ru as Dict);
  // The language whose dictionary is shown. <html lang> and number formats follow it, so they
  // never run ahead of the texts (QA B16).
  const [shown, setShown] = useState<Lang>("ru");
  // On-demand dictionaries (guide, coach) of the shown language.
  const [extra, setExtra] = useState<{ lang: Lang; dicts: Partial<Record<Namespace, Dict>> }>({ lang: "ru", dicts: {} });

  useEffect(() => {
    let alive = true;
    loaders[lang]().then(
      (d) => {
        if (!alive) return;
        setDict(d);
        setShown(lang);
        document.documentElement.lang = lang;
      },
      () => {
        // Chunk missing (offline on a first visit, tab older than the deployed build): keep the
        // language that is on screen and say so.
        if (!alive) return;
        setLangState(shown);
        toast.error(dict["error.network.title"] ?? (ru as Dict)["error.network.title"] ?? "");
      },
    );
    return () => {
      alive = false;
    };
    // `shown` and `dict` are only read on failure, never a reason to reload the dictionary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const loadNamespace = useCallback(
    (ns: Namespace) => {
      const lang = shown;
      const have = (cur: typeof extra) => cur.lang === lang && cur.dicts[ns] !== undefined;
      const ready = cachedNamespace(ns, lang);
      const put = (d: Dict) =>
        setExtra((cur) => (have(cur) ? cur : { lang, dicts: { ...(cur.lang === lang ? cur.dicts : {}), [ns]: d } }));
      if (ready) put(ready);
      else
        loadNamespaceDict(ns, lang).then(put, () => {
          /* offline on a first visit: the screen keeps its skeleton */
        });
    },
    [shown],
  );

  const value = useMemo<I18n>(() => {
    const locale = LOCALES[shown];
    const namespaces = extra.lang === shown ? extra.dicts : {};
    const merged: Dict = Object.assign({}, ...Object.values(namespaces));
    const lookup = (key: string) => dict[key] ?? merged[key] ?? (ru as Dict)[key] ?? key;
    const nf = (o?: Intl.NumberFormatOptions) => new Intl.NumberFormat(locale, o);
    return {
      lang: shown,
      locale,
      setLang,
      t: (key, params) => interpolate(lookup(key), params),
      tp: (key, n, params) => {
        const k = key.endsWith(".plural") ? key : `${key}.plural`;
        return interpolate(pickPlural(lookup(k), n, locale), { n: nf().format(n), ...params });
      },
      has: (key) => key in dict || key in merged || key in (ru as Dict),
      loadNamespace,
      hasNamespace: (ns) => namespaces[ns] !== undefined,
      num: (v, o) => nf(o).format(v),
      money: (v) => nf({ style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v),
      percent: (f, digits = 2) =>
        nf({ style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(f),
      // RU/DE: 03.11.2026. EN: "3 Nov 2026" (dateStyle medium) instead of 03/11/2026,
      // which US readers would take for 11 March.
      date: (iso, o) =>
        new Intl.DateTimeFormat(
          locale,
          o
            ? { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric", ...o }
            : shown === "en"
              ? { timeZone: "UTC", dateStyle: "medium" }
              : { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" },
        ).format(new Date(`${iso}T00:00:00Z`)),
      weekday: (iso) =>
        new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "short" }).format(new Date(`${iso}T00:00:00Z`)),
    };
  }, [dict, shown, setLang, extra, loadNamespace]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
