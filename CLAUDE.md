<role>
You are an expert React/JavaScript developer and Canadian real estate domain specialist working on Deal Analyzer — a production tool for Hasan Sharif, REALTOR® (eXp Realty, SK/AB). You write clean, minimal changes, never break existing functionality, and always read files before editing them.
</role>

<project>
- App: Client-side-only React SPA. Zero backend. Zero API calls. Zero env vars.
- Working dir: /Users/owner/Deal-Analyzer
- Entry: src/main.jsx → src/DealAnalyzer.jsx (~1,540 lines — entire app in one file)
- Charts: src/Charts.jsx (167 lines, 5 Recharts components)
- Storage: Browser localStorage only (key: "dealAnalyzerProperties")
- Build: `npm run dev` (port 5173) | `npm run build` → /dist/
- Stack: React 18 + Vite 5 + Recharts + jsPDF (dynamic import) + localStorage
- Audit: 3 npm vulnerabilities remain (all require breaking --force to fix — see security section)
</project>

<architecture>
Single component tree — DealAnalyzer.jsx contains ALL state, logic, and UI:

  MARKETS (const, lines 4-37) — Saskatoon + Calgary config: taxRate, vac, growth{low/mid/high}, rents, condoFees, hoods[]
  22 useState hooks (lines 136-166)
  calc(gr) → useCallback (~lines 186-413) — THE financial engine, returns object `a` with ~40 props
  a = useMemo(() => calc(baseGr))      — main result, triggers on any input change
  scn = useMemo({low, mid, high})      — 3 growth scenarios; calc() runs 4x total per render
  Charts receive memoized data arrays
  4 tabs: main / projection / areas / saved
  Save modal + PDF export (dynamic import jsPDF)

Key line ranges (approximate — always verify with Grep before editing):
  1-37    MARKETS config         ~186-413  calc() engine
  39-63   Math helpers           ~415-461  useMemo results + chart data
  65-82   TIPS tooltip dict      ~462-544  save/delete/load property
  84-134  UI micro-components    ~546-900  PDF export (3-page branded)
  136-167 State vars             ~900+     JSX render (tabs + modal)
</architecture>

<domain>
Canadian real estate, Saskatchewan + Alberta markets.

Key terms:
  mode        "owner" (buy to live in) | "investor" (investment/hybrid)
  isOwner     mode === "owner" — branches all logic throughout app
  hasOwnerUnit  one unit[] flagged ownerOccupied: true → hybrid investor + CMHC benefit
  downPct     decimal: 0.05 = 5%, 0.20 = 20% — stored as number; UI is PILL BUTTONS not a select
  price/rate/curRent  stored as STRINGS for smooth typing → parsed inside calc()
  mk          MARKETS[market] shorthand — current market config
  egi         grossAnn * (1 - mk.vac) — Effective Gross Income after vacancy
  noi         egi - opex — Net Operating Income (before mortgage)
  cashFlow    noi - annMtg — after mortgage
  coc         cashFlow / cashIn — Cash-on-Cash return
  dscr        noi / annMtg — Debt Service Coverage (banks want ≥1.25)
  cashIn      down + closing — total upfront cash required
  cmhcR       CMHC premium rate (0-0.04) — 0 for pure investment or ≥20% down
  a           The result object from calc() — always use a.propName in JSX
  NC          Non-Conforming basement suite (no full legal requirements, SK)

CMHC rules (Canadian law, Dec 2024 update):
  Only applies if: priceNum ≤ 1,500,000 AND downPct < 0.20 AND (isOwner OR hasOwnerUnit)
  Tiers: 5-9.99%→4% | 10-14.99%→3.1% | 15-19.99%→2.8% | 20%+→0%
  Pure investor <20% down: no CMHC, shows purple "SCENARIO ANALYSIS" note (not a warning)

Formatters (module-level functions):
  $(n)   CAD no cents "$280,000"
  $2(n)  CAD 2 decimals "$1,506.50"
  pct(n) 2dp percent "5.25%"
  pct1(n) 1dp percent "5.3%"
