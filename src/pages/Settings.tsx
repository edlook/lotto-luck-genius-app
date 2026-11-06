import { useId, useRef, useState, type FormEvent } from "react";
import { Download, FileUp, RefreshCw, Save, Trash2, Upload } from "lucide-react";
import {
  Button,
  Field,
  NumberInput,
  Section,
  SegmentedControl,
  Skeleton,
  SkeletonGroup,
  toast,
} from "@/components/ui";
import { PageHeader } from "@/components/layout/PageHeader";
import { GameSwitch } from "@/components/layout/GameSwitch";
import { LanguageSwitch } from "@/components/layout/LanguageSwitch";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { NumberPicker } from "@/components/common/NumberPicker";
import { completenessText } from "@/components/common/completenessText";
import { focusLater } from "@/components/common/focus";
import { DateInput } from "@/components/tickets/TicketEditor";
import { useTicketTransfer } from "@/components/tickets/useTicketTransfer";
import { writeTickets } from "@/components/tickets/writeTickets";
import { useI18n } from "@/i18n/context";
import { useGame } from "@/hooks/useGame";
import { useDraws } from "@/hooks/useDraws";
import { usePageMeta } from "@/hooks/usePageMeta";
import { GAMES, GAME_IDS, type GameId } from "@/lib/games";
import { berlinNow, isValidIsoDate } from "@/lib/drawCalendar";
import { euroPoolOn } from "@/lib/eras";
import { parseDrawCsv, type RowError } from "@/lib/csvImport";
import { useLocalStore, type WriteResult } from "@/lib/storage/localStore";
import { ticketsStore, userDrawsStore } from "@/lib/storage/stores";
import { addUserDraws, manualDrawError, manualToDraw, planDrawImport, type ManualDrawError } from "@/lib/userDrawOps";
import { APP_VERSION } from "@/lib/version";
import type { Draw } from "@/lib/ticketCheck";

function GamePicker({ value, onChange, label }: { value: GameId; onChange: (g: GameId) => void; label: string }) {
  const { t } = useI18n();
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <p id={id} className="text-body font-semibold">
        {label}
      </p>
      <SegmentedControl<GameId>
        labelledBy={id}
        options={GAME_IDS.map((g) => ({ value: g, label: t(`game.${g}.name`) }))}
        value={value}
        onChange={onChange}
        block
        className="flex-wrap"
      />
    </div>
  );
}

function writeError(res: WriteResult, t: (k: string) => string): boolean {
  if (res === "ok") return false;
  toast.error(t(res === "full" ? "settings.import.error.unauthorized" : "settings.import.error.network"));
  return true;
}

/* ---------- import CSV ---------- */

interface Preview {
  game: GameId;
  found: number;
  fresh: Draw[];
  duplicates: number;
  errors: RowError[];
}

