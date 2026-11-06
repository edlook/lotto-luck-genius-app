import { useMemo } from "react";
import { CircleCheck, Equal, Info, TriangleAlert } from "lucide-react";
import { Button, Card, EmptyState, Section } from "@/components/ui";
import { Disclosure } from "@/components/common/Disclosure";
import { useI18n } from "@/i18n/context";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useHints } from "@/hooks/useHints";
import { Hint } from "@/components/hints/Hint";
import { euroPoolOn } from "@/lib/eras";
import type { GameId } from "@/lib/games";
import type { PopularityValidation, PopularityVerdict, ValidationDraw } from "@/lib/popularityValidation";
import type { Draw } from "@/lib/ticketCheck";
import { HBarChart } from "./HBarChart";
import { RunControl } from "./RunControl";

const fixed = (d: number) => ({ minimumFractionDigits: d, maximumFractionDigits: d }) as const;

const VERDICT_ICON: Record<PopularityVerdict, typeof CircleCheck> = {
  confirmed: CircleCheck,
  weak: Info,
  notDetected: Equal,
  opposite: TriangleAlert,
};

export function PopularityPanel({ game, draws, onSwitchToEj }: { game: GameId; draws: Draw[]; onSwitchToEj: () => void }) {
  const { t } = useI18n();
  const key = `${game}:${draws.length}:${draws[draws.length - 1]?.date ?? ""}`;
  const job = useAnalysis("popularity", key);
  const input = useMemo<ValidationDraw[]>(
    () =>
      game === "ej"
        ? draws.map((d) => ({
            date: d.date,
            main: d.main,
            euroPool: d.euroPool ?? euroPoolOn(d.date),
            stake: d.stake,
            quotes: d.quotes,
          }))
        : [],
    [game, draws],
  );

  const r = job.status === "done" ? job.result : null;
  const hints = useHints("backtest", () => ({
    game,
    strategiesNone: false,
    popularity: r
      ? {
          verdict: r.verdict,
          popular: r.popular.meanIndex,
          unpopular: r.unpopular.meanIndex,
          payPop: r.payout.popularMean,
          payUnpop: r.payout.unpopularMean,
          to: r.to,
        }
      : null,
  }));

  if (game !== "ej") {
    return (
      <EmptyState
        icon={<Info />}
        title={t("backtest.p.only.title")}
        body={t("backtest.p.only.body")}
        actions={<Button onClick={onSwitchToEj}>{t("backtest.p.only.action")}</Button>}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <p className="max-w-prose text-body text-muted-foreground">{t("backtest.p.intro")}</p>
        <Section title={t("backtest.p.how.title")} level={3}>
          <ul className="flex max-w-prose list-disc flex-col gap-2 pl-5 text-body text-muted-foreground">
            {[1, 2, 3, 4, 5].map((i) => (
              <li key={i}>{t(`backtest.p.how.${i}`)}</li>
            ))}
          </ul>
        </Section>
        <RunControl state={job} onRun={() => job.start({ draws: input })} />
      </div>

      <Hint control={hints} />

      {job.status === "done" ? (
        job.result ? <Results r={job.result} /> : <p className="text-body font-semibold">{t("backtest.p.tooFew")}</p>
      ) : null}

      <Section title={t("backtest.p.limits.title")}>
        <ul className="flex max-w-prose list-disc flex-col gap-2 pl-5 text-body text-muted-foreground">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <li key={i}>{t(`backtest.p.limits.i${i}`)}</li>
          ))}
        </ul>
      </Section>

      <Section title={t("backtest.p.method.title")}>
        <ul className="flex max-w-prose list-disc flex-col gap-2 pl-5 text-body text-muted-foreground">
          {[1, 2].map((i) => (
            <li key={i}>
              {t(`backtest.p.method.m${i}`, {
                boots: job.result ? job.result.boots : 5000,
                seed: job.result ? job.result.seed : 20261106,
              })}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Results({ r }: { r: PopularityValidation }) {
  const { t, num, money, date } = useI18n();
  const n2 = (v: number) => num(v, fixed(2));
  const n3 = (v: number) => num(v, fixed(3));
  const signed = (v: number, f: (x: number) => string) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${f(Math.abs(v))}`;
  const pText = (p: number) => (p < 0.001 ? `< ${num(0.001, fixed(3))}` : `= ${n3(p)}`);
  const d = r.difference;
  const Icon = VERDICT_ICON[r.verdict];
  const rows = r.byLow.filter((b) => b.n > 0);
  const axisMax = Math.max(1.2, ...rows.map((b) => b.meanIndex)) * 1.1;
  const money2 = (v: number) => money(v);
  const signedMoney = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${money(Math.abs(v))}`;

  return (
    <Section title={t("backtest.result.title")}>
      <div className="flex flex-col gap-6">
        <Card className="flex flex-col gap-2" role="status">
          <h3 className="flex items-center gap-2 text-title-3 font-bold">
            <Icon
              aria-hidden="true"
              className={
                r.verdict === "confirmed"
                  ? "size-6 shrink-0 text-success"
                  : r.verdict === "opposite"
                    ? "size-6 shrink-0 text-warning"
                    : "size-6 shrink-0 text-muted-foreground"
              }
            />
            {t(`backtest.p.verdict.${r.verdict}.title`)}
          </h3>
          <p className="text-body">
            {t(`backtest.p.verdict.${r.verdict}`, {
              popular: n3(r.popular.meanIndex),
              unpopular: n3(r.unpopular.meanIndex),
              diff: signed(d.value, n3),
              low: signed(d.low, n3),
              high: signed(d.high, n3),
              d: n2(d.d),
              p: pText(d.pPerm),
            })}
          </p>
        </Card>

        <div className="flex max-w-prose flex-col gap-2 text-body text-muted-foreground">
          <p>
            {t("backtest.p.groups", {
              nA: num(r.popular.n),
              nB: num(r.unpopular.n),
              nMid: num(r.middle.n),
              n: num(r.n),
              from: date(r.from),
              to: date(r.to),
              mean: n3(r.meanIndex),
            })}
          </p>
          <p>
            {t("backtest.p.corr", {
              r: n2(r.correlation.r),
              low: n2(r.correlation.low),
              high: n2(r.correlation.high),
              p: pText(r.correlation.pPerm),
              n: num(r.correlation.n),
            })}
          </p>
          {r.skipped > 0 ? <p>{t("backtest.p.skipped", { n: num(r.skipped) })}</p> : null}
        </div>

        <Card className="flex flex-col gap-3">
          <h3 className="text-body font-bold">{t("backtest.p.chart.title")}</h3>
          <HBarChart
            listLabel={t("backtest.p.chart.aria")}
            reference={1}
            axisMax={axisMax}
            rows={rows.map((b) => ({
              id: String(b.low),
              label: t("backtest.p.chart.row", { low: b.low, n: num(b.n) }),
              value: b.meanIndex,
              valueText: n3(b.meanIndex),
            }))}
            legend={[
              { kind: "bar", text: t("backtest.p.chart.title") },
              { kind: "reference", text: t("backtest.p.chart.reference") },
            ]}
            note={t("backtest.chart.axis")}
          />
        </Card>

        <Section title={t("backtest.p.payout.title")} level={3}>
          <p className="max-w-prose text-body text-muted-foreground">
            {t("backtest.p.payout.body", {
              popular: money2(r.payout.popularMean),
              unpopular: money2(r.payout.unpopularMean),
              diff: signedMoney(r.payout.diff.value),
              low: signedMoney(r.payout.diff.low),
              high: signedMoney(r.payout.diff.high),
              overall: money2(r.payout.overallMean),
            })}
          </p>
        </Section>

        <Disclosure summary={t("backtest.p.classes.title")} tone="card">
          <div className="flex flex-col gap-3">
            <p className="text-caption">{t("backtest.p.classes.note")}</p>
            <table className="w-full table-fixed text-caption">
              <caption className="sr-only">{t("backtest.p.classes.caption")}</caption>
              <thead>
                <tr className="border-b border-border text-left align-bottom text-muted-foreground">
                  <th scope="col" className="w-[31%] py-1.5 pr-2 font-semibold">
                    {t("backtest.p.classes.class")}
                  </th>
                  <th scope="col" className="py-1.5 pr-2 text-right font-semibold">
                    {t("backtest.p.classes.popular")}
                  </th>
                  <th scope="col" className="py-1.5 pr-2 text-right font-semibold">
                    {t("backtest.p.classes.unpopular")}
                  </th>
                  <th scope="col" className="py-1.5 text-right font-semibold">
                    {t("backtest.p.classes.diff")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {r.checks.map((c) => (
                  <tr key={c.label} className="align-top">
                    <th scope="row" className="py-1.5 pr-2 text-left font-semibold tabular-nums">
                      {c.label}
                      <span className="block font-normal text-muted-foreground">
                        {t("backtest.p.classes.winners", { n: num(c.meanWinners, { maximumFractionDigits: 0 }) })}
                      </span>
                    </th>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{n3(c.popularMean)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{n3(c.unpopularMean)}</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {signed(c.diff.value, n3)}
                      <span className="block text-muted-foreground">
                        {signed(c.diff.low, n3)} … {signed(c.diff.high, n3)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Disclosure>

        <p className="max-w-prose text-caption text-muted-foreground">
          {t("backtest.p.rare", {
            prog: num(r.rare.progression),
            cons: num(r.rare.consecutive),
            mult: num(r.rare.multiples),
          })}
        </p>
      </div>
    </Section>
  );
}
