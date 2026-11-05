import { ChartColumn } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/layout/PageHeader";
import { useI18n } from "@/i18n/context";
import { useGame } from "@/hooks/useGame";
import { usePageMeta } from "@/hooks/usePageMeta";

// SCREEN: implemented in step 3 — frequencies, Monte Carlo uniformity test, distributions (site-structure.md §2.4).
export default function Stats() {
  const { t } = useI18n();
  const [game] = useGame();
  usePageMeta("stats");
  return (
    <>
      <PageHeader title={t("stats.title", { game: t(`game.${game}.name`) })} />
      <EmptyState icon={<ChartColumn />} title={t("stats.result.title")} body={t("stats.frame")} />
    </>
  );
}
