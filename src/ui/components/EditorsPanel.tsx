import type { Scenario, Account, Debt, IncomeStream, ExpenseItem, AccountType } from "../../engine/types";
import type { FilingStatus } from "../../tax/taxData";
import { FILING_STATUS_LABELS } from "../../tax/taxData";
import { DistributionEditor } from "./DistributionEditor";
import { currency } from "../format";

interface Props {
  scenario: Scenario;
  onChange: (s: Scenario) => void;
}

let idCounter = 1000;
const newId = (p: string) => `${p}-${idCounter++}`;

export function EditorsPanel({ scenario, onChange }: Props) {
  const set = (patch: Partial<Scenario>) => onChange({ ...scenario, ...patch });

  return (
    <div className="editors">
      <Section title="Household & filing">
        <div className="field-row">
          <label className="field">
            <span>Filing status</span>
            <select value={scenario.filingStatus} onChange={(e) => set({ filingStatus: e.target.value as FilingStatus })}>
              {(Object.keys(FILING_STATUS_LABELS) as FilingStatus[]).map((k) => (
                <option key={k} value={k}>
                  {FILING_STATUS_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Retirement age (primary)</span>
            <input type="number" value={scenario.retirementAge} onChange={(e) => set({ retirementAge: +e.target.value })} />
          </label>
        </div>
        {scenario.people.map((p, i) => (
          <div className="grid-row people-row" key={i}>
            <input value={p.name} onChange={(e) => updatePerson(i, { name: e.target.value })} />
            <NumCol label="age" v={p.currentAge} on={(n) => updatePerson(i, { currentAge: n })} />
            <NumCol label="birth yr" v={p.birthYear} on={(n) => updatePerson(i, { birthYear: n })} />
            <label className="field">
              <span>sex</span>
              <select value={p.sex} onChange={(e) => updatePerson(i, { sex: e.target.value as "male" | "female" | "blended" })}>
                <option value="female">female</option>
                <option value="male">male</option>
                <option value="blended">blended</option>
              </select>
            </label>
            <NumCol label="SS PIA/yr" v={p.socialSecurityPIA} on={(n) => updatePerson(i, { socialSecurityPIA: n })} />
            <NumCol label="claim age" v={p.claimAge} on={(n) => updatePerson(i, { claimAge: n })} />
            {scenario.people.length > 1 && (
              <button className="icon-btn" onClick={() => set({ people: scenario.people.filter((_, j) => j !== i) })}>
                ✕
              </button>
            )}
          </div>
        ))}
        <button className="add-btn" onClick={() => set({ people: [...scenario.people, { name: "Person", currentAge: 45, birthYear: 1981, sex: "blended", socialSecurityPIA: 0, claimAge: 67 }] })}>
          + Add person
        </button>
      </Section>

      <Section title="Accounts (starting balances)">
        <div className="table-head accounts-row">
          <span>Name</span><span>Type</span><span>Balance</span><span>Cost basis</span><span>Stocks</span><span>Bonds</span><span>Cash</span><span />
        </div>
        {scenario.accounts.map((a, i) => (
          <div className="grid-row accounts-row" key={a.id}>
            <input value={a.name} onChange={(e) => updateAccount(i, { name: e.target.value })} />
            <select value={a.type} onChange={(e) => updateAccount(i, { type: e.target.value as AccountType })}>
              {(["taxable", "traditional", "roth", "cash"] as AccountType[]).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="number" value={a.balance} onChange={(e) => updateAccount(i, { balance: +e.target.value })} />
            <input type="number" value={a.costBasis ?? 0} onChange={(e) => updateAccount(i, { costBasis: +e.target.value })} disabled={a.type !== "taxable"} />
            <input type="number" step="0.05" value={a.allocation.stocks} onChange={(e) => updateAlloc(i, "stocks", +e.target.value)} />
            <input type="number" step="0.05" value={a.allocation.bonds} onChange={(e) => updateAlloc(i, "bonds", +e.target.value)} />
            <input type="number" step="0.05" value={a.allocation.cash} onChange={(e) => updateAlloc(i, "cash", +e.target.value)} />
            <button className="icon-btn" onClick={() => set({ accounts: scenario.accounts.filter((_, j) => j !== i) })}>✕</button>
          </div>
        ))}
        <button className="add-btn" onClick={() => set({ accounts: [...scenario.accounts, { id: newId("acc"), name: "New account", type: "taxable", balance: 0, costBasis: 0, allocation: { stocks: 0.6, bonds: 0.3, cash: 0.1 } }] })}>
          + Add account
        </button>
        <div className="muted small">Total invested + cash: {currency(scenario.accounts.reduce((s, a) => s + a.balance, 0))}</div>
      </Section>

      <Section title="Debts">
        <div className="table-head debts-row">
          <span>Name</span><span>Kind</span><span>Balance</span><span>APR</span><span>Min/mo</span><span>Extra/mo</span><span />
        </div>
        {scenario.debts.map((d, i) => (
          <div className="grid-row debts-row" key={d.id}>
            <input value={d.name} onChange={(e) => updateDebt(i, { name: e.target.value })} />
            <select value={d.kind} onChange={(e) => updateDebt(i, { kind: e.target.value as Debt["kind"] })}>
              {(["mortgage", "student", "auto", "credit", "other"] as Debt["kind"][]).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <input type="number" value={d.balance} onChange={(e) => updateDebt(i, { balance: +e.target.value })} />
            <input type="number" step="0.005" value={d.annualRate} onChange={(e) => updateDebt(i, { annualRate: +e.target.value })} />
            <input type="number" value={d.minPayment} onChange={(e) => updateDebt(i, { minPayment: +e.target.value })} />
            <input type="number" value={d.extraPayment ?? 0} onChange={(e) => updateDebt(i, { extraPayment: +e.target.value })} />
            <button className="icon-btn" onClick={() => set({ debts: scenario.debts.filter((_, j) => j !== i) })}>✕</button>
          </div>
        ))}
        <button className="add-btn" onClick={() => set({ debts: [...scenario.debts, { id: newId("debt"), name: "New debt", kind: "credit", balance: 0, annualRate: 0.18, minPayment: 50 }] })}>
          + Add debt
        </button>
      </Section>

      <Section title="Income streams">
        {scenario.incomes.map((inc, i) => (
          <div className="stacked-row" key={inc.id}>
            <div className="grid-row income-head">
              <input value={inc.name} onChange={(e) => updateIncome(i, { name: e.target.value })} />
              <NumCol label="start age" v={inc.startAge} on={(n) => updateIncome(i, { startAge: n })} />
              <NumCol label="end age" v={inc.endAge} on={(n) => updateIncome(i, { endAge: n })} />
              <NumCol label="real growth" v={inc.realGrowth} on={(n) => updateIncome(i, { realGrowth: n })} step={0.005} />
              <label className="field check"><span>taxable</span><input type="checkbox" checked={inc.taxable} onChange={(e) => updateIncome(i, { taxable: e.target.checked })} /></label>
              <button className="icon-btn" onClick={() => set({ incomes: scenario.incomes.filter((_, j) => j !== i) })}>✕</button>
            </div>
            <DistributionEditor money value={inc.amount} onChange={(amount) => updateIncome(i, { amount })} />
          </div>
        ))}
        <button className="add-btn" onClick={() => set({ incomes: [...scenario.incomes, { id: newId("inc"), name: "New income", amount: { kind: "fixed", value: 50000 }, startAge: scenario.people[0].currentAge, endAge: scenario.retirementAge - 1, realGrowth: 0.01, taxable: true, variability: "fixed" }] })}>
          + Add income
        </button>
      </Section>

      <Section title="Expenses">
        {scenario.expenses.map((ex, i) => (
          <div className="stacked-row" key={ex.id}>
            <div className="grid-row expense-head">
              <input value={ex.name} onChange={(e) => updateExpense(i, { name: e.target.value })} />
              <NumCol label="start age" v={ex.startAge} on={(n) => updateExpense(i, { startAge: n })} />
              <NumCol label="end age" v={ex.endAge} on={(n) => updateExpense(i, { endAge: n })} />
              <label className="field check"><span>inflation-adj</span><input type="checkbox" checked={ex.inflationAdjust} onChange={(e) => updateExpense(i, { inflationAdjust: e.target.checked })} /></label>
              <NumCol label="cut in crash" v={ex.discretionaryCutInDownturn ?? 0} on={(n) => updateExpense(i, { discretionaryCutInDownturn: n })} step={0.05} />
              <button className="icon-btn" onClick={() => set({ expenses: scenario.expenses.filter((_, j) => j !== i) })}>✕</button>
            </div>
            <DistributionEditor money value={ex.amount} onChange={(amount) => updateExpense(i, { amount })} />
          </div>
        ))}
        <button className="add-btn" onClick={() => set({ expenses: [...scenario.expenses, { id: newId("exp"), name: "New expense", amount: { kind: "fixed", value: 12000 }, startAge: scenario.people[0].currentAge, endAge: 120, inflationAdjust: true, category: "Other", variability: "fixed" }] })}>
          + Add expense
        </button>
      </Section>
    </div>
  );

  function updatePerson(i: number, patch: Partial<Scenario["people"][number]>) {
    set({ people: scenario.people.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  }
  function updateAccount(i: number, patch: Partial<Account>) {
    set({ accounts: scenario.accounts.map((a, j) => (j === i ? { ...a, ...patch } : a)) });
  }
  function updateAlloc(i: number, key: "stocks" | "bonds" | "cash", v: number) {
    set({ accounts: scenario.accounts.map((a, j) => (j === i ? { ...a, allocation: { ...a.allocation, [key]: v } } : a)) });
  }
  function updateDebt(i: number, patch: Partial<Debt>) {
    set({ debts: scenario.debts.map((d, j) => (j === i ? { ...d, ...patch } : d)) });
  }
  function updateIncome(i: number, patch: Partial<IncomeStream>) {
    set({ incomes: scenario.incomes.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  }
  function updateExpense(i: number, patch: Partial<ExpenseItem>) {
    set({ expenses: scenario.expenses.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="editor-section" open>
      <summary>{title}</summary>
      <div className="editor-body">{children}</div>
    </details>
  );
}

function NumCol({ label, v, on, step }: { label: string; v: number; on: (n: number) => void; step?: number }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="number" step={step ?? "any"} value={v} onChange={(e) => on(parseFloat(e.target.value))} />
    </label>
  );
}
