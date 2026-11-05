import { useId, useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Field, Input, NumberInput, SegmentedControl, Sheet, toast } from "@/components/ui";
import { NumberPicker } from "@/components/common/NumberPicker";
import { useI18n } from "@/i18n/context";
import { cx } from "@/lib/cx";
import { GAMES, GAME_IDS, type GameId } from "@/lib/games";
import { nextDraw } from "@/lib/drawCalendar";
import { newId, type Ticket } from "@/lib/storage/stores";
import {
  MAX_SERIES,
  MAX_TICKET_FIELDS,
  draftToTicket,
  emptyDraft,
  emptyField,
  hasErrors,
  ticketToDraft,
  validateDraft,
  type DraftErrors,
  type DrawMode,
  type TicketDraft,
} from "@/lib/ticketDraft";
import { drawDaysText } from "./drawDaysText";
import { writeTickets } from "./writeTickets";

export interface TicketEditorProps {
  open: boolean;
  /** Ticket to edit; null = new ticket. */
  ticket: Ticket | null;
  defaultGame: GameId;
  /** Changes on every opening so the form starts fresh. */
  session: number;
  onClose: () => void;
  /** Called with the id of the saved ticket (the page moves focus to its card). */
  onSaved: (id: string) => void;
}

/**
 * Add / edit a ticket in a bottom sheet (phones) or dialog (desktop): game, fields on the
 * slip grid or as text, draw dates (next draw, a date, or a series), Superzahl, note.
 */
export function TicketEditor({ open, ticket, defaultGame, session, onClose, onSaved }: TicketEditorProps) {
  const { t } = useI18n();
  const formId = useId();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t(ticket ? "tickets.drawer.title.edit" : "tickets.drawer.title")}
      closeLabel={t("common.close")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form={formId}>
            {t("tickets.drawer.save")}
          </Button>
        </>
      }
    >
      {open ? (
        <EditorForm
          key={session}
          formId={formId}
          ticket={ticket}
          defaultGame={defaultGame}
          onSaved={(id) => {
            onClose();
            onSaved(id);
          }}
        />
      ) : null}
    </Sheet>
  );
}

