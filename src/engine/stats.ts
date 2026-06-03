// Summary statistics, percentiles, histogram binning, and kernel density
// estimation used across the outputs.

export interface SummaryStats {
  n: number;
  mean: number;
  median: number;
  mode: number;
  std: number;
  min: number;
  max: number;
  p5: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
}

/** Linear-interpolated percentile (type 7, like NumPy default). Sorts a copy. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return percentileSorted(sorted, p);
}

/** Percentile on an already-sorted array. p in [0, 100]. */
export function percentileSorted(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  if (n === 1) return sorted[0];
  const rank = (p / 100) * (n - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  const frac = rank - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

export function mean(values: number[]): number {
  if (values.length === 0) return NaN;
  let s = 0;
  for (const v of values) s += v;
  return s / values.length;
}

/** Sample standard deviation (n-1 denominator). */
export function std(values: number[], sampleMean?: number): number {
  const n = values.length;
  if (n < 2) return 0;
  const m = sampleMean ?? mean(values);
  let s = 0;
  for (const v of values) s += (v - m) * (v - m);
  return Math.sqrt(s / (n - 1));
}

/** Estimate the mode as the center of the densest histogram bin. */
export function modeEstimate(sorted: number[], bins = 64): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  const min = sorted[0];
  const max = sorted[n - 1];
  if (max === min) return min;
  const width = (max - min) / bins;
  const counts = new Array(bins).fill(0);
  for (const v of sorted) {
    let idx = Math.floor((v - min) / width);
    if (idx >= bins) idx = bins - 1;
    counts[idx]++;
  }
  let best = 0;
  for (let i = 1; i < bins; i++) if (counts[i] > counts[best]) best = i;
  return min + (best + 0.5) * width;
}

export function summarize(values: number[]): SummaryStats {
  const sorted = [...values].sort((a, b) => a - b);
  const m = mean(sorted);
  return {
    n: sorted.length,
    mean: m,
    median: percentileSorted(sorted, 50),
    mode: modeEstimate(sorted),
    std: std(sorted, m),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p5: percentileSorted(sorted, 5),
    p10: percentileSorted(sorted, 10),
    p25: percentileSorted(sorted, 25),
    p50: percentileSorted(sorted, 50),
    p75: percentileSorted(sorted, 75),
    p90: percentileSorted(sorted, 90),
    p95: percentileSorted(sorted, 95),
  };
}

export interface HistogramBin {
  x0: number;
  x1: number;
  count: number;
  density: number;
}

export function histogram(values: number[], bins = 40): HistogramBin[] {
  if (values.length === 0) return [];
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (max === min) {
    max = min + 1;
  }
  const width = (max - min) / bins;
  const counts = new Array(bins).fill(0);
  for (const v of values) {
    let idx = Math.floor((v - min) / width);
    if (idx >= bins) idx = bins - 1;
    if (idx < 0) idx = 0;
    counts[idx]++;
  }
  const n = values.length;
  return counts.map((count, i) => ({
    x0: min + i * width,
    x1: min + (i + 1) * width,
    count,
    density: count / (n * width),
  }));
}

/**
 * Gaussian kernel density estimate evaluated on a grid. Bandwidth via
 * Silverman's rule of thumb. Returns {x, y} points for a smooth density curve.
 */
export function kde(values: number[], points = 120): { x: number; y: number }[] {
  const n = values.length;
  if (n === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const m = mean(sorted);
  const s = std(sorted, m);
  const iqr = percentileSorted(sorted, 75) - percentileSorted(sorted, 25);
  const sigma = Math.min(s || 1, (iqr || s || 1) / 1.349);
  const bw = 0.9 * (sigma || 1) * Math.pow(n, -1 / 5) || 1;
  const min = sorted[0];
  const max = sorted[n - 1];
  const span = max - min || 1;
  const lo = min - 0.05 * span;
  const hi = max + 0.05 * span;
  const step = (hi - lo) / (points - 1);
  const norm = 1 / (n * bw * Math.sqrt(2 * Math.PI));
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < points; i++) {
    const x = lo + i * step;
    let y = 0;
    for (const v of sorted) {
      const u = (x - v) / bw;
      y += Math.exp(-0.5 * u * u);
    }
    out.push({ x, y: y * norm });
  }
  return out;
}

/** Pearson correlation between two equal-length series. */
export function correlation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const ma = mean(a);
  const mb = mean(b);
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma;
    const db = b[i] - mb;
    cov += da * db;
    va += da * da;
    vb += db * db;
  }
  if (va === 0 || vb === 0) return 0;
  return cov / Math.sqrt(va * vb);
}
