import { useEffect, useRef, useState } from "react";
import { runAnalysis, type AnalysisKind, type AnalysisKinds } from "@/lib/analysisJobs";

export interface AnalysisState<K extends AnalysisKind> {
  status: "idle" | "running" | "done" | "error";
  /** 0..1 */
  progress: number;
  result: AnalysisKinds[K]["result"] | undefined;
  start: (request: AnalysisKinds[K]["request"]) => void;
}

interface Slot<K extends AnalysisKind> {
  key: string;
  status: "running" | "done" | "error";
  progress: number;
  result?: AnalysisKinds[K]["result"];
}

/**
 * Runs one analysis on demand in a Web Worker (falls back to the main thread without worker
 * support). `key` identifies the input (game, data): a result for another key is not shown.
 * State changes come from worker callbacks and the start handler only.
 */
export function useAnalysis<K extends AnalysisKind>(kind: K, key: string): AnalysisState<K> {
  const [slot, setSlot] = useState<Slot<K> | null>(null);
  const worker = useRef<Worker | null>(null);
  const jobId = useRef(0);

  useEffect(() => () => worker.current?.terminate(), []);

  const start = (request: AnalysisKinds[K]["request"]) => {
    worker.current?.terminate();
    worker.current = null;
    const id = ++jobId.current;
    const patch = (p: Partial<Slot<K>>) => {
      if (id !== jobId.current) return;
      setSlot((cur) => ({ ...(cur && cur.key === key ? cur : { key, status: "running", progress: 0 }), ...p, key }) as Slot<K>);
    };
    patch({ status: "running", progress: 0, result: undefined });
    let w: Worker;
    try {
      w = new Worker(new URL("../workers/analysis.worker.ts", import.meta.url), { type: "module" });
    } catch {
      // No worker support: compute after the progress state has painted.
      window.setTimeout(() => {
        try {
          patch({ status: "done", progress: 1, result: runAnalysis(kind, request) });
        } catch {
          patch({ status: "error" });
        }
      }, 50);
      return;
    }
    worker.current = w;
    w.onmessage = (e: MessageEvent<{ id: number; progress?: number; result?: AnalysisKinds[K]["result"]; error?: string }>) => {
      const m = e.data;
      if (m.id !== id) return;
      if (m.error !== undefined) patch({ status: "error" });
      else if ("result" in m) {
        patch({ status: "done", progress: 1, result: m.result });
        w.terminate();
      } else if (m.progress !== undefined) patch({ progress: m.progress });
    };
    w.onerror = () => patch({ status: "error" });
    w.postMessage({ kind, id, ...request });
  };

  const shown = slot && slot.key === key ? slot : null;
  return {
    status: shown ? shown.status : "idle",
    progress: shown ? shown.progress : 0,
    result: shown?.result,
    start,
  };
}
