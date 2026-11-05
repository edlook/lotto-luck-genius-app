import { useId } from "react";
import { Link } from "react-router";
import { RotateCcw } from "lucide-react";
import { Button, Card, Field, NumberInput, Section, SegmentedControl, Skeleton, SkeletonGroup } from "@/components/ui";
import { PageHeader } from "@/components/layout/PageHeader";
import { HonestyNote } from "@/components/common/HonestyNote";
import { useI18n } from "@/i18n/context";
import { useGame } from "@/hooks/useGame";
import { useArchive } from "@/hooks/useArchive";
import { usePageMeta } from "@/hooks/usePageMeta";
import { GAMES, type GameId } from "@/lib/games";
import { anyWin, classOdds } from "@/lib/odds";
import { fieldEv, yearCost } from "@/lib/ev";
import { useLocalStore } from "@/lib/storage/localStore";
import { oddsStore, type OddsSettings } from "@/lib/storage/stores";

const DEFAULT_YEAR = { fieldsPerDraw: 4, drawsPerWeek: 2, weeks: 52 };

/** Writes one value into the stored odds settings (llg.odds.v1). */
function patch(update: (s: OddsSettings) => OddsSettings) {
  oddsStore.set(update);
}

function ClassTable({ game }: { game: GameId }) {
  const { t, num, percent } = useI18n();
  const rows = classOdds(game);
  const any = anyWin(game);
  const matches = (main: number, extra: number) =>
    game === "ej"
      ? t("odds.table.matches.ej", { main, euro: extra })
      : extra
        ? t("odds.table.matches.649.sz", { main })
        : t("odds.table.matches.649.noSz", { main });
  const oneIn = (v: number) => num(v, { maximumFractionDigits: v < 100 ? 1 : 0 });
  // Three significant digits: 0,0000000715 % for the jackpot, 1,52 % for the last class.
  const pct = (p: number) => num(p, { style: "percent", maximumSignificantDigits: 3 });
  return (
    <table className="w-full text-caption sm:text-body" aria-label={t("odds.table.aria")}>
      <thead>
        <tr className="border-b border-border text-left align-bottom text-muted-foreground">
          <th scope="col" className="py-2 pr-2 font-semibold">
            {t("common.class")}
          </th>
          <th scope="col" className="py-2 pr-2 font-semibold">
            {t("odds.table.matches")}
          </th>
          <th scope="col" className="hidden py-2 pr-2 text-right font-semibold sm:table-cell">
            {t("odds.table.combinations")}
          </th>
          <th scope="col" className="py-2 pr-2 text-right font-semibold">
            {t("odds.table.oneIn")}
          </th>
          <th scope="col" className="hidden py-2 text-right font-semibold sm:table-cell">
            {t("odds.table.probability")}
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map((r) => (
          <tr key={r.cls}>
            <th scope="row" className="py-2 pr-2 text-left font-semibold tabular-nums">
              {r.cls}
            </th>
            <td className="py-2 pr-2 whitespace-nowrap tabular-nums">{matches(r.main, r.extra)}</td>
            <td className="hidden py-2 pr-2 text-right tabular-nums sm:table-cell">{num(r.combinations)}</td>
            <td className="py-2 pr-2 text-right tabular-nums">{oneIn(r.oneIn)}</td>
            <td className="hidden py-2 text-right tabular-nums sm:table-cell">{pct(r.probability)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-border-strong font-semibold">
          <th scope="row" colSpan={2} className="py-2 pr-2 text-left">
            {t("odds.table.anyWin")}
          </th>
          <td className="hidden py-2 pr-2 text-right tabular-nums sm:table-cell">{num(any.combinations)}</td>
          <td className="py-2 pr-2 text-right tabular-nums">{oneIn(any.oneIn)}</td>
          <td className="hidden py-2 text-right tabular-nums sm:table-cell">{percent(any.probability, 2)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

function Result({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md bg-background/60 p-3">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="text-title-3 font-extrabold tabular-nums">{value}</dd>
      {note ? <dd className="text-caption text-muted-foreground">{note}</dd> : null}
    </div>
  );
}

function Calculators({ game }: { game: GameId }) {
  const { t, tp, num, money, date, locale } = useI18n();
  const settings = useLocalStore(oddsStore);
  const cfg = GAMES[game];
  const userShare = settings.share && game in settings.share ? settings.share[game] : undefined;
  // EuroJackpot: the default share comes from the archive meta (official quotas and stakes).
  // Only fetched on this screen and only while the user has not set their own value.
  const archive = useArchive("ej", game === "ej" && userShare === undefined);
  const payout = game === "ej" ? (archive.data?.meta.payout ?? null) : null;
  const waitingForDefault = game === "ej" && userShare === undefined && !payout && archive.isLoading;
  const defaultShare =
    game === "649" ? (cfg.payoutShare ?? 0.5) * 100 : payout ? Math.round(payout.share * 10_000) / 100 : null;

  const price = settings.price?.[game] ?? cfg.price;
  const share = userShare !== undefined ? userShare : defaultShare;
  const fee = settings.fee?.[game] ?? 0;
  const year = settings.year ?? DEFAULT_YEAR;
  const yearId = useId();

  const feePerField = year.fieldsPerDraw > 0 ? fee / year.fieldsPerDraw : fee;
  const ev = fieldEv({ price, payoutShare: share === null ? null : share / 100, feePerField });
  const y = yearCost({ game, ...year, price, feePerDraw: fee, payoutShare: share === null ? null : share / 100 });

  const shareHelp =
    game === "649"
      ? t("odds.ev.share.help.649")
      : payout
        ? t("odds.ev.share.help.ej.data", {
            draws: num(payout.draws),
            from: date(payout.from),
            to: date(payout.to),
            value: num(payout.share * 100, { maximumFractionDigits: 2 }),
          })
        : t("odds.ev.share.help.ej");

  const setYear = (p: Partial<typeof year>) => patch((s) => ({ ...s, year: { ...year, ...p } }));

  return (
    <>
      <Section title={t("odds.ev.title")} card>
        <div className="flex flex-col gap-5">
          <p className="rounded-md bg-background/60 px-3 py-2 font-semibold tabular-nums">{t("odds.ev.formula")}</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("odds.ev.price")} help={t(`odds.ev.price.help.${game}`)}>
              <NumberInput
                value={price}
                onChange={(v) => v !== null && patch((s) => ({ ...s, price: { ...s.price, [game]: v } }))}
                min={0}
                max={100}
                step={0.1}
                decimals={2}
                locale={locale}
              />
            </Field>
            <Field label={t("odds.ev.share")} help={waitingForDefault ? undefined : shareHelp}>
              {waitingForDefault ? (
                <SkeletonGroup label={t("state.loading.aria")}>
                  <Skeleton className="h-12 w-full" />
                </SkeletonGroup>
              ) : (
                <NumberInput
                  value={share}
                  onChange={(v) => patch((s) => ({ ...s, share: { ...s.share, [game]: v } }))}
                  min={0}
                  max={100}
                  step={0.5}
                  decimals={2}
                  locale={locale}
                />
              )}
            </Field>
            <Field label={t("odds.ev.fee")} help={t("odds.ev.fee.help")}>
              <NumberInput
                value={fee}
                onChange={(v) => v !== null && patch((s) => ({ ...s, fee: { ...s.fee, [game]: v } }))}
                min={0}
                max={100}
                step={0.05}
                decimals={2}
                locale={locale}
              />
            </Field>
          </div>
          <div aria-live="polite" className="flex flex-col gap-1">
            {waitingForDefault ? null : ev.expectedReturn === null ? (
              <p className="font-semibold text-warning">{t("odds.ev.missingShare")}</p>
            ) : (
              <>
                <p className="text-title-3 font-bold">
                  {t("odds.ev.result", { value: money(ev.expectedReturn), price: money(price) })}
                </p>
                {fee > 0 && ev.expectedReturnAfterFee !== null ? (
                  <p className="text-body">
                    {t("odds.ev.result.withFee", { value: money(ev.expectedReturnAfterFee) })}{" "}
                    <span className="text-muted-foreground">
                      ({t("odds.ev.perField", { value: money(feePerField) })})
                    </span>
                  </p>
                ) : null}
              </>
            )}
          </div>
          <p className="text-caption text-muted-foreground">{t("odds.ev.note")}</p>
          <HonestyNote>{t("honesty.ev")}</HonestyNote>
          <Button
            variant="ghost"
            icon={<RotateCcw />}
            className="max-w-full self-start text-left whitespace-normal"
            onClick={() =>
              patch((s) => {
                const drop = <T,>(r: Record<string, T> | undefined) => {
                  if (!r) return r;
                  const { [game]: _removed, ...rest } = r;
                  return rest;
                };
                const next: OddsSettings = { ...s };
                next.price = drop(s.price);
                next.share = drop(s.share);
                next.fee = drop(s.fee);
                delete next.year;
                return JSON.parse(JSON.stringify(next)) as OddsSettings;
              })
            }
          >
            {t("odds.ev.reset")}
          </Button>
        </div>
      </Section>

      <Section title={t("odds.year.title")} card>
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label={t("odds.year.fieldsPerDraw")}
              error={year.fieldsPerDraw < 1 ? t("odds.year.error.range") : undefined}
            >
              <NumberInput
                value={year.fieldsPerDraw}
                onChange={(v) => v !== null && v >= 1 && setYear({ fieldsPerDraw: v })}
                min={1}
                max={99}
                decrementLabel={`${t("odds.year.fieldsPerDraw")} −1`}
                incrementLabel={`${t("odds.year.fieldsPerDraw")} +1`}
                locale={locale}
              />
            </Field>
            <div className="flex flex-col gap-1.5">
              <p id={yearId} className="text-body font-semibold">
                {t("odds.year.drawsPerWeek")}
              </p>
              <SegmentedControl<"1" | "2">
                labelledBy={yearId}
                options={[
                  { value: "1", label: "1" },
                  { value: "2", label: "2" },
                ]}
                value={String(year.drawsPerWeek) as "1" | "2"}
                onChange={(v) => setYear({ drawsPerWeek: Number(v) })}
                block
              />
            </div>
            <Field label={t("odds.year.weeks")}>
              <NumberInput
                value={year.weeks}
                onChange={(v) => v !== null && v >= 1 && setYear({ weeks: v })}
                min={1}
                max={53}
                decrementLabel={`${t("odds.year.weeks")} −1`}
                incrementLabel={`${t("odds.year.weeks")} +1`}
                locale={locale}
              />
            </Field>
          </div>
          <p className="text-caption text-muted-foreground">
            {t("odds.year.price")}: {money(price)} · {t("odds.year.fee")}: {money(fee)}
          </p>
          <dl aria-live="polite" className="grid gap-2 sm:grid-cols-2">
            <Result
              label={t("odds.year.result.spent")}
              value={money(y.spent)}
              note={tp("odds.year.result.fields", y.fields)}
            />
            {y.expectedReturn !== null && y.expectedLoss !== null ? (
              <>
                <Result label={t("odds.year.result.return")} value={money(y.expectedReturn)} />
                <Result label={t("odds.year.result.loss")} value={money(y.expectedLoss)} />
              </>
            ) : null}
            <Result
              label={t("odds.year.result.jackpot")}
              value={t("odds.year.result.oneIn", { value: num(1 / y.pJackpot, { maximumFractionDigits: 0 }) })}
            />
            <Result
              label={t("odds.year.result.anyWin")}
              value={
                y.pAnyWin >= 0.9995
                  ? `> ${t("odds.year.result.percent", { value: num(99.9, { maximumFractionDigits: 1 }) })}`
                  : t("odds.year.result.percent", { value: num(y.pAnyWin * 100, { maximumFractionDigits: 1 }) })
              }
            />
          </dl>
          {y.expectedReturn === null && !waitingForDefault ? (
            <p className="text-caption text-warning">{t("odds.year.noShare")}</p>
          ) : null}
          <p className="text-caption text-muted-foreground">{t("odds.year.formula")}</p>
          <p className="text-caption text-muted-foreground">{t("odds.year.assumptions")}</p>
          <p className="text-caption text-muted-foreground">{t("odds.year.note")}</p>
        </div>
      </Section>
    </>
  );
}

export default function Odds() {
  const { t } = useI18n();
  const [game] = useGame();
  usePageMeta("odds");
  return (
    <>
      <PageHeader title={t("odds.title", { game: t(`game.${game}.name`) })} />
      <div className="flex flex-col gap-8">
        <Card className="flex flex-col gap-2">
          <p className="text-title-3 font-bold text-primary">{t(`odds.headline.${game}`)}</p>
          <p className="text-body text-muted-foreground">{t("odds.headline.note")}</p>
        </Card>

        <Section title={t("odds.table.title")}>
          <ClassTable game={game} />
          {game === "649" ? <p className="text-caption text-muted-foreground">{t("odds.table.fixedPrize")}</p> : null}
          <p className="text-caption text-muted-foreground">{t("odds.table.source")}</p>
        </Section>

        <Calculators key={game} game={game} />

        <Section title={t("odds.example.title")} card>
          <p className="text-body">{t("odds.example.body")}</p>
          <Link
            to="/about#odds"
            className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
          >
            {t("odds.source.link")}
          </Link>
        </Section>
      </div>
    </>
  );
}
