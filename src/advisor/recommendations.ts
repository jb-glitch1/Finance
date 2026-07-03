// Transparent, rules-based advisory layer.
//
// Every rule here is plain arithmetic with a stated assumption — nothing is a
// black box. Output is framed as EDUCATION ("here's what the math implies under
// these assumptions"), not a directive. This is not professional financial
// advice and the app is not a fiduciary; the UI states this prominently.

import type { Scenario, Account } from "../engine/types";
import type { SimulationResult } from "../engine/types";
import { fullRetirementAge, annualBenefitAtClaim } from "../tax/socialSecurity";
import { lifeExpectancy } from "../data/mortalityTable";

export type Severity = "good" | "info" | "warn" | "critical";

export interface Recommendation {
  id: string;
  title: string;
  severity: Severity;
  message: string;
  detail?: string;
  assumptions?: string;
}

function sumExpensesAnnual(scenario: Scenario, atAge: number): number {
  return scenario.expenses
    .filter((e) => atAge >= e.startAge && atAge <= e.endAge)
    .reduce((s, e) => s + (specMeanLike(e.amount) ?? 0), 0);
}

function specMeanLike(spec: { kind: string } & Record<string, unknown>): number | undefined {
  switch (spec.kind) {
    case "fixed":
      return spec.value as number;
    case "normal":
    case "studentT":
      return spec.mean as number;
    case "lognormal":
      return Math.exp((spec.mean as number) + (spec.sd as number) ** 2 / 2);
    case "uniform":
      return ((spec.min as number) + (spec.max as number)) / 2;
    case "triangular":
    case "pert":
      return ((spec.min as number) + (spec.mode as number) + (spec.max as number)) / 3;
    default:
      return undefined;
  }
}

function cashBalance(accounts: Account[]): number {
  return accounts.filter((a) => a.type === "cash").reduce((s, a) => s + a.balance, 0);
}

/** Recommended emergency fund: 3–6 months of essential spending held in cash. */
export function emergencyFundCheck(scenario: Scenario): Recommendation {
  const annual = sumExpensesAnnual(scenario, scenario.people[0].currentAge);
  const monthly = annual / 12;
  const cash = cashBalance(scenario.accounts);
  const months = monthly > 0 ? cash / monthly : 0;
  const target = monthly * 6;
  if (months >= 6) {
    return {
      id: "emergency-fund",
      title: "Emergency fund",
      severity: "good",
      message: `You hold about ${months.toFixed(1)} months of expenses in cash — at or above the 6-month guideline.`,
      assumptions: "Guideline: 3–6 months of spending in liquid cash.",
    };
  }
  return {
    id: "emergency-fund",
    title: "Emergency fund",
    severity: months >= 3 ? "info" : "warn",
    message: `You hold about ${months.toFixed(1)} months of expenses in cash. Building toward 6 months (≈$${Math.round(target).toLocaleString()}) adds resilience to job loss or a market drop.`,
    detail: `Cash on hand: $${Math.round(cash).toLocaleString()} vs 6-month target $${Math.round(target).toLocaleString()}.`,
    assumptions: "Guideline: 3–6 months of spending in liquid cash.",
  };
}

/**
 * Age-based glide path (a common, transparent default): stock % ≈ 110 − age,
 * floored/capped to a sensible band. Returned alongside the current mix.
 */
