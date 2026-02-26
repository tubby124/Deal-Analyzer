# Codebase Audit: Deal Analyzer
**Generated:** 2026-02-26
**Audited by:** Claude Code (Sonnet 4.6)
**Git branch:** main
**Last commit:** a4fd99b — Allow 5%/10% down scenarios in investor mode with educational context
**Working directory:** /Users/owner/Deal-Analyzer

---

## Executive Summary

Deal Analyzer is a client-side-only React/Vite single-page application that performs real estate investment and buy-vs-rent analysis for Saskatchewan and Alberta markets (Saskatoon, Calgary). It is a branded tool for Hasan Sharif, REALTOR® (eXp Realty), with PDF export, localStorage-based saved properties, and Recharts visualizations. The app has no backend, no authentication, and no external API calls — everything runs in the browser.

The codebase is functional and produces accurate financial calculations (CMHC, amortization, NOI, cap rate, CoC, DSCR, scoring). However, it has **5 npm audit vulnerabilities** including a HIGH-severity Rollup path traversal and a CRITICAL DOMPurify XSS (via jsPDF dependency) that must be patched. The app is a single 1,529-line monolithic component with `var` scoping bugs in the calc engine, two `console.log` statements left in production, and a ~600KB unoptimized bundle. The most important thing to know before working on this code: **the entire app lives in one file (`DealAnalyzer.jsx`). There are no routes, no API calls, no server. All business logic is in the `calc()` function. Everything renders from the `a` object it returns.**

---

## 1. Project Structure

```
/Users/owner/Deal-Analyzer/
├── .gitignore                    # node_modules, dist, .DS_Store
├── CODEBASE.md                   # Developer reference (good, up to date)
├── IMPROVEMENTS.md               # Feature improvement ideas
├── README.md                     # General readme
├── ROADMAP.md                    # Feature roadmap (some items already complete)
├── UX-CRITICAL-IMPROVEMENTS.md  # UX priority list
├── WHATS-NEW.md                  # Changelog
├── index.html                    # HTML shell — <div id="root">, imports /src/main.jsx
├── package.json                  # Dependencies & scripts
├── package-lock.json             # Lock file
├── vite.config.js                # Vite config with @vitejs/plugin-react
└── src/
    ├── main.jsx                  # Entry: ReactDOM.createRoot → <DealAnalyzer />
    ├── DealAnalyzer.jsx          # ALL app logic — 1,529 lines, single component
    └── Charts.jsx                # 5 Recharts components (167 lines)
```

**No CI/CD.** No Dockerfile. No .env files. No environment variables at all — everything is hardcoded constants. No `.github/workflows/`. No test files. No linter config (`eslint`, `prettier`). The `dist/` folder exists (pre-built) but is gitignored.

**Git state:** 2 commits on `main`. Clean working tree. Only one branch.

---

## 2. Tech Stack

| Layer          | Technology            | Version    | Config File       | Notes/Gotchas |
|----------------|-----------------------|------------|-------------------|---------------|
| Runtime        | Browser (client-only) | N/A        | N/A               | No server — zero backend |
| Framework      | React                 | ^18.2.0    | package.json      | StrictMode enabled in main.jsx |
| Language       | JavaScript (JSX)      | ES2022+    | vite.config.js    | No TypeScript. No JSDoc. |
| Database       | NOT IMPLEMENTED       | —          | —                 | localStorage for save/load only (~5-10MB limit) |
| Auth           | NOT IMPLEMENTED       | —          | —                 | No login, no user accounts |
| Hosting        | UNKNOWN               | —          | —                 | No deployment config found. Static site deployable anywhere. |
| Styling        | Inline CSS-in-JS      | —          | —                 | All styles are inline JS objects. ~40% of file size. No CSS files. |
| State Mgmt     | React useState        | —          | DealAnalyzer.jsx  | 22 useState hooks in one component |
| API Layer      | NOT IMPLEMENTED       | —          | —                 | No API calls anywhere |
| Automation     | NOT IMPLEMENTED       | —          | —                 | No workflows |
| Testing        | NOT IMPLEMENTED       | —          | —                 | Zero test files. No test framework. |
| Linting        | NOT IMPLEMENTED       | —          | —                 | No ESLint, no Prettier config |
| Error Tracking | NOT IMPLEMENTED       | —          | —                 | No Sentry/Datadog. Only `console.error` for load errors. |
| Analytics      | NOT IMPLEMENTED       | —          | —                 | No GA/Plausible/PostHog |
| Email/Comms    | NOT IMPLEMENTED       | —          | —                 | PDF export only |
| File Storage   | Browser localStorage  | —          | DealAnalyzer.jsx  | Key: `dealAnalyzerProperties` |
| AI/LLM         | NOT IMPLEMENTED       | —          | —                 | No LLM integration |
| Payments       | NOT IMPLEMENTED       | —          | —                 | No billing |
| Charts         | Recharts              | ^3.7.0     | package.json      | 5 chart components in Charts.jsx |
| PDF Generation | jsPDF + autotable     | ^2.5.2     | package.json      | Dynamically imported. DOMPurify XSS vulnerability via jsPDF. |
| Build Tool     | Vite                  | ^5.0.0     | vite.config.js    | HIGH/CRITICAL npm audit vulnerabilities in Rollup + esbuild (dev only) |

