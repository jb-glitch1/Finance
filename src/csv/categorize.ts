// Turn raw transactions into a pre-filled model: aggregate to monthly totals by
// category, split recurring/fixed (rent, subscriptions, paychecks) from variable
// (dining, travel), and FIT a distribution to each variable category from its
// own monthly history. Every fit is shown to the user and fully overridable.

import type { Transaction } from "./parseSimplifi";
import type { DistributionSpec } from "../engine/distributions";

export interface CategorySummary {
  category: string;
  type: "income" | "expense";
  /** Mean monthly magnitude (always positive). */
  monthlyMean: number;
  monthlyStd: number;
  /** Coefficient of variation — low = stable/recurring, high = variable. */
  cov: number;
  /** Fraction of months in the window in which this category appears. */
  frequency: number;
  monthsPresent: number;
  totalMonths: number;
  recurring: boolean;
  variability: "fixed" | "variable";
  /** Annualized suggested distribution (the model works in annual dollars). */
  suggested: DistributionSpec;
  monthlySeries: { month: string; amount: number }[];
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function std(xs: number[], m = mean(xs)): number {
  if (xs.length < 2) return 0;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

/**
 * Fit an annualized distribution to a monthly magnitude series.
 *  • Recurring/low-variation → fixed at the annual mean.
 *  • Positive, right-skewed → lognormal (spending rarely goes negative).
 *  • Otherwise → normal.
 * Annualization: mean × 12; sd scales by √12 (assuming weak month-to-month
 * correlation), which keeps the annual variance consistent with monthly data.
 */
export function fitDistribution(
  monthlyMagnitudes: number[],
  recurring: boolean,
): DistributionSpec {
  const m = mean(monthlyMagnitudes);
  const s = std(monthlyMagnitudes, m);
  const annualMean = m * 12;
  const annualSd = s * Math.sqrt(12);

  if (recurring || m === 0 || s / (m || 1) < 0.1) {
    return { kind: "fixed", value: round(annualMean) };
  }

  const cov = s / m;
  if (cov > 0.35 && monthlyMagnitudes.every((x) => x >= 0)) {
    // Lognormal params from method-of-moments on the ANNUAL figures.
    const variance = annualSd * annualSd;
    const phi = Math.sqrt(variance + annualMean * annualMean);
    const mu = Math.log((annualMean * annualMean) / phi);
    const sigma = Math.sqrt(Math.log((phi * phi) / (annualMean * annualMean)));
    return { kind: "lognormal", mean: round(mu, 4), sd: round(sigma, 4) };
  }

  return { kind: "normal", mean: round(annualMean), sd: round(annualSd) };
}

function round(x: number, dp = 0): number {
  const f = Math.pow(10, dp);
  return Math.round(x * f) / f;
}

export function summarizeTransactions(transactions: Transaction[]): CategorySummary[] {
  if (transactions.length === 0) return [];
  const months = new Set<string>();
  for (const t of transactions) months.add(monthKey(t.date));
  const totalMonths = months.size;
  const allMonths = [...months].sort();

  // category -> month -> summed amount
  const byCat = new Map<string, Map<string, number>>();
  for (const t of transactions) {
    const cat = t.category || "Uncategorized";
    if (!byCat.has(cat)) byCat.set(cat, new Map());
    const mk = monthKey(t.date);
    const map = byCat.get(cat)!;
    map.set(mk, (map.get(mk) ?? 0) + t.amount);
  }

  const summaries: CategorySummary[] = [];
  for (const [category, monthMap] of byCat) {
    const signedTotals = allMonths.map((mk) => monthMap.get(mk) ?? 0);
    const overall = signedTotals.reduce((a, b) => a + b, 0);
    const type: "income" | "expense" = overall >= 0 ? "income" : "expense";

    // Work in magnitudes (positive) for stats & fitting.
    const presentMonths = allMonths.filter((mk) => monthMap.has(mk));
    const magnitudes = presentMonths.map((mk) => Math.abs(monthMap.get(mk) ?? 0));
    const m = mean(magnitudes);
    const s = std(magnitudes, m);
    const cov = m > 0 ? s / m : 0;
    const frequency = presentMonths.length / totalMonths;

    // Recurring: appears most months AND is stable month-to-month.
    const recurring = frequency >= 0.66 && cov < 0.2;
    const variability: "fixed" | "variable" = recurring ? "fixed" : "variable";

    summaries.push({
      category,
      type,
      monthlyMean: round(m, 2),
      monthlyStd: round(s, 2),
      cov: round(cov, 3),
      frequency: round(frequency, 2),
      monthsPresent: presentMonths.length,
      totalMonths,
      recurring,
      variability,
      suggested: fitDistribution(magnitudes, recurring),
      monthlySeries: allMonths.map((mk) => ({ month: mk, amount: round(Math.abs(monthMap.get(mk) ?? 0), 2) })),
    });
  }

  // Largest first, income then expenses.
  return summaries.sort((a, b) => {
    if (a.type !== b.type) return a.type === "income" ? -1 : 1;
    return b.monthlyMean - a.monthlyMean;
  });
}
