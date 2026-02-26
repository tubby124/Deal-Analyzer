# Codebase Prompt Context: Deal Analyzer
**Generated:** 2026-02-26 from CODEBASE_AUDIT_20260226.md
**Purpose:** Paste this into Claude Code at session start to load full project context

---

## Project Identity
- **What it is:** A client-side React real estate deal analyzer branded for Hasan Sharif, REALTOR® (eXp Realty)
- **What it does:** Analyzes investment and buy-vs-rent scenarios for Saskatchewan (Saskatoon) and Alberta (Calgary) real estate. Calculates CMHC, mortgage payments, NOI, cap rate, CoC, DSCR, appreciation projections, and produces a 0-100 deal score with a verdict. Saves analyses to localStorage and exports professional 3-page PDFs.
- **Who uses it:** Hasan Sharif and his real estate clients
- **Current state:** Functional MVP. Accurate math. 5 npm audit vulnerabilities. No tests. No mobile CSS. 1,529-line monolithic JSX file.

---

## Naming Conventions
- Files: PascalCase for components (`DealAnalyzer.jsx`, `Charts.jsx`)
- Components: PascalCase (`Tip`, `Row`, `Card`, `Pill`, `Metric`, `SL`, `Fd`)
- State vars: camelCase (`downPct`, `closePct`, `maintPct`, `hasOwnerUnit`)
- CSS: No class names — all inline style objects (`style={{ ... }}`)
- Shared styles: module-level constants `si` (select/input style), `ss` (select style), `ff` (font family), `fm` (mono font)
- Financial outputs: always from `a` object (result of `calc()`)

---

## Core Domain Model

```
DealAnalyzer (single component, all state)
  │
  ├── MARKETS (constant) — market config
  │     saskatoon: { taxRate, vac, growth{low/mid/high}, rents{type:$}, condoFees, hoods[] }
  │     calgary:   { taxRate, vac, growth{low/mid/high}, rents{type:$}, condoFees, hoods[] }
  │
  ├── units[] — rental + owner units
  │     { type: "2bed"|"garage"|etc, rent: "$"|"", ownerOccupied: bool }
  │
  ├── calc(gr) → a — financial result object (~40 props)
  │     Input: growth rate decimal
  │     Key outputs: down, cmhcAmt, totalMtg, moPmt, cashIn, ownMo,
  │                  egi, noi, capRate, cashFlow, coc, dscr, grm,
  │                  eq5, eq10, score, signals, verdict, vc
  │
  ├── scn — { low, mid, high } — 3 growth scenario calc results
  │
  └── savedProperties[] — localStorage snapshots
        { id, name, address, client, notes, date, mode, market, propType,
          price, downPct, rate, amYrs, closePct, curRent, units, ...overrides,
          results: {...a} }
```

---

## Domain Vocabulary

- `"owner"` mode = buying to live in. Shows rent-vs-own comparison, monthly cost.
- `"investor"` mode = investment property. Shows cap rate, cash flow, CoC, DSCR.
- `isOwner` = `mode === "owner"` — controls all mode branches throughout app
- `hasOwnerUnit` = investor mode but one unit flagged as owner-occupied (hybrid)
- `downPct` = down payment as decimal (0.05 = 5%, 0.20 = 20%)
- `cmhcR` = CMHC premium rate. 0 for pure investment or ≥20% down.
- `egi` = Effective Gross Income = `grossAnn * (1 - mk.vac)` — annual rent after vacancy
- `noi` = Net Operating Income = `egi - opex` (before mortgage)
- `cashFlow` = `noi - annMtg` (after mortgage)
- `coc` = Cash-on-cash = `cashFlow / cashIn`
- `dscr` = Debt Service Coverage = `noi / annMtg`. Banks want ≥1.25.
- `cashIn` = `down + closing` — total upfront cash
- `NC` = Non-Conforming basement suite (no full legal requirements, common in SK)
- `maintPct` = maintenance as % of EGI (not gross — applied post-vacancy)
- `mk` = `MARKETS[market]` — current market config shorthand

---

## The Golden Path (how new features are added)

**To add a new input field:**
1. Add `useState` hook at lines 136-166
2. Use it inside `calc()` (lines 186-409)
3. Add to `calc()` dependency array (line 409)
4. Add UI input in appropriate section of JSX (owner vs investor conditional)
5. Add to `saveProperty` data object (lines 468-485)
6. Add to `loadProperty` restore logic (lines 501-538)
7. Add to PDF export if relevant (lines 540-893)