### npm audit results — 5 VULNERABILITIES:

| Severity | Package    | Issue | Fix |
|----------|------------|-------|-----|
| CRITICAL | dompurify < 3.2.4 | XSS — DOMPurify allows cross-site scripting | `npm audit fix --force` (breaks jsPDF API) |
| HIGH     | rollup 4.0.0-4.58.0 | Arbitrary file write via path traversal | `npm audit fix` |
| MODERATE | esbuild ≤ 0.24.2 | Dev server allows any website to read responses | `npm audit fix --force` (dev only) |
| MODERATE | vite 0.11.0-6.1.6 | Depends on vulnerable esbuild | Same fix |
| MODERATE | jspdf ≤ 4.1.0 | Depends on vulnerable dompurify | Fix with `npm audit fix --force` |

---

## 3. Architecture & Data Flow

### 3A — User-Facing Flows

**Flow: Core Property Analysis**
```
Entry: Browser opens index.html
Component chain: main.jsx → <DealAnalyzer />
  ↓ User changes any input (price, downPct, rate, mode, units, etc.)
  ↓ useState setter fires → React re-renders
  ↓ calc(baseGr) recomputes via useCallback
  ↓ a = useMemo(() => calc(baseGr)) updates
  ↓ scn = useMemo({low, mid, high scenarios}) updates (3 calc() calls)
  ↓ UI renders from `a.propertyName` values
  ↓ Charts receive memoized data arrays
API calls: NONE
DB ops: NONE
External calls: Google Fonts CDN (Outfit, JetBrains Mono) — loaded in JSX via <link>
State changes: 22 useState hooks, all in DealAnalyzer component
Error states: Division by zero guarded with ternaries (e.g., `cashIn > 0 ? cashFlow / cashIn : 0`)
```

**Flow: Save Property**
```
Entry: User clicks 💾 Save button
  → openSaveModal() → setShowSaveModal(true) + pre-fills saveName
  → Modal shown. User fills name/address/client/notes.
  → saveProperty() called
  → Builds propertyData object with all current state + calc results snapshot
  → [...savedProperties, propertyData] → setSavedProperties + localStorage.setItem
  → Modal closes
```

**Flow: Load Saved Property**
```
Entry: User clicks saved card in "Saved" tab
  → loadProperty(prop) called
  → All 22 state setters called in sequence with prop values
  → console.log fires (debug statement — left in production)
  → setTab("main") — switches to main tab
  → calc() recomputes with loaded values
```

**Flow: PDF Export**
```
Entry: User clicks 📄 Export PDF
  → exportToPDF() — async function
  → Dynamic import: jsPDF + jspdf-autotable
  → Builds 3-page PDF manually (no HTML rendering — pure jsPDF API)
  → Page 1: Header, key metrics table, deal signals
  → Page 2: Financial analysis, down payment scenarios table
  → Page 3: 5yr/10yr projections, amortization, watermark
  → doc.save() triggers browser download
```

### 3B — Architecture

No backend. No routes. No middleware. Single component tree:

