import type { Scenario } from "../../engine/types";
import type { WithdrawalStrategy } from "../../engine/withdrawal";
import { percent } from "../format";
import { columnStats } from "../../engine/bootstrap";
import { HISTORICAL_RETURNS } from "../../data/historicalReturns";

interface Props {
  scenario: Scenario;
  onChange: (s: Scenario) => void;
}

function Slider({ label, value, min, max, step, format, onChange }: { label: string; value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <label className="slider">
      <div className="slider-head">
        <span>{label}</span>
        <strong>{format(value)}</strong>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>
  );
}

export function PlanControls({ scenario, onChange }: Props) {
  const set = (patch: Partial<Scenario>) => onChange({ ...scenario, ...patch });
  const setW = (patch: Partial<Scenario["withdrawal"]>) => set({ withdrawal: { ...scenario.withdrawal, ...patch } });
  const setSettings = (patch: Partial<Scenario["settings"]>) => set({ settings: { ...scenario.settings, ...patch } });

  // Uniform stock weight across invested accounts (a quick lever).
  const invested = scenario.accounts.filter((a) => a.type !== "cash");
  const total = invested.reduce((s, a) => s + a.balance, 0) || 1;
  const avgStocks = invested.reduce((s, a) => s + a.balance * a.allocation.stocks, 0) / total;
  const setStockWeight = (w: number) => {
    const cash = 0.05;
    const bonds = Math.max(0, 1 - w - cash);
    set({ accounts: scenario.accounts.map((a) => (a.type === "cash" ? a : { ...a, allocation: { stocks: w, bonds, cash } })) });
  };

  const model = scenario.returnModel;

  return (
    <div className="controls">
      <Slider label="Retirement age" value={scenario.retirementAge} min={45} max={75} step={1} format={(v) => `${v}`} onChange={(v) => set({ retirementAge: v })} />
      <Slider label="Stock allocation (invested)" value={avgStocks} min={0} max={1} step={0.05} format={(v) => percent(v)} onChange={setStockWeight} />
      <Slider label="Initial withdrawal rate" value={scenario.withdrawal.initialRate} min={0.02} max={0.08} step={0.0025} format={(v) => percent(v, 2)} onChange={(v) => setW({ initialRate: v })} />
      {scenario.withdrawal.strategy === "guardrails" && (
        <Slider
          label="Max tolerable spending cut"
          value={scenario.withdrawal.maxSpendingCut ?? 0.6}
          min={0}
          max={0.6}
          step={0.05}
          format={(v) => percent(v)}
          onChange={(v) => setW({ maxSpendingCut: v })}
        />
      )}
      <Slider label="Iterations" value={scenario.settings.iterations} min={200} max={100000} step={200} format={(v) => v.toLocaleString()} onChange={(v) => setSettings({ iterations: v })} />

      <div className="control-grid">
        <label className="field">
          <span>Withdrawal strategy</span>
          <select value={scenario.withdrawal.strategy} onChange={(e) => setW({ strategy: e.target.value as WithdrawalStrategy })}>
            <option value="fixed-real">Fixed real (4% rule)</option>
            <option value="guardrails">Guyton-Klinger guardrails</option>
            <option value="vpw">Variable percentage (VPW)</option>
          </select>
        </label>

        <label className="field">
          <span>Return model</span>
          <select
            value={model.kind === "bootstrap" ? `bootstrap-${model.mode}` : "parametric"}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "parametric") {
                set({ returnModel: { kind: "parametric", stocks: { kind: "normal", mean: 0.07, sd: 0.17 }, bonds: { kind: "normal", mean: 0.035, sd: 0.06 }, cash: { kind: "normal", mean: 0.03, sd: 0.01 }, stockBondCorr: 0.1, inflation: { kind: "normal", mean: 0.026, sd: 0.015 } } });
              } else {
                const mode = v === "bootstrap-block" ? "block" : "iid";
                set({ returnModel: { kind: "bootstrap", mode, blockSize: 5 } });
              }
            }}
          >
            <option value="parametric">Parametric (normal/t)</option>
            <option value="bootstrap-block">Historical block bootstrap</option>
            <option value="bootstrap-iid">Historical IID bootstrap</option>
          </select>
        </label>

        <label className="field">
          <span>Random seed</span>
          <input type="number" value={scenario.settings.seed} onChange={(e) => setSettings({ seed: +e.target.value })} />
        </label>

        <label className="field check">
          <span>Stochastic lifespan</span>
          <input type="checkbox" checked={scenario.settings.stochasticLongevity} onChange={(e) => setSettings({ stochasticLongevity: e.target.checked })} />
        </label>

        {!scenario.settings.stochasticLongevity && (
          <label className="field">
            <span>Horizon (years)</span>
            <input type="number" value={scenario.settings.horizonYears} onChange={(e) => setSettings({ horizonYears: +e.target.value })} />
          </label>
        )}
      </div>

      {model.kind === "parametric" ? (
        <div className="muted small">
          Expected stocks {percent((model.stocks.kind === "normal" || model.stocks.kind === "studentT") ? model.stocks.mean : 0, 1)} ·
          inflation {percent((model.inflation.kind === "normal") ? model.inflation.mean : 0, 1)}. Edit full distributions in the Inputs tab.
        </div>
      ) : (
        <div className="muted small">
          Bootstrapping {HISTORICAL_RETURNS.length} historical years (1928–2024). Stocks avg {percent(columnStats(HISTORICAL_RETURNS, "stocks").mean, 1)}, inflation avg {percent(columnStats(HISTORICAL_RETURNS, "inflation").mean, 1)}.
        </div>
      )}
    </div>
  );
}
