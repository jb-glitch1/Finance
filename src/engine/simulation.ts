// ============================================================================
// CORE MONTE CARLO ENGINE
// ============================================================================
//
// Multi-period, state-carrying simulation. The whole point is that SEQUENCE
// matters: we evolve household balances year by year, drawing a fresh market
// outcome each year and letting taxes, withdrawals, debts, Social Security, and
// (optionally) a random lifespan interact. Drawing one set of average numbers
// would hide sequence-of-returns risk — the dominant danger in early
// retirement — so we never do that.
//
// Each iteration is a full lifetime path; we aggregate thousands of paths into
// probabilities and percentile bands.

import { Rng } from "./rng";
import { sample, type DistributionSpec } from "./distributions";
import { cholesky } from "./correlation";
import { bootstrapPath, type MarketDraw } from "./bootstrap";
import { sampleHouseholdHorizon } from "./mortality";
import { computeTax, requiredMinimumDistribution, taxableSocialSecurity } from "../tax/taxEngine";
import { annualBenefitAtClaim } from "../tax/socialSecurity";
import { HISTORICAL_RETURNS } from "../data/historicalReturns";
import { percentileSorted, mean as meanOf } from "./stats";
import { vpwFactor } from "./withdrawal";
import type { Scenario, Account, Debt, PathResult, SimulationResult, YearBand, AccountType } from "./types";

interface YearMarket {
  stocks: number;
  bonds: number;
  cash: number;
  inflation: number;
}

// ---- Market path generation -------------------------------------------------

function drawMarketPath(scenario: Scenario, years: number, rng: Rng): YearMarket[] {
  const model = scenario.returnModel;
  if (model.kind === "bootstrap") {
    const path: MarketDraw[] = bootstrapPath(HISTORICAL_RETURNS, years, rng, model.mode, model.blockSize);
    return path.map((d) => ({ stocks: d.stocks, bonds: d.tbonds, cash: d.tbills, inflation: d.inflation }));
  }
  // Parametric with a stock/bond correlation imposed via a 2x2 Cholesky factor.
  const rho = Math.max(-0.99, Math.min(0.99, model.stockBondCorr));
  const L = cholesky([
    [1, rho],
    [rho, 1],
  ]);
  const sMean = specMean(model.stocks);
  const sSd = specSd(model.stocks);
  const bMean = specMean(model.bonds);
  const bSd = specSd(model.bonds);
  const out: YearMarket[] = [];
  for (let y = 0; y < years; y++) {
    const z0 = rng.normal();
    const z1 = rng.normal();
    const c0 = L[0][0] * z0;
    const c1 = L[1][0] * z0 + L[1][1] * z1;
    // Stocks/bonds carry the imposed correlation via shared normals; we add the
    // distribution's own tail/shape by sampling and matching moments.
    const stocks = model.stocks.kind === "studentT" ? sMean + sSd * rng.studentT(model.stocks.nu) : sMean + sSd * c0;
    const bonds = bMean + bSd * c1;
    out.push({
      stocks,
      bonds,
      cash: sample(model.cash, rng),
      inflation: sample(model.inflation, rng),
    });
  }
  return out;
}

function specSd(spec: DistributionSpec): number {
  switch (spec.kind) {
    case "normal":
    case "studentT":
      return spec.sd;
    case "lognormal":
      return Math.sqrt(Math.exp(spec.sd * spec.sd) - 1) * Math.exp(spec.mean + (spec.sd * spec.sd) / 2);
    case "uniform":
      return (spec.max - spec.min) / Math.sqrt(12);
    default:
      return 0;
  }
}
function specMean(spec: DistributionSpec): number {
  switch (spec.kind) {
    case "normal":
    case "studentT":
      return spec.mean;
    case "lognormal":
      return Math.exp(spec.mean + (spec.sd * spec.sd) / 2);
    case "uniform":
      return (spec.min + spec.max) / 2;
    case "fixed":
      return spec.value;
    default:
      return 0;
  }
}

// ---- Account & debt helpers -------------------------------------------------

function accountReturn(acc: Account, m: YearMarket): number {
  const a = acc.allocation;
  const total = a.stocks + a.bonds + a.cash || 1;
  return (a.stocks * m.stocks + a.bonds * m.bonds + a.cash * m.cash) / total;
}

