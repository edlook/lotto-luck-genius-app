import { useRef, useState, type ReactNode } from "react";
import { BallRow, Button, Dialog, toast } from "@/components/ui";
import { useI18n } from "@/i18n/context";
import { downloadText } from "@/lib/download";
import { berlinNow } from "@/lib/drawCalendar";
import { useLocalStore } from "@/lib/storage/localStore";
import { analyzeTicketImport, exportTickets, ticketsStore, type Ticket } from "@/lib/storage/stores";
import { lastExportStore } from "@/lib/storage/onboarding";
import { mergeImportedTickets } from "@/lib/ticketSummary";
import { writeTickets } from "./writeTickets";

interface PendingImport {
  fresh: Ticket[];
  conflicts: Ticket[];
  /** Index of the conflict being asked about. */
  index: number;
  replace: Ticket[];
  skipped: number;
}

export interface TicketTransfer {
  count: number;
  exportAll: () => void;
  /** Opens the system file picker. */
  startImport: () => void;
  /** Hidden file input + conflict dialog; render once, outside menus that close. */
  ui: ReactNode;
}

/**
 * JSON export/import of tickets. The file never leaves the device. Import never overwrites
 * silently: a ticket with a known id and different content is asked about one by one
 * (replace / skip); broken files are reported with a translated reason (QA B2).
 */
export function useTicketTransfer(): TicketTransfer {
  const { t, date } = useI18n();
  const tickets = useLocalStore(ticketsStore);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingImport | null>(null);

  const exportAll = () => {
    const list = ticketsStore.get();
    downloadText(`lotto-luck-genius-tickets-${berlinNow().date}.json`, exportTickets(list));
    // The "back up your tickets" tip counts from here.
    lastExportStore.set(new Date().toISOString());
    toast.success(t("tickets.export.done", { n: list.length }));
  };

  const apply = (p: PendingImport) => {
    const ok = writeTickets((prev) => mergeImportedTickets(prev, p.fresh, p.replace), t, exportAll);
    if (ok) toast.success(t("tickets.import.done", { added: p.fresh.length + p.replace.length, skipped: p.skipped }));
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    let text = "";
    try {
      text = await file.text();
    } catch {
      toast.error(t("tickets.import.error.json"));
      return;
    }
    const a = analyzeTicketImport(text, ticketsStore.get());
    if (a.error) {
      toast.error(t(`tickets.import.error.${a.error}`, { skipped: a.skipped }));
      return;
    }
    const p: PendingImport = { fresh: a.fresh, conflicts: a.conflicts, index: 0, replace: [], skipped: a.skipped };
    if (a.conflicts.length) setPending(p);
    else apply(p);
  };

  const decide = (replace: boolean) => {
    if (!pending) return;
    const cur = pending.conflicts[pending.index];
    const next: PendingImport = {
      ...pending,
      index: pending.index + 1,
      replace: replace && cur ? [...pending.replace, cur] : pending.replace,
      skipped: replace ? pending.skipped : pending.skipped + 1,
    };
    if (next.index >= next.conflicts.length) {
      setPending(null);
      apply(next);
    } else setPending(next);
  };

  const current = pending?.conflicts[pending.index];

  const ui = (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ""; // the same file can be chosen again
          void onFile(f);
        }}
      />
      <Dialog
        open={Boolean(current)}
        // Closing without a choice skips the remaining conflicts; new tickets are still added.
        onClose={() => {
          if (!pending) return;
          const rest = pending.conflicts.length - pending.index;
          setPending(null);
          apply({ ...pending, skipped: pending.skipped + rest });
        }}
        title={t("tickets.import.title")}
        description={t("tickets.import.conflict")}
        closeLabel={t("common.close")}
        footer={
          <>
            <Button variant="secondary" onClick={() => decide(false)}>
              {t("tickets.import.conflict.skip")}
            </Button>
            <Button onClick={() => decide(true)}>{t("tickets.import.conflict.replace")}</Button>
          </>
        }
      >
        {current && pending ? (
          <div className="flex flex-col gap-3">
            <p className="text-caption font-semibold text-muted-foreground">
              {t("tickets.import.conflict.progress", { n: pending.index + 1, total: pending.conflicts.length })}
            </p>
            <p className="text-body text-foreground">
              {t(`game.${current.game}.name`)} ·{" "}
              {current.drawDates.length > 1
                ? t("tickets.card.draws.range", {
                    first: date(current.drawDates[0]!),
                    last: date(current.drawDates[current.drawDates.length - 1]!),
                    n: current.drawDates.length,
                  })
                : t("tickets.card.draw", { date: date(current.drawDates[0]!) })}
            </p>
            <ul className="flex flex-col gap-2">
              {current.fields.map((f, i) => (
                <li key={i}>
                  <BallRow
                    main={f.main}
                    {...(f.euro ? { euro: f.euro } : {})}
                    {...(current.game === "649" ? { superzahl: current.superzahl ?? null } : {})}
                    size="sm"
                  />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Dialog>
    </>
  );

  return { count: tickets.length, exportAll, startImport: () => inputRef.current?.click(), ui };
}
