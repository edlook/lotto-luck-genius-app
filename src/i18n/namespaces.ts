import type { Dict, Lang } from "./format";

/**
 * Dictionaries loaded on demand, apart from the app shell's (see scripts/build-i18n.mjs):
 * - guide: `guide.*`, the /guide page;
 * - coach: `tour.*`, `hint.*`, `settings.hints.*`, the first-launch tour and the tips.
 * Together they are a third of the copy, and most visits need neither.
 */
export type Namespace = "guide" | "coach";

const loaders: Record<Namespace, Record<Lang, () => Promise<Dict>>> = {
  guide: {
    ru: async () => (await import("./guide/ru.json")).default as Dict,
    en: async () => (await import("./guide/en.json")).default as Dict,
    de: async () => (await import("./guide/de.json")).default as Dict,
  },
  coach: {
    ru: async () => (await import("./coach/ru.json")).default as Dict,
    en: async () => (await import("./coach/en.json")).default as Dict,
    de: async () => (await import("./coach/de.json")).default as Dict,
  },
};

const cache = new Map<string, Dict>();

/** The dictionary if it was loaded before, else null. */
export const cachedNamespace = (ns: Namespace, lang: Lang): Dict | null => cache.get(`${ns}:${lang}`) ?? null;

export async function loadNamespaceDict(ns: Namespace, lang: Lang): Promise<Dict> {
  const hit = cache.get(`${ns}:${lang}`);
  if (hit) return hit;
  const dict = await loaders[ns][lang]();
  cache.set(`${ns}:${lang}`, dict);
  return dict;
}
