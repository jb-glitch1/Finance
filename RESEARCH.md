# RESEARCH.md — Phase 0 findings, sources, and design decisions

This document grounds the application in current, authoritative numbers and
methods **as of June 2026**, records the sources, and explains what was built
and why. All tax parameters live in a single isolated module
([`src/tax/taxData.ts`](src/tax/taxData.ts)) stamped with the tax year so they
can be updated in one place.

> **Not financial advice.** This tool is educational. It is not a fiduciary and
> does not provide professional advice. Federal taxes only; state and local
> taxes are out of scope.

---

## 1. Federal tax parameters — Tax Year 2025 (returns filed early 2026)

2025 is the most recent fully-published year. Note: the **One Big Beautiful Bill
Act (OBBBA)**, signed **2025-07-04**, changed several 2025 figures (notably the
standard deduction), so the values below reflect the post-OBBBA law.

### 1.1 Ordinary income brackets (2025)

Seven rates: 10 / 12 / 22 / 24 / 32 / 35 / 37%. Top rate begins at **$626,350**
(single) and **$751,600** (MFJ). Full bracket tables for single / MFJ / HoH are
encoded in `taxData.ts`.

- Sources: [IRS — Federal income tax rates and brackets](https://www.irs.gov/filing/federal-income-tax-rates-and-brackets),
  [Tax Foundation — 2025 Tax Brackets](https://taxfoundation.org/data/all/federal/2025-tax-brackets/) (IRS Rev. Proc. 2024-40).

### 1.2 Standard deduction (2025, post-OBBBA)

| Status | Standard deduction | Additional age-65+ |
|---|---|---|
| Single | **$15,750** | +$2,000 |
| MFJ | **$31,500** | +$1,600 per qualifying spouse |
| Head of household | **$23,625** | +$2,000 |

- Sources: [Tax Foundation 2025](https://taxfoundation.org/data/all/federal/2025-tax-brackets/),
  [IRS newsroom — OBBBA / 2026 adjustments](https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill).
- *Not modeled:* the OBBBA temporary **senior bonus deduction** ($6,000, 2025–2028, phased out at higher incomes), AMT, QBI.

### 1.3 Long-term capital gains / qualified dividends (2025)

Stacked **on top of** ordinary taxable income. 0% / 15% / 20% breakpoints:

| Status | 0% up to | 15% up to | 20% above |
|---|---|---|---|
| Single | $48,350 | $533,400 | $533,400 |
| MFJ | $96,700 | $600,050 | $600,050 |
| HoH | $64,750 | $566,700 | $566,700 |

Plus the **Net Investment Income Tax (NIIT)**: 3.8% on the lesser of net
investment income or MAGI over **$200,000** (single) / **$250,000** (MFJ) —
statutory, *not* inflation-indexed.

- Sources: [IRS Topic 409](https://www.irs.gov/taxtopics/tc409),
  [NerdWallet 2025/2026 CG rates](https://www.nerdwallet.com/taxes/learn/capital-gains-tax-rates),
  IRC §1411 (NIIT).

### 1.4 Retirement contribution limits (2025)

| Account | Limit | Catch-up |
|---|---|---|
| 401(k) elective deferral | **$23,500** | +$7,500 (50+); **+$11,250 (ages 60–63, SECURE 2.0)** |
| 401(k) total (415(c)) | **$70,000** | — |
| IRA (Traditional/Roth) | **$7,000** | +$1,000 (50+) |

Roth IRA MAGI phase-out (2025): single **$150k–$165k**; MFJ **$236k–$246k**.

- Sources: [IRS — 2026 limits announcement (states 2025 comparatives)](https://www.irs.gov/newsroom/401k-limit-increases-to-24500-for-2026-ira-limit-increases-to-7500),
  [Britannica Money — 2025 limits](https://www.britannica.com/money/2025-contribution-limits-401k-ira), IRS Notice 2024-80.

### 1.5 RMDs (SECURE 2.0)

Start age: **73** for those born 1951–1959, **75** for 1960+ (was 72 pre-2023).
The penalty for a missed RMD is reduced to 25% (10% if corrected timely). Roth
401(k)s no longer have lifetime RMDs. RMD = prior 12/31 balance ÷ the **IRS
Uniform Lifetime Table** divisor (age 73 → 26.5, 74 → 25.5, 75 → 24.6, …),
encoded in full in `taxData.ts`.

- Sources: [IRS — RMD FAQs](https://www.irs.gov/retirement-plans/retirement-plan-and-ira-required-minimum-distributions-faqs),
  [Kiplinger — new RMD rules](https://www.kiplinger.com/retirement/new-rmd-rules),
  IRS Pub. 590-B Appendix B Table III.

### 1.6 Taxation of Social Security benefits (IRC §86)

Up to 85% of benefits are taxable based on "combined income." Thresholds
($25k/$34k single; $32k/$44k MFJ) are **not** inflation-indexed. Implemented in
`taxEngine.ts::taxableSocialSecurity`.

---

## 2. Social Security claiming rules

- **Full retirement age (FRA):** 66 for births 1943–1954, rising 2 months/year to
  **67 for 1960+**. (1957 → 66y6m, etc.)
- **Early claiming reduction:** 5/9 of 1% per month for the first 36 months early,
  then 5/12 of 1% per month beyond — i.e. claiming at 62 with FRA 67 → **70%** of PIA.
- **Delayed retirement credits:** **8%/year** (2/3% per month) past FRA, capped at
  age **70** → up to **124%** of PIA (FRA 67).

Encoded and unit-tested in `socialSecurity.ts` (62→0.70, 67→1.00, 70→1.24).

- Sources: [SSA — Retirement age & benefit reduction](https://www.ssa.gov/benefits/retirement/planner/agereduction.html),
  [SSA — Delayed retirement credits](https://www.ssa.gov/benefits/retirement/planner/delayret.html).

---

## 3. Monte Carlo methodology

What credible retirement research recommends, and what this engine implements:

| Technique | Why it matters | Status |
|---|---|---|
| **Multi-period, state-carrying paths** | Sequence/order of returns dominates early-retirement risk; one-shot averages hide it. | ✅ Year-by-year state machine (`simulation.ts`). |
| **Lognormal / normal parametric returns** | Simple, fast baseline. | ✅ |
| **Student-t (fat tails)** | Real markets have far more extreme years than a normal allows. | ✅ Standardized Student-t (`rng.studentT`). |
| **Historical bootstrap (IID)** | Resamples real years → true marginal distribution, skew, kurtosis. | ✅ |
| **Block bootstrap** | Preserves serial structure (momentum, mean reversion, inflation persistence) — the recommended default for sequence risk. | ✅ Circular block bootstrap, default block = 5y. |
| **Cross-asset correlation** | Stocks/bonds/inflation move together; modeling them independently misstates risk. | ✅ Bootstrap preserves joint draws; parametric uses a Cholesky stock/bond correlation. |
| **Input correlation (Gaussian copula)** | "When markets drop, cut discretionary spend." | ✅ Cholesky machinery (`correlation.ts`) + per-expense `discretionaryCutInDownturn`. |
| **Stochastic longevity** | A fixed "assume age 90" ignores tail risk; ~⅓ of 65-yr-olds live past 90. | ✅ Sampled from the SSA period life table each path. |
| **Sequence-of-returns diagnosis** | Identify the dominant risk for the user. | ✅ Advisor interprets P10 paths. |

### 3.1 Dynamic withdrawal strategies

- **4% rule (fixed real):** Bengen/Trinity baseline; spend 4% of the initial
  portfolio, inflation-adjusted. Critiqued as too rigid (overspends into crashes,
  underspends booms) and based on a specific US historical window.
- **Guyton-Klinger guardrails:** raise spending when the withdrawal rate runs cold,
  cut it when it runs hot (±20% band, ±10% adjust by default). Implemented as a
  persistent spending multiplier.
- **VPW (Variable Percentage Withdrawal):** withdraw an annuity factor of the
  *current* balance set by the remaining horizon — mechanically cannot deplete
  before the horizon, at the cost of variable income.

All three are selectable; the engine default is **guardrails**.

---

## 4. Bundled historical dataset (offline bootstrap)

[`src/data/historicalReturns.ts`](src/data/historicalReturns.ts) ships **97
years (1928–2024)** of annual total returns + inflation:

- **Stocks** = S&P 500 total return, **T-Bills** = 3-mo, **T-Bonds** = 10-yr total
  return, **Inflation** = US CPI.
- **Source:** Aswath Damodaran (NYU Stern), *"Historical Returns on Stocks, Bonds
  and Bills"*, derived from FRED — the standard long-horizon teaching dataset.
  Compiled via fetchable mirrors of his `histretSP` file and cross-checked against
  SlickCharts S&P total returns (agree to ~0.15pp). Provenance and exact URLs are
  in the file header.
- **Sanity check (verified in tests):** stock arithmetic mean ≈ **11.8%/yr**
  (min −43.8% in 1931, max +52.6% in 1954); CPI mean ≈ 3%/yr.
- **To update:** download the latest `histretSP` from Damodaran's NYU page and
  append rows.

Mortality uses an SSA-2021-anchored period life table
([`mortalityTable.ts`](src/data/mortalityTable.ts), log-linearly interpolated;
cap age 120).

---

## 5. Beyond the original spec — what credible tools include, and what I added

After reviewing what reputable planners (and the academic literature) emphasize,
I added the following beyond the original brief:

1. **Block bootstrap + Student-t**, not just lognormal — sequence risk and fat
   tails are first-order, so the default return model offers both historical and
   fat-tailed parametric options.
2. **Stochastic longevity from an actuarial table** rather than a fixed end age,
   including **last-survivor** horizon for couples.
3. **Tax-aware withdrawal sequencing** (taxable → traditional → Roth) with a
   **2-pass tax gross-up**, **RMD floors**, and **NIIT** — because pre-tax and
   after-tax dollars are not interchangeable.
4. **Guyton-Klinger guardrails and VPW**, not only the 4% rule.
5. **Tornado / sensitivity analysis** ranking which assumption drives outcome
   variance — most tools don't surface this.
6. **Trigger-point depletion curve** (P(depleted) by age) to localize *when* plans fail.
7. **Named stress scenarios** (Base / Market Crash / High Inflation / Job Loss)
   compared side by side.
8. **Optimizers** that search savings rate and stock allocation for the
   probability-maximizing setting, with the full search trace shown (no black box).
9. **Reproducibility:** a seedable RNG so any run is exactly repeatable — essential
   for a tool used for real decisions.
10. **Transparent advisor layer** (emergency fund, glide path, debt-payoff-vs-invest,
    SS claiming breakeven vs life expectancy, insurance heuristic) with **every
    assumption printed** alongside each recommendation.

### Deliberately out of scope (stated in-app)
State/local income tax (structured for future addition), AMT/QBI, the OBBBA senior
bonus deduction, account-aggregation APIs (Plaid/MX — by design, for privacy),
and any runtime network/LLM calls. Everything needed to run ships with the app.

---

## 6. Correctness — how the math is verified

The engine is tested against closed-form and hand-worked cases (`src/tests/`):

- **Annuity:** deterministic drawdown matches `Bₙ = (1+r)ⁿP₀ − W(1+r)((1+r)ⁿ−1)/r`.
- **Amortization:** payment, remaining-balance, and full-schedule match the
  standard mortgage formulas; principal sums to the original loan.
- **Tax:** single $84,250 taxable → **$13,449.00**; LTCG stacking and the 0% bracket;
  NIIT; RMD divisors; SS taxability (the $26,600 worked example).
- **Social Security:** 62 → 70%, 67 → 100%, 70 → 124%; FRA by birth year.
- **Distributions:** empirical mean/variance match theory; Student-t is fatter-tailed
  than normal and standardized to unit variance; RNG is reproducible.
- **Dataset:** 1928–2024 coverage with sane long-run averages; block bootstrap path length.
