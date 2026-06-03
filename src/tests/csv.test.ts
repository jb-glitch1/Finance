import { describe, it, expect } from "vitest";
import { parseSimplifiCsv, parseAmount } from "../csv/parseSimplifi";
import { summarizeTransactions, fitDistribution } from "../csv/categorize";
import { SAMPLE_SIMPLIFI_CSV } from "../data/sampleSimplifi";

describe("amount parsing robustness", () => {
  it("handles currency symbols, commas, signs, and parentheses", () => {
    expect(parseAmount("$1,234.56")).toBeCloseTo(1234.56, 2);
    expect(parseAmount("-$45.00")).toBeCloseTo(-45, 2);
    expect(parseAmount("(1,234.56)")).toBeCloseTo(-1234.56, 2);
    expect(parseAmount("2500")).toBe(2500);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("n/a")).toBeNull();
  });
});

describe("Simplifi CSV parsing", () => {
  it("auto-detects columns and handles quoted fields with commas", () => {
    const csv = [
      "Date,Payee,Category,Amount,Account",
      '2024-01-15,"Employer, Inc","Paycheck",3200.00,"Checking"',
      '2024-01-03,"Sunset Apartments","Rent",-2150.00,"Checking"',
      '2024-01-08,"Trader Joe\'s","Groceries",-84.20,"Credit Card"',
    ].join("\n");
    const r = parseSimplifiCsv(csv);
    expect(r.rowCount).toBe(3);
    expect(r.columnMap.amount).toBe("Amount");
    expect(r.transactions[0].payee).toBe("Employer, Inc");
    expect(r.transactions[1].amount).toBeCloseTo(-2150, 2);
  });

  it("parses the bundled sample dataset end to end", () => {
    const r = parseSimplifiCsv(SAMPLE_SIMPLIFI_CSV);
    expect(r.rowCount).toBeGreaterThan(100);
    expect(r.warnings.length).toBe(0);
  });
});

describe("categorization and distribution fitting", () => {
  it("detects recurring rent as fixed and dining as variable income/expense split", () => {
    const r = parseSimplifiCsv(SAMPLE_SIMPLIFI_CSV);
    const summaries = summarizeTransactions(r.transactions);
    const rent = summaries.find((s) => s.category === "Rent");
    const dining = summaries.find((s) => s.category === "Dining");
    const paycheck = summaries.find((s) => s.category === "Paycheck");
    expect(rent?.recurring).toBe(true);
    expect(rent?.suggested.kind).toBe("fixed");
    expect(dining?.variability).toBe("variable");
    expect(paycheck?.type).toBe("income");
  });

  it("fits a fixed distribution to a stable series and lognormal to a volatile one", () => {
    const stable = [1000, 1000, 1000, 1010, 990, 1000, 1000];
    expect(fitDistribution(stable, false).kind).toBe("fixed");
    const volatile = [200, 1500, 50, 900, 2000, 100, 1200, 700];
    const fit = fitDistribution(volatile, false);
    expect(["lognormal", "normal"]).toContain(fit.kind);
  });
});
