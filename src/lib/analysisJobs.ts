/**
 * Heavy analyses of the /backtest screen as plain functions: the Web Worker and the main-thread
 * fallback both call `runAnalysis`, so there is one code path.
 */
import { runBacktest, type BacktestResult } from "./backtest";
import { analysePopularity, type PopularityValidation, type ValidationDraw } from "./popularityValidation";

export interface AnalysisKinds {
  backtest: { request: { draws: number[][]; pool: number; k: number }; result: BacktestResult };
  popularity: { request: { draws: ValidationDraw[] }; result: PopularityValidation | null };
}
export type AnalysisKind = keyof AnalysisKinds;

export type AnalysisMessage = {
  [K in AnalysisKind]: { kind: K; id: number } & AnalysisKinds[K]["request"];
}[AnalysisKind];

export function runAnalysis<K extends AnalysisKind>(
  kind: K,
  request: AnalysisKinds[K]["request"],
  onProgress?: (fraction: number) => void,
): AnalysisKinds[K]["result"] {
  if (kind === "backtest") {
    const r = request as AnalysisKinds["backtest"]["request"];
    return runBacktest(r.draws, r.pool, r.k, { onProgress });
  }
  const r = request as AnalysisKinds["popularity"]["request"];
  return analysePopularity(r.draws, { onProgress });
}