```
index.html
  └── main.jsx
        └── <DealAnalyzer /> (everything)
              ├── calc() — financial engine (useCallback, ~230 lines)
              ├── a = useMemo (main result object, ~40 properties)
              ├── scn = useMemo (3 growth scenarios)
              ├── equityChartData, paymentPieData, cashFlowChartData (useMemo)
              ├── openSaveModal, saveProperty, deleteProperty, loadProperty, exportToPDF (useCallback)
              └── JSX render (tabs: main, projection, areas, saved + save modal)
                    └── <EquityBuildingChart>, <MonthlyPaymentPie>, <CashFlowChart>,
                        <RentVsOwnChart>, <ROIGauge> (from Charts.jsx)
```

### 3C — External Integrations

| Service | Purpose | Auth | Notes |
|---------|---------|------|-------|
| Google Fonts CDN | Outfit + JetBrains Mono fonts | None | Loaded inline in JSX via `<link>`. Fails silently if offline. |

No other external integrations. No env vars. No API keys.

### 3D — Automation

NOT IMPLEMENTED.

---

## 4. Database Schema

**No database.** Data persisted only in browser `localStorage`.

**Key:** `dealAnalyzerProperties`
**Type:** JSON array
**Size limit:** ~5-10MB (browser-dependent)

### Saved Property Object Schema:
```js
{
  id: Number,              // Date.now() timestamp — serves as unique ID
  name: String,            // User-chosen label
  address: String,         // Optional
  client: String,          // Optional client/buyer name
  notes: String,           // Optional freeform notes
  date: String,            // toLocaleDateString() — locale-dependent, not ISO
  mode: "owner" | "investor",
  market: "saskatoon" | "calgary",
  propType: "condo" | "detached" | "duplex" | "multi",
  price: Number,           // Parsed float (not string like state)
  downPct: Number,         // 0.05-0.25
  rate: Number,            // Parsed float
  amYrs: Number,           // 25 or 30
  closePct: Number,        // 0.01-0.05
  curRent: Number,         // Parsed float
  units: Array<{type, rent, ownerOccupied}>,
  taxOvr: String,
  condoOvr: String,
  insurance: String,
  utilElectric: String,
  utilWater: String,
  utilGas: String,
  heatingType: "gas" | "electric" | "baseboard",
  tenantUtils: Boolean,
  maintPct: Number,
  growthOvr: String,
  results: Object          // Full snapshot of calc() output (~40 properties)
}
```

**Backup strategy:** NONE. Browser storage only. Cleared on browser data wipe.
**Connection pooling:** N/A.
**Migrations:** N/A — no schema versioning. If a new field is added to state, old saved properties won't have it; `loadProperty` uses `|| default` fallbacks for backward compat.

---

## 5. Key Files & Business Logic

### 5A — main.jsx (9 lines)
Entry point. Renders `<DealAnalyzer />` inside `React.StrictMode`. Nothing else.

### 5B — DealAnalyzer.jsx (1,529 lines) — THE ENTIRE APP

**Lines 1-37: MARKETS constant**
Hardcoded market data for Saskatoon and Calgary. Contains: label, taxRate, vacancy rate, growth scenarios (low/mid/high), rent defaults by unit type, condo fees, and neighborhood arrays.

```js
// Saskatoon tax rate: 1.35% | Calgary: 0.68%
// Saskatoon vacancy: 5% | Calgary: 6%
// Saskatoon growth: 2%/4%/6% | Calgary: 1.5%/3.5%/5.5%
```

**Lines 39-63: Financial math helpers**
- `CMHC` — premium tiers: 5-9.99% → 4%, 10-14.99% → 3.1%, 15-19.99% → 2.8%, 20%+ → 0%
- `getCmhcRate(pctDown)` — looks up CMHC tier
- `mortgagePayment(prin, annRate, yrs)` — standard annuity formula; handles rate=0 edge case
- `amortSchedule(prin, annRate, amYrs, holdYrs)` — iterates month-by-month to compute principal, interest, balance over `holdYrs`
- `$()`, `$2()`, `pct()`, `pct1()` — CAD currency/percent formatters