function netWorth(accounts: Account[], debts: Debt[]): number {
  return accounts.reduce((s, a) => s + a.balance, 0) - debts.reduce((s, d) => s + d.balance, 0);
}

function totalAccounts(accounts: Account[]): number {
  return accounts.reduce((s, a) => s + a.balance, 0);
}

function amortizeYear(debt: Debt): number {
  const monthlyRate = debt.annualRate / 12;
  let paid = 0;
  const payment = debt.minPayment + (debt.extraPayment ?? 0);
  for (let mo = 0; mo < 12 && debt.balance > 0; mo++) {
    const interest = debt.balance * monthlyRate;
    let principal = payment - interest;
    if (principal <= 0) principal = 0;
    if (principal > debt.balance) principal = debt.balance;
    debt.balance -= principal;
    paid += interest + principal;
  }
  return paid;
}

interface WithdrawalOutcome {
  cashRaised: number;
  ordinaryIncome: number;
  realizedGains: number;
}

function withdrawFromAccounts(accounts: Account[], order: AccountType[], grossTarget: number): WithdrawalOutcome {
  let need = grossTarget;
  const out: WithdrawalOutcome = { cashRaised: 0, ordinaryIncome: 0, realizedGains: 0 };
  for (const type of order) {
    if (need <= 1e-9) break;
    for (const acc of accounts) {
      if (acc.type !== type || acc.balance <= 0) continue;
      if (need <= 1e-9) break;
      const take = Math.min(need, acc.balance);
      if (type === "traditional") {
        out.ordinaryIncome += take;
      } else if (type === "taxable") {
        const basis = acc.costBasis ?? acc.balance;
        const gainFrac = acc.balance > 0 ? Math.max(0, acc.balance - basis) / acc.balance : 0;
        out.realizedGains += take * gainFrac;
        if (acc.costBasis !== undefined) acc.costBasis = Math.max(0, acc.costBasis - take * (1 - gainFrac));
      }
      acc.balance -= take;
      out.cashRaised += take;
      need -= take;
    }
  }
  return out;
}

function depositSavings(accounts: Account[], weights: Record<AccountType, number>, amount: number): void {
  if (amount <= 0) return;
  const totalW = (Object.values(weights) as number[]).reduce((a, b) => a + b, 0) || 1;
  for (const type of Object.keys(weights) as AccountType[]) {
    const share = (weights[type] / totalW) * amount;
    if (share <= 0) continue;
    const acc = accounts.find((a) => a.type === type) ?? accounts[0];
    if (!acc) continue;
    acc.balance += share;
    if (acc.type === "taxable" && acc.costBasis !== undefined) acc.costBasis += share;
  }
}

// ---- Single lifetime path ---------------------------------------------------

