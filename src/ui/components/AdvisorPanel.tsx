import { useMemo, useState } from "react";
import type { Scenario, SimulationResult } from "../../engine/types";
import { buildRecommendations } from "../../advisor/recommendations";
import { runOptimizeSavings, runOptimizeAllocation } from "../../worker/simClient";
import { LineChart } from "../charts/LineChart";
import { currency, percent } from "../format";

interface Props {
  scenario: Scenario;
  result: SimulationResult | null;
}

export function AdvisorPanel({ scenario, result }: Props) {
  const expectedReturn = scenario.returnModel.kind === "parametric" && scenario.returnModel.stocks.kind === "normal"
    ? scenario.returnModel.stocks.mean * 0.7 + 0.03 * 0.3
    : 0.06;
  const recs = useMemo(() => buildRecommendations(scenario, result, expectedReturn), [scenario, result, expectedReturn]);

  const [savings, setSavings] = useState<{ recommended: number | null; trace: { value: number; successProbability: number }[] } | null>(null);
  const [alloc, setAlloc] = useState<{ bestStockWeight: number; trace: { value: number; successProbability: number }[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function optSavings() {
    setBusy("savings");
    setSavings(await runOptimizeSavings(scenario, 0.85));
    setBusy(null);
  }
  async function optAlloc() {
    setBusy("alloc");
    setAlloc(await runOptimizeAllocation(scenario));
    setBusy(null);
  }

  return (
    <div className="advisor">
      <div className="disclaimer">
        ⚖️ Educational tool — <strong>not professional financial advice and not a fiduciary.</strong> Every figure is a projection under your stated assumptions. Federal taxes only; <strong>state &amp; local taxes are out of scope.</strong> Verify before making real-money decisions.
      </div>

      <div className="rec-list">
        {recs.map((r) => (
          <div className={`rec rec-${r.severity}`} key={r.id}>
            <div className="rec-title">{r.title}</div>
            <div className="rec-message">{r.message}</div>
            {r.detail && <div className="rec-detail">{r.detail}</div>}
            {r.assumptions && <div className="rec-assumptions">Assumes: {r.assumptions}</div>}
          </div>
        ))}
      </div>

      <div className="optimizers">
        <div className="optimizer">
          <div className="opt-head">
            <h4>Savings optimizer</h4>
            <button className="btn" onClick={optSavings} disabled={busy !== null}>{busy === "savings" ? "Searching…" : "Find savings for 85% success"}</button>
          </div>
          {savings && (
            <>
              <p className="muted small">
                {savings.recommended != null
                  ? `Saving ~${currency(savings.recommended)}/yr more (while working) reaches an 85% probability of success.`
                  : "Even the top of the search range didn't reach 85% — consider working longer, spending less, or adjusting allocation."}
              </p>
              <LineChart
                series={[{ points: savings.trace.map((t) => ({ x: t.value, y: t.successProbability })), color: "#34d399" }]}
                formatX={(v) => currency(v, { compact: true })}
                formatY={(v) => percent(v)}
                target={{ y: 0.85, label: "85% target" }}
              />
            </>
          )}
        </div>

        <div className="optimizer">
          <div className="opt-head">
            <h4>Allocation optimizer</h4>
            <button className="btn" onClick={optAlloc} disabled={busy !== null}>{busy === "alloc" ? "Searching…" : "Find best stock weight"}</button>
          </div>
          {alloc && (
            <>
              <p className="muted small">Highest success probability near <strong>{percent(alloc.bestStockWeight)}</strong> stocks. The curve is often hump-shaped — too little growth on the left, too much volatility on the right.</p>
              <LineChart
                series={[{ points: alloc.trace.map((t) => ({ x: t.value, y: t.successProbability })), color: "#60a5fa" }]}
                formatX={(v) => percent(v)}
                formatY={(v) => percent(v)}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