**Lines 65-82: TIPS dictionary**
Tooltip text keyed by metric name (capRate, coc, dscr, grm, noi, equity, cmhc, princ, moCost, appr, vac, maint, cf, rvb, ownerMaint, insurance).

**Lines 84-134: Micro UI components**
- `Tip` — tooltip wrapper (hover/click to show, absolute positioned)
- `Row` — label + value display row with optional tip
- `Card` — dark background box with 12px border radius
- `Pill` — toggle button (active/inactive states)
- `Metric` — 4-up metric card (green/red based on `good` prop)
- `SL` — section label (uppercase, spaced, dim)
- `Fd` — form field wrapper with label

**Lines 136-167: State variables (22 useState hooks)**
All documented in Section 2 above.

**Lines 186-409: `calc(gr)` function — THE FINANCIAL ENGINE**

Input: `gr` (growth rate decimal)
Output: Object with ~40 properties

Critical logic flow:
1. Parse string inputs → numbers with defaults
2. CMHC logic: if owner/hasOwnerUnit AND price ≤ $1.5M AND down < 20% → apply CMHC; else if pure investor → cmhcR=0, set showInvestmentWarning
3. Monthly mortgage payment via annuity formula
4. Utility costs (owner mode) with heating type multipliers
5. Rental income → EGI (after vacancy) → NOI → cap rate → cash flow → CoC → DSCR
6. Amortization schedules for 5yr and 10yr
7. Appreciation projections (v5, v10, eq5, eq10)
8. Scoring system (0-100) with signal generation
9. Verdict string and color

⚠️ **Bug:** `var moUtilitiesOwner` and `var utilCostMo` declared inside if/else blocks using `var` (not `let/const`). While this works due to var hoisting, it's a known antipattern and the basis of the "Known Issues" note in CODEBASE.md.

**Lines 411-413: useMemo wrappers**
```js
const a = useMemo(() => calc(baseGr), [calc, baseGr]);
const scn = useMemo(() => growthOvr ? null : { low: calc(mk.growth.low), mid: a, high: calc(mk.growth.high) }, [...]);
```
`calc()` runs up to 4 times on every input change (main + 3 scenarios). Acceptable for this scale.

**Lines 415-456: Derived data for display**
Header stats array, chart data arrays (equity 10yr, payment pie, cash flow 10yr), all via useMemo.

⚠️ **Bug:** `cashFlowChartData` (lines 447-456) pushes the same `a.cashFlow` value for every year 1-10. It does NOT model rent increases, expense changes, or appreciation-linked income over time. The "10-Year Cash Flow" chart shows a flat line, which is misleading.

**Lines 458-538: Save / Delete / Load property**
- `openSaveModal` — pre-fills modal
- `saveProperty` — builds data object, appends to array, localStorage.setItem
- `deleteProperty` — filters array, localStorage.setItem
- `loadProperty` — sets all 22 state variables from saved prop; includes backward-compat for `ownerOccupied` field

⚠️ **Debug statements left in:** Lines 502 (`console.log('Loading property:', prop)`) and 533 (`console.log('Property loaded successfully!')`) — these log to browser console in production.

**Lines 540-893: PDF Export (exportToPDF)**
Async function, dynamically imports jsPDF and autotable. Generates a 3-page professional PDF:
- Page 1: Logo/branding, verdict, key metrics autotable, deal signals
- Page 2: Financial breakdown, down payment comparison table
- Page 3: Projections, amortization tables, eXp Realty watermark, disclaimer, footer with contact info

Branded footer: "Hasan Sharif, REALTOR® | eXp Realty | (306) 850-7687 | hasan.sharif@exprealty.com"

**Lines 895-1529: JSX render tree**

| Lines | Content |
|-------|---------|
| 895-916 | App shell (dark bg), header, mode toggle pills |
| 917-936 | Verdict/score banner, tab bar |
| 938-1366 | "main" tab: inputs, property type, financing row, utilities, rental units, metrics grid, charts, down payment comparison |
| 1368-1431 | "projection" tab: appreciation scenarios, 5yr/10yr cards |
| 1433-1438 | "areas" tab: neighborhood cards |
| 1439-1473 | "saved" tab: saved property grid |
| 1474-1529 | Save modal, disclaimer footer |

