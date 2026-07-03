import { useMemo } from "react";
import type { Scenario, SimulationResult } from "../../engine/types";
import { summarize, percentile } from "../../engine/stats";
import { currency, percent } from "../format";

interface Props {
  result: SimulationResult;
  scenario: Scenario;
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className={`stat-card${tone ? ` ${tone}` : ""}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function HeadlineStats({ result, scenario }: Props) {
  const s = useMemo(() => summarize(result.terminalNetWorth), [result]);
  const pRunOut = 1 - result.successProbability;
  const goal = scenario.goal;
  const pGoal = result.goalProbability ?? null;

  const successTone = result.successProbability >= 0.85 ? "good" : result.successProbability >= 0.7 ? "warn" : "bad";

  return (
    <div className="headline-grid">
      <Stat label={`Probability money lasts to ${scenario.settings.stochasticLongevity ? "end of life" : `age ${result.startAge + scenario.settings.horizonYears}`}`} value={percent(result.successProbability)} tone={successTone} sub={`${result.iterations.toLocaleString()} paths`} />
      <Stat label="Probability of running short" value={percent(pRunOut)} tone={pRunOut > 0.15 ? "warn" : undefined} />
      <Stat label="Median ending net worth" value={currency(s.median, { compact: true })} sub={`mean ${currency(s.mean, { compact: true })}`} />
      <Stat label="P10 — P90 ending range" value={`${currency(s.p10, { compact: true })} – ${currency(s.p90, { compact: true })}`} sub={`P5 ${currency(s.p5, { compact: true })} · P95 ${currency(s.p95, { compact: true })}`} />
      <Stat label="Std. deviation" value={currency(s.std, { compact: true })} sub={`mode ${currency(s.mode, { compact: true })}`} />
      <Stat label="Worst 5% (P5 ending)" value={currency(s.p5, { compact: true })} sub={`best 5% ${currency(s.p95, { compact: true })}`} />
      {goal && (
        <Stat
          label={`Goal: ${currency(goal.targetAmount, { compact: true })} by age ${goal.targetAge}`}
          value={pGoal != null ? percent(pGoal) : "see chart"}
          sub="probability of hitting goal"
        />
      )}
      {scenario.withdrawal.strategy === "guardrails" && result.lifestyleRisk && (
        <>
          <Stat
            label="Lifestyle risk: any spending cut in retirement"
            value={percent(result.lifestyleRisk.pAnyCut)}
            tone={result.lifestyleRisk.pAnyCut > 0.5 ? "warn" : undefined}
            sub={`median ${result.lifestyleRisk.medianYearsBelow.toFixed(0)} yrs below plan`}
          />
          <Stat
            label=">20% cut sustained 3+ years"
            value={percent(result.lifestyleRisk.pDeepCut3yr)}
            tone={result.lifestyleRisk.pDeepCut3yr > 0.25 ? "warn" : result.lifestyleRisk.pDeepCut3yr > 0.1 ? undefined : "good"}
            sub={`deepest cut (P90): ${percent(result.lifestyleRisk.p90MaxDepth)}`}
          />
        </>
      )}
      <Stat label="Median lifetime taxes paid" value={currency(percentile(result.paths.map((p) => p.totalTaxesPaid), 50), { compact: true })} sub="federal, nominal" />
    </div>
  );
}