function ImportBlock() {
  const { t, tp, date } = useI18n();
  const [global] = useGame();
  const [game, setGame] = useState<GameId>(global);
  const data = useDraws(game);
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setResult(null);
    let text = "";
    try {
      text = await file.text();
    } catch {
      toast.error(t("settings.import.error.format", { game: t(`game.${game}.name`) }));
      return;
    }
    if (!text.trim()) {
      setPreview(null);
      toast.error(t("settings.import.error.empty"));
      return;
    }
    const parsed = parseDrawCsv(game, text);
    if (parsed.unrecognized) {
      setPreview(null);
      toast.error(t("settings.import.error.format", { game: t(`game.${game}.name`) }));
      return;
    }
    const plan = planDrawImport(parsed.draws, data.byDate);
    setPreview({ game, found: parsed.found, fresh: plan.fresh, duplicates: plan.duplicates, errors: parsed.errors });
    focusLater(() => document.getElementById("import-preview"));
  };

  const rowError = (e: RowError) =>
    t(`settings.import.error.row.${e.code}`, {
      row: e.row,
      value: e.value ?? "",
      date: e.date ? date(e.date) : "",
    });

  const write = () => {
    if (!preview) return;
    if (preview.fresh.length === 0) {
      setResult(t("settings.import.result.nothing"));
    } else {
      const res = userDrawsStore.set((prev) => addUserDraws(prev, preview.fresh));
      if (writeError(res, t)) return;
      setResult(
        t("settings.import.result", {
          written: preview.fresh.length,
          dups: preview.duplicates,
          errors: preview.errors.length,
        }),
      );
    }
    setPreview(null);
    focusLater(() => document.getElementById("import-result"));
  };

  return (
    <Section
      id="import"
      title={t("settings.import.title")}
      description={t("settings.import.intro")}
      className="scroll-mt-40"
    >
      <div className="flex flex-col gap-4 sm:rounded-lg sm:border sm:border-border sm:bg-card sm:p-5 sm:shadow-soft">
        <GamePicker
          label={t("settings.manual.game")}
          value={game}
          onChange={(g) => {
            setGame(g);
            setPreview(null);
            setResult(null);
          }}
        />
        {data.isLoading ? (
          <SkeletonGroup label={t("state.loading.aria")}>
            <Skeleton className="h-5 w-48" />
          </SkeletonGroup>
        ) : data.draws.length ? (
          <ul className="flex flex-col gap-0.5 text-caption text-muted-foreground">
            <li>{t("settings.import.status.last", { date: date(data.lastDate!) })}</li>
            <li>{tp("settings.import.status.total", data.draws.length)}</li>
            <li>{t("settings.import.status.complete", { result: completenessText(data.completeness, { t, tp }) })}</li>
          </ul>
        ) : (
          <p className="text-caption text-muted-foreground">{t("settings.import.status.none")}</p>
        )}
        <p className="text-caption text-muted-foreground">{t(`settings.import.format.${game}`)}</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            void onFile(f);
          }}
        />
        <Button variant="secondary" icon={<FileUp />} className="self-start" onClick={() => inputRef.current?.click()}>
          {t("settings.import.upload")}
        </Button>

        {preview ? (
          <section
            id="import-preview"
            tabIndex={-1}
            aria-labelledby="import-preview-h"
            className="flex flex-col gap-3 rounded-md border border-border-strong p-3 outline-offset-4"
          >
            <h3 id="import-preview-h" className="font-bold">
              {t("settings.import.preview.title")} · {t(`game.${preview.game}.name`)}
            </h3>
            <p className="text-body">
              {t("settings.import.preview.summary", {
                found: preview.found,
                new: preview.fresh.length,
                errors: preview.errors.length,
              })}
            </p>
            {preview.errors.length ? (
              <div className="flex flex-col gap-1">
                <p className="text-caption font-semibold text-danger">
                  {t("settings.import.preview.errorRows", { rows: preview.errors.map((e) => e.row).join(", ") })}
                </p>
                <ul className="flex max-h-60 flex-col gap-1 overflow-y-auto text-caption text-muted-foreground">
                  {preview.errors.map((e) => (
                    <li key={`${e.row}-${e.code}`}>{rowError(e)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button icon={<Save />} onClick={write}>
                {t("settings.import.write")}
              </Button>
              <Button variant="ghost" onClick={() => setPreview(null)}>
                {t("settings.import.cancel")}
              </Button>
            </div>
          </section>
        ) : null}
        {result ? (
          <p id="import-result" tabIndex={-1} role="status" className="font-semibold text-success outline-offset-4">
            {result}
          </p>
        ) : null}
      </div>
    </Section>
  );
}

/* ---------- manual draw ---------- */

function ManualDraw() {
  const { t, date, locale } = useI18n();
  const [global] = useGame();
  const [game, setGame] = useState<GameId>(global);
  const data = useDraws(game);
  const tickets = useLocalStore(ticketsStore);
  const [iso, setIso] = useState("");
  const [main, setMain] = useState<number[]>([]);
  const [euro, setEuro] = useState<number[]>([]);
  const [sz, setSz] = useState<number | null>(null);
  const [error, setError] = useState<ManualDrawError | null>(null);
  const formId = useId();
  const cfg = GAMES[game];
  const today = berlinNow().date;
  const euroPool = cfg.extraCount ? (isValidIsoDate(iso) ? euroPoolOn(iso) : cfg.extraPool) : 0;

  const errText = (e: ManualDrawError) => ("date" in e ? t(e.key, { date: date(e.date) }) : t(e.key));
  const isDateError = (e: ManualDrawError | null) => e !== null && e.key !== "settings.manual.error.incomplete";

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    const input = { game, date: iso, main, euro: euro.filter((n) => n <= euroPool), superzahl: sz };
    const err = manualDrawError(input, today, data.byDate);
    setError(err);
    if (err) {
      focusLater(() => document.querySelector<HTMLElement>(`#${CSS.escape(formId)} [aria-invalid="true"]`), 0);
      return;
    }
    const res = userDrawsStore.set((prev) => addUserDraws(prev, [manualToDraw(input)]));
    if (writeError(res, t)) return;
    const checked = tickets.filter((x) => x.game === game && x.drawDates.includes(iso)).length;
    toast.success(t("settings.manual.success", { date: date(iso) }), {
      description: t("settings.manual.success.tickets", { n: checked }),
    });
    setMain([]);
    setEuro([]);
    setSz(null);
    setIso("");
    focusLater(() => document.querySelector<HTMLElement>(`#${CSS.escape(formId)} input[type="date"]`), 0);
  };

  return (
    <Section
      id="manual-draw"
      title={t("settings.manual.title")}
      description={t("settings.manual.intro")}
      className="scroll-mt-40"
    >
      <div className="flex flex-col gap-4 sm:rounded-lg sm:border sm:border-border sm:bg-card sm:p-5 sm:shadow-soft">
        <form id={formId} noValidate onSubmit={submit} className="flex flex-col gap-5">
          <GamePicker
            label={t("settings.manual.game")}
            value={game}
            onChange={(g) => {
              setGame(g);
              setMain([]);
              setEuro([]);
              setError(null);
            }}
          />
          <Field label={t("settings.manual.date")} required error={isDateError(error) ? errText(error!) : undefined}>
            <DateInput value={iso} onChange={setIso} max={today} invalid={isDateError(error)} />
          </Field>
          <p className="text-caption text-muted-foreground">{t("settings.manual.inputHint")}</p>
          <NumberPicker
            label={t("settings.manual.main")}
            pool={cfg.mainPool}
            required={cfg.mainCount}
            value={main}
            onChange={setMain}
            error={
              error?.key === "settings.manual.error.incomplete" && main.length !== cfg.mainCount
                ? errText(error)
                : undefined
            }
          />
          {cfg.extraCount ? (
            <NumberPicker
              key={euroPool}
              label={`${t("settings.manual.euro")} (1–${euroPool})`}
              pool={euroPool}
              required={cfg.extraCount}
              value={euro.filter((n) => n <= euroPool)}
              onChange={setEuro}
              columns={6}
              tone="euro"
              error={
                error?.key === "settings.manual.error.incomplete" && euro.length !== 2 ? errText(error) : undefined
              }
            />
          ) : (
            <Field label={t("settings.manual.sz")} optionalText={t("common.optional")}>
              <NumberInput value={sz} onChange={setSz} min={0} max={9} className="max-w-28" locale={locale} />
            </Field>
          )}
          <Button type="submit" icon={<Save />} className="self-start">
            {t("settings.manual.save")}
          </Button>
        </form>
      </div>
    </Section>
  );
}

/* ---------- page ---------- */

export default function Settings() {
  const { t, tp } = useI18n();
  usePageMeta("settings");
  const langId = useId();
  const gameId = useId();
  const userDraws = useLocalStore(userDrawsStore);
  const transfer = useTicketTransfer();
  const [confirm, setConfirm] = useState<"draws" | "tickets" | null>(null);
  const [checking, setChecking] = useState(false);

  const checkUpdate = async () => {
    setChecking(true);
    try {
      const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
      if (reg) await reg.update();
      const incoming = reg?.installing ?? reg?.waiting ?? null;
      if (reg && incoming) {
        // The worker skips waiting by itself; the toast with "Update" appears when it takes over
        // (useServiceWorkerUpdate). Wait for that, so the reload cannot hit a half-installed build.
        if (incoming.state !== "activated") {
          await new Promise<void>((resolve, reject) => {
            const timer = window.setTimeout(() => reject(new Error("update timeout")), 30_000);
            incoming.addEventListener("statechange", () => {
              if (incoming.state === "activated") {
                window.clearTimeout(timer);
                resolve();
              } else if (incoming.state === "redundant") {
                window.clearTimeout(timer);
                reject(new Error("update failed"));
              }
            });
            // A worker that sits in "waiting" is asked to take over (same protocol as workbox).
            if (incoming.state === "installed") incoming.postMessage({ type: "SKIP_WAITING" });
          });
        }
      } else toast.success(t("settings.tech.upToDate"));
    } catch {
      toast.error(t("error.network.title"), { description: t("error.network.body") });
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      <PageHeader title={t("settings.title")} />
      <div className="flex flex-col gap-10">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <h2 id={langId} className="text-title-3 font-bold">
              {t("settings.language.title")}
            </h2>
            <LanguageSwitch labelledBy={langId} />
            <p className="text-caption text-muted-foreground">{t("settings.language.help")}</p>
          </div>
          <div className="flex flex-col gap-2">
            <h2 id={gameId} className="text-title-3 font-bold">
              {t("settings.game.title")}
            </h2>
            <GameSwitch />
            <p className="text-caption text-muted-foreground">{t("settings.game.help")}</p>
          </div>
        </div>

        <ImportBlock />
        <ManualDraw />

        <Section title={t("settings.userDraws.title")} description={t("settings.userDraws.help")} card>
          <div className="flex flex-col gap-3">
            {userDraws.length ? (
              <ul className="flex flex-col gap-0.5 text-body">
                {GAME_IDS.map((g) => (
                  <li key={g}>
                    {t(`game.${g}.name`)}:{" "}
                    {tp("settings.userDraws.count", userDraws.filter((d) => d.game === g).length)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body text-muted-foreground">{t("settings.userDraws.none")}</p>
            )}
            <Button
              variant="secondary"
              icon={<Trash2 />}
              className="self-start"
              disabled={!userDraws.length}
              onClick={() => setConfirm("draws")}
            >
              {t("settings.userDraws.clear")}
            </Button>
          </div>
        </Section>

        <Section title={t("settings.tickets.title")} description={t("settings.tickets.help")} card>
          <div className="flex flex-col gap-3">
            <p className="text-body">
              {t("tickets.summary.tickets")}: {transfer.count}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" icon={<Download />} disabled={!transfer.count} onClick={transfer.exportAll}>
                {t("settings.tickets.export")}
              </Button>
              <Button variant="secondary" icon={<Upload />} onClick={transfer.startImport}>
                {t("settings.tickets.import")}
              </Button>
            </div>
            <Button
              variant="ghost"
              icon={<Trash2 />}
              className="self-start"
              disabled={!transfer.count}
              onClick={() => setConfirm("tickets")}
            >
              {t("settings.tickets.deleteAll")}
            </Button>
          </div>
        </Section>

        <Section title={t("settings.tech.title")} card>
          <div className="flex flex-col gap-3">
            <p className="text-body">{t("settings.tech.version", { version: APP_VERSION })}</p>
            <Button
              variant="secondary"
              icon={<RefreshCw />}
              loading={checking}
              className="self-start"
              onClick={() => void checkUpdate()}
            >
              {t("settings.tech.update")}
            </Button>
          </div>
        </Section>
      </div>

      <ConfirmDialog
        open={confirm === "draws"}
        title={t("settings.userDraws.clear")}
        description={t("settings.userDraws.confirm", { n: userDraws.length })}
        confirmLabel={t("common.delete")}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          if (writeError(userDrawsStore.set([]), t)) return;
          toast.success(t("settings.userDraws.cleared"));
        }}
      />
      <ConfirmDialog
        open={confirm === "tickets"}
        title={t("settings.tickets.deleteAll.confirm.title", { n: transfer.count })}
        description={t("settings.tickets.deleteAll.confirm.body")}
        confirmLabel={t("settings.tickets.deleteAll.confirm")}
        onCancel={() => setConfirm(null)}
        extra={
          <Button variant="secondary" icon={<Download />} onClick={transfer.exportAll}>
            {t("settings.tickets.deleteAll.exportFirst")}
          </Button>
        }
        onConfirm={() => {
          setConfirm(null);
          if (writeTickets(() => [], t)) toast.success(t("settings.tickets.deleteAll.done"));
        }}
      />
      {transfer.ui}
    </>
  );
}
