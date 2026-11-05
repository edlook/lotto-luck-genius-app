import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { CircleCheck, Save, Ticket as TicketIcon } from "lucide-react";
import { Button, ButtonLink, Field, NumberInput, toast } from "@/components/ui";
import { useI18n } from "@/i18n/context";
import { GAMES, type GameId } from "@/lib/games";
import { nextDraw } from "@/lib/drawCalendar";
import { newId, type Ticket, type TicketField } from "@/lib/storage/stores";
import { focusLater } from "@/components/common/focus";
import { ticketCardId } from "./ticketIds";
import { writeTickets } from "./writeTickets";

export interface SaveTicketPanelProps {
  game: GameId;
  fields: TicketField[];
  source: Ticket["source"];
  /** Button text: "Save to tickets" (generator) or "Save as ticket" (evaluate). */
  label: string;
  /** Gold is reserved for one main action per screen; saving is secondary on the generator. */
  variant?: "primary" | "secondary";
}

/**
 * Saves the shown combination(s) as one ticket for the next draw in a single tap. For
 * Lotto 6 aus 49 the Superzahl can be entered right here (optional: it is only known after
 * buying, so it can also be added later on the ticket card).
 * After saving, the button turns into "Open tickets" and takes focus: that is the third tap
 * of the "generate → save → check" flow.
 */
export function SaveTicketPanel({ game, fields, source, label, variant = "secondary" }: SaveTicketPanelProps) {
  const { t, date, locale } = useI18n();
  const navigate = useNavigate();
  const [sz, setSz] = useState<number | null>(null);
  const [saved, setSaved] = useState<{ id: string; date: string } | null>(null);
  const savedRef = useRef<HTMLDivElement>(null);
  const cfg = GAMES[game];

  const save = () => {
    const drawDate = nextDraw(game);
    const ticket: Ticket = {
      id: newId(),
      game,
      fields: fields.map((f) => (f.euro ? { main: [...f.main], euro: [...f.euro] } : { main: [...f.main] })),
      drawDates: [drawDate],
      createdAt: new Date().toISOString(),
      source,
    };
    if (cfg.hasSuperzahl) ticket.superzahl = sz;
    if (!writeTickets((prev) => [ticket, ...prev], t)) return;
    setSaved({ id: ticket.id, date: drawDate });
    toast.success(t("generator.toast.saved", { date: date(drawDate) }), {
      action: { label: t("generator.toast.saved.action"), onClick: () => navigate(`/tickets?edit=${ticket.id}`) },
    });
    focusLater(() => savedRef.current?.querySelector("a"));
  };

  if (saved) {
    return (
      <div ref={savedRef} className="flex flex-col gap-3">
        <p className="flex items-center gap-2 font-semibold text-success">
          <CircleCheck aria-hidden="true" className="size-5 shrink-0" />
          {t("generator.toast.saved", { date: date(saved.date) })}
        </p>
        <ButtonLink to={`/tickets#${ticketCardId(saved.id)}`} variant={variant} size="lg" block icon={<TicketIcon />}>
          {t("generator.saved.open")}
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {cfg.hasSuperzahl ? (
        <Field
          label={t("tickets.drawer.sz.label")}
          help={t("generator.save.sz.help")}
          optionalText={t("common.optional")}
        >
          <NumberInput value={sz} onChange={setSz} min={0} max={9} className="max-w-28" locale={locale} />
        </Field>
      ) : null}
      <Button variant={variant} size="lg" block icon={<Save />} onClick={save}>
        {label}
      </Button>
    </div>
  );
}
