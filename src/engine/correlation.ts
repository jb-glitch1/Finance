// Correlated sampling via Cholesky decomposition.
//
// Given a correlation matrix R, we factor R = L Lᵀ. Then for a vector of
// independent standard normals z, the vector L·z has the desired correlation
// structure. We map each correlated normal back to a target distribution by
// matching quantiles (the Gaussian copula approach), which lets us couple,
// e.g., "market return down" with "discretionary spend down" while keeping
// each marginal distribution intact.

import { Rng } from "./rng";

/**
 * Cholesky factorization of a symmetric positive-(semi)definite matrix.
 * Falls back gracefully on tiny non-PD perturbations by flooring the diagonal.
 */
export function cholesky(matrix: number[][]): number[][] {
  const n = matrix.length;
  const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) sum += L[i][k] * L[j][k];
      if (i === j) {
        const d = matrix[i][i] - sum;
        L[i][j] = Math.sqrt(Math.max(d, 1e-12));
      } else {
        L[i][j] = L[j][j] === 0 ? 0 : (matrix[i][j] - sum) / L[j][j];
      }
    }
  }
  return L;
}

/** Multiply lower-triangular L by a vector of independent normals z. */
export function correlatedNormals(L: number[][], rng: Rng): number[] {
  const n = L.length;
  const z = new Array(n);
  for (let i = 0; i < n; i++) z[i] = rng.normal();
  const out = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j <= i; j++) s += L[i][j] * z[j];
    out[i] = s;
  }
  return out;
}

/** Standard normal CDF (Abramowitz & Stegun 7.1.26 via erf approximation). */
export function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

/** Validate a correlation matrix is square, symmetric, unit-diagonal. */
export function isValidCorrelationMatrix(m: number[][]): boolean {
  const n = m.length;
  for (let i = 0; i < n; i++) {
    if (m[i].length !== n) return false;
    if (Math.abs(m[i][i] - 1) > 1e-6) return false;
    for (let j = 0; j < n; j++) {
      if (Math.abs(m[i][j] - m[j][i]) > 1e-6) return false;
      if (m[i][j] < -1.0001 || m[i][j] > 1.0001) return false;
    }
  }
  return true;
}
