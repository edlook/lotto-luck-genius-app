export type Lang = "ru" | "en" | "de";
export const LANGS: Lang[] = ["ru", "en", "de"];
export type Dict = Record<string, string>;
export type Params = Record<string, string | number>;

export function interpolate(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}

/** Picks the plural form from "one: … / few: … / many: …". */
export function pickPlural(text: string, n: number, locale: string): string {
  const forms: Record<string, string> = {};
  for (const part of text.split(" / ")) {
    const m = /^(zero|one|two|few|many|other):\s*(.*)$/s.exec(part.trim());
    if (m) forms[m[1]!] = m[2]!;
  }
  const cat = new Intl.PluralRules(locale).select(n);
  return forms[cat] ?? forms.other ?? forms.many ?? Object.values(forms)[0] ?? text;
}
