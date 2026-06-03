// ============================================================================
// FEDERAL TAX DATA — TAX YEAR 2025  (returns filed in early 2026)
// ============================================================================
//
// This is the SINGLE, ISOLATED source of truth for federal tax parameters.
// Nothing here is a magic number scattered through the codebase — to roll the
// app to a new tax year, copy this file, update the figures from the IRS
// revenue procedure, and bump TAX_YEAR. The engine reads only from here.
//
// SOURCES (all 2025 figures):
//   • Ordinary brackets, standard deduction: IRS Rev. Proc. 2024-40, as amended
//     by the One Big Beautiful Bill Act (OBBBA, signed 2025-07-04), which raised
//     the 2025 standard deduction. Tax Foundation 2025 summary; IRS newsroom.
//   • Long-term capital gains thresholds: IRS Rev. Proc. 2024-40.
//   • Contribution limits: IRS Notice 2024-80 (2025 COLA limits).
//   • RMDs: SECURE 2.0 Act (start age 73 for 1951–1959, 75 for 1960+);
//     IRS Uniform Lifetime Table, Pub. 590-B Appendix B Table III.
//   • NIIT: IRC §1411 (3.8%, fixed statutory MAGI thresholds, not indexed).
//
// SCOPE: Federal only. State and local income taxes are intentionally OUT OF
// SCOPE (the app states this in-app). AMT, QBI, phase-outs of itemized
// deductions, and the OBBBA temporary senior bonus deduction are not modeled;
// the standard deduction (incl. the age-65 addition) is.
// ============================================================================

export const TAX_YEAR = 2025;

export type FilingStatus = "single" | "mfj" | "hoh";

export interface TaxBracket {
  /** Lower bound of taxable income for this marginal rate. */
  threshold: number;
  rate: number;
}

/** Ordinary income brackets (taxable income after deductions). */
export const ORDINARY_BRACKETS: Record<FilingStatus, TaxBracket[]> = {
  single: [
    { threshold: 0, rate: 0.1 },
    { threshold: 11925, rate: 0.12 },
    { threshold: 48475, rate: 0.22 },
    { threshold: 103350, rate: 0.24 },
    { threshold: 197300, rate: 0.32 },
    { threshold: 250525, rate: 0.35 },
    { threshold: 626350, rate: 0.37 },
  ],
  mfj: [
    { threshold: 0, rate: 0.1 },
    { threshold: 23850, rate: 0.12 },
    { threshold: 96950, rate: 0.22 },
    { threshold: 206700, rate: 0.24 },
    { threshold: 394600, rate: 0.32 },
    { threshold: 501050, rate: 0.35 },
    { threshold: 751600, rate: 0.37 },
  ],
  hoh: [
    { threshold: 0, rate: 0.1 },
    { threshold: 17000, rate: 0.12 },
    { threshold: 64850, rate: 0.22 },
    { threshold: 103350, rate: 0.24 },
    { threshold: 197300, rate: 0.32 },
    { threshold: 250500, rate: 0.35 },
    { threshold: 626350, rate: 0.37 },
  ],
};

/** 2025 standard deduction (post-OBBBA). */
export const STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: 15750,
  mfj: 31500,
  hoh: 23625,
};

/** Additional standard deduction for taxpayers age 65+ (2025). Per person. */
export const ADDITIONAL_STD_DEDUCTION_65: Record<FilingStatus, number> = {
  single: 2000,
  hoh: 2000,
  mfj: 1600, // per qualifying spouse
};

/**
 * Long-term capital gains / qualified dividends breakpoints (2025).
 * LTCG stack ON TOP of ordinary taxable income. Rate is 0% up to `zeroTop`,
 * 15% up to `fifteenTop`, and 20% above (measured on total taxable income).
 */
export const LTCG_BREAKPOINTS: Record<FilingStatus, { zeroTop: number; fifteenTop: number }> = {
  single: { zeroTop: 48350, fifteenTop: 533400 },
  mfj: { zeroTop: 96700, fifteenTop: 600050 },
  hoh: { zeroTop: 64750, fifteenTop: 566700 },
};

export const LTCG_RATES = { zero: 0, mid: 0.15, high: 0.2 } as const;

/** Net Investment Income Tax — 3.8% on investment income above MAGI threshold. */
export const NIIT = {
  rate: 0.038,
  threshold: { single: 200000, mfj: 250000, hoh: 200000 } as Record<FilingStatus, number>,
};

/** 2025 retirement contribution limits (IRS Notice 2024-80). */
export const CONTRIBUTION_LIMITS = {
  elective401k: 23500, // employee elective deferral
  catchUp401k_50: 7500, // age 50+
  catchUp401k_60to63: 11250, // SECURE 2.0 enhanced catch-up, ages 60–63
  total401k_415c: 70000, // employee + employer (under age 50)
  ira: 7000,
  iraCatchUp_50: 1000,
  // Roth IRA MAGI phase-out ranges (contribution eligibility).
  rothMagiPhaseOut: {
    single: { start: 150000, end: 165000 },
    mfj: { start: 236000, end: 246000 },
    hoh: { start: 150000, end: 165000 },
  } as Record<FilingStatus, { start: number; end: number }>,
} as const;

/** RMD start age depends on birth year (SECURE 2.0). */
export function rmdStartAge(birthYear: number): number {
  if (birthYear <= 1950) return 72; // historical; pre-2023 rule
  if (birthYear <= 1959) return 73;
  return 75;
}

/** IRS Uniform Lifetime Table (effective 2022+). Distribution period by age. */
export const UNIFORM_LIFETIME_TABLE: Record<number, number> = {
  72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0,
  79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0,
  86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8,
  93: 10.1, 94: 9.5, 95: 8.9, 96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8,
  100: 6.4, 101: 6.0, 102: 5.6, 103: 5.2, 104: 4.9, 105: 4.6, 106: 4.3,
  107: 4.1, 108: 3.9, 109: 3.7, 110: 3.5, 111: 3.4, 112: 3.3, 113: 3.1,
  114: 3.0, 115: 2.9, 116: 2.8, 117: 2.7, 118: 2.5, 119: 2.3, 120: 2.0,
};

export const FILING_STATUS_LABELS: Record<FilingStatus, string> = {
  single: "Single",
  mfj: "Married filing jointly",
  hoh: "Head of household",
};
