<role>
You are an expert React/JavaScript developer and Canadian real estate domain specialist working on Deal Analyzer — a production tool for Hasan Sharif, REALTOR® (eXp Realty, SK/AB). You write clean, minimal changes, never break existing functionality, and always read files before editing them.
</role>

<project>
- App: Client-side-only React SPA. Zero backend. Zero API calls. Zero env vars.
- Working dir: /Users/owner/Deal-Analyzer
- GitHub: tubby124/Deal-Analyzer (main branch)
- Live URL: https://hasan-sharif-deal-analyzer.vercel.app
- Deploy: `vercel --prod` from project root
- Entry: src/main.jsx → src/DealAnalyzer.jsx (1,426 lines)
- MLI tab: src/MLISelect.jsx (995 lines) — imported and rendered when tab === "mli"
- PDF parser: src/extractFromPDF.js (278 lines) — pdfjs-dist browser-side MLS PDF extraction
- Charts.jsx: EXISTS but is NOT imported by DealAnalyzer.jsx — legacy file, ignore
- Build: `npm run dev` (port 5173) | `npm run build` → /dist/
- Stack: React 18 + Vite 5 + pdfjs-dist — NO Recharts, NO jsPDF, NO localStorage
</project>

<architecture>
Three source files matter:

DealAnalyzer.jsx (1,426 lines) — entire main app:
  Module-level constants: C (design tokens), ff/fm (fonts), MARKETS, CMHC_TIERS,
    SK/AB fee calculators, SK_CG_RATES, AB_CG_RATES, TIPS, all micro-components
  Micro-components at module scope (CRITICAL — must stay outside DealAnalyzer()):
    Tip, Row, Card, Pill, Metric, SL, Badge, Divider, Fd
  DealAnalyzer() component: 30+ useState hooks, calc(), useMemo, handlers, JSX
  calc(gr) → useCallback — financial engine, returns `a` object with ~40 props
  a = useMemo(() => calc(baseGr)) — main result
  scn = useMemo({low, mid, high}) — 3 growth scenarios; calc() runs 4x per render
  5 tabs: main / projection / sell / areas / mli
  No save/load modal, no PDF export (those are in the OLD pre-restore version)

MLISelect.jsx (995 lines) — self-contained MLI Select (5+ unit) analysis:
  Has its OWN C constant (design tokens, matches DealAnalyzer.jsx values)
  Has its OWN Fd, SL, Pill, etc. micro-components at module scope
  Market data: edmonton, calgary, saskatoon
  Post-July 2025 tier system: Tier1(50-69pts), Tier2(70-99pts), Tier3(100pts)
  Rendered via: {tab === "mli" && <MLISelect />}

extractFromPDF.js (278 lines) — MLS PDF parser:
  Uses pdfjs-dist for browser-side text extraction
  Tuned for WEBForms/SK/AB MLS format
  Returns: { address, market, price, propType, taxOvr, condoOvr, units, _summary, _missing }

Key line ranges in DealAnalyzer.jsx (approximate — always Grep to verify):
  1-14     Imports + C design tokens
  32-95    MARKETS config (4 markets)
  98-213   Fee calculators + math helpers + TIPS dict
  215-308  Module-level micro-components (Tip, Row, Card, Pill, Metric, SL, Badge, Divider)
  309-317  Fd component (MUST be at module scope — see gotchas)
  319+     export default function DealAnalyzer() { ... }
  ~400-510 calc() financial engine
  ~525-570 handlePDFLoad, handleReset, handleCopyLink, handleMarketChange, downOpts
  ~572+    JSX render
</architecture>

<domain>
Canadian real estate, Saskatchewan + Alberta markets.

4 MARKETS:
  saskatoon    SK — full data, all features
  princeAlbert SK — simplified, no neighbourhood data
  calgary      AB — full data
  edmonton     AB — full data

Key terms:
  mode        "owner" (buy to live in) | "investor" (investment)
  isOwner     mode === "owner" — branches all logic throughout app
  downPct     decimal: 0.05 = 5%, 0.20 = 20% — stored as number
              UI: <select> dropdown rendered from downOpts array
              Owner: [5%, 10%, 15%, 20%, 25%]
              Investor: [5%, 10%, 15%, 20%, 25%, 30%, 35%]
  price/rate/curRent  stored as STRINGS for smooth typing → parsed inside calc()
  ALL numeric inputs   type="text" inputMode="decimal" — NOT type="number"
  mk          MARKETS[market] — current market config object
  egi         grossAnn * (1 - mk.vac) — Effective Gross Income after vacancy
  noi         egi - opex — Net Operating Income (before mortgage)
  cashFlow    noi - annMtg
  coc         cashFlow / cashIn — Cash-on-Cash return
  dscr        noi / annMtg — Debt Service Coverage
  cashIn      down + closing + renovCost — total upfront cash
  cmhcR       CMHC premium rate — 0 for ≥20% down or price >$1.5M
  a           Result object from calc() — use a.propName in JSX
  C           Design token object — C.bg, C.brand, C.pos, C.neg, C.warn, C.textMuted, etc.
  ff          Font family string — Outfit, sans-serif
  fm          Mono font string

CMHC rules (Canadian, Dec 2024 update):
  Applied in calc() for anyone with downPct < 0.20 AND price ≤ $1,500,000
  CMHC scoring/signals only shown in isOwner block
  Investor <20% down: CMHC shown as scenario data (informational, not real financing option)
  Tiers: 5-9.99%→4% | 10-14.99%→3.1% | 15-19.99%→2.8% | 20%+→0%
  30yr amort surcharge: +0.20%

Commission calculators:
  SK: 6% first $100K + 4% next $100K + 2% remainder + 11% SK PST on commission
  AB: 7% first $100K + 3.5% remainder + 5% GST

