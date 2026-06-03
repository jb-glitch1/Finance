// Synthetic sample data shaped exactly like a Quicken Simplifi transaction
// export (Date, Payee, Category, Amount, Account; expenses negative). Generated
// deterministically so the demo is reproducible. This lets a new user run the
// whole pipeline — parse → categorize → fit → simulate — before uploading their
// real file. It is fictional and contains no real financial data.

import { Rng } from "../engine/rng";

interface Recurring {
  payee: string;
  category: string;
  account: string;
  amount: number; // signed
  day: number;
}

interface Variable {
  payee: string[];
  category: string;
  account: string;
  perMonth: [number, number]; // min/max count
  amount: [number, number]; // min/max magnitude
}

const RECURRING: Recurring[] = [
  { payee: "Employer Payroll", category: "Paycheck", account: "Checking", amount: 3200, day: 15 },
  { payee: "Employer Payroll", category: "Paycheck", account: "Checking", amount: 3200, day: 30 },
  { payee: "Sunset Apartments", category: "Rent", account: "Checking", amount: -2150, day: 1 },
  { payee: "Netflix", category: "Subscriptions", account: "Credit Card", amount: -15.49, day: 7 },
  { payee: "Spotify", category: "Subscriptions", account: "Credit Card", amount: -11.99, day: 12 },
  { payee: "Planet Fitness", category: "Health & Fitness", account: "Credit Card", amount: -24.99, day: 5 },
  { payee: "State Farm", category: "Insurance", account: "Checking", amount: -142.0, day: 20 },
  { payee: "City Utilities", category: "Utilities", account: "Checking", amount: -110, day: 18 },
];

const VARIABLE: Variable[] = [
  { payee: ["Whole Foods", "Trader Joe's", "Safeway", "Costco"], category: "Groceries", account: "Credit Card", perMonth: [4, 7], amount: [40, 180] },
  { payee: ["Chipotle", "Local Bistro", "Sushi House", "Thai Garden", "Starbucks"], category: "Dining", account: "Credit Card", perMonth: [5, 12], amount: [12, 95] },
  { payee: ["Shell", "Chevron", "76 Station"], category: "Gas", account: "Credit Card", perMonth: [2, 4], amount: [35, 70] },
  { payee: ["Amazon", "Target", "Best Buy"], category: "Shopping", account: "Credit Card", perMonth: [2, 6], amount: [20, 250] },
  { payee: ["Delta Airlines", "Marriott", "Airbnb"], category: "Travel", account: "Credit Card", perMonth: [0, 1], amount: [200, 1400] },
  { payee: ["CVS Pharmacy", "Walgreens", "Dr. Office"], category: "Healthcare", account: "Credit Card", perMonth: [0, 2], amount: [15, 220] },
];

function fmtDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

interface Row {
  date: string;
  sortKey: number;
  line: string;
}

/** Build the synthetic CSV text for a full year ending in the given year. */
export function generateSampleSimplifiCsv(year = 2024, seed = 7): string {
  const rng = new Rng(seed);
  const rows: Row[] = [];
  const push = (y: number, mo: number, day: number, payee: string, category: string, amount: number, account: string) => {
    const amt = amount.toFixed(2);
    rows.push({
      date: fmtDate(y, mo, day),
      sortKey: new Date(y, mo - 1, day).getTime(),
      line: `${fmtDate(y, mo, day)},"${payee}","${category}",${amt},"${account}"`,
    });
  };

  for (let mo = 1; mo <= 12; mo++) {
    for (const r of RECURRING) {
      const day = Math.min(r.day, 28);
      // Add a little noise to utilities (seasonal).
      let amt = r.amount;
      if (r.category === "Utilities") amt = -(90 + rng.uniform(0, 80));
      push(year, mo, day, r.payee, r.category, amt, r.account);
    }
    for (const v of VARIABLE) {
      const count = Math.round(rng.uniform(v.perMonth[0], v.perMonth[1] + 0.49));
      for (let i = 0; i < count; i++) {
        const day = 1 + rng.int(28);
        const payee = v.payee[rng.int(v.payee.length)];
        const amount = -(v.amount[0] + rng.uniform(0, v.amount[1] - v.amount[0]));
        push(year, mo, day, payee, v.category, amount, v.account);
      }
    }
    // Occasional interest / dividend income in a brokerage.
    if (mo % 3 === 0) push(year, mo, 28, "Brokerage Dividend", "Investment Income", 65 + rng.uniform(0, 40), "Brokerage");
  }

  rows.sort((a, b) => a.sortKey - b.sortKey);
  const header = "Date,Payee,Category,Amount,Account";
  return [header, ...rows.map((r) => r.line)].join("\n");
}

/** Cached default sample, ready to feed into the parser. */
export const SAMPLE_SIMPLIFI_CSV = generateSampleSimplifiCsv();
