import { useState } from "react";
import { parseSimplifiCsv } from "../../csv/parseSimplifi";
import { summarizeTransactions, type CategorySummary } from "../../csv/categorize";
import { SAMPLE_SIMPLIFI_CSV } from "../../data/sampleSimplifi";
import { DistributionEditor } from "./DistributionEditor";
import type { Scenario, IncomeStream, ExpenseItem } from "../../engine/types";
import type { DistributionSpec } from "../../engine/distributions";
import { currency } from "../format";

interface Props {
  scenario: Scenario;
  onApply: (s: Scenario) => void;
}

interface Editable extends CategorySummary {
  include: boolean;
  spec: DistributionSpec;
}

export function CsvImportPanel({ scenario, onApply }: Props) {
  const [rows, setRows] = useState<Editable[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [info, setInfo] = useState<string>("");

  function ingest(text: string, label: string) {
    const parsed = parseSimplifiCsv(text);
    const summaries = summarizeTransactions(parsed.transactions);
    setRows(summaries.map((s) => ({ ...s, include: true, spec: s.suggested })));
    setWarnings(parsed.warnings);
    setInfo(`${label}: ${parsed.rowCount} transactions across ${summaries[0]?.totalMonths ?? 0} months, ${summaries.length} categories. Columns: ${Object.values(parsed.columnMap).join(", ")}`);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => ingest(String(reader.result), file.name);
    reader.readAsText(file);
  }

  function apply() {
    const startAge = scenario.people[0].currentAge;
    const incomes: IncomeStream[] = rows
      .filter((r) => r.include && r.type === "income")
      .map((r, i) => ({
        id: `csv-inc-${i}`,
        name: r.category,
        amount: r.spec,
        startAge,
        endAge: scenario.retirementAge - 1,
        realGrowth: 0,
        taxable: r.category.toLowerCase().includes("paycheck") || r.category.toLowerCase().includes("salary") || r.category.toLowerCase().includes("income"),
        variability: r.variability,
      }));
    const expenses: ExpenseItem[] = rows
      .filter((r) => r.include && r.type === "expense")
      .map((r, i) => ({
        id: `csv-exp-${i}`,
        name: r.category,
        amount: r.spec,
        startAge,
        endAge: 120,
        inflationAdjust: true,
        category: r.category,
        variability: r.variability,
        discretionaryCutInDownturn: ["Dining", "Travel", "Shopping", "Entertainment"].includes(r.category) ? 0.2 : 0,
      }));
    onApply({ ...scenario, incomes: incomes.length ? incomes : scenario.incomes, expenses: expenses.length ? expenses : scenario.expenses });
    setInfo("Applied to model. Switch to the Inputs or Results tab. Set starting account balances separately (the export has no balances).");
  }

  return (
    <div className="csv-panel">
      <div className="csv-actions">
        <button className="btn" onClick={() => ingest(SAMPLE_SIMPLIFI_CSV, "Sample dataset")}>Load sample Simplifi data</button>
        <label className="btn file-btn">
          Upload Simplifi CSV
          <input type="file" accept=".csv,text/csv" onChange={onFile} hidden />
        </label>
        {rows.length > 0 && <button className="btn primary" onClick={apply}>Apply {rows.filter((r) => r.include).length} categories to model →</button>}
      </div>
      <p className="muted small">
        100% local — your file is parsed in the browser and never uploaded. Recurring items (rent, subscriptions, paychecks) are auto-detected as fixed; variable categories get a fitted distribution you can override below.
      </p>
      {info && <div className="callout">{info}</div>}
      {warnings.length > 0 && <div className="callout warn">{warnings.join(" ")}</div>}

      {rows.length > 0 && (
        <div className="csv-table">
          <div className="csv-row csv-header">
            <span>Use</span><span>Category</span><span>Type</span><span>~$/mo</span><span>Pattern</span><span>Fitted distribution (override anything)</span>
          </div>
          {rows.map((r, i) => (
            <div className="csv-row" key={r.category}>
              <input type="checkbox" checked={r.include} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))} />
              <span className="csv-cat">{r.category}</span>
              <span className={`badge ${r.type}`}>{r.type}</span>
              <span>{currency(r.monthlyMean)}</span>
              <span className={`badge ${r.recurring ? "fixed" : "variable"}`}>{r.recurring ? "recurring" : `variable (cov ${r.cov})`}</span>
              <DistributionEditor compact money value={r.spec} onChange={(spec) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, spec } : x)))} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
