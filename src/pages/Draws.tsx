import { Fragment, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { CalendarDays, ChevronRight, Search, Ticket as TicketIcon } from "lucide-react";
import {
  BallRow,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Section,
  Skeleton,
  SkeletonGroup,
} from "@/components/ui";
import { PageHeader } from "@/components/layout/PageHeader";
import { DrawDataStatus } from "@/components/common/DrawDataStatus";
import { focusLater } from "@/components/common/focus";
import { DateInput } from "@/components/tickets/TicketEditor";
import { useI18n } from "@/i18n/context";
import { useGame } from "@/hooks/useGame";
import { useDraws } from "@/hooks/useDraws";
import { usePageMeta } from "@/hooks/usePageMeta";
import { GAME_START, berlinNow } from "@/lib/drawCalendar";
import { eraDividerBetween, ticketDates } from "@/lib/drawsView";
import { useLocalStore } from "@/lib/storage/localStore";
import { ticketsStore } from "@/lib/storage/stores";
import type { Draw } from "@/lib/ticketCheck";

const PAGE = 50;

function drawBalls(d: Draw, size: "sm" | "md" | "lg") {
  return (
    <BallRow
      main={d.main}
      {...(d.euro ? { euro: d.euro } : {})}
      {...(d.game === "649" ? { superzahl: d.superzahl ?? null } : {})}
      size={size}
    />
  );
}

export default function Draws() {
  const { t, tp, date, weekday } = useI18n();
  const [game] = useGame();
  const data = useDraws(game);
  const drawSummary = (d: Draw) => {
    const numbers = d.main.join(", ");
    if (d.euro?.length) return t("ball.summary.ej", { numbers, euro: d.euro.join(", ") });
    if (d.game === "649")
      return d.superzahl == null ? t("ball.summary.649.noSz", { numbers }) : t("ball.summary.649", { numbers, sz: d.superzahl });
    return numbers;
  };
  const tickets = useLocalStore(ticketsStore);
  const navigate = useNavigate();
  usePageMeta("draws");
  const [shown, setShown] = useState(PAGE);
  const [query, setQuery] = useState("");

  // Show the first page again after switching games (adjusted during render).
  const [lastGame, setLastGame] = useState(game);
  if (lastGame !== game) {
    setLastGame(game);
    setShown(PAGE);
    setQuery("");
  }

  const mine = useMemo(() => ticketDates(tickets, game), [tickets, game]);
  // Newest first; only the visible page is rendered (5 000+ rows would be slow on phones).
  const rows = useMemo(() => data.draws.slice(-shown).reverse(), [data.draws, shown]);
  const total = data.draws.length;
  const latest = data.draws[total - 1];
  const previous = data.draws[total - 2];
  const today = berlinNow().date;

  const search = (e: FormEvent) => {
    e.preventDefault();
    if (query) navigate(`/draws/${game}/${query}`);
  };

  const title = t("draws.title", { game: t(`game.${game}.name`) });

  if (data.isLoading) {
    return (
      <>
        <PageHeader title={title} />
        <SkeletonGroup label={t("state.loading.aria")} className="gap-4">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-40 w-full rounded-lg" />
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </SkeletonGroup>
      </>
    );
  }

  if (total === 0) {
    return (
      <>
        <PageHeader title={title} />
        {data.isError ? (
          <ErrorState
            title={t("error.network.title")}
            body={t("error.network.body")}
            retryLabel={t("common.retry")}
            onRetry={data.refetch}
            actions={
              <ButtonLink to="/settings#import" variant="ghost">
                {t("draws.empty.cta")}
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState
            icon={<CalendarDays />}
            title={t("empty.noData.title")}
            body={t("empty.noData.body")}
            actions={<ButtonLink to="/settings#import">{t("draws.empty.cta")}</ButtonLink>}
          />
        )}
      </>
    );
  }

  return (
    <>
      <PageHeader title={title} />
      <div className="flex flex-col gap-8">
        <DrawDataStatus data={data} />

        {latest ? (
          <Section title={t("draws.latest.title")}>
            <Card className="flex flex-col gap-4">
              <p className="text-body font-semibold">
                <span className="capitalize">{weekday(latest.date)}</span> {date(latest.date)}
              </p>
              {drawBalls(latest, "md")}
              <p className="flex items-center gap-2 text-body text-muted-foreground">
                <TicketIcon aria-hidden="true" className="size-5 shrink-0" />
                {mine.get(latest.date)
                  ? tp("draws.latest.myTickets", mine.get(latest.date) ?? 0)
                  : t("draws.latest.noTickets")}
              </p>
              <div className="flex flex-wrap gap-2">
                <ButtonLink to={`/draws/${game}/${latest.date}`} variant="secondary">
                  {t("draws.quick.latest")}
                </ButtonLink>
                {previous ? (
                  <ButtonLink to={`/draws/${game}/${previous.date}`} variant="ghost">
                    {t("draws.quick.previous")}
                  </ButtonLink>
                ) : null}
              </div>
            </Card>
          </Section>
        ) : null}

        <form onSubmit={search} className="flex flex-col gap-3" role="search">
          <Field
            label={t("draws.search.label")}
            help={t("draws.search.range", { first: date(data.draws[0]!.date), last: date(latest!.date) })}
          >
            <DateInput value={query} onChange={setQuery} min={GAME_START[game]} max={today} />
          </Field>
          <Button type="submit" variant="primary" icon={<Search />} disabled={!query} className="self-start">
            {t("draws.search.cta")}
          </Button>
        </form>

        <Section title={t("draws.list.aria")} description={t("draws.list.shown", { shown: rows.length, total })}>
          <ol className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {rows.map((d, i) => {
              const older = rows[i + 1];
              const divider = older ? eraDividerBetween(game, d.date, older.date) : null;
              const count = mine.get(d.date) ?? 0;
              return (
                <Fragment key={d.date}>
                  <li>
                    <Link
                      id={`draw-row-${d.date}`}
                      to={`/draws/${game}/${d.date}`}
                      aria-label={
                        t("draws.row.aria", {
                          date: date(d.date),
                          // Same sentence as the ball row: Euro numbers / Superzahl named, not appended (QA B17).
                          numbers: drawSummary(d),
                        }) + (count ? `. ${t("draws.row.myTickets")}: ${count}` : "")
                      }
                      className="flex min-h-14 items-center gap-3 px-3 py-2 outline-offset-[-2px] hover:bg-surface-2 sm:px-4"
                    >
                      <span className="flex w-24 shrink-0 flex-col text-caption leading-tight sm:w-28">
                        <span className="font-semibold text-foreground tabular-nums">{date(d.date)}</span>
                        <span className="text-muted-foreground capitalize">{weekday(d.date)}</span>
                      </span>
                      <span className="min-w-0 flex-1">{drawBalls(d, "sm")}</span>
                      {count ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-caption font-semibold text-primary">
                          <TicketIcon aria-hidden="true" className="size-3.5" />
                          <span className="max-sm:sr-only">{t("draws.row.myTickets")}</span>
                        </span>
                      ) : null}
                      <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                  {divider ? (
                    <li className="bg-surface-2 px-4 py-2 text-caption font-semibold text-muted-foreground">
                      {t(divider === "2014-10-10" ? "draws.epoch.divider.2014" : "draws.epoch.divider")}
                    </li>
                  ) : null}
                </Fragment>
              );
            })}
          </ol>
          {rows.length < total ? (
            <Button
              variant="secondary"
              block
              onClick={() => {
                const firstNew = data.draws[total - rows.length - 1];
                setShown((n) => n + PAGE);
                // Keyboard users continue where the new rows start.
                if (firstNew) focusLater(() => document.getElementById(`draw-row-${firstNew.date}`));
              }}
            >
              {t("common.loadMore")}
            </Button>
          ) : null}
        </Section>
      </div>
    </>
  );
}
