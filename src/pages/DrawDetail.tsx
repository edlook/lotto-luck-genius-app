import { Link, useParams } from "react-router";
import {
  CalendarClock,
  CalendarDays,
  CalendarX,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Ticket as TicketIcon,
} from "lucide-react";
import { BallRow, ButtonLink, Card, EmptyState, ErrorState, Section, Skeleton, SkeletonGroup } from "@/components/ui";
import { PageHeader } from "@/components/layout/PageHeader";
import { TicketCard } from "@/components/tickets/TicketCard";
import { useI18n } from "@/i18n/context";
import { useDraws } from "@/hooks/useDraws";
import { usePageMeta } from "@/hooks/usePageMeta";
import { isGameId, type GameId } from "@/lib/games";
import { berlinNow, isValidIsoDate } from "@/lib/drawCalendar";
import { classifyDrawDate, neighbours, ticketsForDate } from "@/lib/drawsView";
import { OFFICIAL_RESULTS } from "@/lib/links";
import { useLocalStore } from "@/lib/storage/localStore";
import { ticketsStore } from "@/lib/storage/stores";
import type { Draw } from "@/lib/ticketCheck";
import { evaluateTicket } from "@/lib/ticketStatus";
import NotFound from "./NotFound";

function Quotes({ draw }: { draw: Draw }) {
  const { t, num, money } = useI18n();
  const quotes = draw.quotes ?? [];
  if (!quotes.length) {
    return (
      <p className="text-body text-muted-foreground">
        {t("draws.detail.quotes")}{" "}
        <a
          href={OFFICIAL_RESULTS[draw.game]}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex min-h-11 items-center gap-1 font-semibold text-foreground underline underline-offset-4"
        >
          {t("common.officialQuotes")}
          <ExternalLink aria-hidden="true" className="size-4" />
        </a>
      </p>
    );
  }
  const jackpotOpen = quotes[0] && quotes[0][1] === 0 && draw.jackpot;
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto" role="region" tabIndex={0} aria-label={t("draws.detail.quotes.title")}>
        <table className="w-full min-w-72 text-caption sm:text-body">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th scope="col" className="py-2 pr-2 font-semibold">
                {t("common.class")}
              </th>
              <th scope="col" className="py-2 pr-2 font-semibold">
                {t("common.matches")}
              </th>
              <th scope="col" className="py-2 pr-2 text-right font-semibold">
                {t("draws.detail.quotes.winners")}
              </th>
              <th scope="col" className="py-2 text-right font-semibold">
                {t("draws.detail.quotes.amount")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {quotes.map(([label, winners, amount], i) => (
              <tr key={label}>
                <th scope="row" className="py-2 pr-2 text-left font-semibold tabular-nums">
                  {i + 1}
                </th>
                <td className="py-2 pr-2 tabular-nums">{label.replace("+", " + ")}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{num(winners)}</td>
                <td className="py-2 text-right tabular-nums">
                  {winners === 0 ? t("draws.detail.quotes.unclaimed") : money(amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {jackpotOpen ? (
        <p className="text-caption text-muted-foreground">
          {t("draws.detail.quotes.jackpot", {
            amount: money(draw.jackpot ?? 0),
          })}
        </p>
      ) : null}
    </div>
  );
}

function DrawDetailScreen({ game, iso }: { game: GameId; iso: string }) {
  const { t, date, weekday } = useI18n();
  const data = useDraws(game);
  const tickets = useLocalStore(ticketsStore);
  const gameName = t(`game.${game}.name`);
  const params = { date: date(iso), game: gameName };
  usePageMeta("drawDetail", params);
  const today = berlinNow().date;
  const title = <PageHeader title={t("draws.detail.title", params)} eyebrow={gameName} />;

  const kind = classifyDrawDate(game, iso, today, data.byDate);
  const nb = neighbours(data.draws, iso);
  const mine = ticketsForDate(tickets, game, iso);
  const evaluations = mine.map((tk) => evaluateTicket(tk, data.byDate, today));

  const nav = (
    <nav aria-label={t("draws.list.aria")} className="grid grid-cols-2 gap-2">
      {nb.prev ? (
        <ButtonLink
          to={`/draws/${game}/${nb.prev}`}
          variant="ghost"
          icon={<ChevronLeft />}
          className="justify-self-start text-left whitespace-normal"
        >
          {t("draws.detail.prev")}
        </ButtonLink>
      ) : (
        <span />
      )}
      {nb.next ? (
        <ButtonLink
          to={`/draws/${game}/${nb.next}`}
          variant="ghost"
          className="col-start-2 justify-self-end text-right whitespace-normal"
        >
          {t("draws.detail.next")}
          <ChevronRight aria-hidden="true" />
        </ButtonLink>
      ) : null}
    </nav>
  );

  const myTickets = (
    <Section title={t("draws.detail.myTickets")}>
      {mine.length ? (
        <ul className="flex flex-col gap-3">
          {mine.map((tk, i) => (
            <li key={tk.id}>
              <TicketCard ticket={tk} evaluation={evaluations[i]!} level={3} onlyDate={iso} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 text-body text-muted-foreground">
          <TicketIcon aria-hidden="true" className="size-5 shrink-0" />
          {t("draws.detail.myTickets.none")}
        </p>
      )}
      {mine.length ? (
        <Link
          to="/tickets"
          className="inline-flex min-h-11 items-center self-start font-semibold underline underline-offset-4"
        >
          {t("nav.tickets")}
        </Link>
      ) : null}
    </Section>
  );

  if (data.isLoading && kind.kind !== "future" && kind.kind !== "beforeStart") {
    return (
      <>
        {title}
        <SkeletonGroup label={t("state.loading.aria")}>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </SkeletonGroup>
      </>
    );
  }

  if (kind.kind === "found") {
    const d = kind.draw;
    return (
      <>
        {title}
        <div className="flex flex-col gap-8">
          <Card as="section" aria-labelledby="draw-numbers" className="flex flex-col gap-4">
            <h2 id="draw-numbers" className="text-body font-semibold text-muted-foreground">
              {t("draws.detail.numbers")} · <span className="capitalize">{weekday(d.date)}</span>
            </h2>
            <BallRow
              main={d.main}
              {...(d.euro ? { euro: d.euro } : {})}
              {...(game === "649" ? { superzahl: d.superzahl ?? null } : {})}
              size="lg"
            />
            <ul className="flex flex-col gap-1 text-caption text-muted-foreground">
              {game === "ej" && d.euroPool ? <li>{t("draws.detail.epoch", { pool: d.euroPool })}</li> : null}
              <li>
                {t("draws.detail.sourceRow", {
                  source:
                    d.source === "user"
                      ? t("draws.source.user")
                      : `${t("draws.source.archive")}${data.meta ? `, ${data.meta.sourceName}` : ""}`,
                })}
              </li>
            </ul>
          </Card>
          {nav}
          {myTickets}
          <Section title={t("draws.detail.quotes.title")}>
            <Quotes draw={d} />
          </Section>
        </div>
      </>
    );
  }

  let state;
  switch (kind.kind) {
    case "future":
      state = (
        <EmptyState
          icon={<CalendarClock />}
          title={t("draws.detail.future", { date: date(iso) })}
          actions={
            <ButtonLink to="/draws" variant="secondary">
              {t("nav.draws")}
            </ButtonLink>
          }
        />
      );
      break;
    case "beforeStart":
      state = (
        <EmptyState
          icon={<CalendarX />}
          title={t("draws.detail.beforeStart", {
            game: gameName,
            date: date(kind.start),
          })}
          actions={
            <ButtonLink to="/draws" variant="secondary">
              {t("nav.draws")}
            </ButtonLink>
          }
        />
      );
      break;
    case "noDrawDay":
      state = (
        <EmptyState
          icon={<CalendarX />}
          title={t("draws.noDrawDay", {
            dates: kind.nearest.map((x) => date(x)).join(", ") || "—",
          })}
          actions={kind.nearest.map((x) => (
            <ButtonLink key={x} to={`/draws/${game}/${x}`} variant="secondary">
              {date(x)}
            </ButtonLink>
          ))}
        />
      );
      break;
    case "noSuchDraw":
      state = (
        <EmptyState
          icon={<CalendarX />}
          title={t("draws.detail.noSuchDraw")}
          actions={
            <ButtonLink to="/draws" variant="secondary">
              {t("nav.draws")}
            </ButtonLink>
          }
        />
      );
      break;
    default:
      state = data.isError ? (
        <ErrorState
          title={t("error.network.title")}
          body={t("error.network.body")}
          retryLabel={t("common.retry")}
          onRetry={data.refetch}
        />
      ) : (
        <EmptyState
          icon={<CalendarDays />}
          title={t("draws.detail.notFound")}
          body={t("tickets.status.notLoaded", { date: date(iso) })}
          actions={
            <>
              <ButtonLink to="/settings#manual-draw">{t("tickets.card.manualDraw")}</ButtonLink>
              <ButtonLink to="/settings#import" variant="ghost">
                {t("tickets.card.importDraw")}
              </ButtonLink>
            </>
          }
        />
      );
  }

  return (
    <>
      {title}
      <div className="flex flex-col gap-8">
        {state}
        {kind.kind === "missing" || kind.kind === "future" ? myTickets : null}
        {kind.kind !== "beforeStart" ? nav : null}
      </div>
    </>
  );
}

export default function DrawDetail() {
  const { game, date } = useParams();
  if (!isGameId(game) || !date || !isValidIsoDate(date)) return <NotFound />;
  return <DrawDetailScreen key={`${game}/${date}`} game={game} iso={date} />;
}
