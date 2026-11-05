import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { ArrowRightLeft, Download, EllipsisVertical, Plus, Ticket as TicketIcon, Upload } from "lucide-react";
import {
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  SegmentedControl,
  Sheet,
  Skeleton,
  SkeletonGroup,
  toast,
} from "@/components/ui";
import { PageHeader } from "@/components/layout/PageHeader";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { focusLater } from "@/components/common/focus";
import { TicketCard } from "@/components/tickets/TicketCard";
import { TicketEditor } from "@/components/tickets/TicketEditor";
import { ticketCardId } from "@/components/tickets/ticketIds";
import { useTicketTransfer } from "@/components/tickets/useTicketTransfer";
import { writeTickets } from "@/components/tickets/writeTickets";
import { useI18n } from "@/i18n/context";
import { useGame } from "@/hooks/useGame";
import { useDraws } from "@/hooks/useDraws";
import { usePageMeta } from "@/hooks/usePageMeta";
import { GAME_IDS } from "@/lib/games";
import { berlinNow } from "@/lib/drawCalendar";
import { useLocalStore } from "@/lib/storage/localStore";
import { ticketsStore, type Ticket } from "@/lib/storage/stores";
import { evaluateTicket } from "@/lib/ticketStatus";
import { TICKET_FILTERS, matchesFilter, summarize, type TicketFilter } from "@/lib/ticketSummary";

interface EditorState {
  open: boolean;
  ticketId: string | null;
  session: number;
}

