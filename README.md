# Monte Carlo Finance — Advisor-Grade Personal-Finance Simulator

A serious, **advisor-grade** Monte Carlo planning tool for real money decisions.
It answers the questions people actually care about — *Will my money last? Will I
hit my goal? What's my net-worth trajectory? Which assumption matters most?* —
with proper sequence-of-returns modeling, a real federal tax engine, dynamic
withdrawal strategies, and stochastic longevity.

**It runs 100% in your browser. No backend. No account aggregation. No network
calls at runtime. Your financial data never leaves your machine.** It deploys as
a static site to GitHub Pages.

> ⚖️ **Not financial advice and not a fiduciary.** Educational projections under
> your stated assumptions. **Federal taxes only (tax year 2025); state & local
> taxes are out of scope.** Verify before making decisions.

---

## What it does

- **Monte Carlo engine** — multi-period, state-carrying paths (year-by-year), so
  the *sequence* and *order* of returns drive the answer (not one-shot averages).
  Default 1,000 iterations, configurable up to ~100k, run in a **Web Worker** so
  the UI never freezes. Every run is **reproducible** from its seed.
- **Questions answered** — probability money lasts to a target age; probability of
  hitting a savings goal; net-worth fan chart (P10/P50/P90); depletion-by-age
  trigger points; affordability under uncertainty.
- **Distributions, not point values** — fixed, normal, lognormal, uniform,
  triangular, **PERT**, **Student-t** (fat tails), discrete/custom; plus
  **historical** and **block bootstrap** from a bundled 1928–2024 dataset. Toggle
  any line item between fixed and stochastic. Correlate inputs (e.g. cut
  discretionary spend in downturns). **Stochastic lifespan** from an actuarial table.
- **Dynamic withdrawals** — 4% rule, **Guyton-Klinger guardrails**, and **VPW**.
- **Real federal tax engine** — marginal vs effective, short vs long-term capital
  gains (stacked), account-type awareness (taxable / traditional / Roth),
  tax-efficient withdrawal sequencing, **RMDs**, and **NIIT**. All parameters live
  in one isolated, tax-year-stamped module ([`src/tax/taxData.ts`](src/tax/taxData.ts)).
- **CSV import (Quicken Simplifi)** — auto-detects columns, robust to signed
  amounts; aggregates to monthly totals by category/account; auto-detects
  recurring vs variable items; **fits a distribution to each variable category**
  and lets you override every fit. A **synthetic sample dataset** ships so the
  demo works before you upload anything.
- **Advisor layer** — emergency-fund and insurance checks, suggested allocation &
  glide path, debt-payoff-vs-invest, Social Security claiming guidance, savings &
  allocation **optimizers**, and a plain-language interpretation of every result.
  Every assumption is printed and editable.
- **Outputs** — distribution histogram + smoothed density, full headline stats
  and percentiles, decision probabilities, **tornado/sensitivity** chart, net-worth
  **fan chart**, named **scenario comparison** (Base / Market Crash / High Inflation
  / Job Loss), interactive sliders with **live re-run**, save/load scenarios, and
  CSV + HTML summary export.

See **[RESEARCH.md](RESEARCH.md)** for the sourced tax/SS figures, the dataset
provenance, the methodology, and the design decisions.

---

## Run locally

Requires Node 18+ (20 recommended).

```bash
npm install
npm run dev        # start the dev server (Vite) — open the printed URL
npm test           # run the test suite (engine, tax, CSV, integration)
npm run build      # production build to dist/
npm run preview    # preview the production build
```

### Single-file build (no server, locked-down machines)

To get **one self-contained `.html` file** you can just double-click to open in any
browser — no install, no server, no terminal:

```bash
npm install
npm run build:single   # → dist-single/index.html  (everything inlined)
```

Open `dist-single/index.html` directly. All JS/CSS — and the simulation Web
Worker — are inlined into the page, and it works from `file://`. (If a browser
blocks blob-URL workers on `file://`, the app automatically falls back to running
the simulation on the main thread.) Nothing is uploaded; all computation and any
CSV you load stay in the page.

### Quick start in the app
1. The app loads with a realistic **Base plan** and runs automatically.
2. Go to **Import CSV → Load sample Simplifi data** to see the full
   parse → categorize → fit → apply pipeline (then upload your own export).
3. Set your **starting account balances** in **Inputs** (a transaction export has
   no balances).
4. Tune the **sliders** (retirement age, allocation, withdrawal rate, iterations)
   and watch the charts re-run live.
5. Use **Advisor** for recommendations + optimizers, and **Scenarios** to stress-test.

---

## Deploy to GitHub Pages

A workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
builds, tests, and publishes to Pages on every push to `main`/`master`.

1. In your repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Push to the default branch. The workflow sets Vite's `base` to `/<repo>/`
   automatically (for a `<user>.github.io` user/org page, set `VITE_BASE=/`).
3. The site appears at `https://<user>.github.io/<repo>/`.

The build emits a `.nojekyll` file and a `404.html` SPA fallback.

---

## Updating the tax-year data

All federal tax parameters are isolated in **[`src/tax/taxData.ts`](src/tax/taxData.ts)**,
stamped with `TAX_YEAR`. To roll to a new year:

1. Open `taxData.ts` and update the figures from the relevant **IRS revenue
   procedure** (brackets, standard deduction, LTCG breakpoints, contribution
   limits) — each block cites its source.
2. Bump `TAX_YEAR`.
3. Re-run `npm test` — the tax tests encode hand-worked examples and will flag
   anything inconsistent.

To refresh the **historical return dataset**, download the latest `histretSP`
file from [Damodaran's NYU page](https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/histretSP.html)
and append rows to `src/data/historicalReturns.ts` (format documented in the file).

---

## Architecture

```
src/
  engine/        Monte Carlo core — rng, distributions, correlation (Cholesky),
                 bootstrap, mortality, withdrawal strategies, simulation, stats,
                 sensitivity (tornado), types
  tax/           taxData.ts (isolated, year-stamped) · taxEngine · socialSecurity
  finance/       amortization (closed-form, tested)
  data/          historicalReturns (1928–2024) · mortalityTable (SSA) · sampleSimplifi
  csv/           parseSimplifi (robust) · categorize (recurring detection + fitting)
  advisor/       recommendations (transparent rules) · optimizer (savings/allocation)
  worker/        sim.worker (off-thread) · simClient (typed promise API)
  state/         defaultScenario + presets · persistence (localStorage/JSON)
  ui/            charts (hand-rolled SVG) + components + formatting + export
  tests/         distributions · tax · socialSecurity · engine · csv · integration
```

**Stack:** TypeScript + React + Vite. Heavy iteration runs in a Web Worker.
Charts are dependency-free hand-rolled SVG. No runtime network calls — the
historical dataset and life table ship with the app.

## Correctness

The engine is validated against closed-form answers and hand-worked tax cases
(`npm test`): a fixed-return annuity matches the exact drawdown formula, the
amortization schedule matches the mortgage formula, federal tax matches
hand calculations (e.g. single $84,250 taxable → $13,449.00), Social Security
claiming factors match SSA rules, and each distribution's empirical moments
match theory. See [RESEARCH.md §6](RESEARCH.md).

## License

Provided as-is for educational use. Not financial, tax, or investment advice.
