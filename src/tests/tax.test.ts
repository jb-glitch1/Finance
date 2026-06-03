import { describe, it, expect } from "vitest";
import {
  computeTax,
  ordinaryTaxOn,
  capitalGainsTaxOn,
  marginalRate,
  requiredMinimumDistribution,
  taxableSocialSecurity,
} from "../tax/taxEngine";

describe("federal ordinary income tax (2025, hand-worked)", () => {
  it("single, $84,250 taxable ordinary → $13,449.00", () => {
    // 10% on 11,925 = 1,192.50
    // 12% on (48,475-11,925)=36,550 = 4,386.00
    // 22% on (84,250-48,475)=35,775 = 7,870.50
    expect(ordinaryTaxOn(84250, "single")).toBeCloseTo(13449.0, 2);
  });

  it("computeTax: single $100k wages, standard deduction → $13,449", () => {
    const r = computeTax({ filingStatus: "single", ordinaryIncome: 100000, longTermGains: 0 });
    expect(r.taxableIncome).toBe(84250);
    expect(r.ordinaryTax).toBeCloseTo(13449.0, 2);
    expect(r.marginalOrdinaryRate).toBe(0.22);
  });

  it("MFJ, $0 taxable → $0", () => {
    expect(ordinaryTaxOn(0, "mfj")).toBe(0);
  });

  it("marginal rate jumps at the 32% threshold (single)", () => {
    expect(marginalRate(197299, "single")).toBe(0.24);
    expect(marginalRate(197301, "single")).toBe(0.32);
  });
});

describe("long-term capital gains stacking (2025)", () => {
  it("single, $0 ordinary taxable + $50k gains → $247.50 (mostly 0% bracket)", () => {
    // 0% up to 48,350; remaining 1,650 at 15% = 247.50
    expect(capitalGainsTaxOn(0, 50000, "single")).toBeCloseTo(247.5, 2);
  });

  it("gains stack on top of ordinary income", () => {
    // Ordinary taxable already at 48,350 → entire 10k gain taxed at 15% = 1,500
    expect(capitalGainsTaxOn(48350, 10000, "single")).toBeCloseTo(1500, 2);
  });

  it("computeTax: gains-only return uses the 0% bracket", () => {
    const r = computeTax({ filingStatus: "single", ordinaryIncome: 15750, longTermGains: 50000 });
    expect(r.taxableIncome).toBe(50000);
    expect(r.capitalGainsTax).toBeCloseTo(247.5, 2);
    expect(r.niit).toBe(0); // AGI below $200k NIIT threshold
  });

  it("NIIT applies above the MAGI threshold", () => {
    const r = computeTax({ filingStatus: "single", ordinaryIncome: 250000, longTermGains: 50000 });
    // NIIT = 3.8% * min(gains 50k, AGI 300k - 200k) = 3.8% * 50k = 1,900
    expect(r.niit).toBeCloseTo(1900, 2);
  });
});

describe("required minimum distributions", () => {
  it("no RMD before start age", () => {
    expect(requiredMinimumDistribution(72, 1_000_000, 1955)).toBe(0); // start age 73
  });

  it("age 73 uses divisor 26.5", () => {
    expect(requiredMinimumDistribution(73, 1_000_000, 1955)).toBeCloseTo(1_000_000 / 26.5, 2);
  });

  it("born 1960+ starts at 75", () => {
    expect(requiredMinimumDistribution(73, 1_000_000, 1962)).toBe(0);
    expect(requiredMinimumDistribution(75, 1_000_000, 1962)).toBeCloseTo(1_000_000 / 24.6, 2);
  });
});

describe("Social Security taxability (IRC §86)", () => {
  it("below base amount → none taxable", () => {
    expect(taxableSocialSecurity(40000, 0, "single")).toBe(0);
  });

  it("single, $40k benefits + $40k other → $26,600 taxable", () => {
    expect(taxableSocialSecurity(40000, 40000, "single")).toBeCloseTo(26600, 2);
  });

  it("caps at 85% of benefits", () => {
    expect(taxableSocialSecurity(40000, 500000, "single")).toBeCloseTo(34000, 2);
  });
});
