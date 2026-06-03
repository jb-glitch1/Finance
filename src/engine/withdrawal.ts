// Dynamic withdrawal strategies.
//
// The "4% rule" sets year-1 spending at 4% of the initial portfolio and then
// raises it with inflation regardless of markets — simple but brittle (it can
// overspend into a crash or underspend a boom). Dynamic rules let spending
// respond to the portfolio, which both lowers failure rates and avoids leaving
// large unintended bequests. We implement:
//   • fixed-real      — the classic constant-inflation-adjusted withdrawal.
//   • guardrails      — Guyton-Klinger: cut spending when the withdrawal rate
//                        runs too hot, raise it when it runs cold.
//   • vpw             — Variable Percentage Withdrawal: spend a rising fraction
//                        of the current balance set by remaining horizon.

export type WithdrawalStrategy = "fixed-real" | "guardrails" | "vpw";

export interface WithdrawalParams {
  strategy: WithdrawalStrategy;
  /** Initial withdrawal rate for fixed-real / starting point (e.g. 0.04). */
  initialRate: number;
  /** Guyton-Klinger guardrail width (e.g. 0.20 = ±20% around initial rate). */
  guardrailBand?: number;
  /** Spending adjustment when a guardrail is hit (e.g. 0.10 = 10% cut/raise). */
  guardrailAdjust?: number;
  /** Real expected return used to build the VPW schedule (e.g. 0.03). */
  vpwReturn?: number;
}

export const DEFAULT_WITHDRAWAL: WithdrawalParams = {
  strategy: "guardrails",
  initialRate: 0.04,
  guardrailBand: 0.2,
  guardrailAdjust: 0.1,
  vpwReturn: 0.03,
};

/**
 * VPW annuity factor: the fraction of the CURRENT balance to withdraw given a
 * real expected return `r` and `n` years remaining. As n shrinks the fraction
 * rises toward 1, which is exactly why VPW can never fully deplete the
 * portfolio before the horizon.
 */
export function vpwFactor(r: number, n: number): number {
  const years = Math.max(1, n);
  return Math.abs(r) < 1e-9 ? 1 / years : r / (1 - Math.pow(1 + r, -years));
}

export interface WithdrawalState {
  /** Current target annual withdrawal in nominal dollars. */
  currentWithdrawal: number;
  /** The initial withdrawal rate, for guardrail comparison. */
  initialRate: number;
}

export function initWithdrawal(
  params: WithdrawalParams,
  initialPortfolio: number,
): WithdrawalState {
  return {
    currentWithdrawal: params.initialRate * initialPortfolio,
    initialRate: params.initialRate,
  };
}

/**
 * Compute this year's withdrawal (nominal $) and the updated state.
 * `yearsRemaining` is the planning horizon left (for VPW). `inflation` is the
 * realized inflation for the year just passed.
 */
export function nextWithdrawal(
  params: WithdrawalParams,
  state: WithdrawalState,
  portfolio: number,
  inflation: number,
  yearsRemaining: number,
): { amount: number; state: WithdrawalState } {
  if (portfolio <= 0) {
    return { amount: 0, state };
  }

  switch (params.strategy) {
    case "fixed-real": {
      const amount = state.currentWithdrawal * (1 + inflation);
      return {
        amount,
        state: { ...state, currentWithdrawal: amount },
      };
    }

    case "guardrails": {
      const band = params.guardrailBand ?? 0.2;
      const adjust = params.guardrailAdjust ?? 0.1;
      // First, inflation-adjust the prior withdrawal.
      let target = state.currentWithdrawal * (1 + inflation);
      const currentRate = target / portfolio;
      const upper = state.initialRate * (1 + band); // "capital preservation" rule
      const lower = state.initialRate * (1 - band); // "prosperity" rule
      if (currentRate > upper) {
        target *= 1 - adjust; // spending cut
      } else if (currentRate < lower) {
        target *= 1 + adjust; // spending raise
      }
      return { amount: target, state: { ...state, currentWithdrawal: target } };
    }

    case "vpw": {
      // Withdraw an annuity-factor fraction of the CURRENT balance. As the
      // horizon shrinks the percentage rises, mechanically preventing ruin.
      const r = params.vpwReturn ?? 0.03;
      const n = Math.max(1, yearsRemaining);
      const factor =
        Math.abs(r) < 1e-9 ? 1 / n : r / (1 - Math.pow(1 + r, -n));
      const amount = portfolio * factor;
      return { amount, state: { ...state, currentWithdrawal: amount } };
    }
  }
}
