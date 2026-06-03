// Probability distributions for stochastic inputs.
//
// Each distribution exposes a `sample(rng)` and, where tractable, its
// theoretical mean/variance so the UI and tests can show/verify properties.
// Distributions are described by a serializable spec so scenarios can be
// saved/loaded and shipped to the Web Worker.

import { Rng } from "./rng";

export type DistributionSpec =
  | { kind: "fixed"; value: number }
  | { kind: "normal"; mean: number; sd: number }
  | { kind: "lognormal"; mean: number; sd: number } // mean/sd are of the underlying NORMAL (log space)
  | { kind: "uniform"; min: number; max: number }
  | { kind: "triangular"; min: number; mode: number; max: number }
  | { kind: "pert"; min: number; mode: number; max: number; lambda?: number }
  | { kind: "studentT"; mean: number; sd: number; nu: number }
  | { kind: "discrete"; values: number[]; weights?: number[] };

export function sample(spec: DistributionSpec, rng: Rng): number {
  switch (spec.kind) {
    case "fixed":
      return spec.value;
    case "normal":
      return rng.normal(spec.mean, spec.sd);
    case "lognormal":
      return Math.exp(rng.normal(spec.mean, spec.sd));
    case "uniform":
      return rng.uniform(spec.min, spec.max);
    case "triangular":
      return sampleTriangular(spec.min, spec.mode, spec.max, rng);
    case "pert":
      return samplePert(spec.min, spec.mode, spec.max, spec.lambda ?? 4, rng);
    case "studentT":
      return spec.mean + spec.sd * rng.studentT(spec.nu);
    case "discrete":
      return sampleDiscrete(spec.values, spec.weights, rng);
    default: {
      const _exhaustive: never = spec;
      throw new Error(`Unknown distribution: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function sampleTriangular(min: number, mode: number, max: number, rng: Rng): number {
  if (max <= min) return min;
  const u = rng.next();
  const fc = (mode - min) / (max - min);
  if (u < fc) {
    return min + Math.sqrt(u * (max - min) * (mode - min));
  }
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

/**
 * PERT (Beta-PERT) — smoother than triangular, popular in cost/schedule risk.
 * Mean = (min + lambda*mode + max) / (lambda + 2). lambda=4 is standard.
 * Implemented as a scaled Beta(alpha, beta) using two Gamma draws.
 */
function samplePert(min: number, mode: number, max: number, lambda: number, rng: Rng): number {
  if (max <= min) return min;
  const range = max - min;
  const mu = (min + lambda * mode + max) / (lambda + 2);
  let alpha: number;
  let beta: number;
  if (Math.abs(mu - mode) < 1e-12) {
    alpha = beta = (lambda + 2) / 2;
  } else {
    alpha = ((mu - min) * (2 * mode - min - max)) / ((mode - mu) * range);
    beta = (alpha * (max - mu)) / (mu - min);
  }
  alpha = Math.max(alpha, 1e-6);
  beta = Math.max(beta, 1e-6);
  const g1 = rng.gamma(alpha);
  const g2 = rng.gamma(beta);
  const b = g1 / (g1 + g2);
  return min + b * range;
}

function sampleDiscrete(values: number[], weights: number[] | undefined, rng: Rng): number {
  if (values.length === 0) return 0;
  if (!weights || weights.length !== values.length) {
    return values[rng.int(values.length)];
  }
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng.next() * total;
  for (let i = 0; i < values.length; i++) {
    r -= weights[i];
    if (r <= 0) return values[i];
  }
  return values[values.length - 1];
}

/** Theoretical mean where closed-form; otherwise undefined (use empirical). */
export function theoreticalMean(spec: DistributionSpec): number | undefined {
  switch (spec.kind) {
    case "fixed":
      return spec.value;
    case "normal":
      return spec.mean;
    case "lognormal":
      return Math.exp(spec.mean + (spec.sd * spec.sd) / 2);
    case "uniform":
      return (spec.min + spec.max) / 2;
    case "triangular":
      return (spec.min + spec.mode + spec.max) / 3;
    case "pert":
      return (spec.min + (spec.lambda ?? 4) * spec.mode + spec.max) / ((spec.lambda ?? 4) + 2);
    case "studentT":
      return spec.mean;
    case "discrete": {
      if (spec.weights) {
        const total = spec.weights.reduce((a, b) => a + b, 0);
        return spec.values.reduce((acc, v, i) => acc + (v * spec.weights![i]) / total, 0);
      }
      return spec.values.reduce((a, b) => a + b, 0) / spec.values.length;
    }
  }
}

/** Theoretical variance where closed-form; otherwise undefined. */
export function theoreticalVariance(spec: DistributionSpec): number | undefined {
  switch (spec.kind) {
    case "fixed":
      return 0;
    case "normal":
      return spec.sd * spec.sd;
    case "lognormal": {
      const s2 = spec.sd * spec.sd;
      return (Math.exp(s2) - 1) * Math.exp(2 * spec.mean + s2);
    }
    case "uniform":
      return Math.pow(spec.max - spec.min, 2) / 12;
    case "triangular": {
      const { min, mode, max } = spec;
      return (min * min + mode * mode + max * max - min * mode - min * max - mode * max) / 18;
    }
    case "pert": {
      const lambda = spec.lambda ?? 4;
      const mu = (spec.min + lambda * spec.mode + spec.max) / (lambda + 2);
      return ((mu - spec.min) * (spec.max - mu)) / (lambda + 3);
    }
    case "studentT":
      // We standardize Student-t to unit variance for nu>2, then scale by sd.
      return spec.nu > 2 ? spec.sd * spec.sd : Infinity;
    case "discrete": {
      const mean = theoreticalMean(spec)!;
      if (spec.weights) {
        const total = spec.weights.reduce((a, b) => a + b, 0);
        return spec.values.reduce(
          (acc, v, i) => acc + (spec.weights![i] / total) * (v - mean) * (v - mean),
          0,
        );
      }
      return (
        spec.values.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / spec.values.length
      );
    }
  }
}

export function describeDistribution(spec: DistributionSpec): string {
  switch (spec.kind) {
    case "fixed":
      return `Fixed ${spec.value}`;
    case "normal":
      return `Normal(μ=${spec.mean}, σ=${spec.sd})`;
    case "lognormal":
      return `Lognormal(μ_log=${spec.mean}, σ_log=${spec.sd})`;
    case "uniform":
      return `Uniform[${spec.min}, ${spec.max}]`;
    case "triangular":
      return `Triangular(${spec.min}, ${spec.mode}, ${spec.max})`;
    case "pert":
      return `PERT(${spec.min}, ${spec.mode}, ${spec.max})`;
    case "studentT":
      return `Student-t(μ=${spec.mean}, σ=${spec.sd}, ν=${spec.nu})`;
    case "discrete":
      return `Discrete{${spec.values.join(", ")}}`;
  }
}
