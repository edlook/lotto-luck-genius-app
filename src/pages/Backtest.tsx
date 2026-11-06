import { useLocation } from "react-router";
import { FlaskConical } from "lucide-react";
import { ButtonLink, EmptyState, ErrorState, Skeleton, SkeletonGroup, Tabs } from "@/components/ui";
import { PageHeader } from "@/components/layout/PageHeader";
import { HonestyNote } from "@/components/common/HonestyNote";
import { PopularityPanel } from "@/components/backtest/PopularityPanel";
import { StrategiesPanel } from "@/components/backtest/StrategiesPanel";
import { useI18n } from "@/i18n/context";
import { useDraws } from "@/hooks/useDraws";
import { useGame } from "@/hooks/useGame";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function Backtest() {
  const { t } = useI18n();
  const [game, setGame] = useGame();
  const data = useDraws(game);
  const { hash } = useLocation();
  usePageMeta("backtest");

  let body;
  if (data.isLoading) {
    body = (
      <SkeletonGroup label={t("state.loading.aria")} className="gap-4">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-14 w-60" />
      </SkeletonGroup>
    );
  } else if (data.draws.length === 0) {
    body = data.isError ? (
      <ErrorState
        title={t("error.network.title")}
        body={t("error.network.body")}
        retryLabel={t("common.retry")}
        onRetry={data.refetch}
      />
    ) : (
      <EmptyState
        icon={<FlaskConical />}
        title={t("empty.noData.title")}
        body={t("stats.empty")}
        actions={<ButtonLink to="/settings#import">{t("common.toImport")}</ButtonLink>}
      />
    );
  } else {
    body = (
      <Tabs
        label={t("backtest.tabs.label")}
        defaultValue={hash === "#popularity" ? "popularity" : "strategies"}
        items={[
          {
            id: "strategies",
            label: t("backtest.tab.strategies"),
            panel: <StrategiesPanel game={game} draws={data.draws} />,
          },
          {
            id: "popularity",
            label: t("backtest.tab.popularity"),
            panel: <PopularityPanel game={game} draws={data.draws} onSwitchToEj={() => setGame("ej")} />,
          },
        ]}
      />
    );
  }

  return (
    <>
      <PageHeader title={t("backtest.title")} eyebrow={t(`game.${game}.name`)} />
      <HonestyNote className="mb-6">{t("backtest.frame")}</HonestyNote>
      {body}
    </>
  );
}
