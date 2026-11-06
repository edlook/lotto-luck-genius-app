/// <reference lib="webworker" />
import { runAnalysis, type AnalysisKind, type AnalysisMessage } from "../lib/analysisJobs";

const ctx = self as unknown as Worker;

self.onmessage = (e: MessageEvent<AnalysisMessage>) => {
  const { id, kind, ...request } = e.data;
  try {
    const result = runAnalysis(kind as AnalysisKind, request as never, (progress) => ctx.postMessage({ id, progress }));
    ctx.postMessage({ id, result });
  } catch (error) {
    ctx.postMessage({ id, error: String(error) });
  }
};
