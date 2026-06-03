import { useState } from "react";
import type { Scenario, SimulationResult } from "../../engine/types";
import { applyPreset, PRESETS } from "../../state/defaultScenario";
import { runScenario } from "../../worker/simClient";
import { summarize } from "../../engine/stats";
import { currency, percent } from "../format";

interface Props {
  scenario: Scenario;
}

interface Row {
  name: string;
  result: SimulationResult;
}

export function ScenarioComparePanel({ scenario }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  async function compare() {
    setBusy(true);
    const out: Row[] = [];
    for (const preset of PRESETS) {
      const variant = applyPreset(scenario, preset);
      variant.settings = { ...variant.settings, iterations: Math.min(variant.settings.iterations, 2000) };
      out.push({ name: preset, result: await runScenario(variant) });
    }
    setRows(out);
    setBusy(false);
  }

  const maxMedian = Math.max(1, ...rows.map((r) => summarize(r.result.terminalNetWorth).median));

  return (
    <div className="compare">
      <div className="compare-head">
        <p className="muted">Run the same plan through named stress scenarios. Crash uses fat-tailed (Student-t) returns with higher stock/bond correlation; High Inflation lifts CPI; Job Loss removes the primary income for the near term.</p>
        <button className="btn primary" onClick={compare} disabled={busy}>{busy ? "Running scenarios…" : "Compare scenarios"}</button>
      </div>
      {rows.length > 0 && (
        <table className="compare-table">
          <thead>
            <tr><th>Scenario</th><th>Success</th><th>Median ending</th><th>P10 ending</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const s = summarize(r.result.terminalNetWorth);
              const tone = r.result.successProbability >= 0.85 ? "good" : r.result.successProbability >= 0.7 ? "warn" : "bad";
              return (
                <tr key={r.name}>
                  <td><strong>{r.name}</strong></td>
                  <td className={`cell-${tone}`}>{percent(r.result.successProbability)}</td>
                  <td>{currency(s.median, { compact: true })}</td>
                  <td>{currency(s.p10, { compact: true })}</td>
                  <td className="bar-cell"><div className="mini-bar" style={{ width: `${(s.median / maxMedian) * 100}%` }} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
