// A realistic default scenario and the named stress-test presets.

import type { Scenario } from "../engine/types";

export function makeDefaultScenario(): Scenario {
  return {
    name: "Base plan",
    filingStatus: "mfj",
    people: [
      { name: "You", currentAge: 45, birthYear: 1981, sex: "female", socialSecurityPIA: 36000, claimAge: 67 },
      { name: "Partner", currentAge: 47, birthYear: 1979, sex: "male", socialSecurityPIA: 30000, claimAge: 67 },
    ],
    accounts: [
      { id: "cash", name: "Cash / Emergency", type: "cash", balance: 40000, allocation: { stocks: 0, bonds: 0, cash: 1 } },
      { id: "taxable", name: "Brokerage", type: "taxable", balance: 220000, costBasis: 150000, allocation: { stocks: 0.8, bonds: 0.15, cash: 0.05 } },
      { id: "trad", name: "401(k) / Traditional", type: "traditional", balance: 480000, allocation: { stocks: 0.75, bonds: 0.2, cash: 0.05 } },
      { id: "roth", name: "Roth IRA", type: "roth", balance: 110000, allocation: { stocks: 0.9, bonds: 0.1, cash: 0 } },
    ],
    debts: [
      { id: "mortgage", name: "Mortgage", kind: "mortgage", balance: 320000, annualRate: 0.0425, minPayment: 1800 },
      { id: "auto", name: "Car loan", kind: "auto", balance: 18000, annualRate: 0.064, minPayment: 420 },
    ],
    incomes: [
      { id: "salary1", name: "Your salary", amount: { kind: "fixed", value: 145000 }, startAge: 45, endAge: 64, realGrowth: 0.01, taxable: true, variability: "fixed" },
      { id: "salary2", name: "Partner salary", amount: { kind: "normal", mean: 95000, sd: 8000 }, startAge: 47, endAge: 66, realGrowth: 0.01, taxable: true, variability: "variable" },
    ],
    expenses: [
      { id: "housing", name: "Housing (non-mortgage)", amount: { kind: "fixed", value: 14000 }, startAge: 45, endAge: 120, inflationAdjust: true, category: "Housing", variability: "fixed" },
      { id: "essentials", name: "Essentials (food, utilities, insurance)", amount: { kind: "normal", mean: 38000, sd: 4000 }, startAge: 45, endAge: 120, inflationAdjust: true, category: "Essentials", variability: "variable" },
      { id: "discretionary", name: "Discretionary (dining, travel, fun)", amount: { kind: "lognormal", mean: Math.log(28000), sd: 0.3 }, startAge: 45, endAge: 120, inflationAdjust: true, category: "Discretionary", variability: "variable", discretionaryCutInDownturn: 0.15 },
      { id: "healthcare", name: "Healthcare (rising)", amount: { kind: "normal", mean: 9000, sd: 2500 }, startAge: 45, endAge: 120, inflationAdjust: true, category: "Healthcare", variability: "variable" },
    ],
    savingsAllocation: { taxable: 0.3, traditional: 0.5, roth: 0.2, cash: 0 },
    returnModel: {
      kind: "parametric",
      // Forward-looking assumptions (real-world nominal): stocks ~7%/17%,
      // bonds ~3.5%/6%, cash ~3%/1%, inflation ~2.6%/1.5%. Edit freely.
      stocks: { kind: "normal", mean: 0.07, sd: 0.17 },
      bonds: { kind: "normal", mean: 0.035, sd: 0.06 },
      cash: { kind: "normal", mean: 0.03, sd: 0.01 },
      stockBondCorr: 0.1,
      inflation: { kind: "normal", mean: 0.026, sd: 0.015 },
    },
    withdrawal: { strategy: "guardrails", initialRate: 0.04, guardrailBand: 0.2, guardrailAdjust: 0.1, vpwReturn: 0.03 },
    retirementAge: 65,
    withdrawalOrder: ["taxable", "traditional", "roth", "cash"],
    settings: { iterations: 1000, seed: 12345, stochasticLongevity: true, horizonYears: 50 },
    goal: { targetAmount: 2_000_000, targetAge: 65 },
  };
}

export type PresetName = "Base" | "Market Crash" | "High Inflation" | "Job Loss";

/** Derive a stress-test variant from a base scenario. */
export function applyPreset(base: Scenario, preset: PresetName): Scenario {
  const s: Scenario = JSON.parse(JSON.stringify(base));
  s.name = preset === "Base" ? base.name : preset;
  if (s.returnModel.kind !== "parametric") {
    // Stress presets are defined for the parametric model; leave bootstrap as-is.
    return s;
  }
  switch (preset) {
    case "Base":
      return s;
    case "Market Crash":
      // Lower expected returns and fatter tails (Student-t) to mimic a crash regime.
      s.returnModel.stocks = { kind: "studentT", mean: 0.04, sd: 0.22, nu: 4 };
      s.returnModel.bonds = { kind: "normal", mean: 0.03, sd: 0.08 };
      s.returnModel.stockBondCorr = 0.4;
      return s;
    case "High Inflation":
      s.returnModel.inflation = { kind: "normal", mean: 0.05, sd: 0.02 };
      s.returnModel.stocks = { kind: "normal", mean: 0.06, sd: 0.18 };
      s.returnModel.bonds = { kind: "normal", mean: 0.025, sd: 0.07 };
      return s;
    case "Job Loss":
      // Primary earner loses 3 years of income near-term.
      s.incomes = s.incomes.map((inc, i) =>
        i === 0 ? { ...inc, endAge: Math.min(inc.endAge, s.people[0].currentAge + 1) } : inc,
      );
      return s;
  }
}

export const PRESETS: PresetName[] = ["Base", "Market Crash", "High Inflation", "Job Loss"];
