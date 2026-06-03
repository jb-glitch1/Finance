// Web Worker: runs the Monte Carlo engine off the main thread so the UI stays
// responsive even at 100k iterations. All computation is local — nothing is
// sent anywhere.

import { runSimulation } from "../engine/simulation";
import { tornado, defaultFactors, type OutcomeMetric } from "../engine/sensitivity";
import { optimizeSavings, optimizeAllocation } from "../advisor/optimizer";
import type { Scenario, SimulationResult } from "../engine/types";

export type WorkerRequest =
  | { id: number; type: "run"; scenario: Scenario }
  | { id: number; type: "tornado"; scenario: Scenario; metric: OutcomeMetric }
  | { id: number; type: "optimizeSavings"; scenario: Scenario; target: number }
  | { id: number; type: "optimizeAllocation"; scenario: Scenario };

export type WorkerResponse =
  | { id: number; type: "progress"; completed: number; total: number }
  | { id: number; type: "result"; result: SimulationResult }
  | { id: number; type: "tornado"; entries: ReturnType<typeof tornado> }
  | { id: number; type: "optimizeSavings"; recommended: number | null; trace: { value: number; successProbability: number }[] }
  | { id: number; type: "optimizeAllocation"; bestStockWeight: number; trace: { value: number; successProbability: number }[] }
  | { id: number; type: "error"; message: string };

const post = (msg: WorkerResponse) => (self as unknown as Worker).postMessage(msg);

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  try {
    switch (req.type) {
      case "run": {
        const result = runSimulation(req.scenario, (completed, total) => {
          post({ id: req.id, type: "progress", completed, total });
        });
        post({ id: req.id, type: "result", result });
        break;
      }
      case "tornado": {
        const entries = tornado(req.scenario, defaultFactors(req.scenario), req.metric);
        post({ id: req.id, type: "tornado", entries });
        break;
      }
      case "optimizeSavings": {
        const { recommended, trace } = optimizeSavings(req.scenario, req.target);
        post({ id: req.id, type: "optimizeSavings", recommended, trace });
        break;
      }
      case "optimizeAllocation": {
        const { bestStockWeight, trace } = optimizeAllocation(req.scenario);
        post({ id: req.id, type: "optimizeAllocation", bestStockWeight, trace });
        break;
      }
    }
  } catch (err) {
    post({ id: req.id, type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
