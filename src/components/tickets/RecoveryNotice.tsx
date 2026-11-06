import { Download, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui";
import { useI18n } from "@/i18n/context";
import { downloadText } from "@/lib/download";
import { useRecoveryCopies } from "@/lib/storage/localStore";
import { ticketsStore } from "@/lib/storage/stores";

/**
 * Shown when stored tickets could not be read in full (broken JSON, entries that fail
 * validation). The original text is kept in a backup key before anything is overwritten and
 * can be downloaded here (QA B3).
 */
export function RecoveryNotice() {
  const { t, date } = useI18n();
  const copies = useRecoveryCopies(ticketsStore);
  if (!copies.length) return null;
  return (
    <section
      role="region"
      aria-labelledby="tickets-recovery"
      className="flex flex-col gap-3 rounded-md border border-warning/60 bg-warning/10 p-3"
    >
      <h2 id="tickets-recovery" className="flex items-start gap-2 text-body font-bold">
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
        {t("tickets.recovery.title")}
      </h2>
      <p className="text-body text-muted-foreground">{t("tickets.recovery.body")}</p>
      <div className="flex flex-wrap gap-2">
        {copies.map((c) => (
          <Button
            key={c.at}
            variant="secondary"
            icon={<Download />}
            onClick={() =>
              downloadText(`llg-tickets-copy-${c.at.slice(0, 10)}.json`, c.raw, "application/json")
            }
          >
            {t("tickets.recovery.download", { date: date(c.at.slice(0, 10)) })}
          </Button>
        ))}
        <Button variant="ghost" onClick={() => ticketsStore.recovery.clear()}>
          {t("tickets.recovery.dismiss")}
        </Button>
      </div>
    </section>
  );
}
