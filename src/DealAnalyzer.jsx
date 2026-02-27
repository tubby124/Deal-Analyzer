import { useState, useMemo, useCallback, useEffect } from "react";
import MLISelect from "./MLISelect.jsx";
import { extractFromPDF } from "./extractFromPDF.js";

// ─── Design Tokens ───────────────────────────────────────────────────────────
// Edit these to retheme the entire app in one place
const C = {
  bg:         "#070b14",   // page background — deep navy-black
  surface:    "#0d1121",   // card/surface background
  surface2:   "#111728",   // input background
  surface3:   "#161d32",   // hover / active state tint
  border:     "#1e2847",   // visible border
  borderSub:  "#131a30",   // subtle divider
  text:       "#eef0f8",   // primary text — crisp near-white
  textSec:    "#8b96b8",   // secondary text — readable
  textMuted:  "#4d5878",   // muted labels, hints
  brand:      "#6470ff",   // interactive indigo
  brandSoft:  "#6470ff20",
  pos:        "#10d98e",   // profit / positive — vivid teal-green
  posSoft:    "#10d98e18",
  warn:       "#f5a623",   // caution — warm amber/gold
  warnSoft:   "#f5a62318",
  neg:        "#ff5757",   // loss / negative — warm red
  negSoft:    "#ff575718",
  purple:     "#a78bfa",   // equity / projection — soft violet
  purpleSoft: "#a78bfa18",
  gold:       "#f5c842",   // score / premium tier — bright gold
  orange:     "#fb923c",   // orange (extra cost, closing, etc.)
};

// ─── Market Data ─────────────────────────────────────────────────────────────
const MARKETS = {
  saskatoon: {
    label: "Saskatoon, SK", taxRate: 0.01001, vac: 0.05,
    growth: { low: 0.02, mid: 0.035, high: 0.055 },
    rents: { bachelor: 975, "1bed": 1175, "2bed": 1400, "3bed": 1750, "1bed_nc": 950, "2bed_nc": 1150, garage: 200, parking: 100 },
    condoFees: 350,
    hoods: [
      { n: "Nutana / Varsity View", t: "A",  p: 450000, g: 0.055, desc: "Character homes, infill, walkable" },
      { n: "City Park / Haultain",  t: "A",  p: 420000, g: 0.05,  desc: "50ft lots, lot splitting, downtown access" },
      { n: "Stonebridge",           t: "A",  p: 480000, g: 0.045, desc: "Newer builds, families, stable" },
      { n: "Brighton / Kensington", t: "B+", p: 440000, g: 0.04,  desc: "New development, growing" },
      { n: "Caswell / Westmount",   t: "B",  p: 320000, g: 0.04,  desc: "Affordable, older stock" },
      { n: "Pleasant Hill / Riversdale", t: "B-", p: 260000, g: 0.035, desc: "Lowest entry, revitalizing" },
      { n: "Willowgrove / Evergreen",    t: "B+", p: 460000, g: 0.04,  desc: "Suburban, newer" },
      { n: "Confederation / Massey",     t: "B",  p: 340000, g: 0.035, desc: "West side, suite potential" },
      { n: "Dundonald / Exhibition",     t: "B",  p: 310000, g: 0.035, desc: "Affordable, near amenities" }
    ]
  },
  calgary: {
    label: "Calgary, AB", taxRate: 0.0068, vac: 0.06,
    growth: { low: 0.015, mid: 0.035, high: 0.055 },
    rents: { bachelor: 1350, "1bed": 1537, "2bed": 1870, "3bed": 2030, "1bed_nc": 1200, "2bed_nc": 1400, garage: 250, parking: 150 },
    condoFees: 420,
    hoods: [
      { n: "Beltline / Downtown",       t: "A",  p: 380000, g: 0.04,  desc: "Condos, walkable" },
      { n: "Killarney / Marda Loop",    t: "A",  p: 620000, g: 0.05,  desc: "Premium, infill" },
      { n: "Forest Lawn / Dover",       t: "B",  p: 350000, g: 0.035, desc: "Affordable, cash flow" },
      { n: "Martindale / Taradale",     t: "B",  p: 420000, g: 0.03,  desc: "NE, families" },
      { n: "Penbrooke / Erin Woods",    t: "B-", p: 320000, g: 0.03,  desc: "Lowest SE entry" },
      { n: "Coventry / Country Hills",  t: "B+", p: 480000, g: 0.035, desc: "North, families" },
      { n: "Rundle / Pineridge",        t: "B",  p: 380000, g: 0.03,  desc: "NE value play" }
    ]
  },
  edmonton: {
    label: "Edmonton, AB", taxRate: 0.01014, vac: 0.05,
    growth: { low: 0.015, mid: 0.03, high: 0.05 },
    rents: { bachelor: 1050, "1bed": 1330, "2bed": 1506, "3bed": 1800, "1bed_nc": 1000, "2bed_nc": 1250, garage: 200, parking: 125 },
    condoFees: 380,
    hoods: [
      { n: "Glenora / Westmount",       t: "A",  p: 750000, g: 0.045, desc: "Premium west end, mature character" },
      { n: "Oliver / Downtown Core",    t: "A",  p: 340000, g: 0.04,  desc: "Urban core, walkable, condo market" },
      { n: "Strathcona / Whyte Ave",    t: "A",  p: 550000, g: 0.045, desc: "Character, high rental demand" },
      { n: "Windermere / Summerside",   t: "B+", p: 520000, g: 0.035, desc: "South, newer families, growing" },
      { n: "Terwillegar / Riverbend",   t: "B+", p: 480000, g: 0.035, desc: "Southwest, newer builds" },
      { n: "Mill Woods",                t: "B",  p: 380000, g: 0.03,  desc: "East side, affordable, diverse" },
      { n: "Calder / Spruce Ave",       t: "B-", p: 280000, g: 0.025, desc: "Affordable older stock, north side" },
      { n: "Beverly / Belmont",         t: "B-", p: 295000, g: 0.025, desc: "Northeast, lowest entry point" }
    ]
  },
  princeAlbert: {
    label: "Prince Albert, SK", taxRate: 0.0185, vac: 0.07,
    growth: { low: 0.01, mid: 0.025, high: 0.04 },
    rents: { bachelor: 700, "1bed": 900, "2bed": 1100, "3bed": 1300, "1bed_nc": 650, "2bed_nc": 850, garage: 100, parking: 60 },
    condoFees: 250,
    hoods: [
      { n: "Crescent Heights",      t: "B+", p: 290000, g: 0.025, desc: "Best area, newer builds, north end" },
      { n: "Garden River / Marquis",t: "B",  p: 250000, g: 0.025, desc: "North, newer development" },
      { n: "River Heights",         t: "B",  p: 210000, g: 0.02,  desc: "Central, mix of ages, walkable" },
      { n: "Exhibition",            t: "B",  p: 190000, g: 0.02,  desc: "Central, rental potential" },
      { n: "West Flat",             t: "B-", p: 155000, g: 0.015, desc: "Affordable, older stock" },
      { n: "East Hill",             t: "B-", p: 145000, g: 0.015, desc: "Lowest entry, older homes" }
    ]
  }
};

// ─── Finance Helpers ──────────────────────────────────────────────────────────
const CMHC_TIERS = [
  { lo: 5, hi: 9.99, r: 0.04 }, { lo: 10, hi: 14.99, r: 0.031 },
  { lo: 15, hi: 19.99, r: 0.028 }, { lo: 20, hi: 100, r: 0 }
];
function getCmhcRate(pctDown) {
  const d = pctDown * 100;
  const tier = CMHC_TIERS.find(t => d >= t.lo && d <= t.hi);
  return tier ? tier.r : 0;
}

// ─── Closing Cost Helpers ─────────────────────────────────────────────────────
function skLandTitleFee(price) { return price * 0.004; }
function abLandTitleFee(price) { return 50 + Math.ceil(price / 5000) * 5; }
function skMtgRegFee(mtg) {
  if (mtg <= 250000) return 180;
  if (mtg <= 500000) return 250;
  if (mtg <= 750000) return 500;
  if (mtg <= 1000000) return 750;
  return 1000;
}
function abMtgRegFee(mtg) { return 50 + Math.ceil(mtg / 5000) * 5; }

// ─── Commission Calculators ───────────────────────────────────────────────────
// SK: 6/4/2 + 11% tax (GST+PST — SK only province charging PST on commissions)
function commissionSK(sp) {
  let c = 0.06 * Math.min(100000, sp);
  if (sp > 100000) c += 0.04 * Math.min(100000, sp - 100000);
  if (sp > 200000) c += 0.02 * (sp - 200000);
  return { commission: c, tax: c * 0.11, total: c * 1.11 };
}
// AB: 7/3.5 + 5% GST only
function commissionAB(sp) {
  let c = 0.07 * Math.min(100000, sp);
  if (sp > 100000) c += 0.035 * (sp - 100000);
  return { commission: c, tax: c * 0.05, total: c * 1.05 };
}
function calcCommission(mkt, sp) {
  return (mkt === "saskatoon" || mkt === "princeAlbert") ? commissionSK(sp) : commissionAB(sp);
}

// ─── Capital Gains Tax (50% inclusion — 2/3 increase cancelled March 21 2025) ────────────
const SK_CG_RATES = [
  { upTo: 54532,    rate: 0.1225 }, { upTo: 58523,    rate: 0.1325 },
  { upTo: 117045,   rate: 0.1650 }, { upTo: 155805,   rate: 0.1925 },
  { upTo: 181440,   rate: 0.2025 }, { upTo: 258482,   rate: 0.2190 },
  { upTo: Infinity, rate: 0.2375 },
];
const AB_CG_RATES = [
  { upTo: 58523,    rate: 0.1100 }, { upTo: 61200,    rate: 0.1425 },
  { upTo: 117045,   rate: 0.1525 }, { upTo: 154259,   rate: 0.1800 },
  { upTo: 181440,   rate: 0.1900 }, { upTo: 185111,   rate: 0.2065 },
  { upTo: 246813,   rate: 0.2115 }, { upTo: 258482,   rate: 0.2165 },
  { upTo: 370220,   rate: 0.2350 }, { upTo: Infinity, rate: 0.2400 },
];
function calcCapGainsTax(capitalGain, otherIncome, mkt) {
  // Effective rates on TOTAL gain (50% inclusion already factored in)
  const rates = (mkt === "saskatoon" || mkt === "princeAlbert") ? SK_CG_RATES : AB_CG_RATES;
  let tax = 0, baseIncome = otherIncome, remaining = capitalGain;
  for (const { upTo, rate } of rates) {
    const space = Math.max(0, upTo - baseIncome);
    const inBracket = Math.min(space, remaining);
    if (inBracket > 0) { tax += inBracket * rate; remaining -= inBracket; }
    baseIncome = Math.min(baseIncome + space, upTo);
    if (remaining <= 0) break;
  }
  return tax;
}

