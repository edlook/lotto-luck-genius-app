import { useEffect, useRef, useState } from "react";
import { monteCarloUniformity, suggestedSims, type UniformityResult } from "@/lib/stats";

export interface TestState {
  status: "idle" | "tooFew" | "running" | "done" | "error";
  sims: number;
  progress: number;
  result: UniformityResult | null;
}

export const MIN_DRAWS_FOR_TEST = 50;

const IDLE: TestState = { status: "idle", sims: 0, progress: 0, result: null };
const TOO_FEW: TestState = { status: "tooFew", sims: 0, progress: 0, result: null };

/**
 * Runs the Monte Carlo uniformity test in a Web Worker (falls back to the main thread).
 * "idle", "tooFew" and the start of "running" are derived during render; the effect only
 * updates state from worker/timer callbacks (no synchronous setState in the effect body).
 */
export function useUniformityTest(observed: number[] | null, draws: number, k: number, pool: number): TestState {
  const key = observed ? `${draws}:${k}:${pool}:${observed.join(",")}` : "";
  const runnable = observed !== null && draws >= MIN_DRAWS_FOR_TEST;
  // Progress and results of the job for `key`; a stale key means a new job is starting.
  const [job, setJob] = useState<{ key: string; state: TestState } | null>(null);
  const jobId = useRef(0);

  useEffect(() => {
    if (!observed || draws < MIN_DRAWS_FOR_TEST) return;
    const id = ++jobId.current;
    const sims = suggestedSims(draws, k);
    const update = (fn: (s: TestState) => TestState) =>
      setJob((cur) => ({
        key,
        state: fn(cur && cur.key === key ? cur.state : { status: "running", sims, progress: 0, result: null }),
      }));
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL("../workers/stats.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (e: MessageEvent<{ id: number; progress?: number; result?: UniformityResult }>) => {
        if (e.data.id !== jobId.current) return;
        const { result, progress } = e.data;
        if (result) update(() => ({ status: "done", sims, progress: sims, result }));
        else if (progress) update((s) => ({ ...s, progress }));
      };
      worker.onerror = () => update((s) => ({ ...s, status: "error" }));
      worker.postMessage({ id, observed, draws, k, pool, sims });
    } catch {
      // no worker support: compute on the main thread after paint
      const t = window.setTimeout(() => {
        if (id !== jobId.current) return;
        update(() => ({
          status: "done",
          sims,
          progress: sims,
          result: monteCarloUniformity(observed, draws, k, pool, sims),
        }));
      }, 30);
      return () => window.clearTimeout(t);
    }
    return () => worker?.terminate();
    // `key` encodes observed/draws/k/pool.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!observed) return IDLE;
  if (!runnable) return TOO_FEW;
  if (job && job.key === key) return job.state;
  return { status: "running", sims: suggestedSims(draws, k), progress: 0, result: null };
}
