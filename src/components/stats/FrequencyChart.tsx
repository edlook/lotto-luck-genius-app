import { useId, useState } from "react";
import { useI18n } from "@/i18n/context";
import { cx } from "@/lib/cx";
import type { FrequencyRow } from "@/lib/stats";
import { Disclosure } from "@/components/common/Disclosure";

export interface FrequencyChartProps {
  rows: FrequencyRow[];
  /** Typical range of one count under random draws (E ± 2 sd). */
  band: { low: number; high: number };
  tone?: "main" | "euro";
}

/**
 * Frequencies as CSS bars (no chart library): one bar per number in number order, the
 * expected value as a line and the typical random spread as a band. The y axis starts at 0
 * so small differences look as small as they are. The same data is in the table below
 * (screen readers get the table; the picture is labelled as such).
 */
export function FrequencyChart({ rows, band, tone = "main" }: FrequencyChartProps) {
  const { t, num, date } = useI18n();
  const [sort, setSort] = useState<"number" | "frequency">("number");
  const sortId = useId();
  const expected = rows[0]?.expected ?? 0;
  const max = Math.max(1, band.high, ...rows.map((r) => r.observed)) * 1.08;
  const pct = (v: number) => `${(v / max) * 100}%`;
  const step = rows.length > 20 ? 10 : rows.length > 10 ? 2 : 1;
  const sorted = sort === "number" ? rows : [...rows].sort((a, b) => b.observed - a.observed || a.number - b.number);
  const fmt1 = (v: number) => num(v, { maximumFractionDigits: 1 });

  return (
    <div className="flex flex-col gap-3">
      <figure className="flex flex-col gap-2">
        <div role="img" aria-label={t("stats.chart.aria")} className="relative h-40 border-b border-border-strong sm:h-48">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bg-secondary/25"
            style={{ bottom: pct(band.low), height: `calc(${pct(band.high)} - ${pct(band.low)})` }}
          />
          <div className="absolute inset-0 flex items-end gap-px sm:gap-0.5">
            {rows.map((r) => (
              <div
                key={r.number}
                title={`${r.number}: ${r.observed}`}
                className={cx("min-w-0 flex-1 rounded-t-[2px]", tone === "main" ? "bg-primary" : "bg-accent")}
                style={{ height: pct(r.observed) }}
              />
            ))}
          </div>
          <div aria-hidden="true" className="absolute inset-x-0 border-t-2 border-dashed border-foreground/80" style={{ bottom: pct(expected) }} />
        </div>
        <div aria-hidden="true" className="relative h-4 text-caption text-muted-foreground tabular-nums">
          {rows.map((r, i) =>
            r.number === rows[0]!.number || r.number % step === 0 ? (
              <span
                key={r.number}
                className="absolute -translate-x-1/2"
                style={{ left: `${((i + 0.5) / rows.length) * 100}%` }}
              >
                {r.number}
              </span>
            ) : null,
          )}
        </div>
        <figcaption className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-caption text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block w-5 border-t-2 border-dashed border-foreground/80" />
            {t("stats.chart.expected")}: {fmt1(expected)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block size-3 rounded-sm bg-secondary/40" />
            {t("stats.chart.band")}: {fmt1(band.low)}–{fmt1(band.high)}
          </span>
          <span>
            {t("stats.chart.axisX")} → · {t("stats.chart.axisY")} ↑
          </span>
        </figcaption>
      </figure>

      <Disclosure summary={t("stats.chart.showTable")}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={sortId} className="text-caption font-semibold text-foreground">
              {t("stats.sort.label")}
            </label>
            <select
              id={sortId}
              value={sort}
              onChange={(e) => setSort(e.target.value as "number" | "frequency")}
              className="h-11 rounded-md border border-border-strong bg-background px-3 text-foreground"
            >
              <option value="number">{t("stats.sort.number")}</option>
              <option value="frequency">{t("stats.sort.frequency")}</option>
            </select>
          </div>
          {sort === "frequency" ? <p className="text-caption">{t("stats.sort.frequency.note")}</p> : null}
          <p className="text-caption">
            {t("stats.table.expected")}: {fmt1(expected)}
          </p>
          <table className="w-full text-caption text-foreground sm:text-body">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th scope="col" className="py-1.5 pr-2 font-semibold">{t("stats.table.number")}</th>
                <th scope="col" className="py-1.5 pr-2 text-right font-semibold">{t("stats.table.observed")}</th>
                <th scope="col" className="py-1.5 pr-2 text-right font-semibold">{t("stats.table.difference")}</th>
                <th scope="col" className="py-1.5 text-right font-semibold">{t("stats.table.lastDrawn")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((r) => (
                <tr key={r.number}>
                  <th scope="row" className="py-1.5 pr-2 text-left font-semibold tabular-nums">{r.number}</th>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{r.observed}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">
                    {r.difference > 0 ? "+" : ""}
                    {fmt1(r.difference)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{r.lastDrawn ? date(r.lastDrawn) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Disclosure>
    </div>
  );
}

export interface CompareRow {
  label: string;
  observed: number;
  theoretical: number;
}

/** Observed vs exact theoretical shares as paired bars inside a real table. */
export function CompareTable({ caption, rows, labelHeader }: { caption: string; rows: CompareRow[]; labelHeader: string }) {
  const { t, percent } = useI18n();
  const max = Math.max(0.0001, ...rows.flatMap((r) => [r.observed, r.theoretical]));
  return (
    <table className="w-full table-fixed text-caption sm:text-body">
      <caption className="pb-2 text-left text-body font-semibold text-foreground">{caption}</caption>
      <colgroup>
        <col className="w-[30%]" />
        <col className="w-[35%]" />
        <col className="w-[35%]" />
      </colgroup>
      <thead>
        <tr className="border-b border-border text-left align-bottom text-muted-foreground">
          <th scope="col" className="py-1.5 pr-2 font-semibold">
            <span className="sr-only">{labelHeader}</span>
          </th>
          <th scope="col" className="py-1.5 pr-2 font-semibold">
            <span className="inline-flex items-baseline gap-1.5">
              <span aria-hidden="true" className="inline-block size-2.5 shrink-0 rounded-sm bg-primary" />
              {t("stats.dist.observed")}
            </span>
          </th>
          <th scope="col" className="py-1.5 font-semibold">
            <span className="inline-flex items-baseline gap-1.5">
              <span aria-hidden="true" className="inline-block size-2.5 shrink-0 rounded-sm border border-foreground/70" />
              {t("stats.dist.theoretical")}
            </span>
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map((r) => (
          <tr key={r.label}>
            <th scope="row" className="py-1.5 pr-2 text-left font-semibold tabular-nums">{r.label}</th>
            <td className="py-1.5 pr-2">
              <span className="block tabular-nums">{percent(r.observed, 1)}</span>
              <span aria-hidden="true" className="block h-1.5 rounded-full bg-primary" style={{ width: `${(r.observed / max) * 100}%` }} />
            </td>
            <td className="py-1.5">
              <span className="block tabular-nums">{percent(r.theoretical, 1)}</span>
              <span aria-hidden="true" className="block h-1.5 rounded-full border border-foreground/70" style={{ width: `${(r.theoretical / max) * 100}%` }} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
