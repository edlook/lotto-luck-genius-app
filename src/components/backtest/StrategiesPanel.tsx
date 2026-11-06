import { useMemo } from "react";
import { Equal, TriangleAlert } from "lucide-react";
import { Card, Section } from "@/components/ui";
import { Disclosure } from "@/components/common/Disclosure";
import { useI18n } from "@/i18n/context";
import { useAnalysis } from "@/hooks/useAnalysis";
import { STRATEGY_ORDER, WARMUP, DEFAULT_RANDOM_RUNS, type BacktestResult, type StrategyId } from "@/lib/backtest";
import { GAMES, type GameId } from "@/lib/games";
import type { Draw } from "@/lib/ticketCheck";
import { HBarChart } from "./HBarChart";
import { RunControl } from "./RunControl";

const fixed = (d: number) => ({ minimumFractionDigits: d, maximumFractionDigits: d }) as const;

export function StrategiesPanel({ game, draws }: { game: GameId; draws: Draw[] }) {
  const { t, num } = useI18n();
  const cfg = GAMES[game];
  const k = cfg.mainCount;
  const pool = cfg.mainPool;
  const key = `${game}:${draws.length}:${draws[draws.length - 1]?.date ?? ""}`;
  const job = useAnalysis("backtest", key);
  const mains = useMemo(() => draws.map((d) => d.main), [draws]);
  const result: BacktestResult | undefined = job.result;

  const n3 = (v: number) => num(v, fixed(3));
  const name = (id: StrategyId) => t(`backtest.strategy.${id}.name`);
  const strategyParams = { k, runs: DEFAULT_RANDOM_RUNS };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <p className="max-w-prose text-body text-muted-foreground">
          {t(`backtest.s.intro.${game}`, { k, pool })}
        </p>
        <Card as="section" aria-label={t("backtest.tab.strategies")}>
          <dl className="flex flex-col gap-3">
            {STRATEGY_ORDER.map((id) => (
              <div key={id} className="flex flex-col gap-0.5">
                <dt className="text-body font-semibold">{name(id)}</dt>
                <dd className="text-caption text-muted-foreground">{t(`backtest.strategy.${id}.desc`, strategyParams)}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <RunControl state={job} onRun={() => job.start({ draws: mains, pool, k })} />
      </div>

      {result ? <Results result={result} game={game} draws={draws} /> : null}

      <Section title={t("backtest.meaning.title")}>
        <div className="flex max-w-prose flex-col gap-3 text-body text-muted-foreground">
          {[1, 2, 3, 4, 5].map((i) => (
            <p key={i}>
              {t(`backtest.meaning.p${i}`, { mean: result ? n3(result.expectedMean) : n3((k * k) / pool) })}
            </p>
          ))}
        </div>
      </Section>

      <Section title={t("backtest.method.title")}>
        <ul className="flex max-w-prose list-disc flex-col gap-2 pl-5 text-body text-muted-foreground">
          {[1, 2, 3, 4, 5].map((i) => (
            <li key={i}>
              {t(`backtest.method.m${i}`, {
                warmup: WARMUP,
                k,
                pool,
                runs: DEFAULT_RANDOM_RUNS,
                mean: n3((k * k) / pool),
                variance: num((k * (k / pool) * (1 - k / pool) * (pool - k)) / (pool - 1), fixed(4)),
              })}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Results({ result: r, game: g, draws }: { result: BacktestResult; game: GameId; draws: Draw[] }) {
  const { t, num, percent, date } = useI18n();
  const k = GAMES[g].mainCount;
  const n3 = (v: number) => num(v, fixed(3));
  const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${num(Math.abs(v), fixed(3))}`;
  const name = (id: StrategyId) => t(`backtest.strategy.${id}.name`);
  const rows = r.strategies;
  const outside = rows.filter((s) => s.id !== "random" && !s.within);
  const axisMax = Math.max(r.band.high, ...rows.map((s) => s.mean)) * 1.15;
  const thresholds = r.strategies[0]!.tails.map((x) => x.atLeast);
  return (
    <Section title={t("backtest.result.title")}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1 text-body text-muted-foreground">
          <p>
            {t("backtest.result.scope", {
              n: num(r.draws),
              from: date(draws[r.warmup]!.date),
              to: date(draws[draws.length - 1]!.date),
              warmup: r.warmup,
            })}
          </p>
          <p>
            {t("backtest.result.expected", {
              mean: n3(r.expectedMean),
              n: num(r.draws),
              low: n3(r.band.low),
              high: n3(r.band.high),
            })}
          </p>
        </div>

        <p className="flex items-start gap-2 text-body font-semibold" role="status">
          {outside.length === 0 ? (
            <Equal aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          ) : (
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
          )}
          <span>
            {outside.length === 0
              ? t("backtest.summary.none", { total: r.strategies.length - 1 })
              : t("backtest.summary.some", {
                  names: outside.map((s) => name(s.id)).join(", "),
                  total: r.strategies.length - 1,
                  chance: percent(r.anyOutsideByChance, 0),
                })}
          </span>
        </p>

        <Card className="flex flex-col gap-3">
          <h3 className="text-body font-bold">{t("backtest.chart.title")}</h3>
          <HBarChart
            listLabel={t("backtest.chart.aria")}
            reference={r.expectedMean}
            axisMax={axisMax}
            rows={rows.map((s) => ({
              id: s.id,
              label: name(s.id),
              value: s.mean,
              valueText: n3(s.mean),
              band: r.band,
              outside: s.id !== "random" && !s.within,
            }))}
            legend={[
              { kind: "bar", text: t("backtest.chart.mean") },
              { kind: "reference", text: t("backtest.chart.expected", { value: n3(r.expectedMean) }) },
              { kind: "band", text: t("backtest.chart.band") },
              { kind: "outside", text: t("backtest.verdict.outside") },
            ]}
            note={t("backtest.chart.axis")}
          />
        </Card>

        <Card padding="none" className="overflow-hidden">
          <table className="w-full table-fixed text-caption sm:text-body">
            <caption className="px-4 pt-4 pb-2 text-left text-body font-bold sm:px-5">{t("backtest.table.caption")}</caption>
            <thead>
              <tr className="border-b border-border text-left align-bottom text-muted-foreground">
                <th scope="col" className="w-[38%] py-1.5 pr-2 pl-4 font-semibold sm:w-[30%] sm:pl-5">
                  {t("backtest.table.strategy")}
                </th>
                <th scope="col" className="w-[24%] py-1.5 pr-2 font-semibold sm:w-[14%]">
                  {t("backtest.table.mean")}
                </th>
                <th scope="col" className="hidden py-1.5 pr-2 font-semibold sm:table-cell sm:w-[18%]">
                  {t("backtest.table.diff")}
                </th>
                <th scope="col" className="hidden py-1.5 pr-2 font-semibold sm:table-cell sm:w-[16%]">
                  {t("backtest.table.share3")}
                </th>
                <th scope="col" className="py-1.5 pr-4 font-semibold sm:pr-5">
                  {t("backtest.table.verdict")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((s) => (
                <tr key={s.id} className="align-top">
                  <th scope="row" className="py-2 pr-2 pl-4 text-left font-semibold sm:pl-5">
                    {name(s.id)}
                  </th>
                  <td className="py-2 pr-2 tabular-nums">
                    {n3(s.mean)}
                    <span className="block text-muted-foreground sm:hidden">{signed(s.diff)}</span>
                  </td>
                  <td className="hidden py-2 pr-2 tabular-nums sm:table-cell">
                    {signed(s.diff)}
                    <span className="block text-caption text-muted-foreground">
                      {t("backtest.table.z", { z: num(s.z, { ...fixed(2), signDisplay: "exceptZero" }) })}
                    </span>
                  </td>
                  <td className="hidden py-2 pr-2 tabular-nums sm:table-cell">
                    {percent(s.shareAtLeast3, 2)}
                    <span className="block text-caption text-muted-foreground">
                      {percent(s.expectedShareAtLeast3, 2)}
                    </span>
                  </td>
                  <td className="py-2 pr-4 sm:pr-5">
                    {s.id === "random" ? (
                      <span className="text-muted-foreground">{t("backtest.table.random")}</span>
                    ) : s.within ? (
                      <span className="inline-flex items-start gap-1.5">
                        <Equal aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <span>{t("backtest.verdict.within")}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-start gap-1.5 font-semibold">
                        <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
                        <span>{t("backtest.verdict.outside")}</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Disclosure summary={t("backtest.classes.title")} tone="card">
          <div className="flex flex-col gap-3">
            <p className="text-caption">{t(`backtest.classes.note.${g}`)}</p>
            <table className="w-full table-fixed text-caption">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th scope="col" className="w-[34%] py-1.5 pr-2 font-semibold">
                    {t("backtest.table.strategy")}
                  </th>
                  {thresholds.map((th) => (
                    <th key={th} scope="col" className="py-1.5 pr-2 text-right font-semibold">
                      {t("backtest.classes.head", { n: th, k })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((s) => (
                  <tr key={s.id}>
                    <th scope="row" className="py-1.5 pr-2 text-left font-semibold">
                      {name(s.id)}
                    </th>
                    {s.tails.map((x) => (
                      <td key={x.atLeast} className="py-1.5 pr-2 text-right tabular-nums">
                        {t("backtest.classes.cell", {
                          observed: num(x.observed, { maximumFractionDigits: s.id === "random" ? 1 : 0 }),
                          expected: num(x.expected, { maximumFractionDigits: 1 }),
                        })}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p>{t("backtest.classes.random")}</p>
          </div>
        </Disclosure>

        <p className="max-w-prose text-caption text-muted-foreground">
          {t("backtest.random.note", {
            runs: r.random.runs,
            share: percent(r.random.outsideShare, 1),
            min: n3(r.random.minMean),
            max: n3(r.random.maxMean),
          })}
        </p>
            </div>
    </Section>
  );
}
