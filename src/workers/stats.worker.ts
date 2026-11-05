/// <reference lib="webworker" />
import { monteCarloUniformity } from "../lib/stats";

export interface StatsJob {
  id: number;
  observed: number[];
  draws: number;
  k: number;
  pool: number;
  sims: number;
}

self.onmessage = (e: MessageEvent<StatsJob>) => {
  const { id, observed, draws, k, pool, sims } = e.data;
  const result = monteCarloUniformity(observed, draws, k, pool, sims, undefined, (done) =>
    (self as unknown as Worker).postMessage({ id, progress: done }),
  );
  (self as unknown as Worker).postMessage({ id, result });
};
