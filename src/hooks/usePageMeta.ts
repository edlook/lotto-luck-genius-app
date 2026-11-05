import { useEffect } from "react";
import { useI18n } from "@/i18n/context";
import type { Params } from "@/i18n/format";

/** Sets document.title and the meta description from the seo.* keys of the copy deck. */
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
  }, [page, key, t, lang]);
}