### 5C — Charts.jsx (167 lines)

Five Recharts components with hardcoded dark theme colors:

| Component | Props | Output |
|-----------|-------|--------|
| `EquityBuildingChart` | `data[]` {year, value, equity} | 10yr line chart |
| `MonthlyPaymentPie` | `data[]` {name, value, color} | Donut chart |
| `CashFlowChart` | `data[]` {year, cashflow} | Bar chart (colored by positive/negative) |
| `RentVsOwnChart` | rentTotal, ownTotal, equityGain | Horizontal bar comparison |
| `ROIGauge` | roi (decimal) | SVG semicircle gauge (0-15%) |

**Note:** `ROIGauge` receives `roi` prop but the gauge maxes at 15% (`Math.min(Math.max(roi * 100, 0), 15)`). Values > 15% ROI will pin the needle. No tooltip on the gauge.

---

## 6. Health Assessment

### 6A. Strengths

- **Accurate financial math.** `mortgagePayment()` and `amortSchedule()` use standard Canadian mortgage formulas. CMHC tiers are correct and updated for the Dec 2024 $1.5M limit increase.
- **Well-thought-out scoring system.** The 0-100 score with signal generation gives actionable verdicts and handles owner, investor, and hybrid modes distinctly.
- **Good UX fundamentals.** Tooltips on every metric, verdict color-coding, clickable down payment comparison table, tab-based organization.
- **PDF export is genuinely professional.** 3-page branded report with autotable, watermark, disclaimer, and full contact info — rare for a solo dev tool.
- **Memoization correctly applied.** `useCallback` on `calc()` and `useMemo` on result objects prevent unnecessary recalculation.
- **Save/load with backward compatibility.** `loadProperty` uses `|| default` fallbacks for fields that might be missing in older saved data.
- **Hybrid ownership model.** The owner-occupied unit logic (owner lives in one unit of a multi) is correctly handled — CMHC applies, scoring adjusts, display separates rental vs owner costs.
- **Market data is accurate.** Rent defaults match CMHC published averages (SK 2025). Tax rates are current.

---

### 6B. Bugs

```
File: src/DealAnalyzer.jsx
Line: 502, 533
Severity: LOW
Issue: Two console.log statements left in production (loadProperty function)
Impact: Logs property data (including client names, financial details) to browser console
Fix: Remove both lines
```

```
File: src/DealAnalyzer.jsx
Lines: 237-244 and 276-282
Severity: MEDIUM
Issue: `var moUtilitiesOwner` and `var utilCostMo` declared inside if/else blocks using `var`
Impact: var hoisting means these work but could cause subtle bugs if blocks are refactored;
        reassignment warning in strict linters; misleading code style
Fix: Replace `var` with `let` and declare above the if/else block, assign inside
```

```
File: src/DealAnalyzer.jsx
Lines: 447-456
Severity: MEDIUM
Issue: cashFlowChartData pushes the SAME a.cashFlow value for all 10 years
Impact: The "10-Year Cash Flow" bar chart shows a flat horizontal line, not a projection.
        This is misleading — it implies cash flow never changes over 10 years.
Fix: Project rent increases (e.g., 2-3%/yr) and recalculate each year's NOI minus
     recalculated mortgage payment (which stays fixed)
```

```
File: src/DealAnalyzer.jsx
Line: 184
Severity: LOW
Issue: `const hasRentals = units.some(u => !u.ownerOccupied)` at component scope is never used
       (it's re-declared inside calc() and returned as `a.hasRentals`)
Impact: Dead code — potential confusion for readers
Fix: Remove line 184
```

```
File: src/DealAnalyzer.jsx
Line: 1349
Severity: LOW
Issue: `const curRentNum = parseFloat(curRent) || 1600` inside down payment comparison
       table map() is declared but its value is not used (line 1353 uses `curRentNum`
       from outer scope)
Impact: Dead variable, minor confusion
Fix: Remove the local declaration; outer scope curRentNum is accessible
```

---

### 6C. Security Vulnerabilities