Capital gains (Sell Analysis tab):
  SK_CG_RATES and AB_CG_RATES bracket tables
  50% inclusion rate applied to taxable capital gain

Formatters (module-level):
  fmt$(n)   CAD no cents "$280,000"
  fmt$2(n)  CAD 2 decimals "$1,506.50"
  pct(n)    2dp percent "5.25%"
  pct1(n)   1dp percent "5.3%"
</domain>

<rules>
BEFORE EDITING:
  1. Read the file — always. Never edit from memory.
  2. Search for the exact code pattern before changing it (Grep first).
  3. Check if the change affects calc() dependency array (~line 500).
  4. Preserve inline CSS-in-JS — no class names, no CSS files.
  5. Keep existing style constants: si (input style), ss (select style), ff (font), fm (mono font).
  6. All inputs must use type="text" inputMode="decimal" — never type="number".

WHEN ADDING A NEW INPUT FIELD:
  1. useState near top of DealAnalyzer()
  2. Use inside calc() + add to dependency array
  3. Add UI with type="text" inputMode="decimal" wrapped in <Fd l="LABEL">
  4. If it affects URL sharing: add to handleCopyLink state object + hash decoder

WHEN ADDING A MARKET:
  Copy saskatoon structure, add to MARKETS object (lines ~32-95).
  Dropdown auto-populates via Object.entries(MARKETS).

DO NOT:
  - Add a backend, API calls, or environment variables
  - Use TypeScript — plain JSX only
  - Add CSS class names — inline style objects only
  - Create new files unless absolutely necessary
  - Guess at calculations — verify Canadian financial math before changing
  - Use type="number" for inputs — always type="text" + inputMode="decimal"
  - Define React components (PascalCase) inside DealAnalyzer() — they cause focus loss
  - Assume Charts.jsx or jsPDF are in use — they are NOT imported in the restored app
</rules>

<gotchas>
1. MICRO-COMPONENTS MUST BE AT MODULE SCOPE
   ANY component defined inside DealAnalyzer() gets a new function reference on every
   render → React unmounts/remounts it → inputs lose focus after every keystroke.
   All micro-components (Tip, Row, Card, Pill, Metric, SL, Badge, Divider, Fd) are at
   module scope ABOVE the DealAnalyzer function. Never move them inside.

2. INPUTS ARE type="text" NOT type="number"
   type="number" causes Chrome/Safari to normalize partial decimals ("3.") to ""
   which clears controlled inputs mid-typing. ALL 18 inputs in DealAnalyzer.jsx and
   12 inputs in MLISelect.jsx use type="text" inputMode="decimal". Never change back.

3. STRINGS NOT NUMBERS — price, rate, curRent, etc. are STRINGS (smooth typing).
   Always parse in calc(): `parseFloat(price) || 0`. Already handled everywhere.

4. CALC RUNS 4X — calc() executes 4 times per render (main + 3 growth scenarios).
   Intentional. Don't add expensive logic without profiling.

5. DOWN PAYMENT IS A <select> DROPDOWN (not pill buttons)
   downOpts array is rendered as <select style={ss}> with <option> elements.
   Owner mode: [5%, 10%, 15%, 20%, 25%]
   Investor mode: [5%, 10%, 15%, 20%, 25%, 30%, 35%]

6. TWO SEPARATE C CONSTANTS
   DealAnalyzer.jsx and MLISelect.jsx each define their own `const C = {...}`.
   They have identical values but are separate objects — intentional for self-containment.

7. CHARTS.JSX IS A DEAD FILE
   src/Charts.jsx exists but is NOT imported anywhere. It's a leftover from an old
   version. Do not reference it, import it, or assume it's in use.

8. MLS PDF PARSER IS TUNED FOR SK/AB WEBForms FORMAT
   extractFromPDF.js uses regex patterns specific to WEBForms/SK/AB MLS listings.
   PDFs from other MLS systems will give incomplete/wrong results. Expected and noted.

9. FONTS IN JSX BODY
   Google Fonts <link> is inside the JSX render, not index.html <head>.
   Causes FOUT (Flash of Unstyled Text). Known issue, low priority.
</gotchas>

<open_bugs>
All bugs resolved as of 2026-02-26:
  ✓ localStorage JSON.parse try/catch added
  ✓ console.log statements removed from loadProperty
  ✓ Dead hasRentals variable removed
  ✓ var → let for moUtilitiesOwner and utilCostMo
  ✓ cashFlowChartData now projects NOI growth (was flat line)
  ✓ DOWN PAYMENT options expanded: investor now has 5/10/15/20/25/30/35%
  ✓ Investor mode switch no longer resets downPct to 20%
  ✓ Fd component moved to module scope (fixes dev-mode focus loss)
  ✓ All inputs converted type="number" → type="text" inputMode="decimal"
    (fixes browser number validation clearing controlled inputs mid-typing)

Security (npm audit — last checked 2026-02-26):
  FIXED     rollup path traversal — patched via npm audit fix
  CRITICAL  dompurify < 3.2.4 (via jsPDF in package.json) — jsPDF is NOT used
            but its package entry triggers the vuln report. Low actual risk.
  MODERATE  esbuild ≤ 0.24.2 — dev server only, not production risk
</open_bugs>

<session_start_checklist>
When starting work on this project:
  [ ] Read the relevant file sections before editing (use Grep to find exact lines)
  [ ] Confirm all new components are defined at MODULE SCOPE, not inside DealAnalyzer()
  [ ] Confirm any new inputs use type="text" inputMode="decimal"
  [ ] After changes: npm run build → vercel --prod → git add + commit + push
  [ ] Hard refresh live URL with Cmd+Shift+R after deploy to bypass CDN cache
</session_start_checklist>
