// Historical and block bootstrap sampling from a bundled annual return series.
//
// Parametric distributions (normal/lognormal) assume a shape that markets do
// not actually follow. Bootstrapping resamples *real* historical years, so the
// fat tails, the skew, and — with block bootstrap — the serial structure
// (momentum, mean reversion, inflation persistence) are preserved. This matters
// for sequence-of-returns risk, which is the dominant risk in early retirement.

import { Rng } from "./rng";
import type { AnnualReturn } from "../data/historicalReturns";

export interface MarketDraw {
  stocks: number;
  tbonds: number;
  tbills: number;
  inflation: number;
}

export type BootstrapMode = "iid" | "block";

/**
 * Draws a full path of `years` correlated market outcomes.
 *
 * - "iid": each year is an independent random historical year. Destroys serial
 *   correlation but preserves cross-asset correlation within a year and the
 *   true marginal distributions.
 * - "block": draws contiguous blocks of `blockSize` historical years (wrapping
 *   around the dataset), preserving short-run autocorrelation and the joint
 *   dynamics of stocks/bonds/inflation. This is the recommended default for
 *   retirement sequence-of-returns modeling.
 */
export function bootstrapPath(
  data: AnnualReturn[],
  years: number,
  rng: Rng,
  mode: BootstrapMode = "block",
  blockSize = 5,
): MarketDraw[] {
  const n = data.length;
  const path: MarketDraw[] = [];
  if (n === 0) return path;

  if (mode === "iid") {
    for (let y = 0; y < years; y++) {
      const idx = rng.int(n);
      path.push(toDraw(data[idx]));
    }
    return path;
  }

  // Stationary-ish circular block bootstrap.
  while (path.length < years) {
    const start = rng.int(n);
    for (let k = 0; k < blockSize && path.length < years; k++) {
      path.push(toDraw(data[(start + k) % n]));
    }
  }
  return path;
}

function toDraw(r: AnnualReturn): MarketDraw {
  return {
    stocks: r.stocks,
    tbonds: r.tbonds,
    tbills: r.tbills,
    inflation: r.inflation,
  };
}

/** Blend asset returns by a portfolio weight on stocks (rest split bonds/cash). */
export function portfolioReturn(
  draw: MarketDraw,
  stockWeight: number,
  bondWeight: number,
  cashWeight: number,
): number {
  const total = stockWeight + bondWeight + cashWeight || 1;
  return (
    (stockWeight * draw.stocks + bondWeight * draw.tbonds + cashWeight * draw.tbills) / total
  );
}

/** Empirical mean/sd of a column, for display and sanity checks. */
export function columnStats(
  data: AnnualReturn[],
  key: keyof Omit<AnnualReturn, "year">,
): { mean: number; sd: number; min: number; max: number } {
  const xs = data.map((d) => d[key]);
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1);
  return {
    mean: m,
    sd: Math.sqrt(v),
    min: Math.min(...xs),
    max: Math.max(...xs),
  };
}