```
Package: dompurify < 3.2.4 (via jspdf dependency)
Severity: CRITICAL
Issue: DOMPurify XSS — allows crafted HTML to bypass sanitization
Impact: If malicious content is ever passed through jsPDF's HTML parsing, XSS is possible.
        Currently jsPDF is used without HTML content — pure API calls only — so active
        exploitability is LOW in current usage, but the dependency should be updated.
Fix: npm audit fix --force (upgrades jspdf to ^4.2.0 — breaking API changes, PDF export
     will need testing/updating after)
```

```
Package: rollup 4.0.0-4.58.0
Severity: HIGH
Issue: Arbitrary File Write via Path Traversal (GHSA-mw96-cpmx-2vgc)
Impact: Build tool vulnerability. Affects CI/CD build process, not the running app.
        If build runs in a trusted environment only, exploitability is LOW, but still HIGH.
Fix: npm audit fix (non-breaking for this version range)
```

```
Package: esbuild ≤ 0.24.2 (via vite dev server)
Severity: MODERATE
Issue: Dev server allows any website to send requests and read responses
Impact: Only the DEVELOPMENT server (npm run dev). Production build is not affected.
Fix: npm audit fix --force (upgrades vite to v7 — breaking changes to vite.config.js likely)
```

```
Type: Data Exposure
File: src/DealAnalyzer.jsx, Lines 502, 533
Severity: LOW
Issue: console.log logs full property data including client names and financial details
Impact: Visible in browser DevTools. Any browser extension with console access could read.
Fix: Remove console.log statements
```

```
Type: No input validation on localStorage
File: src/DealAnalyzer.jsx, Lines 158-161
Severity: LOW
Issue: JSON.parse(localStorage.getItem('dealAnalyzerProperties')) has no try/catch
Impact: If localStorage is corrupted or tampered with, JSON.parse throws and the app crashes
        on load with no error recovery
Fix: Wrap in try/catch with fallback to []
```

---

### 6D. Performance Issues

```
Issue: calc() called 4 times on every state change (main + 3 scenarios)
Impact: Each calc() runs ~100 operations. With React StrictMode (double-invoke in dev),
        this is 8 calls per render cycle in dev. Acceptable at this scale but worth noting.
Mitigation: Already memoized via useCallback + useMemo. Non-urgent.
```

```
Issue: Inline CSS objects recreated on every render
File: DealAnalyzer.jsx, throughout
Impact: Every `style={{ ... }}` creates a new object each render. ~200+ inline style objects.
        React reconciles these efficiently but it adds GC pressure and makes the code verbose.
Fix: Extract to module-level constants (already done for `si`, `ss` — extend this pattern)
```

```
Issue: ~600KB bundle size (per CODEBASE.md "Known Issues")
Impact: Slow initial load on mobile/slow connections. All of jsPDF, Recharts, and the app
        load synchronously.
Fix: jsPDF is already dynamically imported in exportToPDF() — good. Recharts could also
     be lazy-loaded since charts are below the fold.
```

```
Issue: Google Fonts loaded via <link> in JSX render
File: DealAnalyzer.jsx, line 897
Impact: Font link is inside the component body, re-appended on hot reload in dev.
        In production it renders once but it's poor practice — belongs in index.html.
Fix: Move <link> to index.html <head>
```

---

### 6E. Technical Debt

| Item | Location | Severity |
|------|----------|----------|
| `var` in if/else blocks | Lines 237, 241, 276, 281 | MEDIUM |
| 2 console.log in production | Lines 502, 533 | LOW |
| 1,529-line monolithic component | DealAnalyzer.jsx | MEDIUM (scalability) |
| No TypeScript | Entire project | MEDIUM |
| No tests (zero coverage) | Entire project | HIGH |
| No ESLint/Prettier config | Root | LOW |
| Inline Google Fonts link inside JSX | Line 897 | LOW |
| cashFlowChart flat-line bug | Lines 447-456 | MEDIUM |
| Dead variable `hasRentals` at component scope | Line 184 | LOW |
| Dead variable `curRentNum` in table map | Line 1349 | LOW |
| No mobile CSS | Entire app | MEDIUM (UX) |
| ROADMAP.md shows completed features as pending | ROADMAP.md | LOW (docs) |
| No error boundary | App root | LOW |
| localStorage load has no try/catch | Lines 158-161 | LOW |
| date saved as locale string (not ISO) | saveProperty line 475 | LOW |

