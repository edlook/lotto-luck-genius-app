import { useId, useMemo, useState } from "react";
import { Link } from "react-router";
import { ChartColumn, CircleCheck, TriangleAlert } from "lucide-react";
import { ButtonLink, Card, EmptyState, ErrorState, Section, Skeleton, SkeletonGroup } from "@/components/ui";
import { PageHeader } from "@/components/layout/PageHeader";
import { HonestyNote } from "@/components/common/HonestyNote";
import { Disclosure } from "@/components/common/Disclosure";
import { CompareTable, FrequencyChart } from "@/components/stats/FrequencyChart";
import { useI18n } from "@/i18n/context";
import { useGame } from "@/hooks/useGame";
import { useDraws } from "@/hooks/useDraws";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useUniformityTest } from "@/hooks/useUniformityTest";
import { GAMES } from "@/lib/games";
import { CURRENT_EJ_ERA, EJ_ERAS } from "@/lib/eras";
import {
  bucketize,
  evenCountDistribution,
  frequencies,
  lastDigitExpected,
  sumDistribution,
  typicalBand,
} from "@/lib/stats";
import {
  STATS_PERIODS,
  drawsInEra,
  evenCountObserved,
  lastDigitObserved,
  selectPeriod,
  sumObserved,
  type StatsPeriod,
} from "@/lib/statsView";

/** p below this is reported as "larger than chance usually produces". */
const P_ALERT = 0.01;

const selectClass =
  "h-12 w-full rounded-md border border-border-strong bg-background px-3 text-[16px] text-foreground sm:w-auto";

function UniformityBlock({ observed, draws, k, pool }: { observed: number[]; draws: number; k: number; pool: number }) {
  const { t, num } = useI18n();
  const test = useUniformityTest(observed, draws, k, pool);
  const p = (v: number) => num(v, { maximumFractionDigits: v < 0.01 ? 4 : 3 });
  return (
    <Card as="section" aria-labelledby="stats-test" className="flex flex-col gap-3">
      <h2 id="stats-test" className="text-title-3 font-bold">
        {t("stats.result.title")}
      </h2>
      <div aria-live="polite" aria-busy={test.status === "running"}>
        {test.status === "tooFew" ? (
          <p className="text-body">{t("stats.result.tooFew", { n: draws })}</p>
        ) : test.status === "running" || test.status === "idle" ? (
          <div className="flex flex-col gap-2">
            <p className="text-body text-muted-foreground">{t("stats.result.computing", { n: num(test.sims) })}</p>
            <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
                style={{ width: `${test.sims ? (test.progress / test.sims) * 100 : 0}%` }}
              />
            </div>
          </div>
        ) : test.status === "error" || !test.result ? (
          <p className="text-body text-danger">{t("error.unknown.title")}</p>
        ) : test.result.pValue < P_ALERT ? (
          <p className="flex items-start gap-2 text-body font-semibold">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
            {t("stats.result.deviation", { p: p(test.result.pValue) })}
          </p>
        ) : (
          <p className="flex items-start gap-2 text-body font-semibold">
            <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
            {t("stats.result.ok", { p: p(test.result.pValue) })}
          </p>
        )}
      </div>
      {test.result ? (
        <p className="text-caption text-muted-foreground tabular-nums">
          {t("stats.result.statistic", {
            value: num(test.result.statistic, { maximumFractionDigits: 1 }),
            n: num(draws),
            sims: num(test.result.sims),
          })}
        </p>
      ) : null}
      <p className="text-caption text-muted-foreground">{t("stats.result.explainP")}</p>
      <p className="text-caption text-muted-foreground">
        {t("stats.result.method")}{" "}
        <Link to="/about#stats" className="font-semibold text-foreground underline underline-offset-4">
          {t("common.learnMore")}
        </Link>
      </p>
    </Card>
  );
}

