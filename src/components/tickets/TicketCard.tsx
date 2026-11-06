import { useId, useState } from "react";
import { Link } from "react-router";
import { CalendarClock, CircleDashed, CircleHelp, Pencil, Trash2, Trophy, TriangleAlert } from "lucide-react";
import { BallRow, Button, ButtonLink, Card } from "@/components/ui";
import { useI18n } from "@/i18n/context";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { OFFICIAL_RESULTS } from "@/lib/links";
import type { Ticket } from "@/lib/storage/stores";
import type { FieldCheck } from "@/lib/ticketCheck";
import type { TicketDrawResult, TicketEvaluation } from "@/lib/ticketStatus";
import { ticketCardId } from "./ticketIds";

export interface TicketCardProps {
  ticket: Ticket;
  evaluation: TicketEvaluation;
  /** Not needed with `onlyDate` (no actions are shown there). */
  onEdit?: () => void;
  onDelete?: () => void;
  /** Heading level inside the page. */
  level?: 2 | 3;
  /** Compact variant for the draw detail screen: no actions, only this date. */
  onlyDate?: string;
}

const SHOWN_DRAWS = 3;

/** Result line of one field in one checked draw, with the prize amount when known. */
function FieldResult({ check, game }: { check: FieldCheck; game: Ticket["game"] }) {
  const { t, money } = useI18n();
  const k = check.mainHits.length;
  if (check.cls === null) {
    if (check.classUnavailable) {
      return <span className="text-muted-foreground">{t("tickets.result.oldSystem", { n: k })}</span>;
    }
    if (check.possibleCls !== null) {
      // Not a win: it depends on a Superzahl the ticket does not have yet.
      return (
        <span className="inline-flex items-start gap-1.5 text-foreground">
          <CircleHelp aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>
            {t("tickets.result.possible", { n: k, class: check.possibleCls })}
            {check.possibleAmount !== null
              ? ` ${t("tickets.result.possible.amount", { amount: money(check.possibleAmount) })}`
              : ""}
          </span>
        </span>
      );
    }
    return <span className="text-muted-foreground">{t("tickets.result.noWin")}</span>;
  }
  const amount =
    check.amount !== null
      ? game === "ej"
        ? t("tickets.result.amount.quote", { amount: money(check.amount) })
        : t("tickets.result.amount.fixed")
      : null;
  return (
    <span className="flex flex-col gap-0.5">
      <span className="inline-flex items-center gap-1.5 font-semibold text-success">
        <Trophy aria-hidden="true" className="size-4 shrink-0" />
        {check.szUnknown
          ? t("tickets.result.noSz", { n: k, class: check.cls })
          : t("tickets.result.win", { class: check.cls, matches: check.label })}
      </span>
      {amount ? (
        <span className="text-caption text-muted-foreground">{amount}</span>
      ) : (
        <a
          href={OFFICIAL_RESULTS[game]}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex min-h-11 items-center self-start text-caption text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {t("tickets.result.amount.official")}
        </a>
      )}
    </span>
  );
}

