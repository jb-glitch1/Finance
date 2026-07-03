// Export helpers: raw results as CSV and a clean, self-contained HTML summary.

import type { Scenario, SimulationResult } from "../engine/types";
import { summarize } from "../engine/stats";
import { currency, percent } from "./format";

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Raw per-iteration results as CSV for further analysis. */
export function exportResultsCsv(result: SimulationResult) {
  const header =
    "iteration,terminal_net_worth,success,ran_out_age,min_net_worth,total_taxes_paid,spending_cut_years,max_cut_depth,longest_deep_cut_years";
  const lines = result.paths.map(
    (p, i) =>
      `${i},${p.terminalNetWorth.toFixed(2)},${p.success ? 1 : 0},${p.ranOutAge ?? ""},${p.minNetWorth.toFixed(2)},${p.totalTaxesPaid.toFixed(2)},${p.spendingCutYears},${p.maxSpendingCutDepth.toFixed(3)},${p.longestDeepCutYears}`,
  );
  // Also append the percentile bands as a second block.
  const bandHeader = "\n\nage,p10,p25,p50,p75,p90,mean";
  const bandLines = result.bands.map((b) => `${b.age},${b.p10.toFixed(0)},${b.p25.toFixed(0)},${b.p50.toFixed(0)},${b.p75.toFixed(0)},${b.p90.toFixed(0)},${b.mean.toFixed(0)}`);
  download("montecarlo-results.csv", [header, ...lines, bandHeader, ...bandLines].join("\n"), "text/csv");
}

/** A clean, printable HTML summary with the headline numbers. */
export function exportSummary(scenario: Scenario, result: SimulationResult) {
  const s = summarize(result.terminalNetWorth);
  const row = (k: string, v: string) => `<tr><td>${k}</td><td style="text-align:right">${v}</td></tr>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(scenario.name)} — Monte Carlo summary</title>
<style>body{font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:760px;margin:40px auto;color:#0f172a}h1{font-size:22px}table{border-collapse:collapse;width:100%;margin:12px 0}td{padding:6px 10px;border-bottom:1px solid #e2e8f0}small{color:#64748b}.disc{background:#fef9c3;padding:10px 14px;border-radius:8px;font-size:13px;margin-top:24px}</style>
</head><body>
<h1>${escapeHtml(scenario.name)} — Monte Carlo summary</h1>
<small>Generated ${new Date().toLocaleString()} · ${result.iterations.toLocaleString()} iterations · seed ${result.seed}</small>
<table>
${row("Probability money lasts" + (scenario.settings.stochasticLongevity ? " (to modeled lifespan)" : ` to age ${result.startAge + scenario.settings.horizonYears}`), percent(result.successProbability))}
${row("Probability of running short", percent(1 - result.successProbability))}
${scenario.withdrawal.strategy === "guardrails" && result.lifestyleRisk ? row("Lifestyle risk: any guardrail cut / >20% cut for 3+ yrs", `${percent(result.lifestyleRisk.pAnyCut)} / ${percent(result.lifestyleRisk.pDeepCut3yr)}`) : ""}
${scenario.goal ? row(`Probability of goal (${currency(scenario.goal.targetAmount)} by ${scenario.goal.targetAge})`, result.goalProbability != null ? percent(result.goalProbability) : "—") : ""}
${row("Mean ending net worth", currency(s.mean))}
${row("Median (P50)", currency(s.median))}
${row("P5 / P10", currency(s.p5) + " / " + currency(s.p10))}
${row("P90 / P95", currency(s.p90) + " / " + currency(s.p95))}
${row("Std deviation", currency(s.std))}
</table>
<h3>Key assumptions</h3>
<table>
${row("Filing status", scenario.filingStatus)}
${row("Retirement age", String(scenario.retirementAge))}
${row("Withdrawal strategy", scenario.withdrawal.strategy + ` (init ${percent(scenario.withdrawal.initialRate, 2)})`)}
${row("Return model", scenario.returnModel.kind === "bootstrap" ? `historical ${scenario.returnModel.mode} bootstrap` : "parametric")}
${row("Stochastic longevity", scenario.settings.stochasticLongevity ? "yes (SSA period life table)" : "no")}
</table>
<div class="disc"><strong>Not financial advice.</strong> Educational projection under the stated assumptions. Federal taxes only (tax year 2025); state &amp; local taxes out of scope. Verify before making decisions.</div>
</body></html>`;
  download("montecarlo-summary.html", html, "text/html");
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}
