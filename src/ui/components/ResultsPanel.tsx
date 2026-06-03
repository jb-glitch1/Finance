import { useState } from "react";
import type { Scenario, SimulationResult } from "../../engine/types";
import { Histogram } from "../charts/Histogram";
import { FanChart } from "../charts/FanChart";
import { Tornado } from "../charts/Tornado";
import { LineChart } from "../charts/LineChart";
import { HeadlineStats } from "./HeadlineStats";
import { summarize } from "../../engine/stats";
import { runTornado } from "../../worker/simClient";
import type { TornadoEntry, OutcomeMetric } from "../../engine/sensitivity";
import { currency, percent } from "../format";
import { exportResultsCsv, exportSummary } from "../export";

interface Props {
  scenario: Scenario;
  result: SimulationResult | null;
  running: boolean;
}

export function ResultsPanel({ scenario, result, running }: Props) {
  const [tornado, setTornado] = useState<TornadoEntry[]>([]);
  const [metric, setMetric] = useState<OutcomeMetric>("successProbability");
  const [tornadoBusy, setTornadoBusy] = useState(false);

  if (!result) {
    return <div className="results-empty">{running ? "Running simulation…" : "Adjust inputs and the simulation runs automatically."}</div>;
  }

  const s = summarize(result.terminalNetWorth);
  const markers = [
    { label: "P10", value: s.p10, color: "#f87171" },
    { label: "P50", value: s.p50, color: "#fbbf24" },
    { label: "P90", value: s.p90, color: "#34d399" },
  ];

  async function runTornadoAnalysis() {
    setTornadoBusy(true);
    setTornado(await runTornado(scenario, metric));
    setTornadoBusy(false);
  }

  const depletion = result.depletionByAge.filter((d) => d.probability > 0);

  return (
    <div className="results">
      <HeadlineStats result={result} scenario={scenario} />

      <div className="card">
        <div className="card-head">
          <h3>Ending net-worth distribution</h3>
          <div className="card-actions">
            <button className="btn ghost" onClick={() => exportResultsCsv(result)}>Export raw CSV</button>
            <button className="btn ghost" onClick={() => exportSummary(scenario, result)}>Export summary</button>
          </div>
        </div>
        <Histogram values={result.terminalNetWorth} markers={markers} />
        <div className="legend">
          <span><i className="sw bar" /> outcome histogram</span>
          <span><i className="sw density" /> smoothed density</span>
          <span>dashed = percentiles</span>
        </div>
      </div>

      <div className="card">
        <h3>Net worth over time (P10 / P25–P75 / P90 fan)</h3>
        <FanChart bands={result.bands} />
        <div className="legend">
          <span><i className="sw fan-outer-sw" /> P10–P90</span>
          <span><i className="sw fan-inner-sw" /> P25–P75</span>
          <span><i className="sw median-sw" /> median</span>
        </div>
      </div>

      {depletion.length > 0 && (
        <div className="card">
          <h3>Trigger points — probability of depletion by age</h3>
          <LineChart
            series={[{ points: depletion.map((d) => ({ x: d.age, y: d.probability })), color: "#f87171" }]}
            formatX={(v) => `age ${Math.round(v)}`}
            formatY={(v) => percent(v)}
          />
          <p className="muted small">If this curve rises sharply at a given age, that's when failure paths typically deplete — a cue to hold more buffer or flex spending earlier.</p>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h3>Sensitivity (tornado)</h3>
          <div className="card-actions">
            <select value={metric} onChange={(e) => setMetric(e.target.value as OutcomeMetric)}>
              <option value="successProbability">metric: success probability</option>
              <option value="medianTerminal">metric: median ending net worth</option>
            </select>
            <button className="btn" onClick={runTornadoAnalysis} disabled={tornadoBusy}>{tornadoBusy ? "Running…" : "Run sensitivity"}</button>
          </div>
        </div>
        {tornado.length > 0 ? (
          <Tornado entries={tornado} format={(v) => (metric === "successProbability" ? percent(v) : currency(v, { compact: true }))} />
        ) : (
          <p className="muted small">Ranks which assumption swings the outcome most. Each bar varies one driver low↔high while holding the rest at baseline.</p>
        )}
      </div>
    </div>
  );
}
