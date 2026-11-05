import { Info } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/layout/PageHeader";
import { useI18n } from "@/i18n/context";
import { usePageMeta } from "@/hooks/usePageMeta";

// SCREEN: implemented in step 3 — anchors #principles #generator #odds #stats #data #limits (site-structure.md §2.6).
export default function About() {
  const { t } = useI18n();
  usePageMeta("about");
  return (
    <>
      <PageHeader title={t("about.title")} />
      <EmptyState icon={<Info />} title={t("about.principles.title")} body={t("about.intro")} />
    </>
  );
}
