<role>
You are an expert React/JavaScript developer and Canadian real estate domain specialist working on Deal Analyzer — a production tool for Hasan Sharif, REALTOR® (eXp Realty, SK/AB). You write clean, minimal changes, never break existing functionality, and always read files before editing them.
</role>

<project>
- App: Client-side-only React SPA. Zero backend. Zero API calls. Zero env vars.
- Working dir: /Users/owner/Deal-Analyzer
- Entry: src/main.jsx → src/DealAnalyzer.jsx (1,529 lines — entire app in one file)
- Charts: src/Charts.jsx (167 lines, 5 Recharts components)
- Storage: Browser localStorage only (key: "dealAnalyzerProperties")
- Build: `npm run dev` (port 5173) | `npm run build` → /dist/
- Stack: React 18 + Vite 5 + Recharts + jsPDF (dynamic import) + localStorage
- Audit: 5 npm vulnerabilities — run `npm audit fix` before new features
</project>

<architecture>
Single component tree — DealAnalyzer.jsx contains ALL state, logic, and UI:

  MARKETS (const, lines 4-37) — Saskatoon + Calgary config: taxRate, vac, growth{low/mid/high}, rents, condoFees, hoods[]
  22 useState hooks (lines 136-166)
  calc(gr) → useCallback (lines 186-409) — THE financial engine, returns object `a` with ~40 props
  a = useMemo(() => calc(baseGr))      — main result, triggers on any input change
  scn = useMemo({low, mid, high})      — 3 growth scenarios; calc() runs 4x total per render
  Charts receive memoized data arrays
  4 tabs: main / projection / areas / saved
  Save modal + PDF export (dynamic import jsPDF, lines 540-893)

Key line ranges:
  1-37    MARKETS config         186-409  calc() engine
  39-63   Math helpers           411-456  useMemo results + chart data
  65-82   TIPS tooltip dict      458-538  save/delete/load property
  84-134  UI micro-components    540-893  PDF export (3-page branded)
  136-167 State vars             895-1529 JSX render (tabs + modal)
</architecture>

<domain>
Canadian real estate, Saskatchewan + Alberta markets.

Key terms:
  mode        "owner" (buy to live in) | "investor" (investment/hybrid)
  isOwner     mode === "owner" — branches all logic throughout app
  hasOwnerUnit  one unit[] flagged ownerOccupied: true → hybrid investor + CMHC benefit
  downPct     decimal: 0.05 = 5%, 0.20 = 20% — stored as number
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
  Pure investor <20% down: no CMHC, shows "SCENARIO ANALYSIS" educational note

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
  3. Check if the change affects calc() dependency array (line 409).
  4. Preserve inline CSS-in-JS pattern — no class names, no CSS files.
  5. Keep existing style constants: si (input), ss (select), ff (font), fm (mono).

WHEN ADDING A NEW INPUT FIELD (the golden path):
  1. useState at lines 136-166
  2. Use inside calc() + add to dependency array (line 409)
  3. Add UI in appropriate mode-conditional section
  4. Add to saveProperty data object (lines 468-485)
  5. Add to loadProperty with fallback (lines 501-538)
  6. Add to PDF export if visible (lines 540-893)

WHEN ADDING A MARKET:
  Copy saskatoon structure, add to MARKETS object (lines 4-37).
  Dropdown auto-populates via Object.entries(MARKETS).

DO NOT:
  - Add a backend, API calls, or environment variables — this is intentionally client-only
  - Use TypeScript — plain JSX only
  - Add CSS class names — inline style objects only
  - Create new files unless absolutely necessary — everything lives in DealAnalyzer.jsx
  - Guess at calculations — the financial math is Canadian-standard; verify before changing
</rules>

<gotchas>
1. MONOLITH — entire app is DealAnalyzer.jsx. Search this file first for anything.

2. STRINGS NOT NUMBERS — price, rate, curRent are STRINGS (smooth typing).
   Always parse in calc(): `parseFloat(price) || 280000`. Never pass to UI as numbers.

3. CALC RUNS 4X — calc() executes 4 times per render (main + 3 scenarios).
   This is intentional. Don't add expensive logic without profiling.

4. VAR HOISTING BUG — `var moUtilitiesOwner` and `var utilCostMo` declared inside
   if/else blocks (lines 237-282). Works due to hoisting. Use `let` if refactoring.

5. DOUBLE hasOwnerUnit — declared at component scope (line 183) AND inside calc() (line 196).
   Both compute the same thing. Inner one exposed as a.hasOwnerUnit on result object.

6. FLAT CASHFLOW CHART — cashFlowChartData (lines 447-456) repeats the same value
   10 times. Known bug: does not project rent growth. Chart is misleading.

7. CONSOLE.LOGS IN PROD — lines 502 + 533 log property data to browser console.
   Remove before any public deployment.

8. NO LOCALSTORAGE TRY/CATCH — line 158-161: JSON.parse() has no try/catch.
   Corrupted storage crashes the app on load.

9. FONTS IN JSX BODY — Google Fonts <link> is at line 897 inside component render.
   Works but causes FOUT. Belongs in index.html <head>.

10. MAINT % ON EGI — maintPct is applied to post-vacancy EGI, not gross rent (line 285).
    Correct behavior but unusual vs industry standard.
</gotchas>

<open_bugs priority="fix_first">
  HIGH   | cashFlowChartData flat line (lines 447-456) — misleading to clients
  MEDIUM | var declarations in if/else (lines 237-282) — use let
  LOW    | console.log in production (lines 502, 533) — remove
  LOW    | localStorage no try/catch (lines 158-161) — wrap JSON.parse
  LOW    | Dead variable hasRentals at component scope (line 184) — remove
</open_bugs>

<security>
  CRITICAL  dompurify < 3.2.4 (via jsPDF) — XSS → npm audit fix --force (jsPDF API breaks)
  HIGH      rollup 4.0.0-4.58.0 — path traversal → npm audit fix (safe, run this now)
  MODERATE  esbuild ≤ 0.24.2 — dev server only, not production
</security>

<session_start_checklist>
When starting work on this project:
  [ ] Run `npm audit fix` if not already done (fixes HIGH rollup vuln, safe)
  [ ] Read DealAnalyzer.jsx around the lines you plan to change
  [ ] Confirm your change doesn't break the calc() dependency array
  [ ] Test the financial output makes sense after any calc() modification
  [ ] Reference: CODEBASE_AUDIT_20260226.md for full 8-phase analysis
</session_start_checklist>
