// Tornado / sensitivity analysis.
//
// Which assumption moves the answer the most? We perturb one driver at a time
// to a low and a high setting (holding everything else at baseline) and measure
// the swing in the outcome metric. Ranking those swings produces a tornado
// chart: the widest bar is the variable your plan is most sensitive to — often
// the sequence/level of early returns or the spending level.

import { runSimulation } from "./simulation";
import { percentile } from "./stats";
import type { Scenario, ReturnModel } from "./types";

export interface SensitivityFactor {
  name: string;
  apply: (s: Scenario, level: "low" | "high") => Scenario;
}

export interface TornadoEntry {
  name: string;
  lowOutcome: number;
  highOutcome: number;
  baseline: number;
  swing: number;
}

export type OutcomeMetric = "successProbability" | "medianTerminal";

function clone(s: Scenario): Scenario {
  return JSON.parse(JSON.stringify(s)) as Scenario;
}

function bumpReturn(model: ReturnModel, delta: number): ReturnModel {
  if (model.kind === "parametric" && model.stocks.kind === "normal") {
    return { ...model, stocks: { ...model.stocks, mean: model.stocks.mean + delta } };
  }
  return model;
}

/** Default factors derived from the scenario for a quick, meaningful tornado. */
export function defaultFactors(scenario: Scenario): SensitivityFactor[] {
  const factors: SensitivityFactor[] = [];
  const hasSocialSecurity = scenario.people.some((p) => p.socialSecurityPIA > 0);

  factors.push({
    name: "Investment return (±2%/yr)",
    apply: (s, level) => {
      const c = clone(s);
      c.returnModel = bumpReturn(c.returnModel, level === "low" ? -0.02 : 0.02);
      return c;
    },
  });

  factors.push({
    name: "Inflation (±1.5%/yr)",
    apply: (s, level) => {
      const c = clone(s);
      if (c.returnModel.kind === "parametric" && c.returnModel.inflation.kind === "normal") {
        c.returnModel.inflation.mean += level === "low" ? -0.015 : 0.015;
      }
      return c;
    },
  });

  factors.push({
    name: "Spending (±15%)",
    apply: (s, level) => {
      const c = clone(s);
      const f = level === "low" ? 0.85 : 1.15;
      c.expenses = c.expenses.map((e) => ({ ...e, amount: scaleSpec(e.amount, f) }));
      return c;
    },
  });

  factors.push({
    name: "Retirement age (±3 yrs)",
    apply: (s, level) => {
      const c = clone(s);
      c.retirementAge += level === "low" ? 3 : -3; // retiring later = "low" risk
      return c;
    },
  });

  factors.push({
    name: "Longevity (±5 yrs)",
    apply: (s, level) => {
      const c = clone(s);
      c.settings = { ...c.settings, stochasticLongevity: false };
      c.settings.horizonYears += level === "low" ? -5 : 5;
      return c;
    },
  });

  if (hasSocialSecurity)
    factors.push({
    name: "Social Security claim age",
    apply: (s, level) => {
      const c = clone(s);
      c.people = c.people.map((p) => ({ ...p, claimAge: level === "low" ? Math.max(62, p.claimAge - 3) : Math.min(70, p.claimAge + 3) }));
      return c;
    },
  });

  return factors;
}

function scaleSpec<T extends Scenario["expenses"][number]["amount"]>(spec: T, f: number): T {
  switch (spec.kind) {
    case "fixed":
      return { ...spec, value: spec.value * f };
    case "normal":
    case "lognormal":
      return { ...spec, mean: spec.mean * f };
    case "uniform":
      return { ...spec, min: spec.min * f, max: spec.max * f };
    case "triangular":
    case "pert":
      return { ...spec, min: spec.min * f, mode: spec.mode * f, max: spec.max * f };
    case "studentT":
      return { ...spec, mean: spec.mean * f };
    case "discrete":
      return { ...spec, values: spec.values.map((v) => v * f) };
    default:
      return spec;
  }
}

function outcome(scenario: Scenario, metric: OutcomeMetric): number {
  const res = runSimulation(scenario);
  return metric === "successProbability" ? res.successProbability : percentile(res.terminalNetWorth, 50);
}

/** Run a tornado analysis. Uses a reduced iteration count for speed. */
export function tornado(
  baseScenario: Scenario,
  factors: SensitivityFactor[],
  metric: OutcomeMetric = "successProbability",
  iterations = 400,
): TornadoEntry[] {
  const base = clone(baseScenario);
  base.settings = { ...base.settings, iterations };
  const baseline = outcome(base, metric);

  const entries: TornadoEntry[] = factors.map((factor) => {
    const low = factor.apply(base, "low");
    const high = factor.apply(base, "high");
    low.settings = { ...low.settings, iterations };
    high.settings = { ...high.settings, iterations };
    const lowOutcome = outcome(low, metric);
    const highOutcome = outcome(high, metric);
    return {
      name: factor.name,
      lowOutcome,
      highOutcome,
      baseline,
      swing: Math.abs(highOutcome - lowOutcome),
    };
  });

  return entries.sort((a, b) => b.swing - a.swing);
}