---

## 7. Deployment & Infrastructure

**Platform:** UNKNOWN — no deployment config found (no Vercel, Railway, Netlify, Dockerfile). Static site, deployable to any CDN or static host.

**Build command:** `npm run build` → Vite builds to `/dist/`
**Output directory:** `/dist/` (gitignored; pre-built copy exists on disk)
**Dev server:** `npm run dev` → `http://localhost:5173`
**Preview:** `npm run preview`

**Environment variables required:** NONE — no env vars used anywhere.

**SSL:** Depends on hosting platform.

**Domain/DNS:** UNKNOWN — no config found.

**Monitoring:** NONE.

**Logging:** console.log/error only — no structured logging.

**Backup:** NONE — all user data is in localStorage. No export/import of saved data.

**Scaling:** N/A — fully client-side. No server to scale.

**Cost:** ~$0/mo if deployed to Vercel/Netlify free tier (static site only).

**Rollback:** `git revert` or `git checkout` + redeploy. No CI/CD pipeline.

---

## 8. Domain & Business Logic Map

### 8A — Domain Terminology

| Term | Meaning in This Codebase |
|------|--------------------------|
| `mode` | "owner" = buying to live in; "investor" = pure/hybrid investment. Controls which metrics show and scoring weights. |
| `propType` | "condo" / "detached" / "duplex" / "multi" — affects CMHC eligibility, default insurance, unit type options |
| `isOwner` | `mode === "owner"` — boolean used everywhere to branch logic |
| `hasOwnerUnit` | One of the `units[]` has `ownerOccupied: true` — triggers hybrid mode with CMHC benefit |
| `hasRentals` | One or more `units[]` has `ownerOccupied: false` — has rental income |
| `downPct` | Down payment as decimal (0.05 = 5%, 0.20 = 20%) |
| `cmhcR` | CMHC insurance premium rate (0-0.04). 0 when ≥20% down or pure investment |
| `cmhcAmt` | `base * cmhcR` — dollar amount added to mortgage |
| `totalMtg` | `base + cmhcAmt` — total mortgage amount borrowed |
| `egi` | Effective Gross Income — `grossAnn * (1 - mk.vac)` — annual rent after vacancy |
| `opex` | Operating expenses — tax + condo + utilities (if landlord pays) + maintenance |
| `noi` | Net Operating Income — `egi - opex` — before mortgage |
| `capRate` | `noi / price` — return if all-cash purchase |
| `cashFlow` | `noi - annMtg` — after mortgage |
| `coc` | Cash-on-cash — `cashFlow / cashIn` — annual return on invested capital |
| `dscr` | Debt Service Coverage Ratio — `noi / annMtg` — banks want ≥1.25 |
| `grm` | Gross Rent Multiplier — `price / grossAnn` — years of rent to equal purchase price |
| `cashIn` | `down + closing` — total upfront cash required |
| `eq5`/`eq10` | Equity at 5/10 years = projected value minus remaining mortgage balance |
| `score` | 0-100 deal quality score computed from weighted metrics |
| `signals` | Array of `{x: string, c: colorHex}` — positive/negative factors shown on UI |
| `verdict` | "GREAT BUY" / "GOOD DEAL" / "FAIR" / "PASS" (owner) or "STRONG BUY" / "WORTH CONSIDERING" / "MARGINAL" / "PASS" (investor) |
| `NC` | Non-Conforming — basement suites that don't meet full legal suite requirements (common in Saskatoon student rentals) |
| `maintPct` | Maintenance as % of EGI. Default 5%. Applied to rental income only. |
| `mk` | Shorthand for `MARKETS[market]` — current market config object |

### 8B — Business Rules