**To add a new market:**
```js
// In MARKETS object (lines 4-37)
newcity: {
  label: "City, Province",
  taxRate: 0.012,
  vac: 0.05,
  growth: { low: 0.02, mid: 0.04, high: 0.06 },
  rents: { bachelor: 950, "1bed": 1200, "2bed": 1450, /* all unit types */ },
  condoFees: 350,
  hoods: [
    { n: "Neighbourhood Name", t: "A", p: 400000, g: 0.05, desc: "Description" }
  ]
}
// Dropdown auto-populates via Object.entries(MARKETS)
```

**To add a new tab:**
```js
// 1. Add to tab pills array (~line 930):
["newtab", "Tab Label"]

// 2. Add conditional render after existing tab blocks:
{tab === "newtab" && (
  <>
    {/* content */}
  </>
)}
```

---

## API Pattern

No API. No HTTP calls. All logic is synchronous JavaScript in `calc()`.

The pattern for accessing calculated values in JSX:
```jsx
// Always use `a.propertyName` for current results
{a.capRate > 0 && <Row label="Cap Rate" val={pct(a.capRate)} tip="capRate" />}

// Use formatters:
$(amount)   // CAD currency, no cents: "$280,000"
$2(amount)  // CAD currency, 2 decimals: "$1,506.50"
pct(rate)   // 2 decimal percent: "5.25%"
pct1(rate)  // 1 decimal percent: "5.3%"
```

---

## Financial Math Pattern

```js
// Mortgage payment (standard annuity)
function mortgagePayment(prin, annRate, yrs) {
  const r = annRate / 12, n = yrs * 12;
  if (r === 0) return prin / n;
  return prin * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

// CMHC lookup
const CMHC = [
  { lo: 5, hi: 9.99, r: 0.04 },    // 5-9.99% down → 4% premium
  { lo: 10, hi: 14.99, r: 0.031 }, // 10-14.99% → 3.1%
  { lo: 15, hi: 19.99, r: 0.028 }, // 15-19.99% → 2.8%
  { lo: 20, hi: 100, r: 0 }        // 20%+ → no CMHC
];
// Only applies if: priceNum <= 1500000 AND downPct < 0.20 AND (isOwner OR hasOwnerUnit)

// Cap rate
const capRate = priceNum > 0 ? noi / priceNum : 0;

// Cash-on-cash
const coc = cashIn > 0 ? cashFlow / cashIn : 0;

// DSCR
const dscr = annMtg > 0 ? noi / annMtg : 0;
```

---

## Error Handling Pattern

No try/catch in financial logic — division-by-zero is handled inline:
```js
const capRate = priceNum > 0 ? noi / priceNum : 0;
const coc = cashIn > 0 ? cashFlow / cashIn : 0;
const dscr = annMtg > 0 ? noi / annMtg : 0;
const grm = grossAnn > 0 ? priceNum / grossAnn : 0;
```

Load property has try/catch (line 503-537):
```js
try {
  setMode(prop.mode || 'owner');
  // ... all state setters
} catch (error) {
  console.error('Error loading property:', error);
  alert('Error loading property: ' + error.message);
}
```

localStorage init has NO try/catch — potential crash point:
```js
// Line 158-161 — MISSING try/catch:
const [savedProperties, setSavedProperties] = useState(() => {
  const saved = localStorage.getItem('dealAnalyzerProperties');
  return saved ? JSON.parse(saved) : []; // JSON.parse can throw
});
```

---

## All External Services

| Service | Purpose | Env Vars | Notes |
|---------|---------|----------|-------|
| Google Fonts CDN | Outfit + JetBrains Mono | None | Inline `<link>` in JSX render — should move to index.html |
| Browser localStorage | Save/load properties | None | Key: `dealAnalyzerProperties` |

No APIs, no secrets, no environment variables anywhere in the codebase.

---

## All AI/LLM Prompts Currently In Use

NONE. No AI/LLM integration.

---

## Critical Gotchas

1. **The entire app is one component.** `DealAnalyzer.jsx` is 1,529 lines. There are no child components except the Charts. All state, all logic, all UI is in one place. When searching for something, search this file first — it's almost certainly there.

2. **`calc()` runs 4 times per render.** The `scn` useMemo calls `calc()` three times (low, mid, high) plus the main `a` call. The `calc()` function has a 20-variable dependency array. This is intentional and correct but means debugging: changing any input triggers 4 full calc runs.

