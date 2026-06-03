import { describe, it, expect } from "vitest";
import { fullRetirementAge, claimingFactor, annualBenefitAtClaim } from "../tax/socialSecurity";

describe("Social Security full retirement age", () => {
  it("1954 → 66y0m", () => {
    const fra = fullRetirementAge(1954);
    expect(fra.years).toBe(66);
    expect(fra.months).toBe(0);
  });

  it("1957 → 66y6m", () => {
    const fra = fullRetirementAge(1957);
    expect(fra.years).toBe(66);
    expect(fra.months).toBe(6);
  });

  it("1960+ → 67y0m", () => {
    expect(fullRetirementAge(1960).decimal).toBe(67);
    expect(fullRetirementAge(1985).decimal).toBe(67);
  });
});

describe("claiming adjustments (FRA 67, born 1960)", () => {
  it("claiming at 62 → ~70% of PIA", () => {
    // 36 months @ 5/9% + 24 months @ 5/12% = 20% + 10% = 30% reduction
    expect(claimingFactor(1960, 62)).toBeCloseTo(0.7, 4);
  });

  it("claiming at FRA (67) → 100%", () => {
    expect(claimingFactor(1960, 67)).toBeCloseTo(1, 6);
  });

  it("claiming at 70 → 124%", () => {
    // 8%/yr * 3 years of delayed credits
    expect(claimingFactor(1960, 70)).toBeCloseTo(1.24, 4);
  });

  it("delayed credits cap at 70", () => {
    expect(claimingFactor(1960, 72)).toBeCloseTo(claimingFactor(1960, 70), 6);
  });

  it("annual benefit scales the PIA", () => {
    expect(annualBenefitAtClaim(30000, 1960, 70)).toBeCloseTo(37200, 2);
  });
});
