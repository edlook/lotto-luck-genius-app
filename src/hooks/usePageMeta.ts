import { useEffect } from "react";
import { useI18n } from "@/i18n/context";
import type { Params } from "@/i18n/format";

/**
 * Sets document.title, <meta name="description"> and <html lang> for a screen from the
 * seo.{page}.title / seo.{page}.description keys. Call once at the top of every screen.
 * @example usePageMeta("drawDetail", { date: date(iso), game: t(`game.${g}.name`) })
 */
export function usePageMeta(page: string, params?: Params) {
  const { t, lang } = useI18n();
  const key = JSON.stringify(params ?? {});
  useEffect(() => {
    const p = JSON.parse(key) as Params;
    document.title = t(`seo.${page}.title`, p);
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = t(`seo.${page}.description`, p);
    document.documentElement.lang = lang;
  }, [page, key, t, lang]);
}