3. **`var` inside if/else blocks** at lines 237-244 and 276-282. These `var` declarations are hoisted — they work but are a gotcha if you refactor those blocks. `moUtilitiesOwner` and `utilCostMo` are declared with `var` inside if/else branches.

4. **Price, rate, curRent are STRINGS (not numbers).** They're stored as strings to allow smooth typing in `<input>`. Inside `calc()`, they're parsed: `parseFloat(price) || 280000`. Don't pass them as numbers to UI components expecting strings.

5. **`hasOwnerUnit` is declared TWICE** — once at component scope (line 183) for render logic, and once inside `calc()` (line 196) for financial calculations. They compute the same thing but are separate. The inner one returns on the `a` object as `a.hasOwnerUnit`.

6. **Google Fonts loaded inside JSX body** (line 897): `<link href="https://fonts.googleapis.com/..." />` is rendered inside the component, not in `<head>`. This works but causes a brief FOUT (Flash of Unstyled Text) and re-renders incorrectly on hot reload.

7. **Maintenance % is applied to EGI (post-vacancy), not gross rent.** This means: if vacancy reduces income, maintenance budget also drops. This is technically correct (less rent = less wear) but unusual — most investors budget maintenance on gross rent.

8. **cashFlowChartData is flat.** The 10-year cash flow chart shows the same value repeated 10 times. It does NOT project forward with rent increases. This is a known bug to fix.

9. **PDF export is dynamically imported** — jsPDF and autotable are loaded on first click. First export has a 1-2 second delay. Subsequent exports are fast (cached).

10. **No mobile CSS.** The app uses fixed pixel gaps and flex layouts that break on phones under ~768px width. Desktop/tablet only.

---

## What This Codebase Is NOT

- "There's a backend" → WRONG. Zero server, zero API calls, zero database. Pure browser app.
- "localStorage will sync across devices" → WRONG. Data is local to the browser + device only.
- "TypeScript is used" → WRONG. Plain JSX only. No type safety.
- "Charts are tested" → WRONG. Zero test files exist.
- "The roadmap features are implemented" → PARTIALLY WRONG. ROADMAP.md lists charts, save/compare, PDF as "pending" — they're actually all implemented. Roadmap is stale.
- "The cash flow chart shows projections" → WRONG. It shows the same annual figure repeated 10 times.
- "5% down works for investment properties in Canada" → WRONG for conventional lenders. Works with private/alt lenders. The app now shows it as "scenario analysis" with a note.

---

## Quick Start for New Session

> You are working on **Deal Analyzer** — a client-side real estate analysis tool for Hasan Sharif, REALTOR® (eXp Realty SK/AB).
>
> **Key facts:**
> - Stack: React 18 + Vite 5 + Recharts + jsPDF, no backend, no API
> - Working directory: `/Users/owner/Deal-Analyzer`
> - Entry point: `src/main.jsx` → `src/DealAnalyzer.jsx` (1,529 lines — entire app)
> - Charts: `src/Charts.jsx` (167 lines, 5 Recharts components)
> - DB: Browser localStorage only (`dealAnalyzerProperties` key)
> - Auth: NONE — anonymous single-user tool
> - Naming: camelCase state, PascalCase components, inline CSS-in-JS
> - Critical gotcha: `calc()` runs 4x per state change; `price`/`rate`/`curRent` are strings not numbers
> - 5 npm audit vulnerabilities: run `npm audit fix` first (safe), then evaluate `--force` for jsPDF
>
> See `CODEBASE_AUDIT_20260226.md` for full context.

---

## Top 5 Improvements (Ranked by Impact × Effort)

| # | What to do | Why | Impact | Effort |
|---|------------|-----|--------|--------|
| 1 | Run `npm audit fix` + plan jsPDF upgrade | CRITICAL vuln (DOMPurify XSS) + HIGH vuln (Rollup path traversal) | HIGH | LOW/MED |
| 2 | Fix cashFlowChartData to project 10yr with rent growth | Chart currently shows flat line — misleading to clients | HIGH | MEDIUM |
| 3 | Add localStorage export/import (JSON backup button) | Users lose all saved properties on browser clear — no recovery | HIGH | MEDIUM |
| 4 | Add mobile responsive CSS breakpoints | App is unusable on phones; agents use phones | HIGH | HIGH |
| 5 | Remove console.log (lines 502, 533) + wrap localStorage in try/catch | Data exposure + crash risk on corrupted storage | MEDIUM | LOW |