export default function Stats() {
  const { t, tp, date } = useI18n();
  const [game] = useGame();
  const data = useDraws(game);
  usePageMeta("stats");
  const cfg = GAMES[game];
  const [period, setPeriod] = useState<StatsPeriod>("all");
  const [eraId, setEraId] = useState(CURRENT_EJ_ERA.id);
  const periodId = useId();
  const eraSelectId = useId();

  const inPeriod = useMemo(() => selectPeriod(data.draws, period), [data.draws, period]);
  const n = inPeriod.length;
  const mainRows = useMemo(
    () =>
      frequencies(
        inPeriod.map((d) => ({ date: d.date, numbers: d.main })),
        cfg.mainCount,
        cfg.mainPool,
      ),
    [inPeriod, cfg],
  );
  const observed = useMemo(() => mainRows.map((r) => r.observed), [mainRows]);

  const era = EJ_ERAS.find((e) => e.id === eraId) ?? CURRENT_EJ_ERA;
  const euroDraws = useMemo(() => (game === "ej" ? drawsInEra(inPeriod, era.id) : []), [game, inPeriod, era.id]);
  const euroRows = useMemo(
    () =>
      frequencies(
        euroDraws.map((d) => ({ date: d.date, numbers: d.euro ?? [] })),
        2,
        era.euroPool,
      ),
    [euroDraws, era.euroPool],
  );
  const szDraws = useMemo(() => (game === "649" ? inPeriod.filter((d) => d.superzahl != null) : []), [game, inPeriod]);
  const szRows = useMemo(
    () =>
      frequencies(
        szDraws.map((d) => ({ date: d.date, numbers: [d.superzahl as number] })),
        1,
        10,
        true,
      ),
    [szDraws],
  );

  const dist = useMemo(() => {
    const k = cfg.mainCount;
    const even = evenCountDistribution(k, cfg.mainPool);
    const evenObs = evenCountObserved(inPeriod, k);
    const buckets = bucketize(sumDistribution(k, cfg.mainPool), 20).filter((b) => b.p >= 0.0005);
    const sumObs = sumObserved(inPeriod, buckets);
    const digits = lastDigitExpected(cfg.mainPool);
    const digitsObs = lastDigitObserved(inPeriod);
    return {
      even: even.map((p, e) => ({
        label: t("stats.dist.oddEven.row", { even: e, odd: k - e }),
        observed: evenObs[e] ?? 0,
        theoretical: p,
      })),
      sum: buckets.map((b, i) => ({ label: `${b.from}–${b.to}`, observed: sumObs[i] ?? 0, theoretical: b.p })),
      digits: digits.map((p, d) => ({ label: String(d), observed: digitsObs[d] ?? 0, theoretical: p })),
    };
  }, [cfg, inPeriod, t]);

  const title = t("stats.title");
  const eyebrow = t(`game.${game}.name`);

  let body;
  if (data.isLoading) {
    body = (
      <SkeletonGroup label={t("state.loading.aria")} className="gap-4">
        <Skeleton className="h-12 w-60" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-56 w-full rounded-lg" />
      </SkeletonGroup>
    );
  } else if (data.draws.length === 0) {
    body = data.isError ? (
      <ErrorState
        title={t("error.network.title")}
        body={t("error.network.body")}
        retryLabel={t("common.retry")}
        onRetry={data.refetch}
      />
    ) : (
      <EmptyState
        icon={<ChartColumn />}
        title={t("empty.noData.title")}
        body={t("stats.empty")}
        actions={<ButtonLink to="/settings#import">{t("common.toImport")}</ButtonLink>}
      />
    );
  } else {
    body = (
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <label htmlFor={periodId} className="text-body font-semibold">
            {t("stats.period.label")}
          </label>
          <select
            id={periodId}
            value={period}
            onChange={(e) => setPeriod(e.target.value as StatsPeriod)}
            className={selectClass}
          >
            {STATS_PERIODS.map((p) => (
              <option key={p} value={p}>
                {t(`stats.period.${p}`)}
              </option>
            ))}
          </select>
          <p className="text-caption text-muted-foreground">
            {tp("stats.period.drawsInPeriod", n)}
            {n ? ` · ${date(inPeriod[0]!.date)} — ${date(inPeriod[n - 1]!.date)}` : ""}
          </p>
        </div>

        <UniformityBlock observed={observed} draws={n} k={cfg.mainCount} pool={cfg.mainPool} />

        <Section title={t("stats.freq.main.title")}>
          <FrequencyChart rows={mainRows} band={typicalBand(n, cfg.mainCount, cfg.mainPool)} />
        </Section>

        {game === "ej" ? (
          <Section title={t("stats.freq.euro.title")} description={t("stats.euroEra.note")}>
            <div className="flex flex-col gap-2">
              <label htmlFor={eraSelectId} className="text-body font-semibold">
                {t("stats.period.era")}
              </label>
              <select
                id={eraSelectId}
                value={eraId}
                onChange={(e) => setEraId(Number(e.target.value))}
                className={selectClass}
              >
                {[...EJ_ERAS].reverse().map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.to
                      ? t("stats.period.eraOption", { from: date(e.from), to: date(e.to), pool: e.euroPool })
                      : t("stats.period.eraCurrent", { from: date(e.from), pool: e.euroPool })}
                  </option>
                ))}
              </select>
              <p className="text-caption text-muted-foreground">{tp("stats.period.drawsInPeriod", euroDraws.length)}</p>
            </div>
            {euroDraws.length ? (
              <FrequencyChart rows={euroRows} band={typicalBand(euroDraws.length, 2, era.euroPool)} tone="euro" />
            ) : (
              <p className="text-body text-muted-foreground">{t("stats.result.tooFew", { n: 0 })}</p>
            )}
          </Section>
        ) : (
          <Section title={t("stats.freq.sz.title")} description={t("stats.freq.sz.note")}>
            {szDraws.length ? (
              <FrequencyChart rows={szRows} band={typicalBand(szDraws.length, 1, 10)} tone="euro" />
            ) : (
              <p className="text-body text-muted-foreground">{t("stats.sz.tooFew")}</p>
            )}
          </Section>
        )}

        {n > 0 ? (
          <Section title={t("stats.dist.title")} description={t("stats.dist.explain")}>
            <div className="flex flex-col gap-6">
              <CompareTable caption={t("stats.dist.oddEven")} rows={dist.even} labelHeader={t("stats.dist.oddEven")} />
              <CompareTable caption={t("stats.dist.sum")} rows={dist.sum} labelHeader={t("stats.dist.sum")} />
              <CompareTable
                caption={t("stats.dist.lastDigit")}
                rows={dist.digits}
                labelHeader={t("stats.dist.lastDigit")}
              />
            </div>
          </Section>
        ) : null}

        <Card as="section" aria-labelledby="stats-backtest" className="flex flex-col gap-3">
          <h2 id="stats-backtest" className="text-title-3 font-bold">
            {t("stats.backtest.title")}
          </h2>
          <p className="text-body text-muted-foreground">{t("stats.backtest.body")}</p>
          <ButtonLink to="/backtest" variant="secondary" className="self-start">
            {t("stats.backtest.link")}
          </ButtonLink>
        </Card>

        <Section title={t("stats.why.title")}>
          <div className="flex flex-col gap-2">
            {(["independence", "gambler", "p"] as const).map((k) => (
              <Disclosure key={k} summary={t(`stats.why.${k}.q`)} tone="card">
                {t(`stats.why.${k}.a`)}
              </Disclosure>
            ))}
          </div>
        </Section>
      </div>
    );
  }

  return (
    <>
      <PageHeader title={title} eyebrow={eyebrow} />
      <HonestyNote className="mb-6">{t("stats.frame")}</HonestyNote>
      {body}
    </>
  );
}