function fmt$(n) { return n.toLocaleString("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function fmt$2(n) { return n.toLocaleString("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function pct(n)  { return (n * 100).toFixed(2) + "%"; }
function pct1(n) { return (n * 100).toFixed(1) + "%"; }

function mortgagePayment(prin, annRate, yrs) {
  const r = annRate / 12, n = yrs * 12;
  if (r === 0) return prin / n;
  return prin * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}
function amortSchedule(prin, annRate, amYrs, holdYrs) {
  const r = annRate / 12, n = amYrs * 12;
  const pmt = r === 0 ? prin / n : prin * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  let bal = prin, tI = 0, tP = 0;
  for (let i = 0; i < Math.min(holdYrs * 12, n); i++) {
    const ip = bal * r, pp = pmt - ip;
    tI += ip; tP += pp; bal -= pp;
  }
  return { bal: Math.max(0, bal), interest: tI, principal: tP, total: tI + tP };
}

// ─── URL State ────────────────────────────────────────────────────────────────
function encodeState(s) { try { return btoa(JSON.stringify(s)); } catch { return ""; } }
function decodeState(str) { try { return JSON.parse(atob(str)); } catch { return null; } }

// ─── Tooltip content ──────────────────────────────────────────────────────────
const TIPS = {
  capRate: "Return if paid all cash. Compare properties without financing bias. 5%+ decent, 7%+ strong.",
  coc:     "Annual cash vs money invested. $50K in, $4K/yr = 8%. Compare to stocks/GICs.",
  dscr:    "Can rent cover mortgage? Banks want 1.25+. Under 1.0 means you top up monthly.",
  grm:     "Years of gross rent to equal price. Lower = better. Under 15 is typical in SK/AB.",
  noi:     "Income after operating costs, BEFORE mortgage. Determines cap rate.",
  equity:  "Property value minus what you owe. Grows via appreciation + principal paydown.",
  cmhc:    "Required under 20% down. Adds 2.8–4% to your loan. Avoid it by putting 20%+ down.",
  princ:   "Each payment splits: principal (your equity) + interest (bank profit). Early years are mostly interest.",
  moCost:  "Total monthly ownership: mortgage + property tax + condo fees.",
  appr:    "Saskatoon averaged 5.35%/yr since 1994 — but growth is uneven. 3 scenarios show the realistic range.",
  vac:     "Empty time between tenants. Budget 5% even in tight rental markets.",
  maint:   "Repair reserve. Furnace $4K, roof $8K. Budget 5% minimum.",
  cf:      "Cash left after ALL costs including mortgage. Positive = property pays you.",
  rvb:     "Rent is gone forever. Owning builds equity. This shows your net financial advantage.",
  beo:     "% of gross rent you need to collect to cover ALL costs (operating + mortgage). Under 80% = strong buffer. Over 95% = no room for vacancies or surprise repairs.",
  levPrem: "Cash-on-cash return minus cap rate. Positive = borrowing amplifies your return. Negative = mortgage costs more than the property earns — debt is working against you.",
};

// ─── Shared UI Components ─────────────────────────────────────────────────────
const ff = "'Outfit', sans-serif";
const fm = "'JetBrains Mono', monospace";

function Tip({ id, children }) {
  const [open, setOpen] = useState(false);
  const text = TIPS[id];
  if (!text) return children;
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 4 }}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      onClick={e => { e.stopPropagation(); setOpen(p => !p); }}>
      {children}
      <span style={{
        width: 18, height: 18, borderRadius: "50%", background: C.surface3,
        color: C.textSec, fontSize: 10, fontWeight: 800,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", flexShrink: 0, border: "1px solid " + C.border, minWidth: 18
      }}>?</span>
      {open && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
          width: 270, padding: "10px 14px", background: "#0d1428",
          border: "1px solid " + C.border, borderRadius: 10, zIndex: 999,
          boxShadow: "0 12px 40px rgba(0,0,0,0.8)"
        }}>
          <div style={{ fontSize: 12, color: C.textSec, lineHeight: 1.65 }}>{text}</div>
        </div>
      )}
    </span>
  );
}

function Row({ label, val, color, tip }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid " + C.borderSub }}>
      <span style={{ fontSize: 12, color: C.textSec }}>{tip ? <Tip id={tip}>{label}</Tip> : label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: color || C.textSec, fontFamily: fm }}>{val}</span>
    </div>
  );
}

function Card({ children, sx, accent }) {
  return (
    <div data-card style={{
      background: C.surface,
      border: "1px solid " + (accent ? accent + "35" : C.border),
      borderRadius: 12, padding: 16,
      ...(sx || {})
    }}>
      {children}
    </div>
  );
}

function Pill({ on, color, children, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 16px", borderRadius: 7,
      border: on ? "1.5px solid " + color : "1.5px solid " + C.border,
      background: on ? color + "1a" : "transparent",
      color: on ? color : C.textMuted,
      fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: ff, whiteSpace: "nowrap",
      transition: "all 0.15s"
    }}>{children}</button>
  );
}

function Metric({ label, val, good, tip, neutral }) {
  const col = neutral ? C.purple : good ? C.pos : C.neg;
  return (
    <Card accent={col} sx={{ textAlign: "center", padding: "12px 8px" }}>
      <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4 }}>{tip ? <Tip id={tip}>{label}</Tip> : label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, fontFamily: fm, color: col }}>{val}</div>
    </Card>
  );
}

function SL({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: 1.3, textTransform: "uppercase", marginBottom: 8 }}>
      {children}
    </div>
  );
}

function Badge({ color, children }) {
  return (
    <span style={{ padding: "3px 9px", borderRadius: 5, fontSize: 10, fontWeight: 700, background: color + "1a", color, border: "1px solid " + color + "35" }}>
      {children}
    </span>
  );
}

