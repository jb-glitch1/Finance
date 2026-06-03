// Deterministic loan amortization. Used by the debt panel and the payoff-vs-
// invest analysis, and validated against the closed-form mortgage formula.

export interface AmortizationRow {
  month: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

/** Standard fully-amortizing monthly payment for principal P, APR, term months. */
export function monthlyPayment(principal: number, annualRate: number, months: number): number {
  const r = annualRate / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

/** Remaining balance after `t` monthly payments of a fully-amortizing loan. */
export function remainingBalance(
  principal: number,
  annualRate: number,
  months: number,
  t: number,
): number {
  const r = annualRate / 12;
  if (r === 0) return Math.max(0, principal * (1 - t / months));
  const pow = Math.pow(1 + r, months);
  const powT = Math.pow(1 + r, t);
  return principal * ((pow - powT) / (pow - 1));
}

/** Full amortization schedule given an actual monthly payment (>= interest). */
export function amortizationSchedule(
  principal: number,
  annualRate: number,
  payment: number,
  maxMonths = 1200,
): AmortizationRow[] {
  const r = annualRate / 12;
  const rows: AmortizationRow[] = [];
  let balance = principal;
  let month = 0;
  while (balance > 0.005 && month < maxMonths) {
    month++;
    const interest = balance * r;
    let principalPaid = payment - interest;
    if (principalPaid <= 0) break; // payment can't cover interest
    if (principalPaid > balance) principalPaid = balance;
    balance -= principalPaid;
    rows.push({ month, payment: interest + principalPaid, interest, principal: principalPaid, balance });
  }
  return rows;
}

/** Months to pay off a balance at a given monthly payment. Infinity if it never amortizes. */
export function monthsToPayoff(principal: number, annualRate: number, payment: number): number {
  const r = annualRate / 12;
  if (r === 0) return Math.ceil(principal / payment);
  if (payment <= principal * r) return Infinity;
  return Math.ceil(-Math.log(1 - (principal * r) / payment) / Math.log(1 + r));
}

/** Total interest paid over the life of a loan at a given monthly payment. */
export function totalInterest(principal: number, annualRate: number, payment: number): number {
  return amortizationSchedule(principal, annualRate, payment).reduce((s, row) => s + row.interest, 0);
}
