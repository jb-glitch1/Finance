// Display formatting helpers.

export function currency(x: number, opts: { compact?: boolean; cents?: boolean } = {}): string {
  if (!Number.isFinite(x)) return "—";
  if (opts.compact) {
    const abs = Math.abs(x);
    const sign = x < 0 ? "-" : "";
    if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}k`;
    return `${sign}$${abs.toFixed(0)}`;
  }
  return x.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: opts.cents ? 2 : 0,
  });
}

export function percent(x: number, dp = 0): string {
  if (!Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(dp)}%`;
}

export function compactNum(x: number): string {
  return currency(x, { compact: true });
}