</domain>

<rules>
BEFORE EDITING:
  1. Read the file — always. Never edit from memory.
  2. Search for the exact code pattern before changing it.
  3. Check if the change affects calc() dependency array (~line 413).
  4. Preserve inline CSS-in-JS pattern — no class names, no CSS files.
  5. Keep existing style constants: si (input), ss (select), ff (font), fm (mono).

WHEN ADDING A NEW INPUT FIELD (the golden path):
  1. useState at lines 136-166
  2. Use inside calc() + add to dependency array
  3. Add UI in appropriate mode-conditional section
  4. Add to saveProperty data object
  5. Add to loadProperty with fallback
  6. Add to PDF export if visible

WHEN ADDING A MARKET:
  Copy saskatoon structure, add to MARKETS object (lines 4-37).
  Dropdown auto-populates via Object.entries(MARKETS).

DO NOT:
  - Add a backend, API calls, or environment variables — this is intentionally client-only
  - Use TypeScript — plain JSX only
  - Add CSS class names — inline style objects only
  - Create new files unless absolutely necessary — everything lives in DealAnalyzer.jsx
  - Guess at calculations — the financial math is Canadian-standard; verify before changing
  - Replace DOWN PAYMENT pills with a <select> — it was changed to pills intentionally
</rules>

<gotchas>
1. MONOLITH — entire app is DealAnalyzer.jsx. Search this file first for anything.

2. STRINGS NOT NUMBERS — price, rate, curRent are STRINGS (smooth typing).
   Always parse in calc(): `parseFloat(price) || 280000`. Never pass to UI as numbers.

3. CALC RUNS 4X — calc() executes 4 times per render (main + 3 scenarios).
   This is intentional. Don't add expensive logic without profiling.

4. DOUBLE hasOwnerUnit — declared at component scope (~line 187) AND inside calc() (~line 199).
   Both compute the same thing. Inner one is exposed as a.hasOwnerUnit on result object.

5. DOWN PAYMENT IS PILLS — downPct is set via Pill buttons (5% 10% 15% 20% 25%), NOT a <select>.
   Same visual pattern as property type selector. Do not revert to dropdown.

6. FONTS IN JSX BODY — Google Fonts <link> is inside the component render (~line 910).
   Works but causes FOUT. Belongs in index.html <head> (low priority, known).

7. MAINT % ON EGI — maintPct is applied to post-vacancy EGI, not gross rent.
   Correct for this app but unusual vs industry standard.
</gotchas>

<open_bugs priority="fix_first">
  All audit-identified bugs resolved Feb 26 2026:
  ✓ localStorage JSON.parse now has try/catch
  ✓ console.log statements removed from loadProperty
  ✓ Dead hasRentals variable at component scope removed
  ✓ var → let for moUtilitiesOwner and utilCostMo
  ✓ cashFlowChartData now projects NOI growth (was flat line)
  ✓ DOWN PAYMENT converted from hidden dropdown to visible pill buttons

  Remaining security (all require --force breaking changes):
  CRITICAL  dompurify < 3.2.4 (via jsPDF) — XSS → fix breaks jsPDF API
  MODERATE  esbuild ≤ 0.24.2 — dev server only, not production
</open_bugs>

<security>
  FIXED     rollup path traversal — patched Feb 26 2026 via npm audit fix (safe)
  CRITICAL  dompurify < 3.2.4 (via jsPDF) — XSS. npm audit fix --force installs jspdf@4.2.0 (breaking)
  MODERATE  esbuild ≤ 0.24.2 — dev server only. npm audit fix --force installs vite@7.3.1 (breaking)
</security>

<session_start_checklist>
When starting work on this project:
  [ ] Read DealAnalyzer.jsx around the lines you plan to change
  [ ] Confirm your change doesn't break the calc() dependency array
  [ ] Test the financial output makes sense after any calc() modification
  [ ] Reference: CODEBASE_AUDIT_20260226.md for full 8-phase analysis
</session_start_checklist>
