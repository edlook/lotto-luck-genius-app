import { SegmentedControl } from "@/components/ui";
import { useI18n } from "@/i18n/context";
import { LANGS, type Lang } from "@/i18n/format";

/** RU / EN / DE. Each label is written in its own language and marked with lang. */
export function LanguageSwitch({ labelledBy }: { labelledBy?: string }) {
  const { t, lang, setLang } = useI18n();
  return (
    <SegmentedControl<Lang>
      {...(labelledBy ? { labelledBy } : { label: t("topbar.language") })}
      options={LANGS.map((l) => ({ value: l, label: t(`lang.${l}`), lang: l }))}
      value={lang}
      onChange={setLang}
      block
    />
  );
}
