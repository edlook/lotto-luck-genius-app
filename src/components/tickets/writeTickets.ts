import { toast } from "@/components/ui";
import { ticketsStore, type Ticket } from "@/lib/storage/stores";

type T = (key: string, params?: Record<string, string | number>) => string;

/**
 * Writes the ticket list and reports storage problems in words (never silently):
 * - full: nothing is lost in this tab, but the user is told to export and clean up;
 * - unavailable: tickets live only until the page is closed.
 * Returns false when the browser refused the write.
 */
export function writeTickets(update: (prev: Ticket[]) => Ticket[], t: T, onExport?: () => void): boolean {
  const res = ticketsStore.set(update);
  if (res === "full") {
    toast.error(t("tickets.storage.full"), {
      duration: 0,
      ...(onExport ? { action: { label: t("tickets.storage.exportNow"), onClick: onExport } } : {}),
    });
    return false;
  }
  if (res === "unavailable") toast.error(t("tickets.storage.unavailable"), { duration: 10_000 });
  return true;
}
