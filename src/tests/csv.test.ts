import { describe, it, expect } from "vitest";
import { parseSimplifiCsv, parseAmount } from "../csv/parseSimplifi";
import { summarizeTransactions, fitDistribution } from "../csv/categorize";
import { theoreticalMean } from "../engine/distributions";
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

  it("respects the Exclusion column and detects account-to-account transfers", () => {
    const csv = [
      "Date,Account,Payee,Category,Exclusion,Recurring,Amount",
      '"Jan 1, 2025",Checking,Employer,"Personal Income:Paycheck",no,yes,5000.00',
      '"Jan 3, 2025",Checking,Landlord,"Home:Rent",no,yes,-2000.00',
      '"Jan 4, 2025",Checking,Self,"Transfer",no,no,-500.00',
      '"Jan 6, 2025",Brokerage,Buy,"Investment Income",no,no,200.00',
      '"Jan 7, 2025",Checking,Self,"Brokerage",no,no,-300.00',
      '"Jan 5, 2025",Checking,Bank,"Interest",yes,no,3.00',
    ].join("\n");
    const r = parseSimplifiCsv(csv);
    expect(r.excludedCount).toBe(1); // the Exclusion=yes row is dropped
    expect(r.columnMap.exclusion).toBe("Exclusion");
    const summaries = summarizeTransactions(r.transactions);
    const keywordTransfer = summaries.find((s) => s.category === "Transfer");
    const accountNameTransfer = summaries.find((s) => s.category === "Brokerage");
    const rent = summaries.find((s) => s.category === "Home:Rent");
    expect(keywordTransfer?.isTransfer).toBe(true); // matched by keyword
    expect(accountNameTransfer?.isTransfer).toBe(true); // category == an account name
    expect(rent?.isTransfer).toBe(false);
    // Simplifi's Recurring=yes flag marks rent/paycheck as recurring even over 1 month.
    expect(rent?.recurring).toBe(true);
  });

  it("annualizes sporadic categories by true yearly total, not per-active-month", () => {
    // $600 of travel twice in a 12-month window must fit to ~$1,200/yr —
    // not $7,200/yr (12 × the $600 average of active months only).
    const rows = ["Date,Payee,Category,Amount,Account"];
    for (let m = 1; m <= 12; m++) {
      rows.push(`2025-${String(m).padStart(2, "0")}-05,Store,"Groceries",-100.00,Checking`);
    }
    rows.push('2025-03-10,Delta,"Travel",-600.00,Checking');
    rows.push('2025-09-15,United,"Travel",-600.00,Checking');
    const r = parseSimplifiCsv(rows.join("\n"));
    const travel = summarizeTransactions(r.transactions).find((s) => s.category === "Travel")!;
    const annualMean = theoreticalMean(travel.suggested)!;
    expect(annualMean).toBeGreaterThan(700);
    expect(annualMean).toBeLessThan(1800);
    // Monthly mean shown in the UI is the true calendar-month average.
    expect(travel.monthlyMean).toBeCloseTo(100, 0);
  });

  it("fits a fixed distribution to a stable series and lognormal to a volatile one", () => {
    const stable = [1000, 1000, 1000, 1010, 990, 1000, 1000];
    expect(fitDistribution(stable, false).kind).toBe("fixed");
    const volatile = [200, 1500, 50, 900, 2000, 100, 1200, 700];
    const fit = fitDistribution(volatile, false);
    expect(["lognormal", "normal"]).toContain(fit.kind);
  });
});
