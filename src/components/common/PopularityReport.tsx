import { Link } from "react-router";
import { CircleCheck, CircleDashed, CircleMinus, TriangleAlert } from "lucide-react";
import { useI18n } from "@/i18n/context";
import { cx } from "@/lib/cx";
import type { PopularityLevel, PopularityReport as Report, RuleResult } from "@/lib/popularity";

const LEVEL_STYLE: Record<PopularityLevel, string> = {
  low: "border-success/60 text-success",
  medium: "border-warning/70 text-warning",
  high: "border-danger/70 text-danger",
};

/** "Popularity estimate: low" as a pill. Words, not percentages (no reliable weights). */
export function PopularityBadge({ level, className }: { level: PopularityLevel; className?: string }) {
  const { t } = useI18n();
  return (
    <span
      className={cx(
        "inline-flex min-h-7 items-center rounded-full border px-2.5 text-caption font-semibold",
        LEVEL_STYLE[level],
        className,
      )}
    >
      {t("generator.result.popularity", { level: t(`popularity.level.${level}`) })}
    </span>
  );
}

function ruleText(r: RuleResult, t: (k: string, p?: Record<string, string | number>) => string, date: (iso: string) => string) {
  const params: Record<string, string | number> = { ...r.params };
  if (r.id === "pastWinning" && typeof params.date === "string") params.date = date(params.date);
  if (r.id === "ticketPattern" && typeof params.line === "string")
    params.line = t(`popularity.rule.ticketPattern.line.${params.line}`);
  if (r.status === "triggered") return t(`popularity.rule.${r.id}.hit`, params);
  if (r.status === "notTriggered") return t(`popularity.rule.${r.id}.miss`);
  if (r.status === "notChecked") return t("popularity.rule.notChecked");
  return t("popularity.rule.disabledBlank");
}

const STATUS_ICON = {
  triggered: TriangleAlert,
  notTriggered: CircleCheck,
  notChecked: CircleDashed,
  disabledBlank: CircleMinus,
} as const;

/**
 * Every rule with its status (icon + word, not colour alone), the concrete numbers it found,
 * why it matters and its source. Rules that applied come first.
 */
export function PopularityRules({ report, headingLevel = 3 }: { report: Report; headingLevel?: 3 | 4 }) {
  const { t, date } = useI18n();
  const rules = [...report.rules].sort((a, b) => Number(b.status === "triggered") - Number(a.status === "triggered"));
  const H = headingLevel === 3 ? "h3" : "h4";
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-border">
        {rules.map((r) => {
          const Icon = STATUS_ICON[r.status];
          const hit = r.status === "triggered";
          return (
            <li key={r.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
              <Icon
                aria-hidden="true"
                className={cx(
                  "mt-0.5 size-5 shrink-0",
                  hit ? (r.strength === "strong" ? "text-danger" : "text-warning") : "text-muted-foreground",
                )}
              />
              <div className="flex min-w-0 flex-col gap-1">
                <H className="text-body font-semibold text-foreground">
                  {t(`popularity.rule.${r.id}.name`)}
                  <span className="font-normal text-muted-foreground">
                    {" · "}
                    {t(hit ? "popularity.rule.triggered" : r.status === "notTriggered" ? "popularity.rule.notTriggered" : "common.notChecked")}
                    {" · "}
                    {t(`popularity.strength.${r.strength}`)}
                  </span>
                </H>
                <p className={cx("text-body", hit ? "text-foreground" : "text-muted-foreground")}>
                  {ruleText(r, t, date)}
                  {r.status === "notChecked" ? (
                    <>
                      {" "}
                      <Link to="/settings#import" className="font-semibold text-primary underline underline-offset-4">
                        {t("popularity.rule.notChecked.link")}
                      </Link>
                    </>
                  ) : null}
                </p>
                <p className="text-caption text-muted-foreground">{t(`popularity.rule.${r.id}.why`)}</p>
                <p className="text-caption text-muted-foreground">
                  {t("popularity.source.label")}: {r.sources.map((s) => t(`popularity.source.${s}`)).join("; ")}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-caption text-muted-foreground">
        <span className="font-semibold">{t("popularity.scale.title")}.</span> {t("popularity.scale.body")}
      </p>
    </div>
  );
}
