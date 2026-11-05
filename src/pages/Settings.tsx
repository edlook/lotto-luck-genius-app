import { Settings as SettingsIcon } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/layout/PageHeader";
import { useI18n } from "@/i18n/context";
import { usePageMeta } from "@/hooks/usePageMeta";

// SCREEN: implemented in step 3 — language, default game, #import, #manual-draw, tickets JSON, tech (site-structure.md §2.7).
export default function Settings() {
  const { t } = useI18n();
  usePageMeta("settings");
  return (
    <>
      <PageHeader title={t("settings.title")} />
      <EmptyState icon={<SettingsIcon />} title={t("settings.import.title")} body={t("settings.import.intro")} />
    </>
  );
}
