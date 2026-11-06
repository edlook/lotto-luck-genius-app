import { Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui";
import { useI18n } from "@/i18n/context";
import type { AnalysisState } from "@/hooks/useAnalysis";
import type { AnalysisKind } from "@/lib/analysisJobs";

/** Start button, progress and error line shared by both analyses. */
export function RunControl<K extends AnalysisKind>({ state, onRun }: { state: AnalysisState<K>; onRun: () => void }) {
  const { t, percent } = useI18n();
  const running = state.status === "running";
  const done = state.status === "done";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          size="lg"
          loading={running}
          onClick={onRun}
          icon={done ? <RotateCcw /> : <Play />}
          className="w-full sm:w-auto"
        >
          {done ? t("backtest.rerun") : t("backtest.run")}
        </Button>
        {done ? <p className="text-caption text-muted-foreground">{t("backtest.rerun.note")}</p> : null}
      </div>
      <div aria-live="polite" className="flex flex-col gap-2">
        {running ? (
          <>
            <p className="text-body text-muted-foreground">{t("backtest.running", { percent: percent(state.progress, 0) })}</p>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(state.progress * 100)}
              aria-label={t("backtest.run")}
              className="h-2 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
                style={{ width: `${state.progress * 100}%` }}
              />
            </div>
          </>
        ) : null}
        {state.status === "error" ? (
          <p role="alert" className="text-body font-semibold text-danger">
            {t("backtest.error.title")}. {t("backtest.error.body")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
