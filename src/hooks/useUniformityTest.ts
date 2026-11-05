import { useEffect, useRef, useState } from "react";
import { monteCarloUniformity, suggestedSims, type UniformityResult } from "@/lib/stats";

export interface TestState {
  status: "idle" | "tooFew" | "running" | "done" | "error";
  sims: number;
  progress: number;
  result: UniformityResult | null;
}

export const MIN_DRAWS_FOR_TEST = 50;

/** Runs the Monte Carlo uniformity test in a Web Worker (falls back to the main thread). */
export function useUniformityTest(observed: number[] | null, draws: number, k: number, pool: number): TestState {
  const [state, setState] = useState<TestState>({ status: "idle", sims: 0, progress: 0, result: null });
  const jobId = useRef(0);
  const key = observed ? `${draws}:${k}:${pool}:${observed.join(",")}` : "";

  useEffect(() => {
    if (!observed) return;
    if (draws < MIN_DRAWS_FOR_TEST) {
      setState({ status: "tooFew", sims: 0, progress: 0, result: null });
      return;
    }
    const id = ++jobId.current;
    const sims = suggestedSims(draws, k);
    setState({ status: "running", sims, progress: 0, result: null });
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL("../workers/stats.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (e: MessageEvent<{ id: number; progress?: number; result?: UniformityResult }>) => {
        if (e.data.id !== jobId.current) return;
        if (e.data.result) setState({ status: "done", sims, progress: sims, result: e.data.result });
        else if (e.data.progress) setState((s) => ({ ...s, progress: e.data.progress! }));
      };
      worker.onerror = () => setState((s) => ({ ...s, status: "error" }));
      worker.postMessage({ id, observed, draws, k, pool, sims });
    } catch {
      // no worker support: compute on the main thread after paint
      const t = window.setTimeout(() => {
        if (id !== jobId.current) return;
        setState({ status: "done", sims, progress: sims, result: monteCarloUniformity(observed, draws, k, pool, sims) });
      }, 30);
      return () => window.clearTimeout(t);
    }
    return () => worker?.terminate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}
