import { describe, it, expect } from "vitest";
import { runSimulation } from "../engine/simulation";
import { makeDefaultScenario, applyPreset } from "../state/defaultScenario";
import { bootstrapPath, columnStats } from "../engine/bootstrap";
import { HISTORICAL_RETURNS } from "../data/historicalReturns";
import { Rng } from "../engine/rng";
import { lifeExpectancy } from "../data/mortalityTable";

describe("default scenario sanity", () => {
  it("produces a plausible success probability and bands", () => {
    const s = makeDefaultScenario();
    s.settings.iterations = 500;
    const res = runSimulation(s);
    expect(res.successProbability).toBeGreaterThanOrEqual(0);
    expect(res.successProbability).toBeLessThanOrEqual(1);
    expect(res.bands.length).toBeGreaterThan(10);
    expect(res.terminalNetWorth.length).toBe(500);
    // Median net worth should be a finite number.
    expect(Number.isFinite(res.bands[0].p50)).toBe(true);
  });

  it("market crash preset lowers success vs base", () => {
    const base = makeDefaultScenario();
    base.settings.iterations = 800;
    base.settings.stochasticLongevity = false;
    base.settings.horizonYears = 45;
    const baseRes = runSimulation(base);
    const crash = applyPreset(base, "Market Crash");
    const crashRes = runSimulation(crash);
    expect(crashRes.successProbability).toBeLessThanOrEqual(baseRes.successProbability + 0.02);
  });

  it("is reproducible with a fixed seed", () => {
    const s = makeDefaultScenario();
    s.settings.iterations = 300;
    expect(runSimulation(s).successProbability).toBe(runSimulation(s).successProbability);
  });
});

describe("historical dataset & bootstrap", () => {
  it("covers 1928–2024 with sane long-run averages", () => {
    expect(HISTORICAL_RETURNS.length).toBe(97);
    expect(HISTORICAL_RETURNS[0].year).toBe(1928);
    expect(HISTORICAL_RETURNS[HISTORICAL_RETURNS.length - 1].year).toBe(2024);
    const stocks = columnStats(HISTORICAL_RETURNS, "stocks");
    expect(stocks.mean).toBeGreaterThan(0.08);
    expect(stocks.mean).toBeLessThan(0.14);
    const infl = columnStats(HISTORICAL_RETURNS, "inflation");
    expect(infl.mean).toBeGreaterThan(0.02);
    expect(infl.mean).toBeLessThan(0.045);
  });

  it("block bootstrap returns the requested path length", () => {
    const rng = new Rng(1);
    const path = bootstrapPath(HISTORICAL_RETURNS, 40, rng, "block", 5);
    expect(path.length).toBe(40);
  });
});

describe("mortality table", () => {
  it("life expectancy decreases with age and is higher for females", () => {
    expect(lifeExpectancy(65, "female")).toBeGreaterThan(lifeExpectancy(65, "male"));
    expect(lifeExpectancy(65, "male")).toBeGreaterThan(lifeExpectancy(85, "male"));
    // A 65-year-old's remaining life expectancy is roughly 18–24 years.
    expect(lifeExpectancy(65, "blended")).toBeGreaterThan(15);
    expect(lifeExpectancy(65, "blended")).toBeLessThan(26);
  });
});