function EditorForm({
  formId,
  ticket,
  defaultGame,
  onSaved,
}: {
  formId: string;
  ticket: Ticket | null;
  defaultGame: GameId;
  onSaved: (id: string) => void;
}) {
  const { t, tp, date, locale } = useI18n();
  const [draft, setDraft] = useState<TicketDraft>(() => (ticket ? ticketToDraft(ticket) : emptyDraft(defaultGame)));
  const [errors, setErrors] = useState<DraftErrors | null>(null);
  const game = GAMES[draft.game];
  const next = nextDraw(draft.game);
  const ids = useId();

  const update = (patch: Partial<TicketDraft>) => {
    const nextDraft = { ...draft, ...patch };
    setDraft(nextDraft);
    // Re-validate live once the user has tried to save, so fixed problems disappear at once.
    if (errors) setErrors(validateDraft(nextDraft, date));
  };

  const setField = (i: number, patch: Partial<TicketDraft["fields"][number]>) =>
    update({ fields: draft.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validateDraft(draft, date);
    setErrors(errs);
    if (hasErrors(errs)) {
      // Focus the first problem so keyboard and screen-reader users land on it.
      window.setTimeout(() => {
        document.querySelector<HTMLElement>(`#${CSS.escape(formId)} [data-invalid="true"]`)?.focus();
      }, 0);
      return;
    }
    const saved = draftToTicket(
      draft,
      ticket ? { id: ticket.id, createdAt: ticket.createdAt, source: ticket.source } : { id: newId(), createdAt: new Date().toISOString(), source: "manual" },
      next,
    );
    const ok = writeTickets(
      (prev) => (ticket ? prev.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...prev]),
      t,
    );
    if (!ok) return;
    toast.success(t(ticket ? "tickets.toast.updated" : "tickets.toast.saved"));
    onSaved(saved.id);
  };

  const modeOptions: { value: DrawMode; label: string }[] = [
    { value: "next", label: t("tickets.drawer.draws.next", { date: date(next) }) },
    { value: "date", label: t("tickets.drawer.draws.date") },
    { value: "series", label: t("tickets.drawer.draws.series") },
  ];

  return (
    <form id={formId} noValidate onSubmit={submit} className="flex flex-col gap-6 pt-1">
      {ticket ? null : (
        <div className="flex flex-col gap-2">
          <p id={`${ids}-game`} className="text-body font-semibold">
            {t("tickets.drawer.game")}
          </p>
          <SegmentedControl<GameId>
            labelledBy={`${ids}-game`}
            options={GAME_IDS.map((g) => ({ value: g, label: t(`game.${g}.name`) }))}
            value={draft.game}
            onChange={(g) => {
              setErrors(null);
              setDraft((d) => ({ ...emptyDraft(g), mode: d.mode, date: d.date, count: d.count, note: d.note }));
            }}
            block
            className="flex-wrap"
          />
        </div>
      )}

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-3 text-title-3 font-bold">{t("tickets.drawer.fields")}</legend>
        {errors?.fields ? (
          <p role="alert" className="text-caption font-semibold text-danger">
            {t(errors.fields.key)}
          </p>
        ) : null}
        {draft.fields.map((f, i) => {
          const fieldError = errors?.field[i];
          return (
            <div
              key={i}
              data-invalid={fieldError ? "true" : undefined}
              tabIndex={fieldError ? -1 : undefined}
              className={cx("flex flex-col gap-3 rounded-lg outline-offset-4", fieldError && "ring-1 ring-danger/60 ring-offset-8 ring-offset-surface-2")}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-body font-bold">{t("tickets.card.field", { n: i + 1 })}</h3>
                {draft.fields.length > 1 ? (
                  <Button
                    variant="ghost"
                    icon={<Trash2 />}
                    onClick={() => update({ fields: draft.fields.filter((_, j) => j !== i) })}
                  >
                    {t("tickets.drawer.removeField", { n: i + 1 })}
                  </Button>
                ) : null}
              </div>
              <NumberPicker
                label={t("evaluate.grid.label.main", { min: 1, max: game.mainPool })}
                pool={game.mainPool}
                required={game.mainCount}
                value={f.main}
                onChange={(main) => setField(i, { main })}
                error={fieldError && f.main.length !== game.mainCount ? t(fieldError.key, fieldError.params) : undefined}
              />
              {game.extraCount ? (
                <NumberPicker
                  label={t("evaluate.grid.label.euro", { min: 1, max: game.extraPool })}
                  pool={game.extraPool}
                  required={game.extraCount}
                  value={f.euro}
                  onChange={(euro) => setField(i, { euro })}
                  columns={6}
                  tone="euro"
                  error={fieldError && f.euro.length !== game.extraCount ? t(fieldError.key, fieldError.params) : undefined}
                />
              ) : null}
            </div>
          );
        })}
        {draft.fields.length < MAX_TICKET_FIELDS ? (
          <Button variant="secondary" icon={<Plus />} onClick={() => update({ fields: [...draft.fields, emptyField()] })}>
            {t("tickets.drawer.addField")}
          </Button>
        ) : null}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-title-3 font-bold">{t("tickets.drawer.draws")}</legend>
        <SegmentedControl<DrawMode>
          label={t("tickets.drawer.draws")}
          options={modeOptions}
          value={draft.mode}
          onChange={(mode) => update({ mode })}
          orientation="vertical"
          className="[&>button]:whitespace-normal [&>button]:py-2"
        />
        {draft.mode !== "next" ? (
          <Field
            label={t(draft.mode === "date" ? "tickets.drawer.draws.date" : "settings.manual.date")}
            error={errors?.date ? t(errors.date.key, errors.date.params) : undefined}
            help={t("tickets.drawer.draws.help", { days: drawDaysText(draft.game, locale) })}
            required
          >
            <DateInput
              value={draft.date}
              invalid={Boolean(errors?.date)}
              onChange={(v) => update({ date: v })}
            />
          </Field>
        ) : (
          <p className="text-caption text-muted-foreground">
            {t("tickets.drawer.draws.help", { days: drawDaysText(draft.game, locale) })}
          </p>
        )}
        {draft.mode === "series" ? (
          <Field
            label={t("tickets.drawer.draws.count")}
            error={errors?.count ? t(errors.count.key, errors.count.params) : undefined}
            help={draft.count ? tp("draws.status.count", draft.count) : undefined}
            required
          >
            <NumberInput
              value={draft.count}
              onChange={(count) => update({ count })}
              min={1}
              max={MAX_SERIES}
              decrementLabel={`${t("tickets.drawer.draws.count")} −1`}
              incrementLabel={`${t("tickets.drawer.draws.count")} +1`}
              data-invalid={errors?.count ? "true" : undefined}
              locale={locale}
            />
          </Field>
        ) : null}
      </fieldset>

      {game.hasSuperzahl ? (
        <Field
          label={t("tickets.drawer.sz.label")}
          help={t("tickets.drawer.sz.help")}
          error={errors?.superzahl ? t(errors.superzahl.key) : undefined}
          optionalText={t("common.optional")}
        >
          <NumberInput
            value={draft.superzahl}
            onChange={(superzahl) => update({ superzahl })}
            min={0}
            max={9}
            className="max-w-28"
            locale={locale}
            data-invalid={errors?.superzahl ? "true" : undefined}
          />
        </Field>
      ) : null}

      <Field label={t("tickets.drawer.note.label")} optionalText={t("common.optional")}>
        <Input
          value={draft.note}
          maxLength={500}
          placeholder={t("tickets.drawer.note.placeholder")}
          onChange={(e) => update({ note: e.target.value })}
        />
      </Field>
    </form>
  );
}

/** Native date picker (accessible, localised by the OS) wired into the surrounding <Field>. */
export function DateInput({
  value,
  onChange,
  invalid,
  min,
  max,
}: {
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  min?: string;
  max?: string;
}) {
  return (
    <Input
      type="date"
      value={value}
      min={min}
      max={max}
      data-invalid={invalid ? "true" : undefined}
      onChange={(e) => onChange(e.target.value)}
      className="max-w-60 [color-scheme:dark]"
    />
  );
}