function simulatePath(scenario: Scenario, seed: number): PathResult & { trajectory: number[] } {
  const rng = new Rng(seed);
  const startAge = scenario.people[0].currentAge;

  let years: number;
  let horizonAge: number;
  if (scenario.settings.stochasticLongevity) {
    const { lastSurvivorAge } = sampleHouseholdHorizon(
      scenario.people.map((p) => ({ age: p.currentAge, sex: p.sex })),
      rng,
    );
    horizonAge = lastSurvivorAge;
    years = lastSurvivorAge - startAge;
  } else {
    years = scenario.settings.horizonYears;
    horizonAge = startAge + years;
  }
  years = Math.max(1, Math.min(years, 120 - startAge));

  const market = drawMarketPath(scenario, years, rng);
  const accounts: Account[] = scenario.accounts.map((a) => ({ ...a, allocation: { ...a.allocation } }));
  const debts: Debt[] = scenario.debts.map((d) => ({ ...d }));

  let cumInflation = 1;
  let ranOutAge: number | null = null;
  let minNW = Infinity;
  let totalTaxes = 0;
  // Persistent guardrail spending multiplier (Guyton-Klinger flexes the plan).
  let guardrailMultiplier = 1;
  // Lifestyle-risk accumulators (spending cuts vs plan during retirement).
  let cutYears = 0;
  let maxCutDepth = 0;
  let deepStreak = 0;
  let longestDeepStreak = 0;
  const trajectory: number[] = [];
  const status = scenario.filingStatus;

  for (let y = 0; y < years; y++) {
    const age = startAge + y;
    const m = market[y];
    const retired = age >= scenario.retirementAge;
    const numAge65Plus = scenario.people.filter((p) => p.currentAge + y >= 65).length;

    // ---- Income (taxable wages, other taxable, non-taxable, Social Security) ----
    let wageIncome = 0;
    let otherTaxable = 0;
    let nonTaxable = 0;
    for (const inc of scenario.incomes) {
      if (age < inc.startAge || age > inc.endAge) continue;
      const amt = sample(inc.amount, rng) * Math.pow(1 + inc.realGrowth, y) * cumInflation;
      if (!inc.taxable) nonTaxable += amt;
      else if (inc.variability === "fixed" && !retired) wageIncome += amt;
      else otherTaxable += amt;
    }
    let ssBenefits = 0;
    for (const p of scenario.people) {
      const pAge = p.currentAge + y;
      if (pAge >= p.claimAge && p.socialSecurityPIA > 0) {
        ssBenefits += annualBenefitAtClaim(p.socialSecurityPIA, p.birthYear, p.claimAge) * cumInflation;
      }
    }

    // ---- Spending & debt service ----
    let spending = 0;
    const marketDown = m.stocks < 0;
    for (const ex of scenario.expenses) {
      if (age < ex.startAge || age > ex.endAge) continue;
      let amt = sample(ex.amount, rng);
      if (ex.inflationAdjust) amt *= cumInflation;
      if (marketDown && ex.discretionaryCutInDownturn) amt *= 1 - ex.discretionaryCutInDownturn;
      spending += amt;
    }
    let debtService = 0;
    for (const d of debts) debtService += amortizeYear(d);

    // ---- RMD floor (forced traditional distribution) ----
    let rmdRequired = 0;
    const tradBalance = accounts.filter((a) => a.type === "traditional").reduce((s, a) => s + a.balance, 0);
    for (const p of scenario.people) {
      rmdRequired += requiredMinimumDistribution(p.currentAge + y, tradBalance / scenario.people.length, p.birthYear);
    }

    // ---- Determine gross portfolio withdrawal for the year ----
    const guaranteedOrdinary = wageIncome + otherTaxable; // taxable, excl. SS & portfolio
    const guaranteedCash = wageIncome + otherTaxable + nonTaxable + ssBenefits;
    const portfolio = totalAccounts(accounts);

    // Plan spending the strategy will try to fund (guardrails flex it).
    let plannedSpend = spending;
    if (retired && scenario.withdrawal.strategy === "guardrails") {
      plannedSpend = spending * guardrailMultiplier;
    }
    // Lifestyle-risk tracking: how far below the unflexed plan are we living?
    if (retired && spending > 0) {
      const depth = 1 - plannedSpend / spending;
      if (depth > 0.005) {
        cutYears++;
        if (depth > maxCutDepth) maxCutDepth = depth;
      }
      if (depth >= 0.2) {
        deepStreak++;
        if (deepStreak > longestDeepStreak) longestDeepStreak = deepStreak;
      } else {
        deepStreak = 0;
      }
    }
    const grossNeed = plannedSpend + debtService;

    // Net dollars the portfolio must supply (after-tax) for need-based strategies.
    const netFromPortfolio = Math.max(0, grossNeed - guaranteedCash);

    let grossWithdraw: number;
    if (retired && scenario.withdrawal.strategy === "vpw") {
      grossWithdraw = portfolio * vpwFactor(scenario.withdrawal.vpwReturn ?? 0.03, Math.max(1, years - y));
    } else if (retired || netFromPortfolio > 0) {
      // Gross up for taxes with a 2-pass fixed point (taxes depend on the draw).
      grossWithdraw = netFromPortfolio;
      for (let pass = 0; pass < 2; pass++) {
        const dry = withdrawFromAccounts(accounts.map((a) => ({ ...a })), scenario.withdrawalOrder, Math.max(grossWithdraw, rmdRequired));
        const tSS = taxableSocialSecurity(ssBenefits, guaranteedOrdinary + dry.ordinaryIncome, status);
        const t = computeTax({
          filingStatus: status,
          ordinaryIncome: guaranteedOrdinary + dry.ordinaryIncome,
          longTermGains: dry.realizedGains,
          taxableSocialSecurity: tSS,
          numAge65Plus,
        });
        grossWithdraw = netFromPortfolio + t.totalTax;
      }
    } else {
      grossWithdraw = 0;
    }
    grossWithdraw = Math.max(grossWithdraw, rmdRequired);

    // ---- Guardrail adjustment for NEXT year, based on this year's rate ----
    if (retired && scenario.withdrawal.strategy === "guardrails" && portfolio > 0) {
      const rate = grossWithdraw / portfolio;
      const band = scenario.withdrawal.guardrailBand ?? 0.2;
      const adjust = scenario.withdrawal.guardrailAdjust ?? 0.1;
      const initial = scenario.withdrawal.initialRate;
      if (rate > initial * (1 + band)) guardrailMultiplier *= 1 - adjust;
      else if (rate < initial * (1 - band)) guardrailMultiplier *= 1 + adjust;
      guardrailMultiplier = Math.max(0.4, Math.min(1.5, guardrailMultiplier));
    }

    // ---- Execute the withdrawal ----
    const pulled = withdrawFromAccounts(accounts, scenario.withdrawalOrder, grossWithdraw);
    if (pulled.cashRaised < grossWithdraw - 1 && grossNeed > guaranteedCash && ranOutAge === null) {
      ranOutAge = age; // portfolio couldn't fund the spending plan
    }

    // ---- Taxes for the year ----
    const taxableSS = taxableSocialSecurity(ssBenefits, guaranteedOrdinary + pulled.ordinaryIncome, status);
    const tax = computeTax({
      filingStatus: status,
      ordinaryIncome: guaranteedOrdinary + pulled.ordinaryIncome,
      longTermGains: pulled.realizedGains,
      taxableSocialSecurity: taxableSS,
      numAge65Plus,
    });
    totalTaxes += tax.totalTax;

    // ---- Settle cash flow ----
    // The household consumes plannedSpend (NOT raw spending): under guardrails
    // the multiplier genuinely cuts or raises lifestyle, which is the whole
    // point of the strategy.
    let cashIn = guaranteedCash + pulled.cashRaised;
    let cashOut = plannedSpend + debtService + tax.totalTax;
    let surplus = cashIn - cashOut;
    if (surplus < 0) {
      // Residual need (a VPW draw below expenses, or gross-up remainder) must
      // be funded by further TAXED pulls — never a tax-free side channel.
      // Each pull raises the tax bill, which raises the deficit, so iterate:
      // the deficit shrinks geometrically (by ~the marginal rate) per pass.
      // "Ran out" is flagged ONLY when accounts can't supply the cash asked —
      // never on a small tax-convergence residual.
      const baseOrdinary = guaranteedOrdinary + pulled.ordinaryIncome;
      const baseGains = pulled.realizedGains;
      let extraOrdinary = 0;
      let extraGains = 0;
      let extraTax = 0;
      for (let iter = 0; iter < 8 && surplus < -1; iter++) {
        const pull = withdrawFromAccounts(accounts, scenario.withdrawalOrder, -surplus);
        cashIn += pull.cashRaised;
        if (pull.cashRaised < -surplus - 1) {
          // Accounts genuinely dry: insolvent this year.
          if (ranOutAge === null) ranOutAge = age;
          surplus = cashIn - cashOut;
          break;
        }
        extraOrdinary += pull.ordinaryIncome;
        extraGains += pull.realizedGains;
        const tSS = taxableSocialSecurity(ssBenefits, baseOrdinary + extraOrdinary, status);
        const t = computeTax({
          filingStatus: status,
          ordinaryIncome: baseOrdinary + extraOrdinary,
          longTermGains: baseGains + extraGains,
          taxableSocialSecurity: tSS,
          numAge65Plus,
        });
        const newExtraTax = Math.max(0, t.totalTax - tax.totalTax);
        cashOut += newExtraTax - extraTax;
        extraTax = newExtraTax;
        surplus = cashIn - cashOut;
      }
      totalTaxes += extraTax;
    }
    if (surplus > 0) {
      if (!retired) depositSavings(accounts, scenario.savingsAllocation, surplus);
      else depositSavings(accounts, { taxable: 1, traditional: 0, roth: 0, cash: 0 }, surplus);
    }

    // ---- Apply market growth (end-of-year convention: withdrawals don't grow) ----
    for (const acc of accounts) {
      acc.balance *= 1 + accountReturn(acc, m);
      if (acc.balance < 0) acc.balance = 0;
    }
    cumInflation *= 1 + m.inflation;

    const nw = netWorth(accounts, debts);
    trajectory.push(nw);
    if (nw < minNW) minNW = nw;
    if (retired && totalAccounts(accounts) <= 0 && ranOutAge === null) ranOutAge = age;
  }

  const terminalNetWorth = trajectory[trajectory.length - 1] ?? netWorth(accounts, debts);
  return {
    terminalNetWorth,
    success: ranOutAge === null,
    ranOutAge,
    horizonAge,
    minNetWorth: minNW === Infinity ? terminalNetWorth : minNW,
    totalTaxesPaid: totalTaxes,
    spendingCutYears: cutYears,
    maxSpendingCutDepth: maxCutDepth,
    longestDeepCutYears: longestDeepStreak,
    trajectory,
  };
}

