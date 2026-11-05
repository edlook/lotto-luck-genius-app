import { SegmentedControl } from "@/components/ui";
import { useI18n } from "@/i18n/context";
import { LANGS, type Lang } from "@/i18n/format";

/**
 * RU / EN / DE. Full names (each written in its own language, marked with lang) where
 * there is room; `compact` shows the codes and keeps the full name for screen readers.
 */
export function LanguageSwitch({ labelledBy, compact = false }: { labelledBy?: string; compact?: boolean }) {
  const { t, lang, setLang } = useI18n();
  return (
    <SegmentedControl<Lang>
      {...(labelledBy ? { labelledBy } : { label: t("topbar.language") })}
      options={LANGS.map((l) => ({
        value: l,
        lang: l,
        label: compact ? (
          <>
            <span aria-hidden="true">{l.toUpperCase()}</span>
            <span className="sr-only">{t(`lang.${l}`)}</span>
          </>
        ) : (
          t(`lang.${l}`)
        ),
      }))}
      value={lang}
      onChange={setLang}
      block
    />
  );
}
