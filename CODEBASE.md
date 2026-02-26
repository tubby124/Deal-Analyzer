# Deal Analyzer — Developer Reference

> **Last Updated:** Feb 2026
> A comprehensive guide to the codebase for making future updates, fixing bugs, and adding features.

---

## Quick Start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # Production build to /dist
npm run preview  # Preview production build
```

**Tech Stack:** React 18 + Vite 5 + Recharts 3 + jsPDF (for PDF export)
**No backend** — everything runs client-side, data stored in `localStorage`.

---

## File Structure

```
src/
├── main.jsx              # Entry point — renders <DealAnalyzer />
├── DealAnalyzer.jsx      # ALL app logic (state, calculations, UI) ~1500 lines
└── Charts.jsx            # 5 Recharts components (equity, pie, cashflow, rent-vs-own, ROI gauge)

Root:
├── index.html            # HTML shell
├── vite.config.js        # Vite config with React plugin
├── package.json          # Dependencies & scripts
├── CODEBASE.md           # ← You are here
├── IMPROVEMENTS.md       # Feature improvement ideas
├── ROADMAP.md            # Development roadmap
├── UX-CRITICAL-IMPROVEMENTS.md  # UX priorities
└── WHATS-NEW.md          # Changelog
```

### Why One Big File?

`DealAnalyzer.jsx` is a single monolithic component. This was intentional for:
- Fast iteration during prototyping
- All state in one place (no prop drilling / context overhead)
- Easy to search and find anything

**If refactoring:** The natural split would be by tab (MainTab, ProjectionTab, AreasTab, SavedTab) + a shared calculations hook.

---

## Architecture Overview

```
User Input (React state)
    ↓
calc() function (useCallback, ~200 lines of financial math)
    ↓
Results object `a` (useMemo)  +  Scenario object `scn` (low/mid/high)
    ↓
UI renders from `a.propertyName`
    ↓