// ---- Aggregation ------------------------------------------------------------

export interface ProgressFn {
  (completed: number, total: number): void;
}

export function runSimulation(scenario: Scenario, onProgress?: ProgressFn): SimulationResult {
  const { iterations, seed } = scenario.settings;
  const startAge = scenario.people[0].currentAge;
  const maxYears = scenario.settings.stochasticLongevity ? 120 - startAge : scenario.settings.horizonYears;

  const paths: PathResult[] = [];
  const terminal: number[] = [];
  const yearColumns: number[][] = Array.from({ length: maxYears }, () => []);
  const depletionCounts = new Array(maxYears).fill(0);

  for (let i = 0; i < iterations; i++) {
    const path = simulatePath(scenario, seed + i * 2654435761);
    const { trajectory, ...result } = path;
    paths.push(result);
    terminal.push(result.terminalNetWorth);
    for (let y = 0; y < trajectory.length && y < maxYears; y++) yearColumns[y].push(trajectory[y]);
    if (result.ranOutAge !== null) {
      const idx = Math.max(0, result.ranOutAge - startAge);
      for (let y = idx; y < maxYears; y++) depletionCounts[y]++;
    }
    if (onProgress && (i % 250 === 0 || i === iterations - 1)) onProgress(i + 1, iterations);
  }

  const bands: YearBand[] = yearColumns
    .map((col, y) => {
      if (col.length === 0) return null;
      const sorted = [...col].sort((a, b) => a - b);
      return {
        age: startAge + y + 1,
        p10: percentileSorted(sorted, 10),
        p25: percentileSorted(sorted, 25),
        p50: percentileSorted(sorted, 50),
        p75: percentileSorted(sorted, 75),
        p90: percentileSorted(sorted, 90),
        mean: meanOf(col),
      };
    })
    .filter((b): b is YearBand => b !== null);

  let goalProbability: number | undefined;
  if (scenario.goal) {
    const yIdx = scenario.goal.targetAge - startAge - 1;
    const col = yearColumns[yIdx];
    if (col && col.length > 0) {
      goalProbability = col.filter((v) => v >= scenario.goal!.targetAmount).length / col.length;
    }
  }

  const cutYearsSorted = paths.map((p) => p.spendingCutYears).sort((a, b) => a - b);
  const maxDepthSorted = paths.map((p) => p.maxSpendingCutDepth).sort((a, b) => a - b);
  const lifestyleRisk = {
    pAnyCut: paths.filter((p) => p.spendingCutYears > 0).length / iterations,
    pDeepCut3yr: paths.filter((p) => p.longestDeepCutYears >= 3).length / iterations,
    medianYearsBelow: percentileSorted(cutYearsSorted, 50),
    p90MaxDepth: percentileSorted(maxDepthSorted, 90),
  };

  return {
    iterations,
    seed,
    terminalNetWorth: terminal,
    successProbability: paths.filter((p) => p.success).length / iterations,
    paths,
    bands,
    depletionByAge: depletionCounts.map((c, y) => ({ age: startAge + y + 1, probability: c / iterations })),
    startAge,
    goalProbability,
    lifestyleRisk,
  };
}