function DrawResult({ r, ticket }: { r: TicketDrawResult; ticket: Ticket }) {
  const { t, date } = useI18n();
  const multi = ticket.fields.length > 1;
  return (
    <li className="flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0">
      <Link
        to={`/draws/${ticket.game}/${r.date}`}
        className="inline-flex min-h-11 items-center self-start font-semibold text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground"
      >
        {t("tickets.status.checked", { date: date(r.date) })}
      </Link>
      <ul className="flex flex-col gap-1.5">
        {r.fields.map((f, i) => (
          <li key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-body">
            {multi ? (
              <span className="text-caption text-muted-foreground">{t("tickets.card.field", { n: i + 1 })}:</span>
            ) : null}
            <FieldResult check={f} game={ticket.game} />
            {f.mainHits.length || f.euroHits.length ? (
              <span className="w-full text-caption text-muted-foreground">
                {t("tickets.result.matchesLabel", {
                  numbers: [
                    f.mainHits.join(", "),
                    f.euroHits.length ? `${t("ball.label.euro")} ${f.euroHits.join(", ")}` : "",
                  ]
                    .filter(Boolean)
                    .join("; "),
                })}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </li>
  );
}

/**
 * One saved ticket: dates and status, the fields as balls (matched numbers filled with a
 * mark, missed ones outlined, checked against the latest checked draw), a result per
 * checked draw, and what to do when a draw is not loaded yet.
 */
export function TicketCard({ ticket, evaluation: ev, onEdit, onDelete, level = 2, onlyDate }: TicketCardProps) {
  const { t, tp, date } = useI18n();
  const headingId = useId();
  const [showAll, setShowAll] = useState(false);
  // 32 px balls on phones keep a 6 + SZ / 5 + 2 row on one line; the balls are not buttons.
  const wide = useMediaQuery("(min-width: 40rem)");
  const H = level === 2 ? "h2" : "h3";

  const dates = [...ticket.drawDates].sort();
  const checked = ev.results.filter((r) => r.state === "checked" && (!onlyDate || r.date === onlyDate)).reverse();
  const focus = checked[0];
  const title =
    onlyDate || dates.length === 1
      ? t("tickets.card.draw", { date: date(onlyDate ?? dates[0]!) })
      : t("tickets.card.draws.range", {
          first: date(dates[0]!),
          last: date(dates[dates.length - 1]!),
          n: dates.length,
        });

  const visible = showAll ? checked : checked.slice(0, SHOWN_DRAWS);
  const hidden = checked.length - visible.length;
  const szMissing = ticket.game === "649" && (ticket.superzahl === null || ticket.superzahl === undefined);
  const notLoaded = onlyDate ? ev.notLoaded.filter((d) => d === onlyDate) : ev.notLoaded;
  const pending = onlyDate
    ? (ev.results.find((r) => r.date === onlyDate && r.state === "pending")?.date ?? null)
    : ev.nextPending;

  return (
    <Card
      as="article"
      id={onlyDate ? undefined : ticketCardId(ticket.id)}
      tabIndex={-1}
      aria-labelledby={headingId}
      className="flex scroll-mt-32 flex-col gap-4 outline-offset-4"
    >
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <H id={headingId} className="text-body font-bold text-foreground">
          {title}
        </H>
        {ev.status === "won" && ev.bestClass !== null ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-caption font-semibold text-success">
            <Trophy aria-hidden="true" className="size-3.5" />
            {dates.length > 1 && !onlyDate
              ? t("tickets.result.bestOfSeries", { class: ev.bestClass })
              : `${t("common.class")} ${ev.bestClass}`}
          </span>
        ) : null}
      </header>

      <ul className="flex flex-col gap-3">
        {ticket.fields.map((f, i) => {
          const check = focus?.fields[i];
          return (
            <li key={i} className="flex flex-col gap-1">
              {ticket.fields.length > 1 ? (
                <span className="text-caption font-semibold text-muted-foreground">
                  {t("tickets.card.field", { n: i + 1 })}
                </span>
              ) : null}
              <BallRow
                main={f.main}
                {...(f.euro ? { euro: f.euro } : {})}
                {...(ticket.game === "649" ? { superzahl: ticket.superzahl ?? null } : {})}
                size={wide ? "md" : "sm"}
                {...(check
                  ? { matches: { main: check.mainHits, euro: check.euroHits, superzahl: check.szMatch } }
                  : {})}
              />
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-2 text-body">
        {pending ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <CalendarClock aria-hidden="true" className="size-5 shrink-0" />
            {t("tickets.status.waiting", { date: `${date(pending)}` })}
          </p>
        ) : null}
        {notLoaded.length ? (
          <div className="flex flex-col gap-2 rounded-md border border-warning/60 bg-warning/10 p-3">
            <p className="flex items-start gap-2 text-foreground">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
              {t("tickets.status.notLoaded", { date: notLoaded.map((d) => date(d)).join(", ") })}
            </p>
            <div className="flex flex-wrap gap-2">
              <ButtonLink to="/settings#manual-draw" variant="secondary">
                {t("tickets.card.manualDraw")}
              </ButtonLink>
              <ButtonLink to="/settings#import" variant="ghost">
                {t("tickets.card.importDraw")}
              </ButtonLink>
            </div>
          </div>
        ) : null}
        {checked.length ? (
          <>
            <ul className="flex flex-col divide-y divide-border">
              {visible.map((r) => (
                <DrawResult key={r.date} r={r} ticket={ticket} />
              ))}
            </ul>
            {hidden > 0 || showAll ? (
              <Button
                variant="ghost"
                className="self-start"
                onClick={() => setShowAll((v) => !v)}
                aria-expanded={showAll}
              >
                {showAll ? t("common.showLess") : tp("tickets.card.moreDraws", hidden)}
              </Button>
            ) : null}
          </>
        ) : !pending && !notLoaded.length ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <CircleDashed aria-hidden="true" className="size-5 shrink-0" />
            {t("common.notChecked")}
          </p>
        ) : null}
      </div>

      {ticket.note ? (
        <p className="text-caption text-muted-foreground">
          <span className="font-semibold">{t("tickets.card.note")}:</span> {ticket.note}
        </p>
      ) : null}

      {onlyDate || !onEdit || !onDelete ? null : (
        <footer className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <span className="mr-auto text-caption text-muted-foreground">
            {t(`tickets.card.source.${ticket.source}`)}
          </span>
          {szMissing ? (
            <Button variant="secondary" onClick={onEdit}>
              {t("tickets.card.specifySz")}
            </Button>
          ) : null}
          <Button variant="ghost" icon={<Pencil />} onClick={onEdit}>
            {t("common.edit")}
          </Button>
          <Button variant="ghost" icon={<Trash2 />} onClick={onDelete}>
            {t("tickets.card.delete")}
          </Button>
        </footer>
      )}
    </Card>
  );
}
