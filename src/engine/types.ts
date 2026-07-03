// Scenario model — the complete, serializable description of a financial plan.
// Everything here can be saved/loaded as JSON and shipped to the Web Worker.

import type { DistributionSpec } from "./distributions";
import type { BootstrapMode } from "./bootstrap";
import type { WithdrawalParams } from "./withdrawal";
import type { FilingStatus } from "../tax/taxData";
import type { Sex } from "../data/mortalityTable";

export type AccountType = "taxable" | "traditional" | "roth" | "cash";

export interface Allocation {
  stocks: number;
  bonds: number;
  cash: number;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  /** Cost basis for taxable accounts (used to compute realized gains on sale). */
  costBasis?: number;
  allocation: Allocation;
}

export interface Debt {
  id: string;
  name: string;
  kind: "mortgage" | "student" | "auto" | "credit" | "other";
  balance: number;
  annualRate: number; // APR as decimal
  minPayment: number; // monthly minimum payment
  extraPayment?: number; // optional extra monthly principal
}

export interface IncomeStream {
  id: string;
  name: string;
  /** Annual gross amount (stochastic or fixed). */
  amount: DistributionSpec;
  startAge: number;
  endAge: number;
  /** Real annual growth above inflation (e.g. raises). */
  realGrowth: number;
  taxable: boolean;
  /** "fixed" line items (a salary) vs "variable" (freelance) — UI hint. */
  variability: "fixed" | "variable";
}

export interface ExpenseItem {
  id: string;
  name: string;
  /** Annual amount (stochastic for variable categories, fixed for rent). */
  amount: DistributionSpec;
  startAge: number;
  endAge: number;
  /** If true, grows with inflation; if false, held in nominal terms. */
  inflationAdjust: boolean;
  category: string;
  variability: "fixed" | "variable";
  /** Discretionary expenses can be cut in down markets (0 = none, 1 = fully). */
  discretionaryCutInDownturn?: number;
}

export interface Person {
  name: string;
  currentAge: number;
  birthYear: number;
  sex: Sex;
  /** Annual Social Security benefit at full retirement age (PIA), in today's $. */
  socialSecurityPIA: number;
  claimAge: number;
}

export type ReturnModel =
  | { kind: "parametric"; stocks: DistributionSpec; bonds: DistributionSpec; cash: DistributionSpec; stockBondCorr: number; inflation: DistributionSpec }
  | { kind: "bootstrap"; mode: BootstrapMode; blockSize: number };

export interface SimulationSettings {
  iterations: number;
  seed: number;
  /** If true, horizon is the stochastic last-survivor lifespan; else fixed. */
  stochasticLongevity: boolean;
  /** Fixed planning horizon in years (used when longevity is off, or as a cap). */
  horizonYears: number;
}

export interface Scenario {
  name: string;
  filingStatus: FilingStatus;
  people: Person[];
  accounts: Account[];
  debts: Debt[];
  incomes: IncomeStream[];
  expenses: ExpenseItem[];
  /** Annual savings target while still working, split across accounts by these weights. */
  savingsAllocation: Record<AccountType, number>;
  returnModel: ReturnModel;
  withdrawal: WithdrawalParams;
  /** Age at which the primary person retires (income from work stops). */
  retirementAge: number;
  /** Order to draw down accounts in retirement (tax-efficient default). */
  withdrawalOrder: AccountType[];
  settings: SimulationSettings;
  /** Optional explicit savings goal for the savings-goal question. */
  goal?: { targetAmount: number; targetAge: number };
}

/** Per-iteration outcome retained for aggregation. */
export interface PathResult {
  terminalNetWorth: number;
  success: boolean; // never ran out of money before horizon
  ranOutAge: number | null;
  horizonAge: number;
  minNetWorth: number;
  totalTaxesPaid: number;
  /** Retirement years spent below planned spending (adaptive strategies). */
  spendingCutYears: number;
  /** Deepest spending cut as a fraction of plan (0.35 = 35% below plan). */
  maxSpendingCutDepth: number;
  /** Longest consecutive run of years with a >20% spending cut. */
  longestDeepCutYears: number;
}

/**
 * Lifestyle risk: once spending is adaptive (guardrails), "ran out of money"
 * mostly stops happening — the plan bends instead of breaking. The honest
 * successor metric is how often, how deep, and how long spending gets cut.
 */
export interface LifestyleRisk {
  /** P(at least one below-plan year in retirement). */
  pAnyCut: number;
  /** P(a >20% cut sustained for 3+ consecutive years). */
  pDeepCut3yr: number;
  /** Median number of retirement years spent below plan. */
  medianYearsBelow: number;
  /** 90th percentile of the deepest cut experienced (fraction of plan). */
  p90MaxDepth: number;
}

export interface YearBand {
  age: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  mean: number;
}

export interface SimulationResult {
  iterations: number;
  seed: number;
  terminalNetWorth: number[];
  successProbability: number;
  paths: PathResult[];
  bands: YearBand[];
  /** Probability the portfolio is depleted at each age (for trigger analysis). */
  depletionByAge: { age: number; probability: number }[];
  startAge: number;
  /** P(net worth ≥ goal.targetAmount at goal.targetAge), if a goal is set. */
  goalProbability?: number;
  /** Spending-cut risk for adaptive withdrawal strategies (guardrails). */
  lifestyleRisk: LifestyleRisk;
}
