import { Link } from "react-router";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { useI18n } from "@/i18n/context";
import type { DrawSet } from "@/hooks/useDraws";
import { completenessText } from "./completenessText";

/** Source · updated · count · completeness, plus a warning with the missing dates. */
export function DrawDataStatus({ data, showDetails = true }: { data: DrawSet; showDetails?: boolean }) {
  const i18n = useI18n();
  const { t, tp, date } = i18n;
  const c = data.completeness;
  const missing = c?.missing ?? [];
  const updated = data.meta?.fetchedAt ? data.meta.fetchedAt.slice(0, 10) : data.lastDate;
  return (
    <div className="flex flex-col gap-3">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted-foreground">
        {data.meta ? <span>{t("draws.status.source", { source: data.meta.sourceName })}</span> : null}
        {updated ? <span>· {t("draws.status.updated", { date: date(updated) })}</span> : null}
        <span>· {tp("draws.status.count", data.draws.length)}</span>
        <span className="inline-flex items-center gap-1">
          ·{" "}
          {missing.length ? (
            <TriangleAlert aria-hidden="true" className="size-4 text-warning" />
          ) : (
            <CircleCheck aria-hidden="true" className="size-4 text-success" />
          )}
          {completenessText(c, i18n)}
        </span>
        {showDetails ? (
          <Link
            to="/about#data"
            className="inline-flex min-h-11 items-center font-semibold text-foreground underline underline-offset-4"
          >
            {t("draws.status.details")}
          </Link>
        ) : null}
      </p>
      {missing.length ? (
        <div
          role="note"
          className="flex flex-col gap-2 rounded-md border border-warning/60 bg-warning/10 p-3 text-body"
        >
          <p className="flex items-start gap-2 font-semibold">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
            {tp("draws.banner.gap", missing.length)}
          </p>
          <p className="text-caption text-muted-foreground">
            {t("draws.banner.gap.list", {
              dates:
                missing
                  .slice(-12)
                  .map((d) => date(d))
                  .join(", ") + (missing.length > 12 ? " …" : ""),
            })}
          </p>
          <ButtonLink to="/settings#manual-draw" variant="secondary" className="self-start">
            {t("draws.banner.gap.fix")}
          </ButtonLink>
        </div>
      ) : null}
    </div>
  );
}
