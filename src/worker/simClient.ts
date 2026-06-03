// Promise-based client around the simulation Web Worker. Falls back to running
// on the main thread if Workers are unavailable (e.g. some test environments).

import type { WorkerRequest, WorkerResponse } from "./sim.worker";
import type { Scenario, SimulationResult } from "../engine/types";
import type { OutcomeMetric, TornadoEntry } from "../engine/sensitivity";

let worker: Worker | null = null;
let nextId = 1;

function getWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  if (!worker) {
    worker = new Worker(new URL("./sim.worker.ts", import.meta.url), { type: "module" });
  }
  return worker;
}

type ProgressCb = (completed: number, total: number) => void;

// Distributive Omit so each union member keeps its own fields (metric, target…).
type WithoutId<T> = T extends unknown ? Omit<T, "id"> : never;

function call<T extends WorkerResponse>(req: WithoutId<WorkerRequest>, onProgress?: ProgressCb): Promise<T> {
  const w = getWorker();
  const id = nextId++;
  if (!w) return mainThreadFallback({ ...req, id } as WorkerRequest) as Promise<T>;
  return new Promise<T>((resolve, reject) => {
    const handler = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.id !== id) return;
      if (msg.type === "progress") {
        onProgress?.(msg.completed, msg.total);
        return;
      }
      w.removeEventListener("message", handler);
      if (msg.type === "error") reject(new Error(msg.message));
      else resolve(msg as T);
    };
    w.addEventListener("message", handler);
    w.postMessage({ ...req, id } as WorkerRequest);
  });
}

async function mainThreadFallback(req: WorkerRequest): Promise<WorkerResponse> {
  const { runSimulation } = await import("../engine/simulation");
  const { tornado, defaultFactors } = await import("../engine/sensitivity");
  const { optimizeSavings, optimizeAllocation } = await import("../advisor/optimizer");
  switch (req.type) {
    case "run":
      return { id: req.id, type: "result", result: runSimulation(req.scenario) };
    case "tornado":
      return { id: req.id, type: "tornado", entries: tornado(req.scenario, defaultFactors(req.scenario), req.metric) };
    case "optimizeSavings": {
      const r = optimizeSavings(req.scenario, req.target);
      return { id: req.id, type: "optimizeSavings", ...r };
    }
    case "optimizeAllocation": {
      const r = optimizeAllocation(req.scenario);
      return { id: req.id, type: "optimizeAllocation", ...r };
    }
  }
}

export async function runScenario(scenario: Scenario, onProgress?: ProgressCb): Promise<SimulationResult> {
  const res = await call<Extract<WorkerResponse, { type: "result" }>>({ type: "run", scenario }, onProgress);
  return res.result;
}

export async function runTornado(scenario: Scenario, metric: OutcomeMetric): Promise<TornadoEntry[]> {
  const res = await call<Extract<WorkerResponse, { type: "tornado" }>>({ type: "tornado", scenario, metric });
  return res.entries;
}

export async function runOptimizeSavings(scenario: Scenario, target: number) {
  return call<Extract<WorkerResponse, { type: "optimizeSavings" }>>({ type: "optimizeSavings", scenario, target });
}

export async function runOptimizeAllocation(scenario: Scenario) {
  return call<Extract<WorkerResponse, { type: "optimizeAllocation" }>>({ type: "optimizeAllocation", scenario });
}
