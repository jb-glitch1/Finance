// Optimizers that search for the inputs maximizing the probability of success.
//
// These are deliberately simple and transparent: a coarse-to-fine grid / line
// search over one lever at a time, each candidate evaluated by running the full
// Monte Carlo at a reduced iteration count. No opaque solver — you can see every
// candidate that was tried.

import { runSimulation } from "../engine/simulation";
import type { Scenario } from "../engine/types";

function clone(s: Scenario): Scenario {
  return JSON.parse(JSON.stringify(s)) as Scenario;
}

export interface SearchPoint {
  value: number;
  successProbability: number;
}

/**
 * Find the minimum annual SAVINGS amount (added to a "Savings" income/expense
 * offset) that achieves the target probability of success. We model extra
 * savings as an additional fixed contribution by reducing a synthetic expense.
 * Returns the search trace so the UI can plot probability vs savings.
 */
export function optimizeSavings(
  base: Scenario,
  targetProbability = 0.85,
  options: { min?: number; max?: number; steps?: number; iterations?: number } = {},
): { recommended: number | null; trace: SearchPoint[] } {
  const min = options.min ?? 0;
  const max = options.max ?? 60000;
  const steps = options.steps ?? 12;
  const iterations = options.iterations ?? 400;
  const trace: SearchPoint[] = [];
  let recommended: number | null = null;

  for (let i = 0; i <= steps; i++) {
    const extra = min + ((max - min) * i) / steps;
    const s = clone(base);
    s.settings = { ...s.settings, iterations };
    // Extra savings = an additional non-taxable income stream that is saved
    // while working (it raises the working surplus, which gets invested).
    s.incomes = [
      ...s.incomes,
      {
        id: "opt-savings",
        name: "Additional savings",
        amount: { kind: "fixed", value: extra },
        startAge: s.people[0].currentAge,
        endAge: s.retirementAge - 1,
        realGrowth: 0,
        taxable: false,
        variability: "fixed",
      },
    ];
    const p = runSimulation(s).successProbability;
    trace.push({ value: extra, successProbability: p });
    if (recommended === null && p >= targetProbability) recommended = extra;
  }
  return { recommended, trace };
}

/**
 * Search the stock allocation (applied uniformly to invested accounts) that
 * maximizes the probability of success. Returns the best weight and the full
 * curve of probability vs stock weight (often hump-shaped: too little growth
 * vs too much volatility).
 */
export function optimizeAllocation(
  base: Scenario,
  options: { steps?: number; iterations?: number } = {},
): { bestStockWeight: number; trace: SearchPoint[] } {
  const steps = options.steps ?? 10;
  const iterations = options.iterations ?? 500;
  const trace: SearchPoint[] = [];
  let best = { value: 0.6, successProbability: -1 };

  for (let i = 0; i <= steps; i++) {
    const stocks = i / steps;
    const cash = Math.min(0.05, 1 - stocks);
    const bonds = Math.max(0, 1 - stocks - cash);
    const s = clone(base);
    s.settings = { ...s.settings, iterations };
    s.accounts = s.accounts.map((a) =>
      a.type === "cash" ? a : { ...a, allocation: { stocks, bonds, cash } },
    );
    const p = runSimulation(s).successProbability;
    trace.push({ value: stocks, successProbability: p });
    if (p > best.successProbability) best = { value: stocks, successProbability: p };
  }
  return { bestStockWeight: best.value, trace };
}
