import { describe, it, expect } from "vitest";
import { runSimulation } from "../engine/simulation";
import type { Scenario } from "../engine/types";
import {
  monthlyPayment,
  remainingBalance,
  amortizationSchedule,
  monthsToPayoff,
} from "../finance/amortization";

// A deterministic scenario: fixed return (sd=0), fixed withdrawal, no taxes
// (Roth), no inflation. The portfolio must follow the closed-form annuity
// recurrence  B_{t+1} = (B_t - W)(1+r), so the engine's terminal value can be
// checked against the exact formula.
function deterministicScenario(P0: number, r: number, W: number, years: number): Scenario {
  return {
    name: "annuity",
    filingStatus: "single",
    people: [{ name: "A", currentAge: 65, birthYear: 1959, sex: "male", socialSecurityPIA: 0, claimAge: 67 }],
    accounts: [
      { id: "roth", name: "Roth", type: "roth", balance: P0, allocation: { stocks: 1, bonds: 0, cash: 0 } },
    ],
    debts: [],
    incomes: [],
    expenses: [
      { id: "spend", name: "Spend", amount: { kind: "fixed", value: W }, startAge: 65, endAge: 200, inflationAdjust: false, category: "spending", variability: "fixed" },
    ],
    savingsAllocation: { taxable: 0, traditional: 0, roth: 1, cash: 0 },
    returnModel: {
      kind: "parametric",
      stocks: { kind: "normal", mean: r, sd: 0 },
      bonds: { kind: "normal", mean: 0, sd: 0 },
      cash: { kind: "normal", mean: 0, sd: 0 },
      stockBondCorr: 0,
      inflation: { kind: "normal", mean: 0, sd: 0 },
    },
    withdrawal: { strategy: "fixed-real", initialRate: 0.04 },
    retirementAge: 65,
    withdrawalOrder: ["taxable", "traditional", "roth", "cash"],
    settings: { iterations: 8, seed: 1, stochasticLongevity: false, horizonYears: years },
  };
}

function closedFormAnnuity(P0: number, r: number, W: number, n: number): number {
  // B_n = (1+r)^n P0 - W (1+r) ((1+r)^n - 1)/r
  const g = Math.pow(1 + r, n);
  return g * P0 - (W * (1 + r) * (g - 1)) / r;
}

describe("engine vs closed-form annuity", () => {
  it("matches the deterministic drawdown recurrence", () => {
    const P0 = 1_000_000;
    const r = 0.05;
    const W = 50_000;
    const n = 30;
    const res = runSimulation(deterministicScenario(P0, r, W, n));
    const expected = closedFormAnnuity(P0, r, W, n);
    // sd=0 ⇒ every iteration identical and deterministic.
    const median = res.terminalNetWorth[0];
    expect(median).toBeCloseTo(expected, 0);
    expect(res.successProbability).toBe(1);
  });

  it("detects depletion when withdrawals exceed sustainable rate", () => {
    // Withdraw 12% of a 1M portfolio earning 2% → must run out before 30y.
    const res = runSimulation(deterministicScenario(1_000_000, 0.02, 120_000, 30));
    expect(res.successProbability).toBe(0);
    expect(res.paths[0].ranOutAge).not.toBeNull();
  });

  it("is reproducible across runs with the same seed", () => {
    const s = deterministicScenario(500_000, 0.04, 20_000, 25);
    const a = runSimulation(s);
    const b = runSimulation(s);
    expect(a.terminalNetWorth).toEqual(b.terminalNetWorth);
  });
});

describe("amortization closed-form", () => {
  it("30-year $100k @ 6% → payment ≈ $599.55", () => {
    expect(monthlyPayment(100000, 0.06, 360)).toBeCloseTo(599.55, 2);
  });

  it("remaining balance after 12 payments ≈ $98,771.99", () => {
    expect(remainingBalance(100000, 0.06, 360, 12)).toBeCloseTo(98771.99, 0);
  });

  it("schedule fully amortizes to zero in 360 months", () => {
    const pay = monthlyPayment(250000, 0.045, 360);
    const sched = amortizationSchedule(250000, 0.045, pay);
    expect(sched.length).toBe(360);
    expect(sched[sched.length - 1].balance).toBeCloseTo(0, 2);
    // Sum of principal payments equals the original principal.
    const principalSum = sched.reduce((s, r) => s + r.principal, 0);
    expect(principalSum).toBeCloseTo(250000, 0);
  });

  it("monthsToPayoff matches the term", () => {
    const pay = monthlyPayment(100000, 0.06, 360);
    expect(monthsToPayoff(100000, 0.06, pay)).toBeCloseTo(360, 0);
  });

  it("zero-interest loan amortizes linearly", () => {
    expect(monthlyPayment(12000, 0, 12)).toBe(1000);
    expect(remainingBalance(12000, 0, 12, 6)).toBe(6000);
  });
});