Charts get memoized data arrays
```

---

## Key Sections of DealAnalyzer.jsx (by line range)

| Lines (approx) | What's There |
|---|---|
| 1-37 | **MARKETS config** — Saskatoon & Calgary (rents, tax, neighborhoods) |
| 39-63 | **CMHC table**, mortgage math helpers (`mortgagePayment`, `amortSchedule`) |
| 65-82 | **TIPS** — tooltip text dictionary |
| 84-134 | **Small UI components**: `Tip`, `Row`, `Card`, `Pill`, `Metric`, `SL`, `Fd` |
| 136-175 | **All state variables** (`useState` hooks) |
| 181-404 | **`calc()` function** — THE core financial engine |
| 406-408 | **Memoized results**: `a` (main), `scn` (3 scenarios) |
| 410-452 | **Header stats** + **Chart data preparation** |
| 454-520 | **Save/Delete/Load** property functions |
| 522-875 | **PDF Export** (3-page professional report) |
| 877-920 | **App shell**: header, mode toggle, verdict banner, tab bar |
| 920-1348 | **"Main" tab**: inputs, property type pills, mortgage fields, utilities, rental units, metrics grid, charts, down payment comparison |
| 1350-1392 | **"Projection" tab**: 5yr/10yr scenarios |
| 1394-1409 | **"Areas" tab**: neighborhood cards |
| 1411-1449 | **"Saved" tab**: saved properties grid |
| 1451+ | **Save Modal**, disclaimer, closing tags |

---

## State Variables Reference

| Variable | Type | Default | Purpose |
|---|---|---|---|
| `market` | string | `"saskatoon"` | Selected market (saskatoon/calgary) |
| `mode` | string | `"owner"` | "owner" (buy to live) or "investor" |
| `propType` | string | `"condo"` | condo / detached / duplex / multi |
| `price` | string | `"280000"` | Purchase price (string for input control) |
| `downPct` | number | `0.20` | Down payment percentage (0.05-0.25) |
| `rate` | string | `"3.8"` | Mortgage interest rate % |
| `amYrs` | number | `25` | Amortization years (25 or 30) |
| `closePct` | number | `0.015` | Closing cost percentage |
| `curRent` | string | `"1600"` | Current rent (for owner comparison) |
| `taxOvr` | string | `""` | Property tax override (annual) |
| `condoOvr` | string | `""` | Condo fee override (monthly) |
| `insurance` | string | `""` | Insurance override (annual) |
| `utilElectric` | string | `""` | Electric bill override (monthly) |
| `utilWater` | string | `""` | Water bill override (monthly) |
| `utilGas` | string | `""` | Gas bill override (monthly) |
| `heatingType` | string | `"gas"` | gas / electric / baseboard |
| `tenantUtils` | boolean | `true` | Tenant pays utilities? |
| `maintPct` | number | `5` | Maintenance % of EGI |
| `units` | array | `[]` | Rental units array |
| `growthOvr` | string | `""` | Custom appreciation % override |
| `tab` | string | `"main"` | Active tab |
| `savedProperties` | array | from localStorage | Saved analyses |
| `showSaveModal` | boolean | `false` | Save dialog visible? |
| `saveName` | string | `""` | Save modal: property name |
| `saveAddress` | string | `""` | Save modal: address |
| `saveClient` | string | `""` | Save modal: client/buyer name |
| `saveNotes` | string | `""` | Save modal: notes |

### Units Array Shape
```js
[
  { type: "2bed", rent: "1500", ownerOccupied: false },
  { type: "garage", rent: "", ownerOccupied: false },
  // rent: "" means use market default
]
```

### Unit Type Keys
| Key | Label | Saskatoon Default |
|---|---|---|
| `bachelor` | Bachelor | $1,002 |
| `1bed` | 1-Bed (Legal) | $1,315 |
| `2bed` | 2-Bed (Legal) | $1,506 |
| `2bed_legal` | 2-Bed Legal Suite | $1,400 |
| `3bed` | 3-Bed Main | $2,100 |
| `4bed` | 4-Bed Main | $2,600 |
| `1bed_nc` | 1-Bed NC (non-conforming/student) | $800 |
| `2bed_nc` | 2-Bed NC | $1,150 |
| `garage` | Garage | $400 |
| `parking` | Parking | $100 |

> **NC = Non-Conforming** — basement suites that don't meet full legal suite requirements. Common in Saskatoon student rentals.

---

## The `calc()` Function — Financial Engine

**Input:** `gr` (growth rate as decimal, e.g. 0.04 for 4%)
**Output:** Object with ~40 calculated properties

### Key Output Properties

| Property | Type | Description |
|---|---|---|
| `down` | $ | Down payment amount |
| `cmhcR` | decimal | CMHC rate (0-0.04) |
| `cmhcAmt` | $ | CMHC premium dollar amount |
| `totalMtg` | $ | Total mortgage (base + CMHC) |
| `moPmt` | $ | Monthly mortgage payment |
| `cashIn` | $ | Total cash needed (down + closing) |
| `ownMo` | $ | Total monthly owner cost |
| `rentalIncome` | $ | Monthly rental income from units |
| `netOwnMo` | $ | Net owner cost after rental offset |
| `rentSave` | $ | Monthly savings vs renting (traditional) |
| `rentSaveNet` | $ | Monthly savings vs renting (with rental offset) |
| `grossMo` | $ | Gross monthly rent |
| `egi` | $ | Effective Gross Income (after vacancy) |
| `opex` | $ | Annual operating expenses |
| `noi` | $ | Net Operating Income |
| `capRate` | decimal | Capitalization rate |
| `cashFlow` | $ | Annual cash flow |
| `moCF` | $ | Monthly cash flow |
| `coc` | decimal | Cash-on-cash return |
| `dscr` | decimal | Debt Service Coverage Ratio |
| `grm` | number | Gross Rent Multiplier |
| `v5` / `v10` | $ | Projected value at 5/10 years |
| `eq5` / `eq10` | $ | Equity at 5/10 years |
| `score` | 0-100 | Overall deal score |
| `signals` | array | `[{ x: "text", c: "#color" }]` |
| `verdict` | string | "STRONG BUY" / "WORTH CONSIDERING" / "MARGINAL" / "PASS" |
| `vc` | string | Verdict color hex |

### Scoring System

**Owner Mode (max 100):**
- With rentals (hybrid): savings ratio scoring + rental income bonus + equity + principal
- Without rentals: rent comparison (40pts) + equity gain (30pts) + principal ratio (15pts) + CMHC (15pts)

**Investor Mode (max 100):**
- With owner unit (hybrid): living savings + cap rate + total return + CMHC advantage
- Pure investment: cap rate (30pts) + cash flow (25pts) + DSCR (20pts) + CoC (25pts)

**Verdict Thresholds:**
| Score | Owner | Investor |
|---|---|---|
| 75+ | GREAT BUY | STRONG BUY |
| 55-74 | GOOD DEAL | WORTH CONSIDERING |
| 35-54 | FAIR | MARGINAL |
| <35 | PASS | PASS |

---

## MARKETS Config Structure

```js
MARKETS.saskatoon = {
  label: "Saskatoon, SK",
  taxRate: 0.0135,          // Property tax rate
  vac: 0.05,                // Vacancy rate (5%)
  growth: { low: 0.02, mid: 0.04, high: 0.06 },
  rents: { ... },           // Default rents by unit type
  condoFees: 350,           // Default monthly condo fees
  hoods: [                  // Neighborhoods
    { n: "Name", t: "A/B+/B/B-", p: 450000, g: 0.055, desc: "..." }
  ]
}
```

**To add a new market:** Copy the saskatoon object, change the key, update all values, add to MARKETS object.

---

## Saved Properties Data Model

Stored in `localStorage` key: `dealAnalyzerProperties`

```js
{
  id: 1707849600000,         // Date.now() timestamp
  name: "123 Main St Duplex", // User-chosen name
  address: "123 Main St",    // Optional address
  client: "John Smith",      // Optional client/buyer
  notes: "MLS# 12345...",    // Optional notes
  date: "2/13/2026",         // Save date
  mode, market, propType,    // Settings at save time
  price, downPct, rate, amYrs, closePct, curRent,
  units, taxOvr, condoOvr, insurance, utilElectric, utilWater, utilGas, heatingType,
  tenantUtils, maintPct, growthOvr,
  results: { ...a }          // Snapshot of all calc results
}
```

---

## Charts.jsx Components

| Component | Props | Purpose |
|---|---|---|
| `EquityBuildingChart` | `data` (array of {year, value, equity}) | 10yr equity growth area chart |
| `MonthlyPaymentPie` | `data` (array of {name, value, color}) | Cost breakdown donut |
| `CashFlowChart` | `data` (array of {year, cashflow}) | Annual cash flow bars |
| `RentVsOwnChart` | `rentTotal`, `ownTotal`, `equityGain` | 5yr comparison bars |
| `ROIGauge` | `roi` (decimal) | Semi-circle ROI gauge |

All use Recharts library. Dark theme colors are hardcoded in each component.

---

## PDF Export

3-page professional PDF generated with jsPDF + jspdf-autotable:
1. **Page 1:** Executive summary — verdict, property details, key metrics
2. **Page 2:** Financial analysis — cost breakdown, down payment scenarios, deal signals
3. **Page 3:** Long-term projections — equity building, amortization, disclaimers

Branded with "eXp Realty | Hasan Sharif, REALTOR®" throughout.

---

## Common Tasks & How-To

### Add a new rental unit type
1. Add the rent default to `MARKETS.saskatoon.rents` and `MARKETS.calgary.rents`
2. Add `["key", "Display Label"]` to the `unitOpts` arrays (there are 3: condo, detached, other)
3. That's it — the calc engine picks it up automatically via `mk.rents[u.type]`

### Add a new market (e.g. Regina)
1. Add a new key to `MARKETS` object with the full structure (copy saskatoon)
2. The market dropdown auto-populates from `Object.entries(MARKETS)`

### Change default values
- **Tax rate, vacancy, growth rates:** In `MARKETS` config at top of file
- **Insurance defaults:** Search `moInsurance` in `calc()` function (~line 221)
- **Utility defaults:** Search `defaultElectric` in `calc()` function (~line 225-276)
- **CMHC rates:** In `CMHC` array (~line 39)

### Add a new input field
1. Add `useState` for the new field
2. Use it in `calc()` function
3. Add UI input in the appropriate section (owner vs investor mode)
4. Add to `saveProperty` data object
5. Add to `loadProperty` restore logic
6. Add to `calc()` dependency array
7. Add to PDF export if relevant

### Add a new tab
1. Add to the tab array at ~line 912: `["id", "Label"]`
2. Add `{tab === "id" && ( ... )}` section for content
3. Tab system is just pill buttons + conditional rendering

### Modify the scoring system
- Owner scoring: search `if (isOwner)` inside `calc()` (~line 302)
- Investor scoring: the `else` block after that (~line 347)
- Verdict thresholds: ~line 399-402

---

## Saskatoon Market Notes (Real-World Reference)

These real-world values should be used when updating defaults:

| Unit Type | Typical Rent | Notes |
|---|---|---|
| 1-Bed NC (student suite) | ~$800/mo | Non-conforming basement suites |
| 2-Bed Legal Suite | ~$1,400/mo | Minimum for legal 2-bed |
| 3-Bed Main Floor | $2,000-2,200/mo | Typical main suite |
| 4-Bed Main Floor | ~$2,600/mo | Larger family homes |
| Garage (per side) | ~$400/mo | Heated garage rental |

---

## Known Issues / Gotchas

1. **String vs Number inputs:** `price`, `rate`, `curRent` etc are stored as strings to allow smooth typing. Parsed to numbers inside `calc()` with fallbacks.
2. **`var` in calc():** Some utility calculations use `var` instead of `let/const` due to block scoping within if/else. Works but should be refactored.
3. **Chunk size warning:** Build shows a warning about large chunks (598KB). Consider code-splitting jsPDF/html2canvas with dynamic imports if this becomes a problem.
4. **No mobile optimization:** Layout uses CSS grid/flex with fixed pixel widths. Works on tablet but narrow phones may need responsive breakpoints.
5. **localStorage limits:** Browser localStorage is ~5-10MB. Hundreds of saved properties could theoretically hit this limit since each saves a full results snapshot.

---

## Dependencies

| Package | Version | Purpose |
|---|---|---|
| react | ^18.2.0 | UI framework |
| react-dom | ^18.2.0 | React DOM renderer |
| recharts | ^3.7.0 | Charts/graphs |
| jspdf | ^2.5.2 | PDF generation |
| jspdf-autotable | ^5.0.7 | PDF tables |
| html2canvas | ^1.4.1 | HTML to image (for PDF) |
| @vitejs/plugin-react | ^4.2.1 | Vite React plugin |
| vite | ^5.0.0 | Build tool & dev server |