export default function Tickets() {
  const { t, tp } = useI18n();
  const [game, setGame] = useGame();
  const tickets = useLocalStore(ticketsStore);
  const data = useDraws(game);
  const transfer = useTicketTransfer();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<TicketFilter>("all");
  const [editor, setEditor] = useState<EditorState>({ open: false, ticketId: null, session: 0 });
  const [toDelete, setToDelete] = useState<Ticket | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  usePageMeta("tickets");

  // "Change" in the toast after saving opens /tickets?edit=<id>: open that ticket once.
  const editParam = params.get("edit");
  const [handledEdit, setHandledEdit] = useState<string | null>(null);
  if (editParam && editParam !== handledEdit) {
    setHandledEdit(editParam);
    const target = tickets.find((x) => x.id === editParam);
    // The editor works with the ticket's own game, so the global game is left as it is.
    if (target) setEditor((e) => ({ open: true, ticketId: target.id, session: e.session + 1 }));
  }

  const today = berlinNow().date;
  const own = useMemo(() => tickets.filter((x) => x.game === game), [tickets, game]);
  const evaluations = useMemo(() => own.map((tk) => evaluateTicket(tk, data.byDate, today)), [own, data.byDate, today]);
  const summary = summarize(evaluations);
  const visible = own.map((tk, i) => ({ tk, ev: evaluations[i]! })).filter(({ ev }) => matchesFilter(ev, filter));
  const otherGame = GAME_IDS.find((g) => g !== game)!;
  const otherCount = tickets.filter((x) => x.game === otherGame).length;
  const editing = editor.ticketId ? (tickets.find((x) => x.id === editor.ticketId) ?? null) : null;

  const openNew = () => setEditor((e) => ({ open: true, ticketId: null, session: e.session + 1 }));
  const openEdit = (id: string) => setEditor((e) => ({ open: true, ticketId: id, session: e.session + 1 }));
  const closeEditor = () => {
    setEditor((e) => ({ ...e, open: false }));
    if (params.has("edit")) {
      const next = new URLSearchParams(params);
      next.delete("edit");
      setParams(next, { replace: true });
    }
  };

  const confirmDelete = () => {
    const victim = toDelete;
    setToDelete(null);
    if (!victim) return;
    const ids = visible.map((v) => v.tk.id);
    const pos = ids.indexOf(victim.id);
    const focusId = ids[pos + 1] ?? ids[pos - 1] ?? null;
    const index = tickets.findIndex((x) => x.id === victim.id);
    if (!writeTickets((prev) => prev.filter((x) => x.id !== victim.id), t, transfer.exportAll)) return;
    toast.success(t("tickets.toast.deleted"), {
      action: {
        label: t("tickets.toast.deleted.undo"),
        onClick: () => {
          writeTickets((prev) => {
            const next = [...prev];
            next.splice(Math.min(index, next.length), 0, victim);
            return next;
          }, t);
          focusLater(() => document.getElementById(ticketCardId(victim.id)));
        },
      },
    });
    // Focus the neighbouring card; with none left, the "add" action.
    focusLater(() => {
      if (focusId) return document.getElementById(ticketCardId(focusId));
      const add = document.getElementById("tickets-add");
      if (add && add.offsetParent !== null) return add;
      return document.getElementById("tickets-add-empty") ?? document.getElementById("main");
    });
  };

  const header = (
    <PageHeader
      title={t("tickets.title", { game: t(`game.${game}.name`) })}
      actions={
        <>
          <Button id="tickets-add" icon={<Plus />} onClick={openNew} className="max-lg:hidden">
            {t("tickets.add")}
          </Button>
          <IconButton
            label={t("tickets.menu.aria")}
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <EllipsisVertical />
          </IconButton>
        </>
      }
    />
  );

  const otherLine =
    otherCount > 0 ? (
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body text-muted-foreground">
        {tp("tickets.otherGame", otherCount, { game: t(`game.${otherGame}.name`) })}
        <Button variant="ghost" icon={<ArrowRightLeft />} onClick={() => setGame(otherGame)}>
          {t("tickets.otherGame.switch")}
        </Button>
      </p>
    ) : null;

  let body;
  if (own.length === 0) {
    body = (
      <div className="flex flex-col gap-4">
        <EmptyState
          icon={<TicketIcon />}
          title={t("tickets.empty.title")}
          body={t("tickets.empty.body")}
          actions={
            <>
              <ButtonLink to="/">{t("tickets.empty.toGenerator")}</ButtonLink>
              <Button id="tickets-add-empty" variant="secondary" icon={<Plus />} onClick={openNew}>
                {t("tickets.empty.addManual")}
              </Button>
            </>
          }
        />
        {otherLine}
      </div>
    );
  } else if (data.isLoading) {
    body = (
      <SkeletonGroup label={t("state.loading.aria")} className="gap-4">
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-11 w-full" />
        {own.slice(0, 3).map((x) => (
          <Skeleton key={x.id} className="h-48 w-full rounded-lg" />
        ))}
      </SkeletonGroup>
    );
  } else {
    body = (
      <div className="flex flex-col gap-5">
        {data.isError && data.draws.length === 0 ? (
          <ErrorState
            title={t("error.network.title")}
            body={t("error.network.body")}
            retryLabel={t("common.retry")}
            onRetry={data.refetch}
          />
        ) : null}

        <Card as="section" aria-labelledby="tickets-summary" className="flex flex-col gap-4">
          <h2 id="tickets-summary" className="sr-only">
            {t("tickets.summary.byClass")}
          </h2>
          <dl className="grid grid-cols-3 gap-2 text-center">
            {(
              [
                ["tickets.summary.tickets", summary.tickets],
                ["tickets.summary.checked", summary.checked],
                ["tickets.summary.wins", summary.wins],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex flex-col-reverse gap-1 rounded-md bg-background/60 px-1 py-2">
                <dt className="text-caption text-muted-foreground">{t(k)}</dt>
                <dd className="text-title-3 font-extrabold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          {summary.byClass.length ? (
            <table className="w-full text-body">
              <caption className="pb-2 text-left text-caption font-semibold text-muted-foreground">
                {t("tickets.summary.byClass")}
              </caption>
              <thead className="sr-only">
                <tr>
                  <th scope="col">{t("common.class")}</th>
                  <th scope="col">{t("tickets.summary.byClass.times")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {summary.byClass.map(([cls, n]) => (
                  <tr key={cls}>
                    <th scope="row" className="py-1.5 text-left font-semibold">
                      {t("common.class")} {cls}
                    </th>
                    <td className="py-1.5 text-right tabular-nums">× {n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-caption text-muted-foreground">{t("tickets.summary.byClass.none")}</p>
          )}
        </Card>

        <SegmentedControl<TicketFilter>
          label={t("tickets.filter.aria")}
          options={TICKET_FILTERS.map((f) => ({ value: f, label: t(`tickets.filter.${f}`) }))}
          value={filter}
          onChange={setFilter}
          block
          className="flex-wrap"
        />

        {otherLine}

        {visible.length ? (
          <ul className="flex flex-col gap-4">
            {visible.map(({ tk, ev }) => (
              <li key={tk.id}>
                <TicketCard
                  ticket={tk}
                  evaluation={ev}
                  onEdit={() => openEdit(tk.id)}
                  onDelete={() => setToDelete(tk)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title={t("tickets.empty.filtered")}
            actions={
              <Button variant="secondary" onClick={() => setFilter("all")}>
                {t("tickets.filter.all")}
              </Button>
            }
          />
        )}
        {/* Room for the floating "add" button on phones. */}
        <div aria-hidden="true" className="h-16 lg:hidden" />
      </div>
    );
  }

  return (
    <>
      {header}
      {body}

      {own.length ? (
        <Button
          size="lg"
          icon={<Plus />}
          onClick={openNew}
          className="fixed right-[max(1rem,var(--safe-right))] bottom-[calc(var(--bottomnav-h)+var(--safe-bottom)+1rem)] z-20 rounded-full shadow-raised lg:hidden"
        >
          {t("tickets.add")}
        </Button>
      ) : null}

      <TicketEditor
        open={editor.open}
        ticket={editing}
        defaultGame={game}
        session={editor.session}
        onClose={closeEditor}
        onSaved={(id) => {
          setFilter("all");
          focusLater(() => document.getElementById(ticketCardId(id)), 120);
        }}
      />

      <ConfirmDialog
        open={toDelete !== null}
        title={t("tickets.card.delete")}
        description={t("tickets.card.delete.confirm")}
        confirmLabel={t("common.delete")}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />

      <Sheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={t("tickets.menu.aria")}
        closeLabel={t("common.close")}
      >
        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            block
            icon={<Download />}
            disabled={transfer.count === 0}
            onClick={() => {
              setMenuOpen(false);
              transfer.exportAll();
            }}
          >
            {t("tickets.menu.export")}
          </Button>
          <Button
            variant="secondary"
            block
            icon={<Upload />}
            onClick={() => {
              setMenuOpen(false);
              transfer.startImport();
            }}
          >
            {t("tickets.menu.import")}
          </Button>
          <p className="pt-2 text-caption text-muted-foreground">{t("settings.tickets.help")}</p>
        </div>
      </Sheet>
      {transfer.ui}
    </>
  );
}
