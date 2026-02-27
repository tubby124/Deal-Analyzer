import { useState, useMemo } from "react";

// ─── Design Tokens (matches DealAnalyzer.jsx) ─────────────────────────────────
const C = {
  bg: "#070b14", surface: "#0d1121", surface2: "#111728", surface3: "#161d32",
  border: "#1e2847", borderSub: "#131a30",
  text: "#eef0f8", textSec: "#8b96b8", textMuted: "#4d5878",
  brand: "#6470ff", brandSoft: "#6470ff20",
  pos: "#10d98e", posSoft: "#10d98e18",
  warn: "#f5a623", warnSoft: "#f5a62318",
  neg: "#ff5757", negSoft: "#ff575718",
  purple: "#a78bfa", purpleSoft: "#a78bfa18",
  gold: "#f5c842", orange: "#fb923c",
};

// ─── Market Data (research-based, Feb 2026) ───────────────────────────────────
const MLI_MARKETS = {
  edmonton: {
    label: "Edmonton, AB",
    rents: { bachelor: 1050, "1bed": 1330, "2bed": 1506, "3bed": 1800 },
    vacRate: 0.05,         // lender underwriting floor (actual ~3.8% but lenders use 5%)
    mgmtPct: 0.08,         // 8% of EGI
    insurancePerUnit: 600, // $/unit/yr (mid-age building)
    maintPerUnit: 1500,    // $/unit/yr maintenance + CapEx reserve
    taxRate: 0.01014,      // 1.014% of assessed value (2025 composite)
    growth: { low: 0.015, mid: 0.03, high: 0.05 },
    capRate: { low: 0.05, mid: 0.055, high: 0.065 },
    medianRenterIncome: 50000,  // CMHC median renter household income (approx.)
    pricePerDoor: { low: 130000, mid: 180000, high: 225000 },
  },
  calgary: {
    label: "Calgary, AB",
    rents: { bachelor: 1363, "1bed": 1625, "2bed": 1870, "3bed": 2200 },
    vacRate: 0.05,
    mgmtPct: 0.10,
    insurancePerUnit: 650,
    maintPerUnit: 1500,
    taxRate: 0.00618,      // 0.618% of assessed value (2025)
    growth: { low: 0.015, mid: 0.03, high: 0.05 },
    capRate: { low: 0.055, mid: 0.06, high: 0.07 },
    medianRenterIncome: 56000,
    pricePerDoor: { low: 235000, mid: 300000, high: 402000 },
  },
  saskatoon: {
    label: "Saskatoon, SK",
    rents: { bachelor: 975, "1bed": 1175, "2bed": 1400, "3bed": 1750 },
    vacRate: 0.05,
    mgmtPct: 0.08,
    insurancePerUnit: 500,
    maintPerUnit: 1200,
    taxRate: 0.01251 * 0.80, // 1.251% × 80% POV = 1.001% effective on appraised value
    growth: { low: 0.02, mid: 0.035, high: 0.055 },
    capRate: { low: 0.055, mid: 0.065, high: 0.075 },
    medianRenterIncome: 48000,
    pricePerDoor: { low: 150000, mid: 200000, high: 270000 },
  },
};

// ─── MLI Select Tiers (post July 14, 2025 restructuring) ─────────────────────
// Tier 1: 50–69 pts | Tier 2: 70–99 pts | Tier 3: 100 pts
const MLI_TIERS = [
  { minPts: 50, maxPts: 69, tier: 1, label: "Tier 1", ltvExisting: 0.85, ltvNew: 0.95, amort: 40, discount: 0.10, limitedRecourse: false },
  { minPts: 70, maxPts: 99, tier: 2, label: "Tier 2", ltvExisting: 0.95, ltvNew: 0.95, amort: 45, discount: 0.20, limitedRecourse: false },
  { minPts: 100, maxPts: 250, tier: 3, label: "Tier 3", ltvExisting: 0.95, ltvNew: 0.95, amort: 50, discount: 0.30, limitedRecourse: true },
];

// ─── Premium Calculation (Standard Rental, Purchase/Refinance) ────────────────
// Base rates by LTV (post July 14, 2025)
function getBasePremium(ltv) {
  if (ltv <= 0.65) return 0.0260;
  if (ltv <= 0.70) return 0.0285;
  if (ltv <= 0.75) return 0.0335;
  if (ltv <= 0.80) return 0.0435;
  if (ltv <= 0.85) return 0.0535;
  if (ltv <= 0.90) return 0.0590; // MLI Select only
  return 0.0615;                  // >90% MLI Select only
}

// Amortization surcharge: +0.25% per 5-year increment beyond 25 years
function getAmortSurcharge(amortYrs) {
  if (amortYrs <= 25) return 0;
  return 0.0025 * Math.ceil((amortYrs - 25) / 5);
}

// Full MLI Select premium = (base + surcharge) × (1 − discount)
function calcMliPremium(ltv, amortYrs, discountPct) {
  return (getBasePremium(ltv) + getAmortSurcharge(amortYrs)) * (1 - discountPct);
}

// ─── Finance Helpers ──────────────────────────────────────────────────────────
function mortgagePayment(prin, annRate, yrs) {
  const r = annRate / 12, n = yrs * 12;
  if (r === 0) return prin / n;
  return prin * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function balanceAfter(prin, annRate, amYrs, holdYrs) {
  const r = annRate / 12, n = amYrs * 12;
  const pmt = r === 0 ? prin / n : prin * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  if (r === 0) return Math.max(0, prin - pmt * holdYrs * 12);
  const m = holdYrs * 12;
  return Math.max(0, prin * Math.pow(1 + r, m) - pmt * (Math.pow(1 + r, m) - 1) / r);
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const ff = "'Outfit', sans-serif";
const fm = "'JetBrains Mono', monospace";
function fmt$(n)  { return n.toLocaleString("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function fmt$2(n) { return n.toLocaleString("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function pct(n)   { return (n * 100).toFixed(2) + "%"; }
function pct1(n)  { return (n * 100).toFixed(1) + "%"; }
function n2(n)    { return n.toFixed(2); }

// ─── UI Components ────────────────────────────────────────────────────────────
function SL({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: 1.3, textTransform: "uppercase", marginBottom: 10 }}>
      {children}
    </div>
  );
}

function Card({ children, sx, accent }) {
  return (
    <div data-card style={{
      background: C.surface, border: "1px solid " + (accent ? accent + "38" : C.border),
      borderRadius: 12, padding: 16, ...(sx || {})
    }}>
      {children}
    </div>
  );
}

function Row({ label, val, color, bold }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid " + C.borderSub }}>
      <span style={{ fontSize: 12, color: C.textSec, flex: 1 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: bold ? 800 : 700, color: color || C.textSec, fontFamily: fm, textAlign: "right", marginLeft: 8 }}>{val}</span>
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: "1px solid " + C.borderSub, margin: "10px 0" }} />;
}

