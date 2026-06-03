// Social Security claiming rules.
//
// SOURCES: SSA "Retirement Age and Benefit Reduction" and "Delayed Retirement
// Credits" (ssa.gov/benefits/retirement/planner). Full retirement age (FRA) is
// 66 for birth years 1943–1954, rising two months per year to 67 for 1960+.
// Early claiming reduces the benefit (5/9% per month for the first 36 months,
// 5/12% per month beyond that). Delaying past FRA adds 8%/year (2/3% per month)
// of delayed retirement credits up to age 70.

export interface FraResult {
  years: number;
  months: number;
  /** FRA expressed as a decimal age, e.g. 66.5. */
  decimal: number;
}

/** Full retirement age by birth year (SSA schedule). */
export function fullRetirementAge(birthYear: number): FraResult {
  let years = 67;
  let months = 0;
  if (birthYear <= 1937) {
    years = 65;
    months = 0;
  } else if (birthYear <= 1942) {
    // 1938–1942: 65 + 2 months per year after 1937
    years = 65;
    months = (birthYear - 1937) * 2;
  } else if (birthYear <= 1954) {
    years = 66;
    months = 0;
  } else if (birthYear <= 1959) {
    // 1955–1959: 66 + 2 months per year after 1954
    years = 66;
    months = (birthYear - 1954) * 2;
  } else {
    years = 67;
    months = 0;
  }
  years += Math.floor(months / 12);
  months = months % 12;
  return { years, months, decimal: years + months / 12 };
}

/**
 * Benefit multiplier vs the Primary Insurance Amount (PIA, the FRA benefit) for
 * claiming at `claimAge`. Returns e.g. 0.70 (claim at 62 with FRA 67) up to
 * 1.24 (claim at 70 with FRA 67).
 */
export function claimingFactor(birthYear: number, claimAge: number): number {
  const fra = fullRetirementAge(birthYear).decimal;
  const monthsDiff = Math.round((claimAge - fra) * 12);

  if (monthsDiff === 0) return 1;

  if (monthsDiff < 0) {
    // Early: reduction. First 36 months at 5/9 of 1%, beyond at 5/12 of 1%.
    const early = -monthsDiff;
    const first = Math.min(early, 36);
    const beyond = Math.max(0, early - 36);
    const reduction = first * (5 / 9 / 100) + beyond * (5 / 12 / 100);
    return Math.max(0, 1 - reduction);
  }

  // Delayed retirement credits: 8%/year = 2/3% per month, capped at age 70.
  const cappedMonths = Math.min(monthsDiff, Math.round((70 - fra) * 12));
  return 1 + cappedMonths * (2 / 3 / 100);
}

export const EARLIEST_CLAIM_AGE = 62;
export const LATEST_CREDIT_AGE = 70;

/** Annual benefit at a chosen claim age, given the FRA (PIA) annual benefit. */
export function annualBenefitAtClaim(
  piaAnnual: number,
  birthYear: number,
  claimAge: number,
): number {
  const age = Math.max(EARLIEST_CLAIM_AGE, Math.min(LATEST_CREDIT_AGE, claimAge));
  return piaAnnual * claimingFactor(birthYear, age);
}
