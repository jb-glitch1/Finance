// Stochastic longevity sampling from the bundled period life table.

import { Rng } from "./rng";
import { qx, MAX_AGE, type Sex } from "../data/mortalityTable";

/**
 * Sample an age at death for a person currently `currentAge`, by walking forward
 * year by year and applying the annual mortality probability q_x until death (or
 * the table cap). This produces a realistic right-skewed lifespan distribution
 * with a meaningful tail — some plans must fund to 100+, which a fixed "assume
 * age 90" never captures.
 */
export function sampleAgeAtDeath(currentAge: number, sex: Sex, rng: Rng): number {
  let age = currentAge;
  while (age < MAX_AGE) {
    if (rng.next() < qx(age, sex)) return age;
    age++;
  }
  return MAX_AGE;
}

/**
 * For a couple, sample each partner's death age independently; the plan horizon
 * for "money must last" is the LAST survivor (the longer of the two lives).
 */
export function sampleHouseholdHorizon(
  ages: { age: number; sex: Sex }[],
  rng: Rng,
): { deathAges: number[]; lastSurvivorAge: number } {
  const deathAges = ages.map((p) => sampleAgeAtDeath(p.age, p.sex, rng));
  // Express last-survivor relative to the first person's age timeline.
  const base = ages[0].age;
  let last = base;
  ages.forEach((p, i) => {
    const yearsLived = deathAges[i] - p.age;
    last = Math.max(last, base + yearsLived);
  });
  return { deathAges, lastSurvivorAge: last };
}
