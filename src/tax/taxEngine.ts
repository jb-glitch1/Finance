// Federal tax engine. Reads ALL parameters from taxData.ts (tax year 2025).
//
// Models: ordinary income tax (progressive brackets), long-term capital gains
// stacked on top of ordinary income (0/15/20%), the 3.8% NIIT, the standard
// deduction (with the age-65 addition), marginal vs effective rates, RMDs, and
// tax-efficient withdrawal sequencing across account types.

import {
  ORDINARY_BRACKETS,
  STANDARD_DEDUCTION,
  ADDITIONAL_STD_DEDUCTION_65,
  LTCG_BREAKPOINTS,
  LTCG_RATES,
  NIIT,
  UNIFORM_LIFETIME_TABLE,
  rmdStartAge,
  type FilingStatus,
} from "./taxData";

export interface TaxInput {
  filingStatus: FilingStatus;
  /** Wages, pre-tax (traditional) withdrawals, taxable interest, pensions, etc. */
  ordinaryIncome: number;
  /** Long-term capital gains + qualified dividends. */
  longTermGains: number;
  /** Portion of Social Security benefits that is taxable (0–85% computed upstream). */
  taxableSocialSecurity?: number;
  /** Number of taxpayers age 65+ (for the additional standard deduction). */
  numAge65Plus?: number;
  /** Above-the-line adjustments (e.g. deductible traditional contributions). */
  adjustments?: number;
}

export interface TaxResult {
  grossIncome: number;
  agi: number;
  standardDeduction: number;
  taxableIncome: number;
  ordinaryTax: number;
  capitalGainsTax: number;
  niit: number;
  totalTax: number;
  /** Average tax rate over gross income. */
  effectiveRate: number;
  /** Rate on the next dollar of ordinary income. */
  marginalOrdinaryRate: number;
  afterTaxIncome: number;
}

/** Progressive tax on ordinary taxable income using the bracket table. */
export function ordinaryTaxOn(taxableOrdinary: number, status: FilingStatus): number {
  if (taxableOrdinary <= 0) return 0;
  const brackets = ORDINARY_BRACKETS[status];
  let tax = 0;
  for (let i = 0; i < brackets.length; i++) {
    const lower = brackets[i].threshold;
    if (taxableOrdinary <= lower) break;
    const upper = i + 1 < brackets.length ? brackets[i + 1].threshold : Infinity;
    const amountInBracket = Math.min(taxableOrdinary, upper) - lower;
    tax += amountInBracket * brackets[i].rate;
  }
  return tax;
}

/** Marginal ordinary rate at a given taxable income. */
export function marginalRate(taxableOrdinary: number, status: FilingStatus): number {
  const brackets = ORDINARY_BRACKETS[status];
  let rate = brackets[0].rate;
  for (const b of brackets) {
    if (taxableOrdinary >= b.threshold) rate = b.rate;
    else break;
  }
  return rate;
}

/**
 * Long-term capital gains tax. LTCG stacks on top of ordinary taxable income:
 * the portion of gains falling in the 0% band is taxed at 0%, the next band at
 * 15%, the remainder at 20%. `ordinaryTaxable` is taxable income excluding the
 * gains themselves.
 */
export function capitalGainsTaxOn(
  ordinaryTaxable: number,
  gains: number,
  status: FilingStatus,
): number {
  if (gains <= 0) return 0;
  const { zeroTop, fifteenTop } = LTCG_BREAKPOINTS[status];
  const start = Math.max(ordinaryTaxable, 0);
  let remaining = gains;
  let tax = 0;

  // 0% band
  const zeroRoom = Math.max(0, zeroTop - start);
  const inZero = Math.min(remaining, zeroRoom);
  remaining -= inZero;
  tax += inZero * LTCG_RATES.zero;

  // 15% band
  const fifteenRoom = Math.max(0, fifteenTop - Math.max(start, zeroTop));
  const inFifteen = Math.min(remaining, fifteenRoom);
  remaining -= inFifteen;
  tax += inFifteen * LTCG_RATES.mid;

  // 20% band
  tax += Math.max(0, remaining) * LTCG_RATES.high;
  return tax;
}

export function computeTax(input: TaxInput): TaxResult {
  const status = input.filingStatus;
  const taxableSS = input.taxableSocialSecurity ?? 0;
  const ordinary = Math.max(0, input.ordinaryIncome) + taxableSS;
  const gains = Math.max(0, input.longTermGains);
  const grossIncome = ordinary + gains;
  const agi = Math.max(0, grossIncome - (input.adjustments ?? 0));

  let stdDed = STANDARD_DEDUCTION[status];
  const seniors = Math.min(input.numAge65Plus ?? 0, status === "mfj" ? 2 : 1);
  stdDed += seniors * ADDITIONAL_STD_DEDUCTION_65[status];

  const taxableIncome = Math.max(0, agi - stdDed);
  // Deduction reduces ordinary income first; gains sit on top.
  const taxableOrdinary = Math.max(0, taxableIncome - gains);
  const taxableGains = Math.max(0, taxableIncome - taxableOrdinary);

  const ordinaryTax = ordinaryTaxOn(taxableOrdinary, status);
  const capitalGainsTax = capitalGainsTaxOn(taxableOrdinary, taxableGains, status);

  // NIIT: 3.8% on the lesser of net investment income (here, LT gains) or the
  // excess of MAGI (≈AGI here) over the statutory threshold.
  const niitThreshold = NIIT.threshold[status];
  const niit =
    NIIT.rate * Math.max(0, Math.min(gains, agi - niitThreshold));

  const totalTax = ordinaryTax + capitalGainsTax + niit;

  return {
    grossIncome,
    agi,
    standardDeduction: stdDed,
    taxableIncome,
    ordinaryTax,
    capitalGainsTax,
    niit,
    totalTax,
    effectiveRate: grossIncome > 0 ? totalTax / grossIncome : 0,
    marginalOrdinaryRate: marginalRate(taxableOrdinary, status),
    afterTaxIncome: grossIncome - totalTax,
  };
}

/** Required minimum distribution for the year, given age and prior 12/31 balance. */
export function requiredMinimumDistribution(
  age: number,
  priorYearEndBalance: number,
  birthYear: number,
): number {
  if (age < rmdStartAge(birthYear)) return 0;
  const divisor = UNIFORM_LIFETIME_TABLE[Math.min(Math.max(age, 72), 120)];
  if (!divisor) return 0;
  return priorYearEndBalance / divisor;
}

// ---------------------------------------------------------------------------
// Taxability of Social Security benefits (IRC §86). Up to 85% taxable based on
// "combined income" = AGI (excl. SS) + nontaxable interest + 50% of benefits.
// Thresholds are NOT inflation-indexed (set in 1983/1993).
// ---------------------------------------------------------------------------
export function taxableSocialSecurity(
  benefits: number,
  otherIncome: number,
  status: FilingStatus,
): number {
  if (benefits <= 0) return 0;
  const base = status === "mfj" ? 32000 : 25000;
  const second = status === "mfj" ? 44000 : 34000;
  const combined = otherIncome + benefits * 0.5;
  if (combined <= base) return 0;
  if (combined <= second) {
    return Math.min(0.5 * (combined - base), 0.5 * benefits);
  }
  const lower = Math.min(0.5 * (second - base), 0.5 * benefits);
  return Math.min(0.85 * benefits, 0.85 * (combined - second) + lower);
}
