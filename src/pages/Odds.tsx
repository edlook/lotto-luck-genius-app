import { Percent } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/layout/PageHeader";
import { useI18n } from "@/i18n/context";
import { useGame } from "@/hooks/useGame";
import { usePageMeta } from "@/hooks/usePageMeta";

// SCREEN: implemented in step 3 — class table, EV estimate, yearly calculator (site-structure.md §2.5).
export default function Odds() {
  const { t } = useI18n();
  const [game] = useGame();
  usePageMeta("odds");
  return (
    <>
      <PageHeader title={t("odds.title", { game: t(`game.${game}.name`) })} />
      <EmptyState icon={<Percent />} title={t(`odds.headline.${game}`)} body={t("odds.headline.note")} />
    </>
  );
}
