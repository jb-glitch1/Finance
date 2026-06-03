import { describe, it, expect } from "vitest";
import { Rng } from "../engine/rng";
import {
  sample,
  theoreticalMean,
  theoreticalVariance,
  type DistributionSpec,
} from "../engine/distributions";
import { mean, std } from "../engine/stats";

function draw(spec: DistributionSpec, n = 200000, seed = 12345): number[] {
  const rng = new Rng(seed);
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = sample(spec, rng);
  return out;
}

describe("distribution statistical properties", () => {
  const cases: DistributionSpec[] = [
    { kind: "normal", mean: 5, sd: 2 },
    { kind: "uniform", min: -3, max: 7 },
    { kind: "triangular", min: 0, mode: 2, max: 10 },
    { kind: "pert", min: 0, mode: 3, max: 12 },
    { kind: "lognormal", mean: 0, sd: 0.5 },
    { kind: "discrete", values: [1, 2, 3, 4], weights: [4, 3, 2, 1] },
  ];

  for (const spec of cases) {
    it(`matches theoretical mean/variance: ${spec.kind}`, () => {
      const xs = draw(spec);
      const m = mean(xs);
      const v = std(xs) ** 2;
      const tm = theoreticalMean(spec)!;
      const tv = theoreticalVariance(spec)!;
      // Empirical mean within ~1.5% of theory (relative or absolute for near-zero).
      expect(Math.abs(m - tm)).toBeLessThan(0.03 * (Math.abs(tm) + 1));
      expect(Math.abs(v - tv)).toBeLessThan(0.06 * (Math.abs(tv) + 1));
    });
  }

  it("triangular respects [min, max] bounds", () => {
    const spec: DistributionSpec = { kind: "triangular", min: 1, mode: 4, max: 9 };
    const xs = draw(spec, 50000);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...xs)).toBeLessThanOrEqual(9);
  });

  it("Student-t with low nu is fatter-tailed than normal", () => {
    const t = draw({ kind: "studentT", mean: 0, sd: 1, nu: 3 }, 200000);
    const tailT = t.filter((x) => Math.abs(x) > 3).length / t.length;
    const n = draw({ kind: "normal", mean: 0, sd: 1 }, 200000, 999);
    const tailN = n.filter((x) => Math.abs(x) > 3).length / n.length;
    expect(tailT).toBeGreaterThan(tailN);
  });

  it("Student-t (nu>2) is standardized to ~unit variance", () => {
    const t = draw({ kind: "studentT", mean: 0, sd: 1, nu: 8 }, 300000);
    expect(Math.abs(std(t) - 1)).toBeLessThan(0.05);
  });
});

describe("RNG reproducibility", () => {
  it("same seed yields identical sequence", () => {
    const a = new Rng("seed-A");
    const b = new Rng("seed-A");
    for (let i = 0; i < 1000; i++) expect(a.next()).toBe(b.next());
  });

  it("different seeds diverge", () => {
    const a = new Rng(1);
    const b = new Rng(2);
    let same = 0;
    for (let i = 0; i < 1000; i++) if (a.next() === b.next()) same++;
    expect(same).toBeLessThan(5);
  });

  it("uniform draws stay in [0,1)", () => {
    const r = new Rng(42);
    for (let i = 0; i < 100000; i++) {
      const x = r.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});
