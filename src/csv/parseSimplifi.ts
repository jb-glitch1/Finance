// Robust CSV parser for Quicken Simplifi transaction exports.
//
// Simplifi's export columns vary by version and locale, so we AUTO-DETECT the
// date / payee / category / amount / account columns by header name, and we are
// robust to: quoted fields with embedded commas, signed amounts where expenses
// are negative, currency symbols and thousands separators, parenthesised
// negatives ("(1,234.56)"), and BOM/CRLF. Everything runs locally in the
// browser — transactions never leave the machine.

export interface Transaction {
  date: Date;
  payee: string;
  category: string;
  amount: number; // signed: negative = money out (expense), positive = money in
  account: string;
  /** Simplifi's "Recurring" flag, if present (yes/no). */
  recurringFlag?: boolean;
}

export interface ParseResult {
  transactions: Transaction[];
  columnMap: Record<string, string>;
  warnings: string[];
  rowCount: number;
  /** Count of rows dropped because Simplifi marked them excluded. */
  excludedCount: number;
}

/** Split a single CSV line honoring quotes and escaped quotes. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

const HEADER_ALIASES = {
  date: ["date", "transaction date", "posted date", "post date"],
  payee: ["payee", "description", "name", "merchant", "memo/notes", "memo"],
  category: ["category", "categories", "tag", "tags"],
  amount: ["amount", "amount ($)", "value", "debit/credit"],
  account: ["account", "account name", "source account", "bank"],
  exclusion: ["exclusion", "excluded", "exclude from reports", "exclude"],
  recurring: ["recurring", "is recurring", "recurrence"],
} as const;

function isYes(s: string | undefined): boolean {
  const v = (s ?? "").trim().toLowerCase();
  return v === "yes" || v === "true" || v === "y" || v === "1";
}

function matchHeader(headers: string[], aliases: readonly string[]): number {
  const norm = headers.map((h) => h.trim().toLowerCase().replace(/^﻿/, ""));
  // exact match first
  for (const alias of aliases) {
    const idx = norm.indexOf(alias);
    if (idx >= 0) return idx;
  }
  // contains match
  for (let i = 0; i < norm.length; i++) {
    if (aliases.some((a) => norm[i].includes(a))) return i;
  }
  return -1;
}

/** Parse a money string like "$1,234.56", "(1,234.56)", "-$45.00" → number. */
export function parseAmount(raw: string): number | null {
  if (raw == null) return null;
  let s = raw.trim();
  if (s === "") return null;
  let sign = 1;
  if (/^\(.*\)$/.test(s)) {
    sign = -1;
    s = s.slice(1, -1);
  }
  s = s.replace(/[$£€,\s]/g, "");
  if (s.startsWith("-")) {
    sign *= -1;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  const n = Number(s);
  if (Number.isNaN(n)) return null;
  return sign * n;
}

function parseDate(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  // Try ISO and common US formats.
  let d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    let [, mm, dd, yy] = m;
    const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
    d = new Date(year, Number(mm) - 1, Number(dd));
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

export function parseSimplifiCsv(text: string): ParseResult {
  const warnings: string[] = [];
  const clean = text.replace(/^﻿/, "");
  const lines = clean.split(/\r\n|\n|\r/).filter((l) => l.trim() !== "");
  if (lines.length < 2) {
    return { transactions: [], columnMap: {}, warnings: ["File has no data rows."], rowCount: 0, excludedCount: 0 };
  }
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());

  const idx = {
    date: matchHeader(headers, HEADER_ALIASES.date),
    payee: matchHeader(headers, HEADER_ALIASES.payee),
    category: matchHeader(headers, HEADER_ALIASES.category),
    amount: matchHeader(headers, HEADER_ALIASES.amount),
    account: matchHeader(headers, HEADER_ALIASES.account),
    exclusion: matchHeader(headers, HEADER_ALIASES.exclusion),
    recurring: matchHeader(headers, HEADER_ALIASES.recurring),
  };

  if (idx.date < 0) warnings.push("Could not find a Date column.");
  if (idx.amount < 0) warnings.push("Could not find an Amount column.");

  const columnMap: Record<string, string> = {};
  (Object.keys(idx) as (keyof typeof idx)[]).forEach((k) => {
    if (idx[k] >= 0) columnMap[k] = headers[idx[k]];
  });

  const transactions: Transaction[] = [];
  let excludedCount = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const amount = idx.amount >= 0 ? parseAmount(cols[idx.amount]) : null;
    const date = idx.date >= 0 ? parseDate(cols[idx.date]) : null;
    if (amount == null || date == null) continue;
    // Respect Simplifi's "Exclusion" flag — those are intentionally left out of reports.
    if (idx.exclusion >= 0 && isYes(cols[idx.exclusion])) {
      excludedCount++;
      continue;
    }
    transactions.push({
      date,
      payee: idx.payee >= 0 ? (cols[idx.payee] ?? "").trim() : "",
      category: idx.category >= 0 ? (cols[idx.category] ?? "Uncategorized").trim() || "Uncategorized" : "Uncategorized",
      amount,
      account: idx.account >= 0 ? (cols[idx.account] ?? "").trim() : "",
      recurringFlag: idx.recurring >= 0 ? isYes(cols[idx.recurring]) : undefined,
    });
  }

  if (transactions.length === 0) warnings.push("No valid transactions were parsed.");

  return { transactions, columnMap, warnings, rowCount: transactions.length, excludedCount };
}
