import { useEffect, useRef, useState } from "react";
import type { Scenario, SimulationResult } from "./engine/types";
import { makeDefaultScenario } from "./state/defaultScenario";
import { runScenario } from "./worker/simClient";
import { PlanControls } from "./ui/components/PlanControls";
import { EditorsPanel } from "./ui/components/EditorsPanel";
import { ResultsPanel } from "./ui/components/ResultsPanel";
import { AdvisorPanel } from "./ui/components/AdvisorPanel";
import { CsvImportPanel } from "./ui/components/CsvImportPanel";
import { ScenarioComparePanel } from "./ui/components/ScenarioComparePanel";
import { loadAll, saveScenario, deleteScenario, exportScenarioJson, importScenarioJson } from "./state/persistence";

type Tab = "results" | "inputs" | "import" | "advisor" | "compare";

const TABS: { id: Tab; label: string }[] = [
  { id: "results", label: "Results" },
  { id: "inputs", label: "Inputs" },
  { id: "import", label: "Import CSV" },
  { id: "advisor", label: "Advisor" },
  { id: "compare", label: "Scenarios" },
];

export default function App() {
  const [scenario, setScenario] = useState<Scenario>(() => makeDefaultScenario());
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tab, setTab] = useState<Tab>("results");
  const [saved, setSaved] = useState(() => loadAll());
  const [autoRun, setAutoRun] = useState(true);
  const runToken = useRef(0);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function run(s: Scenario) {
    const token = ++runToken.current;
    setRunning(true);
    setProgress(0);
    try {
      const res = await runScenario(s, (c, t) => {
        if (token === runToken.current) setProgress(c / t);
      });
      if (token === runToken.current) setResult(res);
    } finally {
      if (token === runToken.current) setRunning(false);
    }
  }

  // Live re-run (debounced) whenever the scenario changes.
  useEffect(() => {
    if (!autoRun) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => run(scenario), 350);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario, autoRun]);

  function update(s: Scenario) {
    setScenario(s);
  }

  function onSave() {
    saveScenario(scenario);
    setSaved(loadAll());
  }
  function onLoad(name: string) {
    const all = loadAll();
    if (all[name]) setScenario(all[name]);
  }
  function onDelete(name: string) {
    deleteScenario(name);
    setSaved(loadAll());
  }
  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setScenario(await importScenarioJson(file));
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="logo">▲</span>
          <div>
            <h1>Monte Carlo Finance</h1>
            <span className="tagline">Advisor-grade planning · 100% in your browser · tax year 2025</span>
          </div>
        </div>
        <div className="header-actions">
          <label className="auto-toggle">
            <input type="checkbox" checked={autoRun} onChange={(e) => setAutoRun(e.target.checked)} /> auto-run
          </label>
          {!autoRun && <button className="btn primary" onClick={() => run(scenario)} disabled={running}>Run</button>}
          {running && <span className="progress"><span className="progress-bar" style={{ width: `${Math.round(progress * 100)}%` }} /></span>}
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="scenario-bar">
            <input className="scenario-name" value={scenario.name} onChange={(e) => update({ ...scenario, name: e.target.value })} />
            <div className="scenario-buttons">
              <button className="btn ghost" onClick={onSave} title="Save to browser">Save</button>
              <button className="btn ghost" onClick={() => exportScenarioJson(scenario)} title="Download JSON">Export</button>
              <label className="btn ghost file-btn" title="Load JSON">Import<input type="file" accept=".json" hidden onChange={onImport} /></label>
            </div>
            {Object.keys(saved).length > 0 && (
              <div className="saved-list">
                {Object.keys(saved).map((name) => (
                  <span className="saved-chip" key={name}>
                    <button onClick={() => onLoad(name)}>{name}</button>
                    <button className="chip-x" onClick={() => onDelete(name)}>✕</button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <PlanControls scenario={scenario} onChange={update} />
        </aside>

        <main className="content">
          <nav className="tabs">
            {TABS.map((t) => (
              <button key={t.id} className={`tab${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>

          <div className="tab-content">
            {tab === "results" && <ResultsPanel scenario={scenario} result={result} running={running} />}
            {tab === "inputs" && <EditorsPanel scenario={scenario} onChange={update} />}
            {tab === "import" && <CsvImportPanel scenario={scenario} onApply={update} />}
            {tab === "advisor" && <AdvisorPanel scenario={scenario} result={result} />}
            {tab === "compare" && <ScenarioComparePanel scenario={scenario} />}
          </div>
        </main>
      </div>

      <footer className="app-footer">
        <span>Not financial advice · not a fiduciary · federal tax (2025) only, state/local out of scope · all computation is local — no data leaves your browser.</span>
      </footer>
    </div>
  );
}