export function suggestedAllocation(age: number): { stocks: number; bonds: number; cash: number } {
  const stocks = Math.max(0.3, Math.min(0.9, (110 - age) / 100));
  const cash = 0.05;
  const bonds = Math.max(0, 1 - stocks - cash);
  return { stocks: round2(stocks), bonds: round2(bonds), cash };
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

export function allocationCheck(scenario: Scenario): Recommendation {
  const age = scenario.people[0].currentAge;
  const target = suggestedAllocation(age);
  // Weighted current stock allocation across invested accounts.
  const invested = scenario.accounts.filter((a) => a.type !== "cash");
  const total = invested.reduce((s, a) => s + a.balance, 0) || 1;
  const currentStocks = invested.reduce((s, a) => s + a.balance * a.allocation.stocks, 0) / total;
  const diff = currentStocks - target.stocks;
  const sev: Severity = Math.abs(diff) <= 0.1 ? "good" : "info";
  return {
    id: "allocation",
    title: "Asset allocation & glide path",
    severity: sev,
    message: `A common age-based glide path suggests ~${Math.round(target.stocks * 100)}% stocks at age ${age}; you're at ~${Math.round(currentStocks * 100)}%.`,
    detail:
      Math.abs(diff) <= 0.1
        ? "Your stock weight is within 10 points of the glide-path target."
        : `Consider ${diff > 0 ? "trimming" : "adding"} stock exposure by ~${Math.round(Math.abs(diff) * 100)} points, then rebalancing annually or when any sleeve drifts >5 points.`,
    assumptions: "Glide path: stock% ≈ 110 − age, capped to 30–90%. Educational default, not personalized.",
  };
}

/**
 * Debt payoff vs invest: compare each debt's APR (a guaranteed, risk-free
 * after-tax return from paying it down) against the portfolio's expected return.
 */
export function debtPayoffVsInvest(scenario: Scenario, expectedReturn: number): Recommendation[] {
  return scenario.debts.map((d) => {
    const beatsMarket = d.annualRate > expectedReturn;
    return {
      id: `debt-${d.id}`,
      title: `Debt: ${d.name}`,
      severity: d.annualRate > 0.07 ? "warn" : "info",
      message: beatsMarket
        ? `At ${(d.annualRate * 100).toFixed(1)}% APR, paying this down is a guaranteed return above your ~${(expectedReturn * 100).toFixed(1)}% expected market return — usually the stronger move.`
        : `At ${(d.annualRate * 100).toFixed(1)}% APR, this is below your ~${(expectedReturn * 100).toFixed(1)}% expected return, so investing the difference may win on average — though debt payoff is risk-free.`,
      assumptions: "Compares the loan APR (guaranteed return from payoff) to the expected pre-tax portfolio return. Ignores tax-deductibility of some interest.",
    };
  });
}

/** Social Security claiming guidance: breakeven age between two claim ages. */
export function socialSecurityGuidance(scenario: Scenario): Recommendation[] {
  return scenario.people
    .filter((p) => p.socialSecurityPIA > 0)
    .map((p, i) => {
      const fra = fullRetirementAge(p.birthYear);
      const at62 = annualBenefitAtClaim(p.socialSecurityPIA, p.birthYear, 62);
      const at70 = annualBenefitAtClaim(p.socialSecurityPIA, p.birthYear, 70);
      // Simple nominal breakeven of claiming 70 vs 62 (ignoring COLA/discounting).
      const extraPerYear = at70 - at62;
      const foregone = at62 * 8; // 8 years of benefits given up by waiting 62→70
      const breakevenAge = 70 + foregone / extraPerYear;
      const le = lifeExpectancy(p.currentAge, p.sex) + p.currentAge;
      return {
        id: `ss-${i}`,
        title: `Social Security: ${p.name}`,
        severity: "info" as Severity,
        message: `Full retirement age is ${fra.years}y${fra.months ? ` ${fra.months}m` : ""}. Claiming at 70 vs 62 breaks even around age ${breakevenAge.toFixed(0)}; your period life expectancy is ~${le.toFixed(0)}.`,
        detail:
          le > breakevenAge
            ? "Because your life expectancy is beyond the breakeven age, delaying tends to pay off — and provides valuable longevity insurance."
            : "Your life expectancy is near or below the breakeven age, so claiming earlier may be reasonable; delaying still hedges longevity risk.",
        assumptions: "Nominal breakeven, no discounting, single life. Spousal/survivor benefits and taxes not modeled here.",
      };
    });
}

/** Rough life-insurance adequacy via income-replacement (human-capital) method. */
export function insuranceCheck(scenario: Scenario): Recommendation {
  const workingIncome = scenario.incomes
    .filter((inc) => inc.taxable && inc.variability === "fixed")
    .reduce((s, inc) => s + (specMeanLike(inc.amount) ?? 0), 0);
  const yearsToRetire = Math.max(0, scenario.retirementAge - scenario.people[0].currentAge);
  const recommendedCoverage = workingIncome * Math.min(yearsToRetire, 10);
  if (workingIncome <= 0 || yearsToRetire === 0) {
    return {
      id: "insurance",
      title: "Insurance adequacy",
      severity: "info",
      message: "With no remaining wage income modeled, term life insurance for income replacement is likely less critical; focus shifts to health and long-term-care coverage.",
      assumptions: "Income-replacement (human-capital) heuristic.",
    };
  }
  return {
    id: "insurance",
    title: "Insurance adequacy",
    severity: "info",
    message: `If others depend on your income, a common rule of thumb is roughly $${Math.round(recommendedCoverage).toLocaleString()} of term life coverage (income × years to retirement, capped at 10×).`,
    detail: "This is a starting heuristic; disability and long-term-care coverage matter too and aren't sized here.",
    assumptions: "Coverage ≈ annual wage income × min(years to retirement, 10). Excludes existing coverage, debts, and dependents' specific needs.",
  };
}

/** Plain-language interpretation of a simulation result. */
export function interpretResult(
  result: SimulationResult,
  scenario: Scenario,
  targetProbability = 0.85,
): Recommendation {
  const pct = Math.round(result.successProbability * 100);
  const horizonAge = scenario.settings.stochasticLongevity
    ? "your modeled lifespan"
    : `age ${result.startAge + scenario.settings.horizonYears}`;

  // Identify the biggest early-sequence risk by comparing the worst decile path.
  const sortedTerminal = [...result.terminalNetWorth].sort((a, b) => a - b);
  const p10 = sortedTerminal[Math.floor(sortedTerminal.length * 0.1)];
  const sequenceRisk = p10 <= 0;

  let severity: Severity = "good";
  if (result.successProbability < 0.7) severity = "critical";
  else if (result.successProbability < targetProbability) severity = "warn";
  else if (result.successProbability < 0.95) severity = "info";

  const verdict =
    result.successProbability >= targetProbability
      ? `At ${pct}%, the plan meets your ${Math.round(targetProbability * 100)}% target probability of lasting to ${horizonAge}.`
      : `At ${pct}%, the plan falls short of your ${Math.round(targetProbability * 100)}% target of lasting to ${horizonAge}.`;

  const riskLine = sequenceRisk
    ? "Your single biggest risk factor is sequence-of-returns risk: a poor run of returns in the first decade of retirement drives most failure paths."
    : "Even the lower-decile outcomes retain a positive balance, suggesting the plan is resilient to a bad return sequence.";

  // With adaptive spending, ruin probability understates the real risk: the
  // plan bends (spending cuts) instead of breaking. Say so explicitly.
  const lr = result.lifestyleRisk;
  const lifestyleLine =
    lr && lr.pAnyCut > 0.02 && scenario.withdrawal.strategy === "guardrails"
      ? ` Because spending is adaptive, the risk shows up as lifestyle cuts rather than ruin: ${Math.round(lr.pAnyCut * 100)}% of paths see at least one guardrail cut, and ${Math.round(lr.pDeepCut3yr * 100)}% endure a >20% cut for 3+ consecutive years (deepest decile of cuts ≈ ${Math.round(lr.p90MaxDepth * 100)}% below plan).`
      : "";

  return {
    id: "interpretation",
    title: "What the math implies",
    severity,
    message: `${verdict} ${riskLine}${lifestyleLine}`,
    detail: `Median ending net worth ≈ $${Math.round(sortedTerminal[Math.floor(sortedTerminal.length / 2)]).toLocaleString()}. Lower-decile (P10) ending ≈ $${Math.round(p10).toLocaleString()}.`,
    assumptions: "Educational projection under your stated assumptions. Not financial advice; not a fiduciary recommendation.",
  };
}

/** Build the full recommendation set for the current scenario + result. */
export function buildRecommendations(
  scenario: Scenario,
  result: SimulationResult | null,
  expectedReturn = 0.06,
): Recommendation[] {
  const recs: Recommendation[] = [];
  if (result) recs.push(interpretResult(result, scenario));
  recs.push(emergencyFundCheck(scenario));
  recs.push(allocationCheck(scenario));
  recs.push(...debtPayoffVsInvest(scenario, expectedReturn));
  recs.push(...socialSecurityGuidance(scenario));
  recs.push(insuranceCheck(scenario));
  return recs;
}
