// Seedable, reproducible random number generation.
//
// We use a small, fast, well-distributed PRNG (mulberry32) seeded from an
// arbitrary string/number via a splitmix-style hash. Every simulation run is
// fully reproducible from its seed, which is essential for an advisor-grade
// tool: the same inputs + seed always produce the same answer.

export class Rng {
  private state: number;

  constructor(seed: number | string) {
    this.state = typeof seed === "number" ? seed >>> 0 : hashString(seed);
    // Avoid a zero state which would weaken the generator.
    if (this.state === 0) this.state = 0x9e3779b9;
  }

  /** Uniform in [0, 1). */
  next(): number {
    // mulberry32
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform in [min, max). */
  uniform(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  /** Standard normal via Box-Muller (cached pair). */
  private spare: number | null = null;
  normal(mean = 0, sd = 1): number {
    if (this.spare !== null) {
      const v = this.spare;
      this.spare = null;
      return mean + sd * v;
    }
    let u = 0;
    let v = 0;
    let s = 0;
    do {
      u = this.next() * 2 - 1;
      v = this.next() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const mul = Math.sqrt((-2 * Math.log(s)) / s);
    this.spare = v * mul;
    return mean + sd * (u * mul);
  }

  /**
   * Gamma(shape k, scale theta=1) via Marsaglia & Tsang (2000).
   * Used to construct chi-square / Student-t draws.
   */
  gamma(shape: number): number {
    if (shape < 1) {
      // Boost: Gamma(a) = Gamma(a+1) * U^(1/a)
      const u = this.next();
      return this.gamma(shape + 1) * Math.pow(u, 1 / shape);
    }
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x = 0;
      let vv = 0;
      do {
        x = this.normal();
        vv = 1 + c * x;
      } while (vv <= 0);
      vv = vv * vv * vv;
      const u = this.next();
      if (u < 1 - 0.0331 * x * x * x * x) return d * vv;
      if (Math.log(u) < 0.5 * x * x + d * (1 - vv + Math.log(vv))) return d * vv;
    }
  }

  /**
   * Standardized Student-t with `nu` degrees of freedom (unit-ish scale).
   * t = Z / sqrt(V/nu) where Z~N(0,1), V~ChiSq(nu).
   * For nu>2 we rescale by sqrt((nu-2)/nu) so the result has unit variance,
   * making it a drop-in fat-tailed replacement for a standard normal.
   */
  studentT(nu: number): number {
    const z = this.normal();
    const v = 2 * this.gamma(nu / 2); // ChiSq(nu) = Gamma(nu/2, scale 2)
    const t = z / Math.sqrt(v / nu);
    if (nu > 2) return t * Math.sqrt((nu - 2) / nu);
    return t;
  }
}

/** Deterministic 32-bit string hash (FNV-1a-ish with avalanche). */
export function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // splitmix32 finalizer for good avalanche
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}
