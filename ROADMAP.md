# Deal Analyzer - Feature Roadmap

Last updated: Feb 26 2026

---

## ✅ Completed Features

### Core Analysis
- [x] Owner vs Investor mode
- [x] CMHC calculations (Dec 2024 rules — 5%/10%/15% tiers, owner-occupied only)
- [x] Multiple property types (condo, detached, duplex, multi)
- [x] 5/10 year projections with 3 growth scenarios (conservative/moderate/optimistic)
- [x] Neighborhood quick-fill (Saskatoon + Calgary hoods with grade/price/growth)
- [x] Property insurance (auto-defaults by type, overridable)
- [x] Input validation + smooth typing (price/rate stored as strings)
- [x] Maintenance % selector (0/3/5/8/10% of EGI)
- [x] Hybrid mode — investor with owner-occupied unit (CMHC eligible)

### Mortgage & Financing
- [x] Down payment pill buttons — 5% / 10% / 15% / 20% / 25% (all modes)
- [x] Closing cost selector — 1% / 1.5% / 2% / 3% / 5%
- [x] Amortization 25yr / 30yr toggle
- [x] CMHC premium auto-calc (pure investors: no CMHC, shows scenario note)
- [x] Down payment comparison table (click any row to model it)

### Utilities
- [x] Separate electric / water / gas fields with smart defaults by property type
- [x] Heating type selector (gas / electric / baseboard) with baseboard cost multiplier
- [x] Tenant pays utilities toggle (investor mode)

### Visual Charts (Charts.jsx — 5 components)
- [x] Equity building line chart (10-year)
- [x] Monthly payment breakdown pie/donut
- [x] Cash flow timeline bar chart (projects NOI growth, not flat line)
- [x] Rent vs Own comparison bars
- [x] ROI gauge (semi-circle 0–15%)

### Save & Compare
- [x] Save properties to localStorage with name / address / client / notes
- [x] "Saved" tab — grid of all saved deals
- [x] Load saved property (restores all inputs)
- [x] Delete saved property
- [x] Deal score snapshot saved with property

### PDF Export (3-page branded report)
- [x] Page 1: Executive summary — verdict, property details, key metrics
- [x] Page 2: Financial analysis — cost breakdown, down payment scenarios, deal signals
- [x] Page 3: Long-term projections — equity building, amortization, disclaimers
- [x] Branded: Hasan Sharif REALTOR® / eXp Realty / (306) 850-7687

### Code Quality (Feb 26 2026)
- [x] localStorage JSON.parse wrapped in try/catch (crash prevention)
- [x] console.log removed from production code
- [x] Dead variables removed
- [x] var → let for proper block scoping in calc()
- [x] CLAUDE.md added for instant session context
- [x] rollup path traversal vulnerability patched

---

## 🚀 Next Up — High Impact

### Real-Time Sliders
**Status**: PENDING
**Why**: Faster scenario exploration — drag to explore without clicking
- [ ] Price slider ($100K–$1.5M) with live display
- [ ] Interest rate slider (3%–9%) with +/- 0.25% step
- [ ] Custom appreciation rate slider in Projection tab
- Note: Down payment is already pill buttons (instant click)

### Side-by-Side Property Comparison
**Status**: PENDING
**Why**: Users analyze 10–20 properties before deciding
- [ ] Select 2–3 saved properties to compare
- [ ] Grid comparing all key metrics side-by-side
- [ ] Winner highlight per metric

### Mobile Optimization
**Status**: PENDING
**Why**: Agents show clients on-site on phones
- [ ] Responsive breakpoints for narrow screens
- [ ] Touch targets sized for mobile (44px min)
- [ ] Collapsible sections on small screens

---

## 🔧 Technical Debt

### Security (requires breaking changes)
- [ ] dompurify < 3.2.4 (via jsPDF) — XSS. Fix = upgrade to jspdf@4.2.0 (API breaking)
- [ ] esbuild ≤ 0.24.2 — dev server only. Fix = vite@7.3.1 (breaking)
- Decision: Accept until jsPDF v4 API is tested and PDF export rewritten for it

### Code Quality
- [ ] Fonts in JSX body (Google Fonts `<link>` in render) → move to index.html `<head>`
- [ ] FOUT (Flash of Unstyled Text) from font loading
- [ ] Single 1,540-line monolith → split by tab (MainTab, ProjectionTab, etc.) when it gets unwieldy

---

## 💡 Future Ideas (Phase 3+)

- [ ] Deal scoring explanation ("Why 67/100? Raise rent by $100 → 78/100")
- [ ] Improvement suggestions ("Negotiate to $305K for 80/100")
- [ ] Regina market config
- [ ] Dark mode toggle
- [ ] Animated number transitions on input change
- [ ] Benchmark indicators (avg market rates overlay)
- [ ] Portfolio view (track all owned properties post-purchase)
- [ ] Address autocomplete
- [ ] Multi-currency (USD conversion for cross-border clients)
