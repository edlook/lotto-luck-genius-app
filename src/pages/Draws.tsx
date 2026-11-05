import { CalendarDays } from "lucide-react";
import { ButtonLink, EmptyState, ErrorState, Skeleton, SkeletonGroup } from "@/components/ui";
import { PageHeader } from "@/components/layout/PageHeader";
import { useI18n } from "@/i18n/context";
import { useGame } from "@/hooks/useGame";
import { useDraws } from "@/hooks/useDraws";
import { usePageMeta } from "@/hooks/usePageMeta";

// SCREEN: implemented in step 3 — data status, latest draw, date search, history list (site-structure.md §2.3).
export default function Draws() {
  const { t, tp, date } = useI18n();
  const [game] = useGame();
  const data = useDraws(game);
  usePageMeta("draws");
  return (
    <>
      <PageHeader title={t("draws.title", { game: t(`game.${game}.name`) })} />
      {data.isLoading ? (
        <SkeletonGroup label={t("state.loading.aria")}>
          <Skeleton className="h-40 w-full rounded-lg" />
        </SkeletonGroup>
      ) : data.draws.length === 0 ? (
        data.isError ? (
          <ErrorState
            title={t("error.network.title")}
            body={t("error.network.body")}
            retryLabel={t("common.retry")}
            onRetry={data.refetch}
          />
        ) : (
          <EmptyState
            icon={<CalendarDays />}
            title={t("empty.noData.title")}
            body={t("empty.noData.body")}
            actions={<ButtonLink to="/settings#import">{t("draws.empty.cta")}</ButtonLink>}
          />
        )
      ) : (
        <EmptyState
          icon={<CalendarDays />}
          title={tp("draws.status.count", data.draws.length)}
          body={data.lastDate ? t("sidebar.dataStatus", { date: date(data.lastDate) }) : undefined}
        />
      )}
    </>
  );
}
