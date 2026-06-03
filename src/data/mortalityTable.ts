// Period life table: probability of dying within one year (q_x) by age and sex.
//
// Anchored to the U.S. Social Security Administration 2021 Period Life Table
// (published in the 2024 Trustees Report). Values at anchor ages approximate
// the SSA table; intermediate ages are log-linearly interpolated, and late
// life follows the anchors with a hard cap at age 120. These drive STOCHASTIC
// longevity: rather than assuming a fixed death age, each simulated person
// lives a random lifespan consistent with these mortality rates.
//
// To update: replace the anchors with the latest SSA Period Life Table
// (https://www.ssa.gov/oact/STATS/table4c6.html), q_x columns. Out of scope:
// annuitant/healthy-life adjustments (annuitants tend to outlive the average).

export type Sex = "male" | "female" | "blended";

// q_x anchors (probability of death within the year), SSA 2021 period table.
const MALE_ANCHORS: Record<number, number> = {
  50: 0.00459,
  55: 0.00662,
  60: 0.01019,
  65: 0.01473,
  70: 0.02221,
  75: 0.03450,
  80: 0.05720,
  85: 0.09670,
  90: 0.16060,
  95: 0.24510,
  100: 0.34240,
  105: 0.43000,
  110: 0.50000,
  119: 0.65000,
};

const FEMALE_ANCHORS: Record<number, number> = {
  50: 0.00301,
  55: 0.00447,
  60: 0.00707,
  65: 0.01034,
  70: 0.01570,
  75: 0.02440,
  80: 0.04050,
  85: 0.07100,
  90: 0.12380,
  95: 0.20030,
  100: 0.29560,
  105: 0.39000,
  110: 0.47000,
  119: 0.62000,
};

export const MAX_AGE = 120;

function interpolate(anchors: Record<number, number>, age: number): number {
  const ages = Object.keys(anchors)
    .map(Number)
    .sort((a, b) => a - b);
  const lo = ages[0];
  const hi = ages[ages.length - 1];
  if (age <= lo) return anchors[lo];
  if (age >= hi) return anchors[hi];
  let a0 = lo;
  let a1 = hi;
  for (let i = 0; i < ages.length - 1; i++) {
    if (age >= ages[i] && age <= ages[i + 1]) {
      a0 = ages[i];
      a1 = ages[i + 1];
      break;
    }
  }
  // Log-linear interpolation (mortality grows roughly exponentially with age).
  const t = (age - a0) / (a1 - a0);
  const q0 = Math.log(anchors[a0]);
  const q1 = Math.log(anchors[a1]);
  return Math.exp(q0 + t * (q1 - q0));
}

/** Probability of dying within one year at a given (integer) age and sex. */
export function qx(age: number, sex: Sex): number {
  if (age >= MAX_AGE) return 1;
  const m = interpolate(MALE_ANCHORS, age);
  const f = interpolate(FEMALE_ANCHORS, age);
  let q: number;
  if (sex === "male") q = m;
  else if (sex === "female") q = f;
  else q = (m + f) / 2;
  return Math.min(Math.max(q, 0), 1);
}

/** Cumulative probability of surviving from `fromAge` to the start of `toAge`. */
export function survivalProbability(fromAge: number, toAge: number, sex: Sex): number {
  let p = 1;
  for (let a = fromAge; a < toAge; a++) p *= 1 - qx(a, sex);
  return p;
}

/** Period life-expectancy (mean remaining years) at a given age. */
export function lifeExpectancy(age: number, sex: Sex): number {
  let p = 1;
  let e = 0;
  for (let a = age; a < MAX_AGE; a++) {
    const surviveYear = 1 - qx(a, sex);
    // Expected years lived this interval ≈ p*(survive full year) + half year if dying.
    e += p * surviveYear + p * (1 - surviveYear) * 0.5;
    p *= surviveYear;
  }
  return e;
}
