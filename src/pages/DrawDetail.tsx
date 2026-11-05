import { CalendarDays } from "lucide-react";
import { useParams } from "react-router";
import { BallRow, ButtonLink, Card, EmptyState, Skeleton, SkeletonGroup } from "@/components/ui";
import { PageHeader } from "@/components/layout/PageHeader";
import { useI18n } from "@/i18n/context";
import { useDraws } from "@/hooks/useDraws";
import { usePageMeta } from "@/hooks/usePageMeta";
import { isGameId, type GameId } from "@/lib/games";
import { isValidIsoDate } from "@/lib/drawCalendar";
import NotFound from "./NotFound";

// SCREEN: implemented in step 3 — numbers, era, source, my tickets for the date, quotas (site-structure.md §2.3).
function DrawDetailScreen({ game, iso }: { game: GameId; iso: string }) {
  const { t, date } = useI18n();
  const data = useDraws(game);
  const params = { date: date(iso), game: t(`game.${game}.name`) };
  usePageMeta("drawDetail", params);
  const draw = data.byDate.get(iso);
  return (
    <>
      <PageHeader title={t("draws.detail.title", params)} />
      {data.isLoading ? (
        <SkeletonGroup label={t("state.loading.aria")}>
          <Skeleton className="h-24 w-full rounded-lg" />
        </SkeletonGroup>
      ) : draw ? (
        <Card as="section" aria-label={t("draws.detail.numbers")}>
          <BallRow
            main={draw.main}
            {...(draw.euro ? { euro: draw.euro } : {})}
            {...(game === "649" ? { superzahl: draw.superzahl ?? null } : {})}
            size="lg"
          />
        </Card>
      ) : (
        <EmptyState
          icon={<CalendarDays />}
          title={t("draws.detail.notFound")}
          actions={
            <ButtonLink to="/draws" variant="secondary">
              {t("common.back")}
            </ButtonLink>
          }
        />
      )}
    </>
  );
}

export default function DrawDetail() {
  const { game, date } = useParams();
  if (!isGameId(game) || !date || !isValidIsoDate(date)) return <NotFound />;
  return <DrawDetailScreen game={game} iso={date} />;
}