function Badge({ color, children }) {
  return (
    <span style={{ padding: "3px 9px", borderRadius: 5, fontSize: 10, fontWeight: 700, background: color + "1a", color, border: "1px solid " + color + "35" }}>
      {children}
    </span>
  );
}

function InfoBox({ color, children }) {
  return (
    <div style={{ padding: "10px 14px", borderRadius: 8, background: color + "10", border: "1px solid " + color + "30", fontSize: 12, color: C.textSec, lineHeight: 1.65, marginTop: 8 }}>
      {children}
    </div>
  );
}

function Fd({ l, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
      <label style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, letterSpacing: 0.8 }}>{l}</label>
      {children}
    </div>
  );
}

// ─── Main MLI Select Component ────────────────────────────────────────────────
export default function MLISelect() {
  // Input styles
  const si = {
    background: C.surface2, border: "1px solid " + C.border, borderRadius: 7,
    padding: "10px 12px", color: C.text, fontSize: 13, fontFamily: ff,
    outline: "none", width: "100%", boxSizing: "border-box",
  };
  const ss = { ...si, cursor: "pointer" };

  // ── State ────────────────────────────────────────────────────────────────────
  const [market, setMarket]           = useState("edmonton");
  const [isNew, setIsNew]             = useState(false);
  const [unitMix, setUnitMix]         = useState([
    { type: "1bed", count: 4, rent: "" },
    { type: "2bed", count: 4, rent: "" },
  ]);

  // Points
  const [affordPts, setAffordPts]     = useState(0);
  const [durationBonus, setDuration]  = useState(false); // +30 pts for 20yr covenant
  const [energyPts, setEnergyPts]     = useState(0);
  const [accessPts, setAccessPts]     = useState(0);

  // Financing
  const [purchasePrice, setPurchasePrice] = useState("1400000");
  const [rateStr, setRateStr]         = useState("4.25");
  const [termYrs, setTermYrs]         = useState(5);
  const [amOvr, setAmOvr]             = useState("");
  const [ltvOvr, setLtvOvr]           = useState("");

  // Operating overrides
  const [vacOvr, setVacOvr]           = useState("");
  const [mgmtOvr, setMgmtOvr]         = useState("");
  const [taxOvr, setTaxOvr]           = useState("");
  const [insuranceOvr, setInsuranceOvr] = useState("");
  const [maintOvr, setMaintOvr]       = useState("");
  const [utilitiesOvr, setUtilitiesOvr] = useState("");

  const mk = MLI_MARKETS[market];

  // ── Points ───────────────────────────────────────────────────────────────────
  const totalPts = useMemo(() => {
    const bonus = durationBonus && affordPts > 0 ? 30 : 0;
    return Math.min(affordPts + bonus + energyPts + accessPts, 250);
  }, [affordPts, durationBonus, energyPts, accessPts]);

  const tier = useMemo(() => {
    return MLI_TIERS.find(t => totalPts >= t.minPts && totalPts <= t.maxPts) || null;
  }, [totalPts]);

  // ── Unit counts ──────────────────────────────────────────────────────────────
  const totalUnitCount = unitMix.reduce((s, u) => s + (parseInt(u.count) || 0), 0);

  const grossMonthlyRent = useMemo(() => {
    return unitMix.reduce((sum, u) => {
      const r = u.rent ? Number(u.rent) : (mk.rents[u.type] || 0);
      return sum + r * (parseInt(u.count) || 0);
    }, 0);
  }, [unitMix, mk.rents]);

  // ── Financing ────────────────────────────────────────────────────────────────
  const rate     = parseFloat(rateStr) || 4.25;
  const ltv      = ltvOvr ? Math.min(parseFloat(ltvOvr) / 100, 0.95) : (tier ? (isNew ? tier.ltvNew : tier.ltvExisting) : 0.75);
  const amortYrs = amOvr  ? Math.max(1, parseInt(amOvr)) : (tier ? tier.amort : 25);
  const discount = tier ? tier.discount : 0;

  const premiumRate  = tier ? calcMliPremium(ltv, amortYrs, discount) : 0;
  const loanAmt      = purchasePrice * ltv;
  const cmhcFee      = loanAmt * premiumRate;
  const totalMortgage = loanAmt + cmhcFee;
  const downPayment  = purchasePrice - loanAmt;
  const moPayment    = tier ? mortgagePayment(totalMortgage, rate / 100, amortYrs) : 0;
  const annDebtService = moPayment * 12;

  // ── Operating ────────────────────────────────────────────────────────────────
  const grossAnnRent = grossMonthlyRent * 12;
  const vacPct       = vacOvr   ? parseFloat(vacOvr) / 100   : mk.vacRate;
  const mgmtPct      = mgmtOvr  ? parseFloat(mgmtOvr) / 100  : mk.mgmtPct;
  const egi          = grossAnnRent * (1 - vacPct);
  const mgmtAmt      = egi * mgmtPct;
  const insuranceAmt = insuranceOvr ? Number(insuranceOvr)    : mk.insurancePerUnit * totalUnitCount;
  const maintAmt     = maintOvr    ? Number(maintOvr)         : mk.maintPerUnit * totalUnitCount;
  const taxAmt       = taxOvr      ? Number(taxOvr)           : purchasePrice * mk.taxRate;
  const utilitiesAmt = utilitiesOvr ? Number(utilitiesOvr)    : 0;
  const opex         = mgmtAmt + insuranceAmt + maintAmt + taxAmt + utilitiesAmt;
  const noi          = egi - opex;
  const capRate      = purchasePrice > 0 ? noi / purchasePrice : 0;
  const priceDoor    = totalUnitCount > 0 ? purchasePrice / totalUnitCount : 0;

  // ── DCR ──────────────────────────────────────────────────────────────────────
  const dcr = annDebtService > 0 ? noi / annDebtService : 0;

  // Stress test: 5yr term → contract rate; 10yr+ → max(contract, ~6.5% conventional floor)
  const conventionalFloor = 6.50;
  const stressRatePct = termYrs >= 10 ? Math.max(rate, conventionalFloor) : rate;
  const stressPayment  = tier ? mortgagePayment(totalMortgage, stressRatePct / 100, amortYrs) : 0;
  const dcrStress      = stressPayment * 12 > 0 ? noi / (stressPayment * 12) : 0;

  // What rent increase is needed to hit DCR 1.30?
  const requiredNoi       = annDebtService * 1.30;
  const requiredEgi       = requiredNoi + opex;
  const requiredGrossRent = egi > 0 ? requiredEgi / (1 - vacPct) : 0;
  const rentGapMonthly    = Math.max(0, (requiredGrossRent / 12) - grossMonthlyRent);
  const rentPerUnitIncrease = totalUnitCount > 0 ? rentGapMonthly / totalUnitCount : 0;

  // ── Cash Flow ────────────────────────────────────────────────────────────────
  const annCashFlow  = noi - annDebtService;
  const moCashFlow   = annCashFlow / 12;
  const moCFPerUnit  = totalUnitCount > 0 ? moCashFlow / totalUnitCount : 0;
  const closingCosts = purchasePrice * 0.015; // ~1.5% closing
  const totalCashIn  = downPayment + closingCosts;
  const cocReturn    = totalCashIn > 0 ? annCashFlow / totalCashIn : 0;

  // ── Hold Period Analysis ─────────────────────────────────────────────────────
  function holdAnalysis(holdYrsInput, growthRate) {
    const futureValue       = purchasePrice * Math.pow(1 + growthRate, holdYrsInput);
    const remainingMortgage = tier ? balanceAfter(totalMortgage, rate / 100, amortYrs, holdYrsInput) : 0;
    const equity            = futureValue - remainingMortgage;
    const cumulativeCF      = annCashFlow * holdYrsInput;
    const totalReturn       = equity - totalCashIn + cumulativeCF;
    const irr               = totalCashIn > 0
      ? Math.pow(Math.max(0.001, (totalCashIn + totalReturn) / totalCashIn), 1 / holdYrsInput) - 1
      : 0;
    return { futureValue, remainingMortgage, equity, cumulativeCF, totalReturn, irr };
  }

  const holdResults = {
    10: { low: holdAnalysis(10, mk.growth.low), mid: holdAnalysis(10, mk.growth.mid), high: holdAnalysis(10, mk.growth.high) },
    15: { low: holdAnalysis(15, mk.growth.low), mid: holdAnalysis(15, mk.growth.mid), high: holdAnalysis(15, mk.growth.high) },
    20: { low: holdAnalysis(20, mk.growth.low), mid: holdAnalysis(20, mk.growth.mid), high: holdAnalysis(20, mk.growth.high) },
  };

  // ── Signal helpers ───────────────────────────────────────────────────────────
  const dcrGood        = dcr >= 1.30;
  const dcrOk          = dcr >= 1.10 && dcr < 1.30;
  const dcrStressGood  = dcrStress >= 1.20;
  const dcrStressOk    = dcrStress >= 1.10 && dcrStress < 1.20;
  const cfPositive     = annCashFlow > 0;
  const capGood        = capRate >= 0.06;
  const capOk          = capRate >= 0.05;
  const priceDoorGood  = priceDoor > 0 && priceDoor <= mk.pricePerDoor.mid;
  const tierAchieved   = tier !== null;

  // ── Unit mix helpers ─────────────────────────────────────────────────────────
  function updateUnitMix(index, field, value) {
    setUnitMix(prev => prev.map((u, i) => i === index ? { ...u, [field]: value } : u));
  }
  function addUnitRow() {
    setUnitMix(prev => [...prev, { type: "2bed", count: 1, rent: "" }]);
  }
  function removeUnitRow(index) {
    setUnitMix(prev => prev.filter((_, i) => i !== index));
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ marginTop: 24 }}>

      {/* ── Covenant Banner ───────────────────────────────────────────────────── */}
      <div style={{ padding: "14px 18px", borderRadius: 10, background: C.warn + "12", border: "1.5px solid " + C.warn + "45", marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.warn, letterSpacing: 1, marginBottom: 5 }}>🔒 MLI SELECT COVENANT — READ BEFORE ANALYZING</div>
        <div style={{ fontSize: 12, color: C.textSec, lineHeight: 1.7 }}>
          MLI Select requires an <strong style={{ color: C.warn }}>affordability covenant lasting 10–20 years</strong> that
          survives any sale of the property. While there is no statutory prohibition on selling, the buyer must
          honour the covenant. Interest rate advantage is <strong style={{ color: C.pos }}>~100–150 bps below conventional</strong>.
          Minimum <strong style={{ color: C.text }}>5 rental units</strong> required. Post July 2025: premiums increased ~49% on average.
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          A. Property Setup
      ══════════════════════════════════════════════════════════════════════ */}
      <Card sx={{ marginBottom: 14 }}>
        <SL>A — Property Setup</SL>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <Fd l="MARKET">
            <select style={ss} value={market} onChange={e => { setMarket(e.target.value); setTaxOvr(""); }}>
              {Object.entries(MLI_MARKETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Fd>
          <Fd l="PROPERTY TYPE">
            <select style={ss} value={isNew ? "new" : "existing"} onChange={e => setIsNew(e.target.value === "new")}>
              <option value="existing">Existing Building</option>
              <option value="new">New Construction / Major Reno</option>
            </select>
          </Fd>
          <Fd l="PURCHASE PRICE">
            <input style={si} type="text" inputMode="decimal" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} step={25000} />
          </Fd>
        </div>

        <SL>Unit Mix</SL>
        {unitMix.map((u, i) => (
          <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-end", marginBottom: 6, flexWrap: "wrap" }}>
            <Fd l="TYPE">
              <select style={{ ...ss, minWidth: 140 }} value={u.type} onChange={e => updateUnitMix(i, "type", e.target.value)}>
                <option value="bachelor">Bachelor/Studio</option>
                <option value="1bed">1-Bedroom</option>
                <option value="2bed">2-Bedroom</option>
                <option value="3bed">3-Bedroom</option>
              </select>
            </Fd>
            <Fd l="COUNT">
              <input style={{ ...si, width: 72, textAlign: "center" }} type="text" inputMode="decimal" min={1} max={99}
                value={u.count} onChange={e => updateUnitMix(i, "count", Math.max(1, parseInt(e.target.value) || 1))} />
            </Fd>
            <Fd l={"RENT/MO (blank = " + fmt$(mk.rents[u.type] || 0) + " market default)"}>
              <input style={{ ...si, minWidth: 140 }} type="text" inputMode="decimal" placeholder={mk.rents[u.type] || ""}
                value={u.rent} onChange={e => updateUnitMix(i, "rent", e.target.value)} step={50} />
            </Fd>
            {unitMix.length > 1 && (
              <button onClick={() => removeUnitRow(i)} style={{
                padding: "10px 12px", borderRadius: 7, border: "1px solid " + C.border,
                background: "transparent", color: C.neg, cursor: "pointer", fontSize: 16, flexShrink: 0
              }}>×</button>
            )}
          </div>
        ))}
        <button onClick={addUnitRow} style={{
          marginTop: 4, padding: "7px 14px", borderRadius: 7, border: "1px solid " + C.border,
          background: "transparent", color: C.brand, cursor: "pointer", fontSize: 12, fontFamily: ff, fontWeight: 600
        }}>+ Add Unit Type</button>

        <div style={{ display: "flex", gap: 24, marginTop: 12, flexWrap: "wrap" }}>
          <div>
            <span style={{ fontSize: 11, color: C.textMuted }}>Total Units: </span>
            <span style={{ fontSize: 14, fontWeight: 800, color: totalUnitCount >= 5 ? C.text : C.neg, fontFamily: fm }}>{totalUnitCount}</span>
            {totalUnitCount < 5 && <span style={{ fontSize: 11, color: C.neg, marginLeft: 6 }}>⚠ Need 5+ for MLI Select</span>}
          </div>
          <div>
            <span style={{ fontSize: 11, color: C.textMuted }}>Gross Monthly Rent: </span>
            <span style={{ fontSize: 14, fontWeight: 800, color: C.pos, fontFamily: fm }}>{fmt$(grossMonthlyRent)}</span>
          </div>
          <div>
            <span style={{ fontSize: 11, color: C.textMuted }}>Price/Door: </span>
            <span style={{ fontSize: 14, fontWeight: 800, color: priceDoorGood ? C.pos : C.warn, fontFamily: fm }}>
              {totalUnitCount > 0 ? fmt$(Math.round(priceDoor)) : "—"}
            </span>
            <span style={{ fontSize: 10, color: C.textMuted, marginLeft: 4 }}>
              (market mid {fmt$(mk.pricePerDoor.mid)})
            </span>
          </div>
        </div>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════
          B. MLI Select Points Calculator
      ══════════════════════════════════════════════════════════════════════ */}
      <Card sx={{ marginBottom: 14 }} accent={tier ? C.gold : undefined}>
        <SL>B — MLI Select Points Calculator</SL>

        {/* Score display */}
        <div style={{
          display: "flex", alignItems: "center", gap: 16, marginBottom: 18, padding: "16px 18px",
          borderRadius: 10, background: tier ? C.gold + "0d" : C.surface2,
          border: "1px solid " + (tier ? C.gold + "45" : C.border)
        }}>
          <div style={{ textAlign: "center", minWidth: 64 }}>
            <div style={{ fontSize: 44, fontWeight: 900, color: tier ? C.gold : C.textMuted, fontFamily: fm, lineHeight: 1 }}>{totalPts}</div>
            <div style={{ fontSize: 9, color: C.textMuted, letterSpacing: 1.5, marginTop: 2 }}>POINTS</div>
          </div>
          <div style={{ flex: 1 }}>
            {tier ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 16, fontWeight: 900, color: C.gold }}>{tier.label}</span>
                  <Badge color={C.gold}>{totalPts} pts</Badge>
                  {tier.limitedRecourse && <Badge color={C.purple}>Limited Recourse</Badge>}
                </div>
                <div style={{ fontSize: 12, color: C.textSec, lineHeight: 1.7 }}>
                  <span style={{ color: C.pos, fontWeight: 700 }}>Max LTV {pct(isNew ? tier.ltvNew : tier.ltvExisting)}</span>
                  {" · "}
                  <span style={{ color: C.pos, fontWeight: 700 }}>Max Amort {tier.amort} yrs</span>
                  {" · "}
                  <span style={{ color: C.pos, fontWeight: 700 }}>{(tier.discount * 100).toFixed(0)}% premium discount</span>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 14, fontWeight: 800, color: totalPts > 0 ? C.warn : C.textMuted }}>
                  {totalPts === 0 ? "No points selected" : totalPts + " pts — 50 minimum required for MLI Select"}
                </div>
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                  Select points below to unlock MLI Select benefits
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tier reference */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {[
            { label: "Tier 1 · 50–69 pts", sub: "85% LTV · 40yr · 10% off", color: C.warn },
            { label: "Tier 2 · 70–99 pts", sub: "95% LTV · 45yr · 20% off", color: C.pos },
            { label: "Tier 3 · 100 pts",   sub: "95% LTV · 50yr · 30% off", color: C.gold },
          ].map(({ label, sub, color }) => (
            <div key={label} style={{
              flex: 1, minWidth: 130, padding: "8px 12px", borderRadius: 8,
              background: C.surface2, border: "1px solid " + color + "30", textAlign: "center"
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color }}>{label}</div>
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* ── Affordability ── */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, flexWrap: "wrap", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
              Affordability — max 100 pts
            </span>
            <span style={{ fontSize: 11, color: C.textMuted }}>
              Affordable rent ≤ {fmt$(Math.round(mk.medianRenterIncome * 0.30 / 12))}/mo (30% of {fmt$(mk.medianRenterIncome)}/yr median renter income)
            </span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              [0, "None"],
              [50, isNew ? "50 pts — 10% of units" : "50 pts — 40% of units"],
              [70, isNew ? "70 pts — 15% of units" : "70 pts — 60% of units"],
              [100, isNew ? "100 pts — 25% of units" : "100 pts — 80% of units"],
            ].map(([p, lb]) => (
              <button key={p} onClick={() => setAffordPts(p)} style={{
                padding: "8px 14px", borderRadius: 7, cursor: "pointer", fontFamily: ff, fontSize: 11, fontWeight: 700,
                border: affordPts === p ? "1.5px solid " + C.pos : "1.5px solid " + C.border,
                background: affordPts === p ? C.pos + "1a" : "transparent",
                color: affordPts === p ? C.pos : C.textMuted, transition: "all 0.12s",
              }}>{lb}</button>
            ))}
          </div>
          {affordPts > 0 && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={durationBonus} onChange={e => setDuration(e.target.checked)}
                style={{ width: 14, height: 14, accentColor: C.gold }} />
              <span style={{ fontSize: 11, color: C.textSec }}>
                +30 pts duration bonus — commit to <strong style={{ color: C.gold }}>20-year</strong> affordability covenant (instead of 10yr minimum)
              </span>
            </label>
          )}
        </div>

        {/* ── Energy Efficiency ── */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 6 }}>
            Energy Efficiency — max 50 pts
            <span style={{ fontSize: 11, fontWeight: 400, color: C.textMuted, marginLeft: 6 }}>
              (cannot reach Tier 3 from energy alone — max 80 pts with energy + accessibility)
            </span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              [0, "None"],
              [20, isNew ? "20 pts — 20% better than code" : "20 pts — 15% energy reduction"],
              [35, isNew ? "35 pts — 25% better than code" : "35 pts — 25% reduction"],
              [50, isNew ? "50 pts — 40% better than code" : "50 pts — 40% reduction"],
            ].map(([p, lb]) => (
              <button key={p} onClick={() => setEnergyPts(p)} style={{
                padding: "8px 14px", borderRadius: 7, cursor: "pointer", fontFamily: ff, fontSize: 11, fontWeight: 700,
                border: energyPts === p ? "1.5px solid " + C.brand : "1.5px solid " + C.border,
                background: energyPts === p ? C.brand + "1a" : "transparent",
                color: energyPts === p ? C.brand : C.textMuted, transition: "all 0.12s",
              }}>{lb}</button>
            ))}
          </div>
        </div>

        {/* ── Accessibility ── */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 6 }}>
            Accessibility — max 30 pts
            <span style={{ fontSize: 11, fontWeight: 400, color: C.textMuted, marginLeft: 6 }}>
              (all projects must have 100% visitable units + barrier-free common areas at no extra points)
            </span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              [0, "None"],
              [20, "20 pts — 15% units fully accessible (CSA B651:23)"],
              [30, "30 pts — RHFAC Gold 80%+ or 100% universal design"],
            ].map(([p, lb]) => (
              <button key={p} onClick={() => setAccessPts(p)} style={{
                padding: "8px 14px", borderRadius: 7, cursor: "pointer", fontFamily: ff, fontSize: 11, fontWeight: 700,
                border: accessPts === p ? "1.5px solid " + C.purple : "1.5px solid " + C.border,
                background: accessPts === p ? C.purple + "1a" : "transparent",
                color: accessPts === p ? C.purple : C.textMuted, transition: "all 0.12s",
              }}>{lb}</button>
            ))}
          </div>
        </div>

        <InfoBox color={C.textMuted}>
          💡 <strong style={{ color: C.text }}>Strategy tip:</strong> Affordability alone reaches Tier 3 (100 pts).
          Energy alone caps at 50 pts (Tier 1 only). Energy + Accessibility maxes at 80 pts (Tier 2).
          Fastest path to Tier 3: Affordability 70 pts + Duration bonus 30 pts = 100 pts total.
        </InfoBox>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════
          C. Financing
      ══════════════════════════════════════════════════════════════════════ */}
      <Card sx={{ marginBottom: 14 }}>
        <SL>C — Financing</SL>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <Fd l="INTEREST RATE %">
            <input style={si} type="text" inputMode="decimal" value={rateStr} onChange={e => setRateStr(e.target.value)} step={0.05} />
          </Fd>
          <Fd l="MORTGAGE TERM">
            <select style={ss} value={termYrs} onChange={e => setTermYrs(Number(e.target.value))}>
              <option value={5}>5 Year — stress test = contract rate</option>
              <option value={10}>10 Year — stress test = max(contract, market)</option>
            </select>
          </Fd>
          <Fd l={"AMORTIZATION YRS (tier default: " + (tier ? tier.amort : "N/A") + " yr)"}>
            <input style={si} type="text" inputMode="decimal" placeholder={tier ? tier.amort : "25"}
              value={amOvr} onChange={e => setAmOvr(e.target.value)} step={5} />
          </Fd>
          <Fd l={"LTV OVERRIDE % (tier default: " + (tier ? pct1(isNew ? tier.ltvNew : tier.ltvExisting) : "N/A") + ")"}>
            <input style={si} type="text" inputMode="decimal" placeholder={tier ? ((isNew ? tier.ltvNew : tier.ltvExisting) * 100).toFixed(0) : ""}
              value={ltvOvr} onChange={e => setLtvOvr(e.target.value)} step={1} />
          </Fd>
        </div>

        <Divider />
        <Row label="Down Payment" val={tier ? fmt$(downPayment) + " (" + pct1(1 - ltv) + ")" : "Select tier above"} color={C.warn} bold />
        <Row label="Loan Amount" val={tier ? fmt$(loanAmt) : "—"} color={C.text} />
        <Row label="CMHC Premium Rate" val={tier ? pct(premiumRate) : "—"} color={C.orange} />
        <Row label="CMHC Fee (added to mortgage)" val={tier ? fmt$(cmhcFee) : "—"} color={C.orange} />
        <Row label="Total Insured Mortgage" val={tier ? fmt$(totalMortgage) : "—"} color={C.text} />
        <Row label={"Monthly P+I — " + amortYrs + "yr amort at " + pct1(rate / 100)} val={tier ? fmt$2(moPayment) : "—"} color={C.text} bold />
        <Row label="Annual Debt Service" val={tier ? fmt$(annDebtService) : "—"} color={C.textSec} />

        {tier && (
          <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: C.surface2, fontSize: 11, color: C.textMuted, lineHeight: 1.75 }}>
            <div><strong style={{ color: C.text }}>Premium breakdown:</strong>{" "}
              Base {pct(getBasePremium(ltv))} + amort surcharge {pct(getAmortSurcharge(amortYrs))} = {pct(getBasePremium(ltv) + getAmortSurcharge(amortYrs))}{" "}
              × (1 − {(tier.discount * 100).toFixed(0)}% MLI discount) = <strong style={{ color: C.gold }}>{pct(premiumRate)}</strong>
            </div>
            <div style={{ marginTop: 4 }}>
              MLI Select rate advantage: approximately <strong style={{ color: C.pos }}>100–150 bps below conventional</strong> — lenders price insured loans closer to GOC bond yields.
            </div>
            <div style={{ marginTop: 4 }}>
              <strong style={{ color: C.warn }}>Note:</strong> Post July 14, 2025 — CMHC premiums increased ~49% on average. Model carefully.
            </div>
          </div>
        )}
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════
          D. Operating Income & Expenses
      ══════════════════════════════════════════════════════════════════════ */}
      <Card sx={{ marginBottom: 14 }}>
        <SL>D — Operating Income & Expenses (Annual)</SL>

        <Row label="Gross Potential Rent (100% occupancy)" val={fmt$(grossAnnRent)} color={C.text} />

        <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
          <Fd l={"VACANCY % (lender floor: " + (mk.vacRate * 100).toFixed(0) + "% — use this even if actual is lower)"}>
            <input style={si} type="text" inputMode="decimal" placeholder={(mk.vacRate * 100).toFixed(0)} value={vacOvr}
              onChange={e => setVacOvr(e.target.value)} step={0.5} />
          </Fd>
        </div>

        <Row label={"Vacancy & Credit Loss (" + pct1(vacPct) + ")"} val={"(" + fmt$(grossAnnRent * vacPct) + ")"} color={C.neg} />
        <Row label="Effective Gross Income (EGI)" val={fmt$(egi)} color={C.pos} bold />

        <Divider />
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 10 }}>
          Operating Expenses — leave blank to use {mk.label} market defaults. CMHC applies its own benchmarks regardless (e.g., management fee applied even if self-managed).
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
          <Fd l={"PROPERTY TAX (default: " + fmt$(Math.round(purchasePrice * mk.taxRate)) + "/yr)"}>
            <input style={si} type="text" inputMode="decimal" placeholder={Math.round(purchasePrice * mk.taxRate)}
              value={taxOvr} onChange={e => setTaxOvr(e.target.value)} step={500} />
          </Fd>
          <Fd l={"PROPERTY MGMT % OF EGI (default: " + (mk.mgmtPct * 100).toFixed(0) + "%)"}>
            <input style={si} type="text" inputMode="decimal" placeholder={(mk.mgmtPct * 100).toFixed(0)}
              value={mgmtOvr} onChange={e => setMgmtOvr(e.target.value)} step={0.5} />
          </Fd>
          <Fd l={"INSURANCE $/yr (default: " + fmt$(mk.insurancePerUnit) + "/unit = " + fmt$(mk.insurancePerUnit * totalUnitCount) + " total)"}>
            <input style={si} type="text" inputMode="decimal" placeholder={mk.insurancePerUnit * totalUnitCount}
              value={insuranceOvr} onChange={e => setInsuranceOvr(e.target.value)} step={200} />
          </Fd>
          <Fd l={"MAINTENANCE + RESERVE $/yr (default: " + fmt$(mk.maintPerUnit) + "/unit = " + fmt$(mk.maintPerUnit * totalUnitCount) + " total)"}>
            <input style={si} type="text" inputMode="decimal" placeholder={mk.maintPerUnit * totalUnitCount}
              value={maintOvr} onChange={e => setMaintOvr(e.target.value)} step={500} />
          </Fd>
          <Fd l="UTILITIES $/yr (if landlord pays — else $0)">
            <input style={si} type="text" inputMode="decimal" placeholder="0" value={utilitiesOvr}
              onChange={e => setUtilitiesOvr(e.target.value)} step={500} />
          </Fd>
        </div>

        <Row label={"Property Tax"} val={"(" + fmt$(taxAmt) + ")"} color={C.neg} />
        <Row label={"Prop. Management (" + pct1(mgmtPct) + " × EGI)"} val={"(" + fmt$(mgmtAmt) + ")"} color={C.neg} />
        <Row label="Insurance" val={"(" + fmt$(insuranceAmt) + ")"} color={C.neg} />
        <Row label="Maintenance + CapEx Reserve" val={"(" + fmt$(maintAmt) + ")"} color={C.neg} />
        {utilitiesAmt > 0 && <Row label="Utilities (landlord pays)" val={"(" + fmt$(utilitiesAmt) + ")"} color={C.neg} />}
        <Row label="Total Operating Expenses" val={"(" + fmt$(opex) + ")"} color={C.neg} bold />
        <Row label="Net Operating Income (NOI)" val={fmt$(noi)} color={noi > 0 ? C.pos : C.neg} bold />
        <Row label="Cap Rate" val={pct(capRate)} color={capGood ? C.pos : capOk ? C.warn : C.neg} />
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════
          E. DCR Qualification Check
      ══════════════════════════════════════════════════════════════════════ */}
      <Card sx={{ marginBottom: 14 }} accent={dcrGood ? C.pos : dcrOk ? C.warn : C.neg}>
        <SL>E — DCR Qualification Check</SL>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {/* Contract rate DCR */}
          <div style={{ padding: "16px", borderRadius: 10, background: C.surface2, border: "1px solid " + (dcrGood ? C.pos + "45" : dcrOk ? C.warn + "45" : C.neg + "45") }}>
            <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 1, marginBottom: 4 }}>DEBT COVERAGE RATIO</div>
            <div style={{ fontSize: 38, fontWeight: 900, color: dcrGood ? C.pos : dcrOk ? C.warn : C.neg, fontFamily: fm, lineHeight: 1 }}>
              {annDebtService > 0 ? n2(dcr) : "—"}
            </div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>at {pct1(rate / 100)} contract rate</div>
            <div style={{ marginTop: 8 }}>
              {annDebtService > 0 ? (
                dcrGood ? <Badge color={C.pos}>✓ LENDER-READY (1.30+)</Badge>
                : dcrOk  ? <Badge color={C.warn}>⚠ CMHC OK but lender may require more</Badge>
                :          <Badge color={C.neg}>✗ BELOW CMHC 1.10 MIN</Badge>
              ) : <Badge color={C.textMuted}>Select tier first</Badge>}
            </div>
          </div>

          {/* Stress test DCR */}
          <div style={{ padding: "16px", borderRadius: 10, background: C.surface2, border: "1px solid " + (dcrStressGood ? C.pos + "45" : dcrStressOk ? C.warn + "45" : C.neg + "45") }}>
            <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 1, marginBottom: 4 }}>STRESS TEST DCR</div>
            <div style={{ fontSize: 38, fontWeight: 900, color: dcrStressGood ? C.pos : dcrStressOk ? C.warn : C.neg, fontFamily: fm, lineHeight: 1 }}>
              {annDebtService > 0 ? n2(dcrStress) : "—"}
            </div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
              at {pct1(stressRatePct / 100)}{termYrs >= 10 ? " (10yr — market floor applied)" : " (5yr — contract rate)"}
            </div>
            <div style={{ marginTop: 8 }}>
              {annDebtService > 0 ? (
                dcrStressGood ? <Badge color={C.pos}>✓ PASSES STRESS TEST</Badge>
                : dcrStressOk ? <Badge color={C.warn}>⚠ MARGINAL</Badge>
                :               <Badge color={C.neg}>✗ FAILS STRESS TEST</Badge>
              ) : <Badge color={C.textMuted}>Select tier first</Badge>}
            </div>
          </div>
        </div>

        <Row label="NOI" val={fmt$(noi)} color={C.text} />
        <Row label="Annual Debt Service (P+I)" val={tier ? fmt$(annDebtService) : "—"} color={C.text} />
        <Row label="DCR (NOI ÷ Debt Service)" val={annDebtService > 0 ? n2(dcr) + "x" : "—"} color={dcrGood ? C.pos : dcrOk ? C.warn : C.neg} bold />
        <Row label="CMHC minimum (standard rental)" val="1.10x" color={C.textMuted} />
        <Row label="Typical lender minimum" val="1.20–1.30x" color={C.textMuted} />
        <Row label="Lender stress test rate" val={pct1(stressRatePct / 100) + (termYrs >= 10 ? " (10yr term — max of contract & 6.5% floor)" : " (5yr term = contract rate)")} color={C.textMuted} />

        {tier && dcr < 1.30 && (
          <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 8, background: C.warn + "0e", border: "1px solid " + C.warn + "38" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.warn, marginBottom: 6 }}>
              Rent Increase Needed to Hit DCR 1.30 (lender target):
            </div>
            <div style={{ fontSize: 12, color: C.textSec, lineHeight: 1.8 }}>
              Required NOI: <span style={{ color: C.text, fontWeight: 700 }}>{fmt$(requiredNoi)}</span>
              {" vs. current "}
              <span style={{ color: C.neg, fontWeight: 700 }}>{fmt$(noi)}</span>
              <br />
              Monthly rent gap: <span style={{ color: C.text, fontWeight: 700 }}>{fmt$(rentGapMonthly)}/month total</span>
              <br />
              Per-unit increase needed: <span style={{ color: C.text, fontWeight: 700 }}>
                {totalUnitCount > 0 ? fmt$(Math.round(rentPerUnitIncrease)) + "/unit/month" : "—"}
              </span>
              <br />
              Current avg rent/unit: <span style={{ color: C.text, fontWeight: 700 }}>
                {totalUnitCount > 0 ? fmt$(Math.round(grossMonthlyRent / totalUnitCount)) + "/month" : "—"}
              </span>
            </div>
          </div>
        )}

        <InfoBox color={C.brand}>
          <strong style={{ color: C.text }}>DCR = NOI ÷ Annual P+I.</strong> NOI is calculated <em>before</em> mortgage payments.
          Taxes, insurance, mgmt, and maintenance are all deducted first. CMHC minimum: <strong style={{ color: C.pos }}>1.10x</strong> for standard
          rental. Most approved lenders require <strong style={{ color: C.warn }}>1.20–1.30x</strong>.
          For 5-year terms, no residential stress test applies — contract rate is used directly.
        </InfoBox>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════
          F. Hold Period & Exit Analysis
      ══════════════════════════════════════════════════════════════════════ */}
      <Card sx={{ marginBottom: 14 }}>
        <SL>F — Hold Period & Exit Analysis</SL>

        <InfoBox color={C.warn}>
          🔒 <strong style={{ color: C.warn }}>Affordability covenant</strong> survives sale — the new buyer must honour your commitment.
          Plan for a <strong style={{ color: C.text }}>minimum 10-year hold</strong>. MLI Select lock-in is contractual, not a statutory sale prohibition.
        </InfoBox>

        <div style={{ marginTop: 16, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 420 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid " + C.border }}>
                <th style={{ padding: "8px 8px 10px", textAlign: "left", fontSize: 10, color: C.textMuted, letterSpacing: 1.2, fontWeight: 700 }}>METRIC (mid-growth scenario)</th>
                {[10, 15, 20].map(yr => (
                  <th key={yr} style={{ padding: "8px 8px 10px", textAlign: "right", fontSize: 10, color: C.brand, letterSpacing: 0.5, fontWeight: 800 }}>{yr} YEARS</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { key: "futureValue",      label: "Property Value (mid growth)",  color: C.text,   bold: false },
                { key: "remainingMortgage",label: "Remaining Mortgage",           color: C.neg,    bold: false, neg: true },
                { key: "equity",           label: "Total Equity at Exit",         color: C.purple, bold: true  },
                { key: "cumulativeCF",     label: "Cumulative Net Cash Flow",     color: annCashFlow >= 0 ? C.pos : C.neg, bold: false },
                { key: "totalReturn",      label: "Total Net Return",             color: C.gold,   bold: true  },
                { key: "irr",              label: "Annualized IRR (est.)",        color: C.brand,  bold: false, isIrr: true },
              ].map(({ key, label, color, bold, neg, isIrr }) => (
                <tr key={key} style={{ borderBottom: "1px solid " + C.borderSub }}>
                  <td style={{ padding: "8px", color: C.textSec, fontSize: 12 }}>{label}</td>
                  {[10, 15, 20].map(yr => {
                    const v = holdResults[yr].mid[key];
                    return (
                      <td key={yr} style={{ padding: "8px", textAlign: "right", fontWeight: bold ? 800 : 600, color, fontFamily: fm, fontSize: 13 }}>
                        {isIrr ? pct(v) : neg ? "(" + fmt$(v) + ")" : fmt$(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>
            Equity at exit after 10 years — by scenario:
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              ["low", "Conservative", C.warn],
              ["mid", "Moderate", C.pos],
              ["high", "Optimistic", C.purple],
            ].map(([scn, label, color]) => (
              <div key={scn} style={{
                flex: 1, minWidth: 120, padding: "12px 14px", borderRadius: 10,
                background: C.surface2, border: "1px solid " + color + "35", textAlign: "center"
              }}>
                <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4 }}>{label} · {pct1(mk.growth[scn])}/yr</div>
                <div style={{ fontSize: 17, fontWeight: 900, color, fontFamily: fm }}>{fmt$(holdResults[10][scn].equity)}</div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>IRR {pct(holdResults[10][scn].irr)}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════
          G. Cash Flow Summary
      ══════════════════════════════════════════════════════════════════════ */}
      <Card sx={{ marginBottom: 14 }}>
        <SL>G — Cash Flow Summary</SL>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          {[
            { label: "Monthly NOI",        val: fmt$2(noi / 12),       color: noi > 0 ? C.pos : C.neg    },
            { label: "Monthly Mortgage",   val: tier ? fmt$2(moPayment) : "—", color: C.neg             },
            { label: "Monthly Cash Flow",  val: tier ? fmt$2(moCashFlow) : "—", color: moCashFlow >= 0 ? C.pos : C.neg },
            { label: "Cash Flow / Unit",   val: tier && totalUnitCount > 0 ? fmt$2(moCFPerUnit) : "—",   color: moCFPerUnit >= 0 ? C.pos : C.neg },
            { label: "Cash-on-Cash Return",val: tier ? pct(cocReturn) : "—",  color: cocReturn >= 0.06 ? C.pos : cocReturn >= 0.03 ? C.warn : C.neg },
            { label: "Cap Rate",           val: pct(capRate),           color: capGood ? C.pos : capOk ? C.warn : C.neg },
          ].map((m, i) => (
            <div key={i} data-card style={{
              padding: "12px 14px", borderRadius: 10, background: C.surface2,
              border: "1px solid " + C.border, textAlign: "center"
            }}>
              <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 5 }}>{m.label}</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: m.color, fontFamily: fm }}>{m.val}</div>
            </div>
          ))}
        </div>

        <Row label="Gross Potential Rent (annual)" val={fmt$(grossAnnRent)} color={C.text} />
        <Row label={"Vacancy (" + pct1(vacPct) + ")"} val={"(" + fmt$(grossAnnRent * vacPct) + ")"} color={C.neg} />
        <Row label="EGI" val={fmt$(egi)} color={C.textSec} />
        <Row label="Total Operating Expenses" val={"(" + fmt$(opex) + ")"} color={C.neg} />
        <Row label="NOI (annual)" val={fmt$(noi)} color={noi > 0 ? C.pos : C.neg} bold />
        <Row label="Debt Service (annual P+I)" val={tier ? "(" + fmt$(annDebtService) + ")" : "—"} color={C.neg} />
        <Row label="Annual Cash Flow" val={tier ? fmt$(annCashFlow) : "—"} color={annCashFlow >= 0 ? C.pos : C.neg} bold />

        {tier && (
          <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 8, background: C.surface2, fontSize: 11, color: C.textMuted, lineHeight: 1.75 }}>
            <strong style={{ color: C.text }}>Cash invested:</strong>{" "}
            Down payment {fmt$(downPayment)} + closing costs {fmt$(closingCosts)} = <strong style={{ color: C.text }}>{fmt$(totalCashIn)}</strong>
            {" · "}Cash-on-cash: <strong style={{ color: cocReturn >= 0.06 ? C.pos : cocReturn >= 0.03 ? C.warn : C.neg }}>{pct(cocReturn)}</strong>
            <br />
            Note: CMHC fee of {fmt$(cmhcFee)} is rolled into the mortgage and not counted as cash out-of-pocket.
          </div>
        )}
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════
          H. Deal Signals
      ══════════════════════════════════════════════════════════════════════ */}
      <Card sx={{ marginBottom: 14 }} accent={tierAchieved && dcrGood && cfPositive ? C.pos : tierAchieved && dcrOk ? C.warn : C.neg}>
        <SL>H — Deal Signals</SL>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            {
              label: "MLI Select Tier",
              pass: tierAchieved, warn: totalPts >= 50 && totalPts < 50,
              val: tier ? tier.label + " (" + totalPts + " pts) · " + (tier.limitedRecourse ? "Limited Recourse" : "Full Recourse") : totalPts + " pts — need 50 minimum",
              passColor: C.gold, failColor: C.neg,
            },
            {
              label: "LTV & Down Payment",
              pass: !!tier,
              val: tier ? pct1(ltv) + " LTV — " + fmt$(downPayment) + " down (" + pct1(1 - ltv) + ")" : "No tier — using conventional default",
              passColor: C.brand, failColor: C.textMuted,
            },
            {
              label: "Insurance Premium",
              pass: tier && premiumRate < 0.055, warn: tier && premiumRate >= 0.055 && premiumRate < 0.07,
              val: tier ? pct(premiumRate) + " of loan = " + fmt$(cmhcFee) + " fee" : "N/A",
              passColor: C.pos, failColor: C.warn,
            },
            {
              label: "DCR — Contract Rate",
              pass: dcrGood, warn: dcrOk,
              val: annDebtService > 0 ? n2(dcr) + "x — " + (dcrGood ? "lender-ready ✓" : dcrOk ? "CMHC ok, lender may need rent increase" : "below CMHC 1.10 minimum") : "—",
              passColor: C.pos, failColor: dcrOk ? C.warn : C.neg,
            },
            {
              label: "DCR — Stress Test",
              pass: dcrStressGood, warn: dcrStressOk,
              val: annDebtService > 0 ? n2(dcrStress) + "x at " + pct1(stressRatePct / 100) + " — " + (dcrStressGood ? "passes ✓" : dcrStressOk ? "borderline ⚠" : "fails ✗") : "—",
              passColor: C.pos, failColor: dcrStressOk ? C.warn : C.neg,
            },
            {
              label: "Monthly Cash Flow",
              pass: cfPositive, warn: annCashFlow >= -500 && annCashFlow < 0,
              val: tier ? fmt$2(moCashFlow) + "/mo (" + (totalUnitCount > 0 ? fmt$2(moCFPerUnit) + "/unit" : "—") + ")" : "—",
              passColor: C.pos, failColor: C.neg,
            },
            {
              label: "Cap Rate",
              pass: capGood, warn: capOk,
              val: pct(capRate) + (capGood ? " — strong (6%+)" : capOk ? " — acceptable (5–6%)" : " — weak (under 5%)"),
              passColor: C.pos, failColor: capOk ? C.warn : C.neg,
            },
            {
              label: "Price Per Door",
              pass: priceDoorGood, warn: !priceDoorGood && priceDoor <= mk.pricePerDoor.high,
              val: totalUnitCount > 0 ? fmt$(Math.round(priceDoor)) + " vs " + mk.label + " range " + fmt$(mk.pricePerDoor.low) + "–" + fmt$(mk.pricePerDoor.high) : "—",
              passColor: C.pos, failColor: C.warn,
            },
            {
              label: "Affordability Covenant",
              pass: affordPts > 0, warn: false,
              val: affordPts > 0
                ? (durationBonus ? "20-yr" : "10-yr") + " — " + (isNew
                  ? (affordPts === 50 ? "10%" : affordPts === 70 ? "15%" : "25%")
                  : (affordPts === 50 ? "40%" : affordPts === 70 ? "60%" : "80%")) + " of units at affordable rent"
                : "None — no affordability points selected",
              passColor: C.pos, failColor: C.textMuted,
            },
          ].map(({ label, pass, warn, val, passColor, failColor }, i) => {
            const col  = pass ? passColor : warn ? C.warn : failColor;
            const icon = pass ? "✓" : warn ? "⚠" : "✗";
            return (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 12px",
                borderRadius: 8, background: col + "0a", border: "1px solid " + col + "28"
              }}>
                <span style={{ color: col, fontSize: 13, fontWeight: 900, flexShrink: 0, marginTop: 1, fontFamily: fm }}>{icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{label}</div>
                  <div style={{ fontSize: 11, color: C.textSec, marginTop: 1 }}>{val}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════
          Mortgage Broker Checklist
      ══════════════════════════════════════════════════════════════════════ */}
      <Card>
        <SL>Mortgage Broker Qualification Checklist</SL>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {[
            "Corporate or personal financial statements (2–3 years)",
            "Personal T1 General returns for all named borrowers (2–3 years)",
            "Statement of Real Estate Owned (SREO) + personal net worth statement",
            "Minimum net worth: 25% of property value · Absolute minimum: $100,000",
            "Credit score ≥ 600 (lenders prefer 650+)",
            "5+ years multi-unit ownership / management experience — or retain a qualified PM",
            "Full CMHC appraisal: 3 methods (income, sales comparison, cost) — now required for ALL deals",
            "Current rent roll (signed, dated) + 2–3 year operating statements",
            "Phase I Environmental Site Assessment (ESA) — required; Phase II if flagged",
            "Building Condition Assessment (BCA)",
            "Property tax notice (current year)",
            "Building insurance binder / declarations page",
            "Proof of equity / down payment source (bank statements)",
            ...(affordPts > 0 ? ["Affordability evidence: CMHC rent table + calculation worksheet (affordability points)"] : []),
            ...(energyPts > 0 ? ["Energy attestation signed by P.Eng, Architect, CET, or CEM (energy points)"] : []),
            ...(accessPts > 0 ? ["Accessibility attestation (Architect or certified accessibility consultant) (accessibility points)"] : []),
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ color: C.brand, flexShrink: 0, fontSize: 13, marginTop: 1 }}>□</span>
              <span style={{ fontSize: 12, color: C.textSec, lineHeight: 1.55 }}>{item}</span>
            </div>
          ))}
        </div>
        <InfoBox color={C.brand}>
          <strong style={{ color: C.text }}>No rent control in AB or SK.</strong>{" "}
          Alberta: rent increases allowed once per 12 months with <strong>3 months</strong> written notice, no cap.{" "}
          Saskatchewan: increases allowed once per 12 months with <strong>12 months</strong> written notice, no cap.
          Factor the longer SK notice period into cash flow planning for value-add deals.
        </InfoBox>
      </Card>
    </div>
  );
}