function Divider() {
  return <div style={{ borderTop: "1px solid " + C.borderSub, margin: "10px 0" }} />;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DealAnalyzer() {
  const [address,    setAddress]    = useState("");
  const [market,     setMarket]     = useState("saskatoon");
  const [mode,       setMode]       = useState("owner");
  const [propType,   setPropType]   = useState("condo");
  const [price,      setPrice]      = useState("280000");
  const [downPct,    setDownPct]    = useState(0.20);
  const [rate,       setRate]       = useState("3.69");
  const [amYrs,      setAmYrs]      = useState(25);
  const [taxOvr,     setTaxOvr]     = useState("");
  const [condoOvr,   setCondoOvr]   = useState("");
  const [curRent,    setCurRent]    = useState("1600");
  const [tenantUtils,setTenantUtils]= useState(true);
  const [maintPct,   setMaintPct]   = useState(5);
  const [units,      setUnits]      = useState([]);
  const [growthOvr,  setGrowthOvr]  = useState("");
  const [tab,        setTab]        = useState("main");
  // First-Time Buyer Programs
  const [isFirstTime,  setIsFirstTime]  = useState(false);
  const [fhsaBalance,  setFhsaBalance]  = useState("0");
  const [hbpAmount,    setHbpAmount]    = useState("0");
  const [showFthb,     setShowFthb]     = useState(false);
  // Sell Analysis
  const [sellPrice,      setSellPrice]      = useState("");
  const [purchaseYear,   setPurchaseYear]   = useState(String(new Date().getFullYear()));
  const [origPurchPrice, setOrigPurchPrice] = useState("");
  const [capImprov,      setCapImprov]      = useState("0");
  const [ccaClaimed,     setCcaClaimed]     = useState("0");
  const [otherIncome,    setOtherIncome]    = useState("0");
  const [mortgPenalty,   setMortgPenalty]   = useState("0");
  // Investor: renovation cost + renewal rate scenario
  const [renovCost,    setRenovCost]    = useState("0");
  const [renewRateScen, setRenewRateScen] = useState("5.5");
  const [showClosing, setShowClosing] = useState(false);
  const [copied,     setCopied]     = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfResult,  setPdfResult]  = useState(null); // { summary: [], warnings: [] }

  // Update document title for clean PDF filename
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const priceStr = price ? "$" + Number(price).toLocaleString("en-CA") : "";
    const addrStr = address ? address.trim() : "";
    if (addrStr || priceStr) {
      document.title = ["Property-Analysis", priceStr, addrStr, today].filter(Boolean).join(" — ");
    } else {
      document.title = "Deal Analyzer — Hasan Sharif Realty";
    }
  }, [address, price]);

  // Restore state from URL hash on mount
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith("#s=")) return;
    const s = decodeState(hash.slice(3));
    if (!s) return;
    if (s.address    !== undefined) setAddress(s.address);
    if (s.market)    setMarket(s.market);
    if (s.mode)      setMode(s.mode);
    if (s.propType)  setPropType(s.propType);
    if (s.price)     setPrice(String(s.price));
    if (s.downPct)   setDownPct(s.downPct);
    if (s.rate)      setRate(String(s.rate));
    if (s.amYrs)     setAmYrs(s.amYrs);
    if (s.taxOvr   !== undefined) setTaxOvr(s.taxOvr);
    if (s.condoOvr !== undefined) setCondoOvr(s.condoOvr);
    if (s.curRent)   setCurRent(String(s.curRent));
    if (s.tenantUtils !== undefined) setTenantUtils(s.tenantUtils);
    if (s.maintPct)  setMaintPct(s.maintPct);
    if (s.units)     setUnits(s.units);
    if (s.growthOvr !== undefined) setGrowthOvr(s.growthOvr);
  }, []);

  const mk      = MARKETS[market];
  const isOwner = mode === "owner";
  const isCondo = propType === "condo";

  // Shared input styles
  const si = {
    background: C.surface2, border: "1px solid " + C.border, borderRadius: 7,
    padding: "10px 12px", color: C.text, fontSize: 13, fontFamily: ff,
    outline: "none", width: "100%", boxSizing: "border-box"
  };
  const ss = { ...si, cursor: "pointer" };

  const unitOpts = isCondo
    ? [["bachelor","Bachelor"],["1bed","1-Bed"],["2bed","2-Bed"],["3bed","3-Bed"]]
    : propType === "detached"
    ? [["1bed","1-Bed Legal"],["2bed","2-Bed Legal"],["3bed","3-Bed"],["1bed_nc","1-Bed NC"],["2bed_nc","2-Bed NC"],["garage","Garage"],["parking","Parking"]]
    : [["bachelor","Bachelor"],["1bed","1-Bed"],["2bed","2-Bed"],["3bed","3-Bed"],["1bed_nc","1-Bed NC"],["2bed_nc","2-Bed NC"],["garage","Garage"],["parking","Parking"]];

  // ── Core calculation ────────────────────────────────────────────────────────
  const calc = useCallback((gr) => {
    const p  = parseFloat(price)     || 0;
    const r  = parseFloat(rate)      || 0;
    const cr = parseFloat(curRent)   || 0;
    const rv = parseFloat(renovCost) || 0;
    const isSK    = market === "saskatoon" || market === "princeAlbert";
    const down    = p * downPct;
    const base    = p - down;
    const cmhcR   = (downPct < 0.20 && p <= 1500000) ? getCmhcRate(downPct) + (amYrs === 30 ? 0.002 : 0) : 0;
    const cmhcAmt = base * cmhcR;
    const totalMtg = base + cmhcAmt;
    const moPmt    = mortgagePayment(totalMtg, r / 100, amYrs);
    const annMtg   = moPmt * 12;
    const annTax   = taxOvr ? Number(taxOvr) : p * mk.taxRate;
    const moTax    = annTax / 12;
    // Auto-calculated closing costs
    const legalFees  = 1400;
    const landFee    = p > 0 ? (isSK ? skLandTitleFee(p) : abLandTitleFee(p)) : 0;
    const mtgRegFee  = totalMtg > 0 ? (isSK ? skMtgRegFee(totalMtg) : abMtgRegFee(totalMtg)) : 0;
    const titleIns   = 300;
    const inspection = 500;
    const pstOnCmhc  = isSK ? cmhcAmt * 0.06 : 0;
    const taxAdj     = annTax / 12;
    const miscClose  = 150;
    const closing    = legalFees + landFee + mtgRegFee + titleIns + inspection + pstOnCmhc + taxAdj + miscClose;
    const cashIn     = down + closing + rv;
    const moCondo    = isCondo ? (condoOvr ? Number(condoOvr) : mk.condoFees) : 0;
    const annCondo   = moCondo * 12;
    const ownMo      = moPmt + moTax + moCondo;
    const rentSave   = cr - ownMo;
    const grossMo  = units.reduce((s, u) => s + (u.rent ? Number(u.rent) : (mk.rents[u.type] || 0)), 0);
    const grossAnn = grossMo * 12;
    const egi      = grossAnn * (1 - mk.vac);
    const utilCost = tenantUtils ? 0 : (propType === "detached" ? 350 : isCondo ? 180 : 280) * 12;
    const maint    = egi * (maintPct / 100);
    const opex     = annTax + annCondo + utilCost + maint;
    const noi      = egi - opex;
    const capRate  = p > 0 ? noi / p : 0;
    const cashFlow = noi - annMtg;
    const moCF     = cashFlow / 12;
    const coc      = cashIn > 0 ? cashFlow / cashIn : 0;
    const dscr     = annMtg > 0 ? noi / annMtg : 0;
    const grm      = grossAnn > 0 ? p / grossAnn : 0;
    const beo      = grossAnn > 0 ? (opex + annMtg) / grossAnn : 0;
    const levPrem  = capRate > 0 ? coc - capRate : 0;
    const s5         = amortSchedule(totalMtg, r / 100, amYrs, 5);
    const s10        = amortSchedule(totalMtg, r / 100, amYrs, 10);
    const v5         = p * Math.pow(1 + gr, 5);
    const v10        = p * Math.pow(1 + gr, 10);
    const eq5        = v5  - s5.bal;
    const eq10       = v10 - s10.bal;
    const eqGain5    = eq5  - cashIn;
    const eqGain10   = eq10 - cashIn;
    const netAdv5    = eqGain5  - (ownMo * 60  - cr * 60);
    const netAdv10   = eqGain10 - (ownMo * 120 - cr * 120);
    const roi5  = cashIn > 0 ? Math.pow(Math.max(0.01, (cashIn + eqGain5  + cashFlow * 5))  / cashIn, 0.2) - 1 : 0;
    const roi10 = cashIn > 0 ? Math.pow(Math.max(0.01, (cashIn + eqGain10 + cashFlow * 10)) / cashIn, 0.1) - 1 : 0;

    let score = 0, signals = [];
    if (isOwner) {
      if (rentSave > 0) { score += 40; signals.push({ x: "Saves " + fmt$(rentSave) + "/mo vs renting", c: C.pos }); }
      else { score += 10; signals.push({ x: "Costs " + fmt$(-rentSave) + "/mo more than rent", c: C.orange }); }
      if (eqGain5 > 0) { score += 30; signals.push({ x: fmt$(eqGain5) + " equity gain in 5 years", c: C.pos }); }
      if (s5.principal > s5.interest) { score += 15; signals.push({ x: "More principal than interest paid (5yr)", c: C.pos }); }
      else { score += 5; signals.push({ x: Math.round(s5.interest / s5.total * 100) + "% of 5yr payments go to interest", c: C.warn }); }
      if (cmhcAmt === 0) { score += 15; signals.push({ x: "No CMHC insurance — 20%+ down", c: C.pos }); }
      else { score += 5; signals.push({ x: "CMHC adds " + fmt$(cmhcAmt) + " to mortgage", c: C.warn }); }
    } else {
      if (units.length === 0) {
        signals.push({ x: "Add rental units below to see investment signals", c: C.brand });
      } else {
        if (capRate >= 0.07)      { score += 30; signals.push({ x: "Strong cap rate (7%+)",        c: C.pos  }); }
        else if (capRate >= 0.05) { score += 20; signals.push({ x: "Decent cap rate (5–7%)",       c: C.warn }); }
        else                      { score +=  5; signals.push({ x: "Weak cap rate (under 5%)",     c: C.neg  }); }
        if (cashFlow > 0)  { score += 25; signals.push({ x: "Positive cash flow — property pays you",          c: C.pos  }); }
        else               {              signals.push({ x: "Negative cash flow — you top up monthly",          c: C.neg  }); }
        if (dscr >= 1.25)      { score += 20; signals.push({ x: "DSCR 1.25+ — bank-approvable",       c: C.pos  }); }
        else if (dscr >= 1.0)  { score += 10; signals.push({ x: "DSCR 1.0–1.25 — borderline coverage", c: C.warn }); }
        else                   {              signals.push({ x: "DSCR under 1.0 — rent doesn't cover mortgage", c: C.neg  }); }
        if (coc >= 0.08)      { score += 25; signals.push({ x: "Cash-on-cash 8%+ — excellent return",  c: C.pos  }); }
        else if (coc >= 0.04) { score += 15; signals.push({ x: "Cash-on-cash 4–8% — acceptable",       c: C.warn }); }
        else                  { score +=  5; signals.push({ x: "Cash-on-cash under 4% — better options exist", c: C.neg }); }
      }
    }
    let verdict = "NO DEAL", vc = C.neg;
    if      (score >= 75) { verdict = isOwner ? "GREAT BUY"  : "STRONG BUY"; vc = C.pos;  }
    else if (score >= 55) { verdict = isOwner ? "GOOD DEAL"  : "WORTH IT";   vc = C.warn; }
    else if (score >= 35) { verdict = isOwner ? "FAIR"       : "MARGINAL";   vc = C.orange; }
    return {
      down, cmhcR, cmhcAmt, totalMtg, moPmt, annMtg,
      closing, legalFees, landFee, mtgRegFee, titleIns, inspection, pstOnCmhc, taxAdj, miscClose, rv,
      cashIn,
      annTax, moTax, moCondo, annCondo, ownMo, rentSave,
      grossMo, grossAnn, egi, utilCost, maint, opex, noi,
      capRate, cashFlow, moCF, coc, dscr, grm, beo, levPrem,
      s5, s10, v5, v10, eq5, eq10, eqGain5, eqGain10,
      netAdv5, netAdv10, roi5, roi10, score, signals, verdict, vc, gr,
      p, r, cr
    };
  }, [price, rate, curRent, renovCost, downPct, amYrs, market, propType, mode, units, maintPct, taxOvr, condoOvr, tenantUtils, isOwner, isCondo, mk]);

  const baseGr = growthOvr ? Number(growthOvr) / 100 : mk.growth.mid;
  const a    = useMemo(() => calc(baseGr), [calc, baseGr]);
  const scn  = useMemo(() => growthOvr ? null : { low: calc(mk.growth.low), mid: a, high: calc(mk.growth.high) }, [calc, mk.growth.low, mk.growth.high, a, growthOvr]);

  const headerStats = isOwner
    ? [
        { l: "Monthly",   v: fmt$2(a.ownMo),                                      c: C.text    },
        { l: "vs Rent",   v: a.rentSave >= 0 ? "Save " + fmt$(a.rentSave) : "+" + fmt$(-a.rentSave) + "/mo", c: a.rentSave >= 0 ? C.pos : C.orange },
        { l: "5yr Equity",v: fmt$(a.eq5),                                          c: C.purple  },
        { l: "Score",     v: a.score + "/100",                                     c: a.vc      },
      ]
    : [
        { l: "Cap Rate", v: pct(a.capRate),  c: C.text   },
        { l: "CoC",      v: pct(a.coc),      c: C.text   },
        { l: "Mo CF",    v: fmt$(a.moCF),    c: a.moCF >= 0 ? C.pos : C.neg },
        { l: "Score",    v: a.score + "/100",c: a.vc     },
      ];

  const Fd = ({ l, children }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
      <label style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, letterSpacing: 0.8 }}>{l}</label>
      {children}
    </div>
  );

  async function handlePDFLoad(file) {
    setPdfLoading(true);
    setPdfResult(null);
    try {
      const s = await extractFromPDF(file);
      // Apply extracted fields to form state
      if (s.address    !== undefined) setAddress(s.address);
      if (s.market)    setMarket(s.market);
      if (s.price)     setPrice(s.price);
      if (s.propType)  setPropType(s.propType);
      if (s.taxOvr     !== undefined && s.taxOvr !== null) setTaxOvr(String(s.taxOvr));
      if (s.condoOvr   !== undefined && s.condoOvr !== null) setCondoOvr(String(s.condoOvr));
      if (s.units && s.units.length > 0) {
        setMode("investor");
        setUnits(s.units.map(u => ({ ...u, rent: u.rent || "" })));
      }
      setPdfResult({ summary: s._summary || [], missing: s._missing || [], ok: true });
    } catch (e) {
      setPdfResult({ summary: ["Error reading PDF: " + e.message], ok: false });
    } finally {
      setPdfLoading(false);
    }
  }

  function handleReset() {
    setAddress(""); setMarket("saskatoon"); setMode("owner"); setPropType("condo");
    setPrice("280000"); setDownPct(0.20); setRate("3.69"); setAmYrs(25);
    setTaxOvr(""); setCondoOvr(""); setCurRent("1600"); setTenantUtils(true);
    setMaintPct(5); setUnits([]); setGrowthOvr(""); setTab("main");
    setIsFirstTime(false); setFhsaBalance("0"); setHbpAmount("0"); setShowFthb(false);
    setRenovCost("0"); setRenewRateScen("5.5");
    window.history.replaceState(null, "", window.location.pathname);
  }

  function handleCopyLink() {
    const state = { address, market, mode, propType, price, downPct, rate, amYrs, taxOvr, condoOvr, curRent, tenantUtils, maintPct, units, growthOvr };
    const url = window.location.href.split("#")[0] + "#s=" + encodeState(state);
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); });
  }

  function handleMarketChange(val) { setMarket(val); setTaxOvr(""); setCondoOvr(""); }

  const downOpts = isOwner ? [0.05, 0.10, 0.15, 0.20, 0.25] : [0.20, 0.25, 0.30, 0.35];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.textSec, fontFamily: ff }}>
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "0 16px 100px" }}>

        {/* ── Header ── */}
        <div style={{ padding: "24px 0 18px", borderBottom: "1px solid " + C.borderSub }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 3.5, fontWeight: 800 }}>EXP REALTY</div>
              <h1 style={{ fontSize: 24, fontWeight: 900, margin: "4px 0 8px", color: C.text, letterSpacing: -0.5 }}>Deal Analyzer</h1>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: C.brand }}>Hasan Sharif</span>
                <a href="tel:3068507687" style={{ fontSize: 12, color: C.purple, textDecoration: "none", fontWeight: 600 }}>306-850-7687</a>
                <span style={{ fontSize: 11, color: C.textMuted }}>Residential · Commercial · Farming</span>
                <Badge color={C.brand}>Licensed SK &amp; AB</Badge>
              </div>
            </div>
            <div className="no-print" style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 4 }}>
              <label style={{
                padding: "8px 14px", borderRadius: 7, border: "1px solid " + C.brand,
                background: "transparent", color: C.brand, fontSize: 11,
                cursor: "pointer", fontFamily: ff, fontWeight: 700, whiteSpace: "nowrap"
              }}>
                ⬆ Load JSON
                <input type="file" accept=".json" style={{ display: "none" }} onChange={e => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = ev => {
                    try {
                      const s = JSON.parse(ev.target.result);
                      if (s.address    !== undefined) setAddress(s.address);
                      if (s.market)    setMarket(s.market);
                      if (s.mode)      setMode(s.mode);
                      if (s.propType)  setPropType(s.propType);
                      if (s.price)     setPrice(String(s.price));
                      if (s.downPct    !== undefined) setDownPct(Number(s.downPct));
                      if (s.rate       !== undefined) setRate(String(s.rate));
                      if (s.amYrs      !== undefined) setAmYrs(Number(s.amYrs));
                      if (s.taxOvr     !== undefined) setTaxOvr(s.taxOvr || "");
                      if (s.condoOvr   !== undefined) setCondoOvr(s.condoOvr || "");
                      if (s.curRent    !== undefined) setCurRent(String(s.curRent));
                      if (s.maintPct   !== undefined) setMaintPct(Number(s.maintPct));
                      if (s.units)     setUnits(s.units);
                      if (s.growthOvr  !== undefined) setGrowthOvr(s.growthOvr || "");
                    } catch { alert("Invalid JSON file"); }
                  };
                  reader.readAsText(file);
                  e.target.value = "";
                }} />
              </label>
              <label style={{
                padding: "8px 14px", borderRadius: 7, border: "1px solid " + C.purple,
                background: pdfLoading ? C.purple + "22" : "transparent",
                color: C.purple, fontSize: 11,
                cursor: "pointer", fontFamily: ff, fontWeight: 700, whiteSpace: "nowrap"
              }}>
                {pdfLoading ? "⏳ Reading…" : "📄 Drop MLS PDF"}
                <input type="file" accept=".pdf" style={{ display: "none" }} disabled={pdfLoading} onChange={e => {
                  const file = e.target.files[0];
                  if (!file) return;
                  handlePDFLoad(file);
                  e.target.value = "";
                }} />
              </label>
              <button className="no-print" onClick={handleReset} style={{
                padding: "8px 14px", borderRadius: 7, border: "1px solid " + C.border,
                background: "transparent", color: C.textMuted, fontSize: 11,
                cursor: "pointer", fontFamily: ff
              }}>↺ Reset</button>
            </div>
          </div>

          {/* PDF extraction result banner */}
          {pdfResult && (
            <div style={{
              marginTop: 10, padding: "10px 14px", borderRadius: 8,
              background: pdfResult.ok ? C.pos + "12" : C.neg + "12",
              border: "1px solid " + (pdfResult.ok ? C.pos : C.neg) + "44",
              fontSize: 11
            }}>
              <div style={{ fontWeight: 700, color: pdfResult.ok ? C.pos : C.neg, marginBottom: 6 }}>
                {pdfResult.ok ? "✓ MLS listing parsed — review fields below then run analysis" : "⚠ Parsing issue"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 16px" }}>
                {pdfResult.summary.map((s, i) => (
                  <div key={i} style={{ color: C.text, fontSize: 11 }}>· {s}</div>
                ))}
              </div>
              {pdfResult.missing && pdfResult.missing.length > 0 && (
                <div style={{ marginTop: 6, color: C.orange, fontSize: 10.5 }}>
                  ⚠ Not found — fill manually: {pdfResult.missing.join(", ")}
                </div>
              )}
              <div style={{ marginTop: 4, color: C.textMuted, fontSize: 10 }}>
                Set down payment, rate, and rental units below to complete the analysis.
              </div>
              <button onClick={() => setPdfResult(null)} style={{
                marginTop: 6, padding: "2px 8px", borderRadius: 4, border: "1px solid " + C.border,
                background: "transparent", color: C.textMuted, fontSize: 10, cursor: "pointer", fontFamily: ff
              }}>dismiss</button>
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <input
              style={{ ...si, background: C.surface, fontSize: 14, fontWeight: 600, color: C.text }}
              placeholder="Enter property address  (e.g. 418 Kenderdine Rd, Saskatoon SK)"
              value={address}
              onChange={e => setAddress(e.target.value)}
            />
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>Tap the ? icons to understand each metric · Drop a listing PDF above to auto-fill</div>
        </div>

        {/* ── Mode toggle ── */}
        <div style={{ display: "flex", gap: 3, marginTop: 18, background: C.surface, borderRadius: 10, padding: 3, width: "fit-content", border: "1px solid " + C.border }}>
          {[["owner", "🏠 Buying to Live In"], ["investor", "📈 Investment"]].map(([id, lb]) => (
            <button key={id} onClick={() => {
              setMode(id);
              if (id === "owner")    { setUnits([]); if (downPct > 0.25) setDownPct(0.20); }
              if (id === "investor") { if (downPct < 0.20) setDownPct(0.20); if (units.length === 0) setUnits([{ type: isCondo ? "2bed" : "2bed_nc", rent: "" }]); }
            }} style={{
              padding: "10px 22px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: ff,
              background: mode === id ? C.brand : "transparent",
              color: mode === id ? "#fff" : C.textMuted,
              fontSize: 12, fontWeight: 700, transition: "all 0.15s"
            }}>{lb}</button>
          ))}
        </div>

        {/* ── Verdict banner ── */}
        <div style={{
          marginTop: 16, padding: "20px 24px", borderRadius: 14,
          background: "linear-gradient(135deg," + a.vc + "0e,transparent 65%)",
          border: "1.5px solid " + a.vc + "30",
          display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16
        }}>
          <div>
            <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 2, fontWeight: 700 }}>{isOwner ? "BUY vs RENT" : "INVESTMENT"} VERDICT</div>
            <div style={{ fontSize: 30, fontWeight: 900, color: a.vc, fontFamily: fm, letterSpacing: -1, marginTop: 2 }}>{a.verdict}</div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>
              <span style={{ color: a.vc, fontWeight: 700 }}>{a.score}</span>/100 score
            </div>
          </div>
          <div className="header-stats" style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {headerStats.map((s, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3, letterSpacing: 0.5 }}>{s.l}</div>
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: fm, color: s.c }}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tab nav ── */}
        <div className="tab-nav" style={{ display: "flex", gap: 4, marginTop: 18, flexWrap: "wrap" }}>
          {[["main", isOwner ? "Buy Analysis" : "Deal Analysis"], ["projection", "5/10yr Outlook"], ["sell", "Sell Analysis"], ["areas", "Neighborhoods"], ["mli", "🏢 MLI Select (5+)"]].map(([id, lb]) => (
            <Pill key={id} on={tab === id} color={id === "mli" ? C.gold : id === "sell" ? C.orange : C.brand} onClick={() => setTab(id)}>{lb}</Pill>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: MAIN
        ══════════════════════════════════════════════════════════════════════ */}
        {tab === "main" && (<>

          {/* Inputs row 1 */}
          <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
            <Fd l="MARKET">
              <select style={ss} value={market} onChange={e => handleMarketChange(e.target.value)}>
                {Object.entries(MARKETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Fd>
            <Fd l="PURCHASE PRICE">
              <input style={si} type="number" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} onWheel={e => e.target.blur()} step={5000} />
            </Fd>
            {isOwner && (
              <Fd l="YOUR CURRENT RENT">
                <input style={si} type="number" inputMode="decimal" value={curRent} onChange={e => setCurRent(e.target.value)} onWheel={e => e.target.blur()} step={50} />
              </Fd>
            )}
          </div>

          {/* Property type */}
          <div style={{ display: "flex", gap: 4, marginTop: 10, flexWrap: "wrap" }}>
            {[["condo","Condo"], ["detached","Detached"], ["duplex","Duplex / 4-plex"], ["multi","Multi (5+)"]].map(([id, lb]) => (
              <Pill key={id} on={propType === id} color={C.brand} onClick={() => {
                setPropType(id);
                if (!isOwner) {
                  if (id === "condo")    setUnits([{ type: "2bed",    rent: "" }]);
                  else if (id === "detached") setUnits([{ type: "2bed_nc", rent: "" }, { type: "garage", rent: "" }]);
                  else                   setUnits([{ type: "2bed",    rent: "" }, { type: "2bed",   rent: "" }]);
                }
              }}>{lb}</Pill>
            ))}
          </div>

          {/* Financing */}
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <Fd l="DOWN PAYMENT">
              <select style={ss} value={downPct} onChange={e => setDownPct(Number(e.target.value))}>
                {downOpts.map(d => <option key={d} value={d}>{(d * 100).toFixed(0)}%</option>)}
              </select>
            </Fd>
            <Fd l="INTEREST RATE %">
              <input style={si} type="number" inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} onWheel={e => e.target.blur()} step={0.05} />
            </Fd>
            <Fd l="AMORTIZATION">
              <select style={ss} value={amYrs} onChange={e => setAmYrs(Number(e.target.value))}>
                <option value={25}>25 years</option>
                <option value={30}>30 years</option>
              </select>
            </Fd>
          </div>

          {/* CMHC banner */}
          {a.cmhcAmt > 0 && (
            <div style={{ marginTop: 8, padding: "8px 14px", background: C.warnSoft, border: "1px solid " + C.warn + "30", borderRadius: 8, fontSize: 11, color: C.warn }}>
              <Tip id="cmhc">CMHC: {pct(a.cmhcR)} = {fmt$(a.cmhcAmt)} added to mortgage — put 20%+ down to eliminate this</Tip>
            </div>
          )}

          {/* Tax / condo / expenses */}
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <Fd l={"PROPERTY TAX / YR  (default " + fmt$((parseFloat(price)||0) * mk.taxRate) + ")"}>
              <input style={si} type="number" inputMode="decimal" placeholder={Math.round((parseFloat(price)||0) * mk.taxRate)} value={taxOvr} onChange={e => setTaxOvr(e.target.value)} />
            </Fd>
            {isCondo && (
              <Fd l={"CONDO FEES / MO  (default " + fmt$(mk.condoFees) + ")"}>
                <input style={si} type="number" inputMode="decimal" placeholder={mk.condoFees} value={condoOvr} onChange={e => setCondoOvr(e.target.value)} />
              </Fd>
            )}
            {!isOwner && (<>
              <Fd l="TENANT PAYS UTILITIES?">
                <div style={{ display: "flex", gap: 3, paddingTop: 2 }}>
                  <Pill on={tenantUtils}  color={C.pos}  onClick={() => setTenantUtils(true)}>Yes</Pill>
                  <Pill on={!tenantUtils} color={C.neg}  onClick={() => setTenantUtils(false)}>No</Pill>
                </div>
              </Fd>
              <Fd l="MAINTENANCE RESERVE">
                <select style={ss} value={maintPct} onChange={e => setMaintPct(Number(e.target.value))}>
                  <option value={0}>0%</option><option value={3}>3%</option>
                  <option value={5}>5% ✓ recommended</option><option value={8}>8%</option><option value={10}>10%</option>
                </select>
              </Fd>
            </>)}
          </div>

          {/* FTHB Programs (owner mode only) */}
          {isOwner && (
            <div style={{ marginTop: 12 }}>
              <button onClick={() => setShowFthb(v => !v)} style={{
                padding: "8px 14px", borderRadius: 7, border: "1px solid " + (showFthb ? C.pos : C.border),
                background: showFthb ? C.pos + "15" : "transparent",
                color: showFthb ? C.pos : C.textMuted,
                fontSize: 11, cursor: "pointer", fontFamily: ff, fontWeight: 700
              }}>
                {showFthb ? "▾" : "▸"} First-Time Buyer Programs
              </button>
              {showFthb && (
                <Card sx={{ marginTop: 8 }} accent={C.pos}>
                  <SL>FTHB Programs (Federal + SK/AB)</SL>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, color: C.textSec }}>First-time buyer?</span>
                    <Pill on={isFirstTime}  color={C.pos} onClick={() => setIsFirstTime(true)}>Yes</Pill>
                    <Pill on={!isFirstTime} color={C.neg} onClick={() => setIsFirstTime(false)}>No</Pill>
                  </div>
                  {isFirstTime ? (<>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                      <Fd l="FHSA BALANCE ($8K/yr, $40K lifetime)">
                        <input style={si} type="number" inputMode="decimal" value={fhsaBalance} onChange={e => setFhsaBalance(e.target.value)} onWheel={e => e.target.blur()} placeholder="0" />
                      </Fd>
                      <Fd l="HBP RRSP WITHDRAWAL (max $60K/person)">
                        <input style={si} type="number" inputMode="decimal" value={hbpAmount} onChange={e => setHbpAmount(e.target.value)} onWheel={e => e.target.blur()} placeholder="0" />
                      </Fd>
                    </div>
                    {(() => {
                      const fhsa = parseFloat(fhsaBalance) || 0;
                      const hbp  = parseFloat(hbpAmount)   || 0;
                      const fhsaTaxSave = fhsa * 0.33;
                      const isSK0 = market === "saskatoon" || market === "princeAlbert";
                      const totalSave = fhsaTaxSave + 1500 + (isSK0 ? 1575 : 0);
                      const adjCash = a.cashIn - fhsa - hbp;
                      return (
                        <div>
                          <Row label="FHSA deduction (est. ~33% marginal)" val={fmt$(fhsaTaxSave)} color={C.pos} />
                          <Row label="Federal HBTC (non-refundable)"       val="$1,500"            color={C.pos} />
                          {isSK0 && <Row label="SK HBTC (2025+)"          val="$1,575"            color={C.pos} />}
                          <Divider />
                          <Row label="Total estimated tax savings"         val={fmt$(totalSave)}   color={C.pos} />
                          <Row label="Effective cash needed"               val={fmt$(adjCash)}     color={C.orange} />
                          {hbp > 0 && (
                            <div style={{ marginTop: 8, padding: "8px 10px", background: C.warnSoft, borderRadius: 6, fontSize: 10, color: C.warn, lineHeight: 1.6 }}>
                              ⚠ HBP: RRSP funds must be on deposit 90+ days. Repay over 15 years or add to income.
                            </div>
                          )}
                          <div style={{ marginTop: 6, fontSize: 10, color: C.textMuted }}>
                            30-yr amortization available above. CMHC surcharge +0.20% applies.
                          </div>
                        </div>
                      );
                    })()}
                  </>) : (
                    <div style={{ fontSize: 11, color: C.textMuted }}>Toggle "Yes" to see FHSA, HBP, and HBTC credits.</div>
                  )}
                </Card>
              )}
            </div>
          )}

          {/* Rental units */}
          {!isOwner && (<>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 22 }}>
              <SL>Rental Units</SL>
              <button onClick={() => setUnits([...units, { type: isCondo ? "2bed" : "2bed_nc", rent: "" }])} style={{
                padding: "6px 14px", borderRadius: 6, border: "1px solid " + C.brand + "40",
                background: C.brandSoft, color: C.brand,
                fontSize: 11, cursor: "pointer", fontFamily: ff, fontWeight: 700
              }}>+ Add Unit</button>
            </div>
            {units.length === 0 && (
              <div style={{ padding: "18px", borderRadius: 10, background: C.brandSoft, border: "1px dashed " + C.brand + "40", textAlign: "center", fontSize: 12, color: C.brand }}>
                No units added yet — add at least one to see cash flow analysis
              </div>
            )}
            {units.map((u, i) => (
              <div key={i} style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "end" }}>
                <Fd l="UNIT TYPE">
                  <select style={ss} value={u.type} onChange={e => { const nu = [...units]; nu[i] = { ...nu[i], type: e.target.value }; setUnits(nu); }}>
                    {unitOpts.map(([id, lb]) => <option key={id} value={id}>{lb}</option>)}
                  </select>
                </Fd>
                <Fd l={"RENT  (market: " + fmt$(mk.rents[u.type] || 0) + "/mo)"}>
                  <input style={si} type="number" inputMode="decimal" placeholder={mk.rents[u.type] || 0} value={u.rent}
                    onChange={e => { const nu = [...units]; nu[i] = { ...nu[i], rent: e.target.value }; setUnits(nu); }} />
                </Fd>
                <button onClick={() => setUnits(units.filter((_, j) => j !== i))} style={{
                  padding: "10px 12px", borderRadius: 6, border: "1px solid " + C.neg + "30",
                  background: "transparent", color: C.neg, fontSize: 12, cursor: "pointer", fontWeight: 700, marginBottom: 1
                }}>✕</button>
              </div>
            ))}
            {units.length > 0 && (
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 7 }}>
                Gross <span style={{ color: C.textSec, fontWeight: 600 }}>{fmt$(a.grossMo)}/mo</span>
                &nbsp;·&nbsp;After {(mk.vac * 100).toFixed(0)}% vacancy:&nbsp;
                <span style={{ color: C.pos, fontWeight: 600 }}>{fmt$(a.egi / 12)}/mo effective</span>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <Fd l="RENOVATION BUDGET ($)">
                <input style={si} type="number" inputMode="decimal" value={renovCost} onChange={e => setRenovCost(e.target.value)} onWheel={e => e.target.blur()} placeholder="0" />
              </Fd>
              <Fd l="RENEWAL RATE SCENARIO (%)">
                <input style={si} type="number" inputMode="decimal" value={renewRateScen} onChange={e => setRenewRateScen(e.target.value)} onWheel={e => e.target.blur()} step={0.25} />
              </Fd>
            </div>
          </>)}

          {/* Summary cards */}
          <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 22 }}>
            <Card>
              <SL>Purchase Summary</SL>
              <Row label="Purchase Price"      val={fmt$(a.p)} />
              <Row label={"Down (" + (downPct * 100).toFixed(0) + "%)"} val={fmt$(a.down)} />
              {a.cmhcAmt > 0 && <Row label="CMHC Premium" val={fmt$(a.cmhcAmt)} color={C.warn} tip="cmhc" />}
              <Row label="Total Mortgage"      val={fmt$(a.totalMtg)}  color={C.purple} />
              <Row label="Monthly Payment"     val={fmt$2(a.moPmt)}    color={C.text}   />
              <div style={{ borderBottom: "1px solid " + C.borderSub }}>
                <div onClick={() => setShowClosing(v => !v)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", cursor: "pointer" }}>
                  <span style={{ fontSize: 12, color: C.textSec }}>{showClosing ? "▾" : "▸"} Closing Costs</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.textSec, fontFamily: fm }}>{fmt$(a.closing)}</span>
                </div>
                {showClosing && (
                  <div style={{ paddingLeft: 12, paddingBottom: 6 }}>
                    <Row label="Legal Fees"       val={fmt$(a.legalFees)}   />
                    <Row label="Land Title Fee"   val={fmt$(a.landFee)}     />
                    <Row label="Mtg Registration" val={fmt$(a.mtgRegFee)}   />
                    <Row label="Title Insurance"  val={fmt$(a.titleIns)}    />
                    <Row label="Inspection"       val={fmt$(a.inspection)}  />
                    {a.pstOnCmhc > 0 && <Row label="SK PST on CMHC (cash)" val={fmt$(a.pstOnCmhc)} color={C.warn} />}
                    <Row label="Tax Adjustment"   val={fmt$(a.taxAdj)}      />
                    <Row label="Misc"             val={fmt$(a.miscClose)}   />
                    {a.rv > 0 && <Row label="Renovation Budget" val={fmt$(a.rv)} color={C.orange} />}
                  </div>
                )}
              </div>
              <Row label="Cash Needed at Close"val={fmt$(a.cashIn)}    color={C.orange} />
            </Card>

            {isOwner ? (
              <Card>
                <SL><Tip id="moCost">Monthly Ownership Cost</Tip></SL>
                <Row label="Mortgage"         val={fmt$2(a.moPmt)}   />
                <Row label="Property Tax"     val={fmt$2(a.moTax)}   />
                {isCondo && <Row label="Condo Fees" val={fmt$2(a.moCondo)} />}
                <Divider />
                <Row label="Total Monthly"    val={fmt$2(a.ownMo)}   color={C.text}   />
                <Row label="Your Current Rent"val={fmt$2(a.cr)}      color={C.textMuted} />
                <Row label={a.rentSave >= 0 ? "Monthly Savings" : "Extra vs Renting"}
                     val={fmt$2(Math.abs(a.rentSave))}
                     color={a.rentSave >= 0 ? C.pos : C.orange} tip="rvb" />
                <div style={{ marginTop: 10, fontSize: 11, color: C.textMuted, lineHeight: 1.65 }}>
                  {a.rentSave >= 0
                    ? "Owning costs less. Save " + fmt$(a.rentSave) + "/mo while building equity."
                    : "Costs " + fmt$(-a.rentSave) + "/mo more — but you build " + fmt$(a.s5.principal) + " equity over 5 years."}
                </div>
              </Card>
            ) : (
              <Card>
                <SL>Annual Operating</SL>
                <Row label="Effective Income"  val={fmt$(a.egi)}     />
                <Row label="Property Tax"      val={fmt$(a.annTax)}  />
                {a.annCondo > 0 && <Row label="Condo Fees" val={fmt$(a.annCondo)} />}
                {tenantUtils
                  ? <Row label="Utilities" val="Tenant pays" color={C.pos} />
                  : <Row label="Utilities" val={fmt$(a.utilCost)} />}
                <Row label={"Maintenance (" + maintPct + "%)"}  val={fmt$(a.maint)} tip="maint" />
                <Divider />
                <Row label="NOI"           val={fmt$(a.noi)}      color={a.noi >= 0 ? C.pos : C.neg} tip="noi" />
                <Row label="Annual Cash Flow" val={fmt$(a.cashFlow)} color={a.cashFlow >= 0 ? C.pos : C.neg} tip="cf" />
              </Card>
            )}
          </div>

          {/* Metrics */}
          <div className="grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginTop: 10 }}>
            {isOwner ? (<>
              <Metric label="Monthly Cost"  val={fmt$2(a.ownMo)}              good={a.rentSave >= 0}   tip="moCost" />
              <Metric label="vs Rent"       val={a.rentSave >= 0 ? "−" + fmt$(a.rentSave) : "+" + fmt$(-a.rentSave)} good={a.rentSave >= 0} tip="rvb" />
              <Metric label="5yr Equity"    val={fmt$(a.eq5)}                 neutral={true}           tip="equity" />
              <Metric label="10yr Equity"   val={fmt$(a.eq10)}                neutral={true}           tip="equity" />
              <Metric label="Principal 5yr" val={fmt$(a.s5.principal)}        good={true}              tip="princ" />
              <Metric label="Interest 5yr"  val={fmt$(a.s5.interest)}         good={false}             tip="princ" />
              <Metric label="Value in 5yr"  val={fmt$(a.v5)}                  neutral={true}           tip="appr"  />
              <Metric label="Net Gain 5yr"  val={fmt$(a.netAdv5)}             good={a.netAdv5 >= 0}    />
            </>) : (<>
              <Metric label="Cap Rate"      val={pct(a.capRate)}              good={a.capRate >= 0.05} tip="capRate" />
              <Metric label="Cash-on-Cash"  val={pct(a.coc)}                 good={a.coc >= 0.04}     tip="coc"    />
              <Metric label="DSCR"          val={a.dscr.toFixed(2)}          good={a.dscr >= 1.25}    tip="dscr"   />
              <Metric label="GRM"           val={a.grm > 0 ? a.grm.toFixed(1) : "—"} good={a.grm > 0 && a.grm <= 15} tip="grm" />
              <Metric label="Monthly CF"    val={fmt$(a.moCF)}               good={a.moCF >= 0}       tip="cf"     />
              <Metric label="Annual CF"     val={fmt$(a.cashFlow)}           good={a.cashFlow >= 0}   tip="cf"     />
              <Metric label="5yr ROI"       val={pct(a.roi5)}                good={a.roi5 >= 0.06}    />
              <Metric label="10yr ROI"      val={pct(a.roi10)}               good={a.roi10 >= 0.06}   />
              <Metric label="Break-Even Occ." val={a.beo > 0 ? pct1(a.beo) : "—"} good={a.beo > 0 && a.beo < 0.85} neutral={a.beo >= 0.85 && a.beo <= 0.95} tip="beo" />
              <Metric label="Lev. Premium"  val={a.capRate > 0 ? (a.levPrem >= 0 ? "+" : "") + pct1(a.levPrem) : "—"} good={a.levPrem > 0} neutral={a.levPrem === 0} tip="levPrem" />
            </>)}
          </div>

          {/* Signals */}
          <Card sx={{ marginTop: 10 }}>
            <SL>Deal Signals</SL>
            {a.signals.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.c, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: s.c, lineHeight: 1.4 }}>{s.x}</span>
              </div>
            ))}
          </Card>

          {/* Down payment comparison table */}
          <div style={{ marginTop: 22 }}>
            <SL>Down Payment Comparison — tap a row to select</SL>
            <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid " + C.border }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 480 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid " + C.border, background: C.surface }}>
                    {["%", "Down", "CMHC", "Mortgage", "Payment", isOwner ? "Mo Cost" : "Mo CF", "Cash In"].map(h => (
                      <th key={h} style={{ padding: "10px 10px", color: C.textMuted, fontWeight: 700, textAlign: "right", fontSize: 10, letterSpacing: 0.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {downOpts.map(d => {
                    const p0   = parseFloat(price) || 0;
                    const dn   = p0 * d;
                    const b    = p0 - dn;
                    const cmr  = (d < 0.20 && p0 <= 1500000) ? getCmhcRate(d) : 0;
                    const cp   = b * cmr;
                    const tm   = b + cp;
                    const pmt  = mortgagePayment(tm, (parseFloat(rate)||0) / 100, amYrs);
                    const isSK0 = market === "saskatoon" || market === "princeAlbert";
                    const pst0  = isSK0 ? cp * 0.06 : 0;
                    const landFee0 = p0 > 0 ? (isSK0 ? skLandTitleFee(p0) : abLandTitleFee(p0)) : 0;
                    const mtgReg0  = tm > 0  ? (isSK0 ? skMtgRegFee(tm) : abMtgRegFee(tm)) : 0;
                    const ci   = dn + 1400 + landFee0 + mtgReg0 + 800 + pst0 + (a.annTax / 12) + 150;
                    const mc   = pmt + a.moTax + a.moCondo;
                    const mcf  = a.noi / 12 - pmt;
                    const act  = d === downPct;
                    return (
                      <tr key={d} onClick={() => setDownPct(d)} style={{
                        borderBottom: "1px solid " + C.borderSub,
                        background: act ? C.brand + "0e" : "transparent",
                        cursor: "pointer"
                      }}>
                        <td style={{ padding: "9px 10px", textAlign: "right", color: act ? C.brand : C.textMuted, fontWeight: act ? 800 : 500 }}>{(d * 100).toFixed(0)}%</td>
                        <td style={{ padding: "9px 10px", textAlign: "right", color: C.textSec,  fontFamily: fm }}>{fmt$(dn)}</td>
                        <td style={{ padding: "9px 10px", textAlign: "right", color: cmr ? C.warn : C.borderSub, fontFamily: fm }}>{cmr ? fmt$(cp) : "—"}</td>
                        <td style={{ padding: "9px 10px", textAlign: "right", color: C.textSec,  fontFamily: fm }}>{fmt$(tm)}</td>
                        <td style={{ padding: "9px 10px", textAlign: "right", color: C.text,     fontFamily: fm, fontWeight: 700 }}>{fmt$2(pmt)}</td>
                        <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: fm, fontWeight: 700,
                          color: isOwner ? (mc <= a.cr ? C.pos : C.orange) : (mcf >= 0 ? C.pos : C.neg)
                        }}>{isOwner ? fmt$2(mc) : fmt$(mcf)}</td>
                        <td style={{ padding: "9px 10px", textAlign: "right", color: C.orange, fontFamily: fm }}>{fmt$(ci)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>)}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: PROJECTION
        ══════════════════════════════════════════════════════════════════════ */}
        {tab === "projection" && (<>
          <Card sx={{ marginTop: 18 }} accent={C.brand}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.brand }}><Tip id="appr">APPRECIATION RATE</Tip></div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 10, color: C.textMuted }}>Custom % / yr:</span>
                <input style={{ ...si, width: 80, padding: "6px 10px", fontSize: 12, textAlign: "center" }}
                  type="number" inputMode="decimal" step={0.5} placeholder="auto" value={growthOvr}
                  onChange={e => setGrowthOvr(e.target.value)} />
                {growthOvr && (
                  <button onClick={() => setGrowthOvr("")} style={{
                    padding: "6px 10px", borderRadius: 5, border: "1px solid " + C.border,
                    background: "transparent", color: C.textMuted, fontSize: 10, cursor: "pointer", fontFamily: ff
                  }}>Clear</button>
                )}
              </div>
            </div>
            <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.65, marginBottom: 12 }}>
              Real estate doesn't grow steadily. Three scenarios show the realistic range for {mk.label}.
            </div>
            {!growthOvr && (
              <div style={{ display: "flex", gap: 8 }}>
                {[["Conservative", mk.growth.low, C.neg], ["Moderate", mk.growth.mid, C.warn], ["Optimistic", mk.growth.high, C.pos]].map(([lb, r, c]) => (
                  <div key={lb} style={{ flex: 1, padding: "10px 12px", borderRadius: 8, background: c + "0c", border: "1px solid " + c + "25", textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: c, fontWeight: 700 }}>{lb}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: c, fontFamily: fm }}>{pct1(r)}/yr</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {scn && !growthOvr ? [5, 10].map(yr => {
            const sch = yr === 5 ? a.s5 : a.s10;
            return (
              <div key={yr} style={{ marginTop: 24 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 12 }}>{yr}-Year Outlook</div>
                <Card sx={{ marginBottom: 10 }}>
                  <SL><Tip id="princ">Mortgage Breakdown ({yr}yr)</Tip></SL>
                  <Row label="Total Paid"              val={fmt$(sch.total)}     />
                  <Row label="Principal (your equity)" val={fmt$(sch.principal)} color={C.pos}  />
                  <Row label="Interest (bank profit)"  val={fmt$(sch.interest)}  color={C.neg}  />
                  <Row label="Balance Remaining"       val={fmt$(sch.bal)}       />
                  <div style={{ marginTop: 10, height: 8, borderRadius: 4, background: C.surface3, overflow: "hidden", display: "flex" }}>
                    <div style={{ width: (sch.principal / sch.total * 100) + "%", background: C.pos }} />
                    <div style={{ flex: 1, background: C.neg }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.textMuted, marginTop: 4 }}>
                    <span>Principal {(sch.principal / sch.total * 100).toFixed(0)}%</span>
                    <span>Interest {(sch.interest / sch.total * 100).toFixed(0)}%</span>
                  </div>
                </Card>
                <div className="grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {[["Conservative", scn.low, C.neg], ["Moderate", scn.mid, C.warn], ["Optimistic", scn.high, C.pos]].map(([lb, sc, c]) => {
                    const val = yr === 5 ? sc.v5  : sc.v10;
                    const eq  = yr === 5 ? sc.eq5 : sc.eq10;
                    const eG  = eq - sc.cashIn;
                    return (
                      <Card key={lb} accent={c}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: c, marginBottom: 8 }}>{lb} ({pct1(sc.gr)}/yr)</div>
                        <Row label="Value"  val={fmt$(val)} color={c} />
                        <Row label="Equity" val={fmt$(eq)}              />
                        <Row label="Gain"   val={fmt$(eG)}  color={eG >= 0 ? C.pos : C.neg} />
                        {isOwner && (<>
                          <Divider />
                          <Row label={"Rent Paid (" + yr + "yr)"}  val={fmt$(a.cr * yr * 12)} color={C.neg} />
                          <Row label="Net Advantage" val={fmt$(eG - (a.ownMo * yr * 12 - a.cr * yr * 12))}
                               color={(eG - (a.ownMo * yr * 12 - a.cr * yr * 12)) >= 0 ? C.pos : C.neg} />
                        </>)}
                        {!isOwner && (<>
                          <Divider />
                          <Row label={"Cash Flow (" + yr + "yr)"} val={fmt$(sc.cashFlow * yr)} color={sc.cashFlow >= 0 ? C.pos : C.neg} />
                          <Row label="Total Return" val={fmt$(eG + sc.cashFlow * yr)} color={C.text} />
                          {(() => {
                            const exitC = calcCommission(market, val).total + 1000;
                            const netRet = eG + sc.cashFlow * yr - exitC;
                            return (<>
                              <Row label="Est. Exit Costs" val={"−" + fmt$(exitC)} color={C.neg} />
                              <Row label="Net After Sale"  val={fmt$(netRet)} color={netRet >= 0 ? C.pos : C.neg} />
                            </>);
                          })()}
                        </>)}
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          }) : (
            <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 18 }}>
              {[{ yr: 5, sch: a.s5, val: a.v5, eq: a.eq5 }, { yr: 10, sch: a.s10, val: a.v10, eq: a.eq10 }].map(p => (
                <Card key={p.yr}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.purple, fontFamily: fm, marginBottom: 12 }}>{p.yr}-YEAR</div>
                  <SL>Mortgage</SL>
                  <Row label="Paid"      val={fmt$(p.sch.total)}     />
                  <Row label="Principal" val={fmt$(p.sch.principal)} color={C.pos} />
                  <Row label="Interest"  val={fmt$(p.sch.interest)}  color={C.neg} />
                  <Row label="Balance"   val={fmt$(p.sch.bal)}       />
                  <div style={{ marginTop: 12 }}><SL>If You Sell</SL></div>
                  <Row label={"Value (" + growthOvr + "%/yr)"} val={fmt$(p.val)}              color={C.purple} />
                  <Row label="Equity"                           val={fmt$(p.eq)}              color={C.pos}    />
                  <Row label="Gain"                             val={fmt$(p.eq - a.cashIn)}   color={(p.eq - a.cashIn) >= 0 ? C.pos : C.neg} />
                  {(() => {
                    const exitC = calcCommission(market, p.val).total + 1000;
                    const netGain = p.eq - a.cashIn - exitC;
                    return (<>
                      <Row label="Est. Exit Costs" val={"−" + fmt$(exitC)} color={C.neg} />
                      <Row label="Net After Exit"  val={fmt$(netGain)} color={netGain >= 0 ? C.pos : C.neg} />
                    </>);
                  })()}
                </Card>
              ))}
            </div>
          )}

          {/* Renewal Risk (investor only) */}
          {!isOwner && (
            <Card sx={{ marginTop: 20 }} accent={C.warn}>
              <SL>Mortgage Renewal Risk at 5 Years</SL>
              {(() => {
                const renewR = parseFloat(renewRateScen) || 0;
                const bal5   = a.s5.bal;
                const remYrs = Math.max(1, amYrs - 5);
                const newPmt = mortgagePayment(bal5, renewR / 100, remYrs);
                const delta  = newPmt - a.moPmt;
                return (
                  <div>
                    <Row label="Balance at 5yr"               val={fmt$(bal5)}                          />
                    <Row label="Current payment"              val={fmt$2(a.moPmt)}                      />
                    <Row label={"Payment at " + renewR + "%"} val={fmt$2(newPmt)} color={delta > 0 ? C.neg : C.pos} />
                    <Row label="Monthly delta"                val={(delta >= 0 ? "+" : "") + fmt$2(delta)} color={delta > 0 ? C.neg : C.pos} />
                    <Row label="Annual delta"                 val={(delta >= 0 ? "+" : "") + fmt$(delta * 12)} color={delta > 0 ? C.neg : C.pos} />
                    <div style={{ marginTop: 8, fontSize: 10, color: C.textMuted }}>
                      Adjust "Renewal Rate Scenario" in Deal Analysis inputs above.
                    </div>
                  </div>
                );
              })()}
            </Card>
          )}
        </>)}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: SELL ANALYSIS
        ══════════════════════════════════════════════════════════════════════ */}
        {tab === "sell" && (<>
          <Card sx={{ marginTop: 18 }} accent={C.orange}>
            <SL>Sale Details</SL>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Fd l="EXPECTED SALE PRICE (blank = purchase price)">
                <input style={si} type="number" inputMode="decimal" value={sellPrice} onChange={e => setSellPrice(e.target.value)} onWheel={e => e.target.blur()} placeholder={price || "0"} />
              </Fd>
              <Fd l="ORIGINAL PURCHASE PRICE">
                <input style={si} type="number" inputMode="decimal" value={origPurchPrice} onChange={e => setOrigPurchPrice(e.target.value)} onWheel={e => e.target.blur()} placeholder={price || "0"} />
              </Fd>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              <Fd l="YEAR PURCHASED">
                <input style={si} type="number" inputMode="decimal" value={purchaseYear} onChange={e => setPurchaseYear(e.target.value)} onWheel={e => e.target.blur()} />
              </Fd>
              <Fd l="CAPITAL IMPROVEMENTS ($)">
                <input style={si} type="number" inputMode="decimal" value={capImprov} onChange={e => setCapImprov(e.target.value)} onWheel={e => e.target.blur()} placeholder="0" />
              </Fd>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              <Fd l="CCA CLAIMED (investor properties)">
                <input style={si} type="number" inputMode="decimal" value={ccaClaimed} onChange={e => setCcaClaimed(e.target.value)} onWheel={e => e.target.blur()} placeholder="0" />
              </Fd>
              <Fd l="OTHER INCOME THIS YEAR ($)">
                <input style={si} type="number" inputMode="decimal" value={otherIncome} onChange={e => setOtherIncome(e.target.value)} onWheel={e => e.target.blur()} placeholder="0" />
              </Fd>
              <Fd l="PREPAYMENT PENALTY ($)">
                <input style={si} type="number" inputMode="decimal" value={mortgPenalty} onChange={e => setMortgPenalty(e.target.value)} onWheel={e => e.target.blur()} placeholder="0" />
              </Fd>
            </div>
          </Card>

          {(() => {
            const sp      = parseFloat(sellPrice)     || parseFloat(price) || 0;
            const opp     = parseFloat(origPurchPrice)|| parseFloat(price) || 0;
            const ci0     = parseFloat(capImprov)     || 0;
            const cca0    = parseFloat(ccaClaimed)    || 0;
            const oi      = parseFloat(otherIncome)   || 0;
            const penalty = parseFloat(mortgPenalty)  || 0;
            const isSK0   = market === "saskatoon" || market === "princeAlbert";
            const commData = calcCommission(market, sp);
            const legalSell = 1000;
            const rpr = (propType !== "condo") ? 900 : 0;
            const discharge = 300;
            const totalSellCosts = commData.total + legalSell + rpr + discharge + penalty;
            const grossProceeds = sp - totalSellCosts;
            const yearsHeld = Math.max(0, new Date().getFullYear() - (parseInt(purchaseYear) || new Date().getFullYear()));
            const remBal = yearsHeld > 0 ? amortSchedule(a.totalMtg, a.r / 100, amYrs, yearsHeld).bal : a.totalMtg;
            const equityBefore = grossProceeds - remBal;
            const acb = opp + ci0;
            const cg = Math.max(0, (sp - totalSellCosts) - acb);
            const cgTax = calcCapGainsTax(cg, oi, market);
            const ccaRecap = Math.max(0, Math.min(cca0, opp > 0 ? sp - opp : 0));
            const ccaRecapTax = ccaRecap * (isSK0 ? 0.475 : 0.48);
            const netProceeds = equityBefore - cgTax - ccaRecapTax;
            return (
              <Card sx={{ marginTop: 12 }} accent={C.orange}>
                <SL>Seller Net Sheet</SL>
                <Row label="Sale Price"                      val={fmt$(sp)}                         color={C.text}   />
                <Row label={"Commission (" + (isSK0 ? "SK 6/4/2 ×1.11" : "AB 7/3.5 ×1.05") + ")"} val={"−" + fmt$(commData.total)} color={C.neg} />
                <Row label="Legal Fees"                      val="−$1,000"                          color={C.neg}    />
                {rpr > 0 && <Row label="RPR / Survey"        val="−$900"                            color={C.neg}    />}
                <Row label="Mortgage Discharge"              val="−$300"                            color={C.neg}    />
                {penalty > 0 && <Row label="Prepayment Penalty" val={"−" + fmt$(penalty)}           color={C.neg}    />}
                <Divider />
                <Row label="Gross Proceeds After Sale Costs" val={fmt$(grossProceeds)}              color={C.warn}   />
                <Row label={"Mortgage Balance (" + yearsHeld + "yr held)"} val={"−" + fmt$(remBal)} color={C.neg}   />
                <Divider />
                <Row label="Equity Before Tax"               val={fmt$(equityBefore)} color={equityBefore >= 0 ? C.pos : C.neg} />
                {cg > 0 && <Row label="Capital Gain (50% inclusion)" val={fmt$(cg)}                color={C.warn}   />}
                {cg > 0 && <Row label="Est. Capital Gains Tax"       val={"−" + fmt$(cgTax)}       color={C.neg}    />}
                {ccaRecap > 0 && <Row label="CCA Recapture (full inclusion)" val={"−" + fmt$(ccaRecapTax)} color={C.neg} />}
                <Divider />
                <Row label="Estimated Net Proceeds"          val={fmt$(netProceeds)} color={netProceeds >= 0 ? C.pos : C.neg} />
                <div style={{ marginTop: 10, fontSize: 10, color: C.textMuted, lineHeight: 1.6 }}>
                  Commission: {isSK0 ? "6% first $100K + 4% $100–200K + 2% balance, ×1.11 (SK: GST+PST)" : "7% first $100K + 3.5% balance, ×1.05 (GST)"} ·
                  Capital gains use 50% inclusion rate (2/3 rate cancelled Mar 2025) ·
                  CCA recapture taxed at full marginal rate ·
                  Consult a CPA for actual tax position
                </div>
              </Card>
            );
          })()}
        </>)}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: NEIGHBORHOODS
        ══════════════════════════════════════════════════════════════════════ */}
        {tab === "areas" && (
          <div style={{ marginTop: 18 }}>
            <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
              {Object.entries(MARKETS).map(([k, v]) => (
                <Pill key={k} on={market === k} color={C.brand} onClick={() => handleMarketChange(k)}>{v.label}</Pill>
              ))}
            </div>
            <SL>{mk.label} — Neighborhood Guide</SL>
            {mk.hoods.map((h, i) => {
              const tCol = h.t.startsWith("A") ? C.pos : h.t === "B+" ? C.warn : C.orange;
              return (
                <Card key={i} sx={{ marginTop: 8, cursor: "pointer" }} onClick={() => { setPrice(String(h.p)); setGrowthOvr((h.g * 100).toFixed(1)); setTab("main"); }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Badge color={tCol}>{h.t}</Badge>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{h.n}</span>
                    </div>
                    <div style={{ display: "flex", gap: 18 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 9, color: C.textMuted }}>Avg Price</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.textSec, fontFamily: fm }}>{fmt$(h.p)}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 9, color: C.textMuted }}>Growth</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.purple, fontFamily: fm }}>{pct1(h.g)}/yr</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 5 }}>
                    {h.desc} · <span style={{ color: C.brand, fontWeight: 600 }}>Tap to analyze →</span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: MLI SELECT
        ══════════════════════════════════════════════════════════════════════ */}
        {tab === "mli" && <MLISelect />}

        {/* ── Disclaimer ── */}
        <div style={{ marginTop: 28, padding: "12px 16px", borderRadius: 8, background: C.surface, border: "1px solid " + C.border, fontSize: 11, color: C.textMuted, lineHeight: 1.65 }}>
          ⚠️ Estimates based on market averages. Not guaranteed. Speak with Hasan Sharif before making any real estate decision —{" "}
          <a href="tel:3068507687" style={{ color: C.brand, textDecoration: "none", fontWeight: 600 }}>306-850-7687</a>
        </div>

        {/* ── Print-only signature block ── */}
        <div className="print-only print-footer">
          <div className="print-header">
            <div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>Hasan Sharif, REALTOR®</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>eXp Realty</div>
              <div style={{ fontSize: 12, marginTop: 2 }}>Licensed in Saskatchewan &amp; Alberta</div>
              <div style={{ fontSize: 12, marginTop: 1 }}>Residential · Commercial · Farming</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>306-850-7687</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>hasan.sharif.realtor@gmail.com</div>
              {address && <div style={{ fontSize: 12, marginTop: 6, fontWeight: 700 }}>Property: {address}</div>}
              <div style={{ fontSize: 11, marginTop: 4, color: "#555" }}>
                Generated {new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 10, color: "#666", lineHeight: 1.7 }}>
            This analysis is an estimate only and does not constitute financial, legal, or investment advice.
            All figures are based on market averages and assumptions provided by the user. Results may vary.
            Consult a licensed mortgage broker, accountant, and legal professional before making any real estate decision.
            Hasan Sharif is a licensed REALTOR® — not a financial advisor or mortgage broker.
          </div>
        </div>

      </div>{/* end max-width */}

      {/* ── Floating action buttons ── */}
      <div className="floating-actions no-print" style={{ position: "fixed", bottom: 20, right: 16, display: "flex", gap: 8, zIndex: 100 }}>
        <button onClick={handleCopyLink} style={{
          padding: "11px 18px", borderRadius: 9,
          background: copied ? C.pos + "18" : C.surface,
          color: copied ? C.pos : C.purple,
          border: "1px solid " + (copied ? C.pos + "40" : C.border),
          cursor: "pointer", fontFamily: ff, fontSize: 12, fontWeight: 700,
          boxShadow: "0 4px 20px rgba(0,0,0,0.6)"
        }}>
          {copied ? "✓ Copied!" : "🔗 Share"}
        </button>
        <button onClick={() => window.print()} style={{
          padding: "11px 20px", borderRadius: 9,
          background: C.brand, color: "#fff", border: "none",
          cursor: "pointer", fontFamily: ff, fontSize: 12, fontWeight: 700,
          boxShadow: "0 4px 20px " + C.brand + "55"
        }}>
          ⬇ Print / PDF
        </button>
      </div>

    </div>
  );
}