| Rule | Enforcement | Location |
|------|-------------|---------|
| CMHC only for ≤$1.5M AND <20% down AND (owner or hasOwnerUnit) | if/else block | DealAnalyzer.jsx:201-214 |
| CMHC tiers: 5-9.99%→4%, 10-14.99%→3.1%, 15-19.99%→2.8%, 20%+→0% | CMHC array + getCmhcRate() | DealAnalyzer.jsx:39-44 |
| Pure investor <20% down: no CMHC, show educational note | showInvestmentWarning flag | DealAnalyzer.jsx:208-213 |
| Vacancy applied to gross rent, not EGI | `egi = grossAnn * (1 - mk.vac)` | DealAnalyzer.jsx:257 |
| Maintenance applied to EGI (post-vacancy), not gross | `maint = egi * (maintPct / 100)` | DealAnalyzer.jsx:285 |
| Owner cost = mortgage + tax + condo + insurance + utilities | `ownMo` calculation | DealAnalyzer.jsx:247 |
| Net owner cost in hybrid: owner cost minus rental income | `netOwnMo = ownMo - rentalIncome` | DealAnalyzer.jsx:260 |
| Investor mode requires at least 1 unit to show analysis | Warning shown if units.length === 0 | DealAnalyzer.jsx:955 |
| Score threshold: 75+ → strong, 55+ → good, 35+ → fair, <35 → pass | Verdict logic | DealAnalyzer.jsx:404-408 |
| Default investor unit set on mode switch (only if no units exist) | Conditional in mode toggle onClick | DealAnalyzer.jsx:910-913 |
| Closing costs default 1.5% | `closePct: useState(0.015)` | DealAnalyzer.jsx:144 |
| 25-year default amortization | `amYrs: useState(25)` | DealAnalyzer.jsx:143 |

### 8C — User Roles

No auth. No roles. Single anonymous user. Tool is intended for use by Hasan Sharif (agent) or his clients — no multi-user functionality.

### 8D — Feature Flags

NONE. No feature flag system.

### 8E — Pricing/Billing

NOT IMPLEMENTED. Free tool, no billing.

### 8F — Email/Notification Triggers

NONE. PDF export is the only "communication" — manual download.

### 8G — Data Lifecycle

- **Created:** On "Save Property" — stored in localStorage
- **Updated:** NOT IMPLEMENTED — saved properties cannot be edited, only deleted + re-saved
- **Deleted:** On ✕ button in Saved tab — removed from array, localStorage.setItem
- **Archival:** NONE
- **Export:** PDF export only (one property at a time)

### 8H — Compliance

No GDPR compliance (no user accounts, no server). No PCI (no payments). No HIPAA. Client data (client names in saved properties) stored unencrypted in browser localStorage — **advise users not to save sensitive client PII if using a shared computer**.

---

## 9. Recommendations (Priority Order)

| Priority | Recommendation | Impact | Effort | Category |
|----------|----------------|--------|--------|----------|
| 1 | Run `npm audit fix` immediately to patch HIGH Rollup vulnerability | HIGH | LOW | Security |
| 2 | Remove `console.log` at lines 502 and 533 | MEDIUM | LOW | Security/Quality |
| 3 | Wrap localStorage.getItem in try/catch (lines 158-161) | MEDIUM | LOW | Reliability |
| 4 | Fix `cashFlowChartData` to project cash flow over 10 years with rent growth | HIGH | MEDIUM | Bug/UX |
| 5 | Replace `var` with `let` for `moUtilitiesOwner` and `utilCostMo` | LOW | LOW | Code Quality |
| 6 | Move Google Fonts `<link>` from JSX to index.html `<head>` | LOW | LOW | Performance |
| 7 | Plan jsPDF upgrade for CRITICAL DOMPurify fix — requires API changes | HIGH | MEDIUM | Security |
| 8 | Add localStorage export/import (JSON backup of saved properties) | HIGH | MEDIUM | UX/Data Safety |
| 9 | Add mobile responsive CSS — currently unusable on phones | HIGH | HIGH | UX |
| 10 | Add ESLint config to catch future var/dead-code issues automatically | MEDIUM | LOW | Developer Quality |
| 11 | Split DealAnalyzer.jsx into tab components — approaching 2000 lines | MEDIUM | HIGH | Maintainability |
| 12 | Add at least smoke tests for `calc()` financial engine | HIGH | MEDIUM | Reliability |
| 13 | Add a third market (Regina, SK) — straightforward with MARKETS pattern | MEDIUM | LOW | Feature |
