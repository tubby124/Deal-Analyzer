import { useState, useMemo, useCallback } from "react";
import { EquityBuildingChart, MonthlyPaymentPie, CashFlowChart, RentVsOwnChart, ROIGauge } from './Charts';

const MARKETS = {
  saskatoon: {
    label: "Saskatoon, SK", taxRate: 0.0135, vac: 0.05,
    growth: { low: 0.02, mid: 0.04, high: 0.06 },
    rents: { bachelor: 1002, "1bed": 1315, "2bed": 1506, "3bed": 2100, "4bed": 2600, "1bed_nc": 800, "2bed_nc": 1150, "2bed_legal": 1400, garage: 400, parking: 100 },
    condoFees: 350,
    hoods: [
      { n: "Nutana / Varsity View", t: "A", p: 450000, g: 0.055, desc: "Character homes, infill, walkable" },
      { n: "City Park / Haultain", t: "A", p: 420000, g: 0.05, desc: "50ft lots, lot splitting, downtown" },
      { n: "Stonebridge", t: "A", p: 480000, g: 0.045, desc: "Newer builds, families, stable" },
      { n: "Brighton / Kensington", t: "B+", p: 440000, g: 0.04, desc: "New development, growing" },
      { n: "Caswell / Westmount", t: "B", p: 320000, g: 0.04, desc: "Affordable, older stock" },
      { n: "Pleasant Hill / Riversdale", t: "B-", p: 260000, g: 0.035, desc: "Lowest entry, revitalizing" },
      { n: "Willowgrove / Evergreen", t: "B+", p: 460000, g: 0.04, desc: "Suburban, newer" },
      { n: "Confederation / Massey", t: "B", p: 340000, g: 0.035, desc: "West side, suite potential" },
      { n: "Dundonald / Exhibition", t: "B", p: 310000, g: 0.035, desc: "Affordable, near amenities" }
    ]
  },
  calgary: {
    label: "Calgary, AB", taxRate: 0.0068, vac: 0.06,
    growth: { low: 0.015, mid: 0.035, high: 0.055 },
    rents: { bachelor: 1350, "1bed": 1537, "2bed": 1870, "3bed": 2030, "4bed": 2500, "1bed_nc": 1200, "2bed_nc": 1400, "2bed_legal": 1600, garage: 250, parking: 150 },
    condoFees: 420,
    hoods: [
      { n: "Beltline / Downtown", t: "A", p: 380000, g: 0.04, desc: "Condos, walkable" },
      { n: "Killarney / Marda Loop", t: "A", p: 620000, g: 0.05, desc: "Premium, infill" },
      { n: "Forest Lawn / Dover", t: "B", p: 350000, g: 0.035, desc: "Affordable, cash flow" },
      { n: "Martindale / Taradale", t: "B", p: 420000, g: 0.03, desc: "NE, families" },
      { n: "Penbrooke / Erin Woods", t: "B-", p: 320000, g: 0.03, desc: "Lowest SE" },
      { n: "Coventry / Country Hills", t: "B+", p: 480000, g: 0.035, desc: "North, families" },
      { n: "Rundle / Pineridge", t: "B", p: 380000, g: 0.03, desc: "NE value play" }
    ]
  }
};

const CMHC = [{ lo: 5, hi: 9.99, r: 0.04 }, { lo: 10, hi: 14.99, r: 0.031 }, { lo: 15, hi: 19.99, r: 0.028 }, { lo: 20, hi: 100, r: 0 }];
function getCmhcRate(pctDown) {
  const d = pctDown * 100;
  const tier = CMHC.find(t => d >= t.lo && d <= t.hi);
  return tier ? tier.r : 0;
}
function $(n) { return n.toLocaleString("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function $2(n) { return n.toLocaleString("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function pct(n) { return (n * 100).toFixed(2) + "%"; }
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

const TIPS = {
  capRate: "Return if paid all cash. Compare properties without financing bias. 5%+ decent, 7%+ strong.",
  coc: "Annual cash vs money invested. $50K in, $4K/yr = 8%. Compare to stocks.",
  dscr: "Can rent cover mortgage? Banks want 1.25+. Under 1.0 means you pay out of pocket.",
  grm: "Years of rent to equal price. Lower = better. Under 15 typical in SK/AB.",
  noi: "Income after operating costs, BEFORE mortgage. Determines cap rate.",
  equity: "Value minus what you owe. Grows via appreciation + principal payments.",
  cmhc: "Required under 20% down. 2.8-4% added to loan. Disappears at 20%+.",
  princ: "Payments split: principal (your equity) + interest (bank profit). Early years mostly interest.",
  moCost: "Mortgage + tax + condo fees. Even if more than rent, you build equity.",
  appr: "Saskatoon averaged 5.35%/yr since 1994, but uneven. 3 scenarios show range.",
  vac: "Empty time between tenants. Budget 5% even in tight markets.",
  maint: "Repair fund. Furnace $4K, roof $8K. Budget 5% minimum.",
  cf: "Left after ALL costs + mortgage. Positive = property pays you.",
  rvb: "Rent = gone. Owning builds equity. This shows your NET position.",
  ownerMaint: "As an owner, budget $200-500/mo for maintenance (HVAC, appliances, roof). Not shown in monthly cost but essential for long-term ownership.",
  insurance: "Property insurance protects your investment. Condos: ~$50/mo, Houses: ~$150/mo. Required by lenders."
};

function Tip({ id, children }) {
  const [open, setOpen] = useState(false);
  const text = TIPS[id];
  if (!text) return children;
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 4 }}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      onClick={(e) => { e.stopPropagation(); setOpen(prev => !prev); }}>
      {children}
      <span style={{ width: 14, height: 14, borderRadius: "50%", background: "#1a1e2e", color: "#667", fontSize: 8, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, border: "1px solid #262d42" }}>?</span>
      {open && (
        <div style={{ position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", width: 260, padding: "10px 12px", background: "#141825", border: "1px solid #262d42", borderRadius: 8, zIndex: 999, boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
          <div style={{ fontSize: 11, color: "#99a", lineHeight: 1.6 }}>{text}</div>
        </div>
      )}
    </span>
  );
}

const ff = "'Outfit', sans-serif";
const fm = "'JetBrains Mono', monospace";

function Row({ label, val, color, tip }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
      <span style={{ fontSize: 12, color: "#6b7194" }}>{tip ? <Tip id={tip}>{label}</Tip> : label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: color || "#c8cad4", fontFamily: fm }}>{val}</span>
    </div>
  );
}
function Card({ children, sx, onClick }) {
  return <div onClick={onClick} style={{ background: "#10131c", border: "1px solid #1a1e30", borderRadius: 12, padding: 16, ...(sx || {}) }}>{children}</div>;
}
function Pill({ on, color, children, onClick }) {
  return <button onClick={onClick} style={{ padding: "8px 16px", borderRadius: 7, border: on ? "1.5px solid " + color : "1.5px solid #1c2036", background: on ? color + "14" : "transparent", color: on ? color : "#3d4266", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: ff, whiteSpace: "nowrap" }}>{children}</button>;
}
function Metric({ label, val, good, tip }) {
  return (
    <Card sx={{ textAlign: "center", padding: "12px 8px", borderColor: good ? "#34d39915" : "#f8717115" }}>
      <div style={{ fontSize: 10, color: "#4a5072", marginBottom: 2 }}>{tip ? <Tip id={tip}>{label}</Tip> : label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, fontFamily: fm, color: good ? "#34d399" : "#f87171" }}>{val}</div>
    </Card>
  );
}
function SL({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color: "#3d4266", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>{children}</div>;
}

function Fd({ l, children }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}><label style={{ fontSize: 10, color: "#4a5072", fontWeight: 700, letterSpacing: 0.8 }}>{l}</label>{children}</div>;
}

export default function DealAnalyzer() {
  const [market, setMarket] = useState("saskatoon");
  const [mode, setMode] = useState("owner");
  const [propType, setPropType] = useState("condo");
  const [price, setPrice] = useState("280000");
  const [downPct, setDownPct] = useState(0.20);
  const [rate, setRate] = useState("3.8");
  const [amYrs, setAmYrs] = useState(25);
  const [closePct, setClosePct] = useState(0.015);
  const [taxOvr, setTaxOvr] = useState("");
  const [condoOvr, setCondoOvr] = useState("");
  const [curRent, setCurRent] = useState("1600");
  const [tenantUtils, setTenantUtils] = useState(true);
  const [maintPct, setMaintPct] = useState(5);
  const [units, setUnits] = useState([]);
  const [growthOvr, setGrowthOvr] = useState("");
  const [tab, setTab] = useState("main");
  const [insurance, setInsurance] = useState("");
  const [utilElectric, setUtilElectric] = useState("");
  const [utilWater, setUtilWater] = useState("");
  const [utilGas, setUtilGas] = useState("");
  const [heatingType, setHeatingType] = useState("gas");
  const [savedProperties, setSavedProperties] = useState(() => {
    try {
      const saved = localStorage.getItem('dealAnalyzerProperties');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveAddress, setSaveAddress] = useState("");
  const [saveClient, setSaveClient] = useState("");
  const [saveNotes, setSaveNotes] = useState("");

  const mk = MARKETS[market];
  const isOwner = mode === "owner";
  const isCondo = propType === "condo";
  const si = { background: "#10131c", border: "1px solid #1c2036", borderRadius: 7, padding: "10px 12px", color: "#e8e8ec", fontSize: 13, fontFamily: ff, outline: "none", width: "100%", boxSizing: "border-box" };
  const ss = { ...si, cursor: "pointer" };

  const unitOpts = isCondo
    ? [["bachelor","Bachelor"],["1bed","1-Bed"],["2bed","2-Bed"],["3bed","3-Bed"],["4bed","4-Bed"]]
    : propType === "detached"
    ? [["1bed","1-Bed Legal"],["2bed","2-Bed Legal"],["2bed_legal","2-Bed Legal Suite"],["3bed","3-Bed Main"],["4bed","4-Bed Main"],["1bed_nc","1-Bed NC"],["2bed_nc","2-Bed NC"],["garage","Garage"],["parking","Parking"]]
    : [["bachelor","Bachelor"],["1bed","1-Bed"],["2bed","2-Bed"],["3bed","3-Bed"],["4bed","4-Bed"],["1bed_nc","1-Bed NC"],["2bed_nc","2-Bed NC"],["2bed_legal","2-Bed Legal Suite"],["garage","Garage"],["parking","Parking"]];

  // Helper functions for hybrid ownership model
  const getOwnerUnit = useCallback(() => units.find(u => u.ownerOccupied), [units]);
  const getRentalUnits = useCallback(() => units.filter(u => !u.ownerOccupied), [units]);
  const hasOwnerUnit = units.some(u => u.ownerOccupied);

  const calc = useCallback((gr) => {
    // Parse string inputs to numbers with defaults
    const priceNum = parseFloat(price) || 280000;
    const curRentNum = parseFloat(curRent) || 1600;
    const rateNum = parseFloat(rate) || 3.8;

    const down = priceNum * downPct;
    const base = priceNum - down;

    // Enhanced CMHC logic with owner-occupied detection
    const hasOwnerUnit = units.some(u => u.ownerOccupied);
    let cmhcR = 0;
    let showCmhcBenefit = false;
    let showInvestmentWarning = false;

    if (priceNum <= 1500000 && downPct < 0.20) {
      if (hasOwnerUnit || isOwner) {
        // Owner-occupied or owner mode: eligible for CMHC
        cmhcR = getCmhcRate(downPct);
        if (hasOwnerUnit && !isOwner) {
          showCmhcBenefit = true; // Show educational notice in investor mode
        }
      } else {
        // Pure investment, no owner occupancy
        // CMHC typically not available for non-owner-occupied < 20% down
        cmhcR = 0;
        showInvestmentWarning = true;
      }
    }

    const cmhcAmt = base * cmhcR;
    const totalMtg = base + cmhcAmt;
    const moPmt = mortgagePayment(totalMtg, rateNum / 100, amYrs);
    const annMtg = moPmt * 12;
    const closing = priceNum * closePct;
    const cashIn = down + closing;
    const annTax = taxOvr ? Number(taxOvr) : priceNum * mk.taxRate;
    const moTax = annTax / 12;
    const moCondo = isCondo ? (condoOvr ? Number(condoOvr) : mk.condoFees) : 0;
    const annCondo = moCondo * 12;
    const moInsurance = insurance ? Number(insurance) / 12 : (isCondo ? 50 : propType === "detached" ? 150 : 100);
    const annInsurance = moInsurance * 12;

    // Calculate utilities for owner mode too
    const defaultElectricOwner = propType === "detached" ? 120 : isCondo ? 80 : 100;
    const defaultWaterOwner = propType === "detached" ? 80 : isCondo ? 60 : 70;
    let defaultGasOwner = propType === "detached" ? 150 : isCondo ? 100 : 120;

    let moUtilitiesOwner;
    if (heatingType === "baseboard") {
      defaultGasOwner = 0;
      const baseboardCost = propType === "detached" ? 400 : 300;
      moUtilitiesOwner = (utilElectric ? Number(utilElectric) : defaultElectricOwner + baseboardCost) +
                         (utilWater ? Number(utilWater) : defaultWaterOwner) +
                         (utilGas ? Number(utilGas) : 0);
    } else {
      moUtilitiesOwner = (utilElectric ? Number(utilElectric) : defaultElectricOwner) +
                         (utilWater ? Number(utilWater) : defaultWaterOwner) +
                         (utilGas ? Number(utilGas) : defaultGasOwner);
    }

    const annUtilitiesOwner = moUtilitiesOwner * 12;
    const ownMo = moPmt + moTax + moCondo + moInsurance + moUtilitiesOwner;

    // Split units into owner-occupied and rental units for hybrid ownership model
    const ownerUnit = units.find(u => u.ownerOccupied);
    const rentalUnits = units.filter(u => !u.ownerOccupied);

    // Rental income (only from non-owner-occupied units)
    const grossMo = rentalUnits.reduce((s, u) => s + (u.rent ? Number(u.rent) : (mk.rents[u.type] || 0)), 0);
    const rentalIncome = grossMo; // For display purposes
    const grossAnn = grossMo * 12;
    const egi = grossAnn * (1 - mk.vac);

    // Net owner cost after rental offset
    const netOwnMo = ownMo - rentalIncome;
    const rentSave = curRentNum - ownMo; // Traditional comparison
    const rentSaveNet = curRentNum - netOwnMo; // With rental offset

    // Detailed utilities calculation
    const defaultElectric = propType === "detached" ? 120 : isCondo ? 80 : 100;
    const defaultWater = propType === "detached" ? 80 : isCondo ? 60 : 70;
    let defaultGas = propType === "detached" ? 150 : isCondo ? 100 : 120;

    // Baseboard heating multiplier (much higher costs)
    let utilCostMo;
    if (heatingType === "baseboard") {
      defaultGas = 0; // No gas with electric baseboard
      const baseboardCost = propType === "detached" ? 400 : 300; // $300-400/mo in winter
      const moElectric = utilElectric ? Number(utilElectric) : defaultElectric + baseboardCost;
      const moWater = utilWater ? Number(utilWater) : defaultWater;
      const moGas = utilGas ? Number(utilGas) : 0;
      utilCostMo = moElectric + moWater + moGas;
    } else {
      const moElectric = utilElectric ? Number(utilElectric) : defaultElectric;
      const moWater = utilWater ? Number(utilWater) : defaultWater;
      const moGas = utilGas ? Number(utilGas) : defaultGas;
      utilCostMo = moElectric + moWater + moGas;
    }

    const utilCost = tenantUtils ? 0 : utilCostMo * 12;
    const maint = egi * (maintPct / 100);
    const opex = annTax + annCondo + utilCost + maint;
    const noi = egi - opex;
    const capRate = priceNum > 0 ? noi / priceNum : 0;
    const cashFlow = noi - annMtg;
    const moCF = cashFlow / 12;
    const coc = cashIn > 0 ? cashFlow / cashIn : 0;
    const dscr = annMtg > 0 ? noi / annMtg : 0;
    const grm = grossAnn > 0 ? priceNum / grossAnn : 0;
    const s5 = amortSchedule(totalMtg, rateNum / 100, amYrs, 5);
    const s10 = amortSchedule(totalMtg, rateNum / 100, amYrs, 10);
    const v5 = priceNum * Math.pow(1 + gr, 5);
    const v10 = priceNum * Math.pow(1 + gr, 10);
    const eq5 = v5 - s5.bal;
    const eq10 = v10 - s10.bal;
    const eqGain5 = eq5 - cashIn;
    const eqGain10 = eq10 - cashIn;
    const netAdv5 = eqGain5 - (ownMo * 60 - curRentNum * 60);
    const netAdv10 = eqGain10 - (ownMo * 120 - curRentNum * 120);
    const roi5 = cashIn > 0 ? Math.pow(Math.max(0.01, cashIn + eqGain5 + cashFlow * 5) / cashIn, 0.2) - 1 : 0;
    const roi10 = cashIn > 0 ? Math.pow(Math.max(0.01, cashIn + eqGain10 + cashFlow * 10) / cashIn, 0.1) - 1 : 0;
    let score = 0, signals = [];
    if (isOwner) {
      const hasRentals = rentalUnits.length > 0;

      if (hasRentals) {
        // Hybrid owner scoring
        const savingsRatio = rentSaveNet / curRentNum;

        if (savingsRatio > 0.4) {
          score += 45;
          signals.push({ x: `Live much cheaper than renting (${$(netOwnMo)}/mo net)`, c: "#34d399" });
        } else if (savingsRatio > 0.2) {
          score += 35;
          signals.push({ x: `Save ${$(rentSaveNet)}/mo vs renting with rental offset`, c: "#34d399" });
        } else if (savingsRatio > 0) {
          score += 25;
          signals.push({ x: `Rentals offset ${Math.round(rentalIncome/ownMo*100)}% of costs`, c: "#34d399" });
        }

        // Bonus for significant rental income
        if (rentalIncome >= ownMo * 0.5) {
          score += 20;
          signals.push({ x: `Rentals cover ${Math.round(rentalIncome/ownMo*100)}% of your costs`, c: "#34d399" });
        } else if (rentalIncome >= ownMo * 0.3) {
          score += 10;
          signals.push({ x: `Rentals help with ${Math.round(rentalIncome/ownMo*100)}% of costs`, c: "#facc15" });
        }

        // Equity building
        if (eqGain5 > 0) { score += 20; signals.push({ x: $(eqGain5) + " equity gain in 5 yrs", c: "#34d399" }); }

        // Principal vs interest
        if (s5.principal > s5.interest) {
          score += 15;
          signals.push({ x: "More principal than interest (5yr)", c: "#34d399" });
        }
      } else {
        // Traditional owner scoring (no rentals)
        if (rentSave > 0) { score += 40; signals.push({ x: "Saves " + $(rentSave) + "/mo vs renting", c: "#34d399" }); }
        else { score += 10; signals.push({ x: "Costs " + $(-rentSave) + "/mo more than rent", c: "#fb923c" }); }
        if (eqGain5 > 0) { score += 30; signals.push({ x: $(eqGain5) + " equity gain in 5 yrs", c: "#34d399" }); }
        if (s5.principal > s5.interest) { score += 15; signals.push({ x: "More principal than interest (5yr)", c: "#34d399" }); }
        else { score += 5; signals.push({ x: Math.round(s5.interest / s5.total * 100) + "% of payments go to interest", c: "#facc15" }); }
        if (cmhcAmt === 0) { score += 15; signals.push({ x: "No CMHC - 20%+ down", c: "#34d399" }); }
        else { score += 5; signals.push({ x: "CMHC adds " + $(cmhcAmt), c: "#facc15" }); }
      }
    } else {
      // Investor mode
      const hasOwnerUnit = !!ownerUnit;

      if (hasOwnerUnit) {
        // Hybrid investor scoring
        // Living cost savings
        const livingSavings = curRentNum - netOwnMo;
        if (livingSavings > curRentNum * 0.5) {
          score += 30;
          signals.push({ x: `Live almost free (${$(netOwnMo)}/mo net cost)`, c: "#34d399" });
        } else if (livingSavings > 0) {
          score += 20;
          signals.push({ x: `Save ${$(livingSavings)}/mo on living costs`, c: "#34d399" });
        }

        // Investment metrics (adjusted thresholds for owner-occupied)
        if (capRate >= 0.04) {
          score += 20;
          signals.push({ x: "Cap rate 4%+ (good for owner-occupied)", c: "#34d399" });
        } else if (capRate >= 0.02) {
          score += 10;
          signals.push({ x: "Cap rate 2-4% (acceptable for owner-occupied)", c: "#facc15" });
        }

        // Combined return (investment + living savings)
        const totalAnnualBenefit = cashFlow + (livingSavings * 12);
        if (totalAnnualBenefit > 0) {
          score += 25;
          signals.push({ x: "Positive total return (investment + living savings)", c: "#34d399" });
        }

        // CMHC advantage
        if (cmhcAmt > 0) {
          score += 15;
          signals.push({ x: "Eligible for CMHC as owner-occupied", c: "#34d399" });
        }
      } else {
        // Traditional investor scoring (pure investment)
        if (capRate >= 0.07) { score += 30; signals.push({ x: "Cap rate 7%+", c: "#34d399" }); }
        else if (capRate >= 0.05) { score += 20; signals.push({ x: "Cap rate 5-7%", c: "#facc15" }); }
        else { score += 5; signals.push({ x: "Cap rate under 5%", c: "#f87171" }); }
        if (cashFlow > 0) { score += 25; signals.push({ x: "Positive cash flow", c: "#34d399" }); }
        else { signals.push({ x: "Negative cash flow", c: "#f87171" }); }
        if (dscr >= 1.25) { score += 20; signals.push({ x: "DSCR 1.25+", c: "#34d399" }); }
        else if (dscr >= 1.0) { score += 10; signals.push({ x: "DSCR 1.0-1.25", c: "#facc15" }); }
        else { signals.push({ x: "DSCR under 1.0", c: "#f87171" }); }
        if (coc >= 0.08) { score += 25; signals.push({ x: "CoC 8%+", c: "#34d399" }); }
        else if (coc >= 0.04) { score += 15; signals.push({ x: "CoC 4-8%", c: "#facc15" }); }
        else { score += 5; signals.push({ x: "CoC under 4%", c: "#f87171" }); }
      }
    }
    let verdict = "PASS", vc = "#f87171";
    if (score >= 75) { verdict = isOwner ? "GREAT BUY" : "STRONG BUY"; vc = "#34d399"; }
    else if (score >= 55) { verdict = isOwner ? "GOOD DEAL" : "WORTH CONSIDERING"; vc = "#facc15"; }
    else if (score >= 35) { verdict = isOwner ? "FAIR" : "MARGINAL"; vc = "#fb923c"; }
    return { down, cmhcR, cmhcAmt, totalMtg, moPmt, annMtg, closing, cashIn, annTax, moTax, moCondo, annCondo, moInsurance, annInsurance, moUtilitiesOwner, annUtilitiesOwner, ownMo, rentSave, rentalIncome, netOwnMo, rentSaveNet, hasOwnerUnit, hasRentals: rentalUnits.length > 0, showCmhcBenefit, showInvestmentWarning, grossMo, grossAnn, egi, utilCost, utilCostMo, maint, opex, noi, capRate, cashFlow, moCF, coc, dscr, grm, s5, s10, v5, v10, eq5, eq10, eqGain5, eqGain10, netAdv5, netAdv10, roi5, roi10, score, signals, verdict, vc, gr };
  }, [price, downPct, rate, amYrs, closePct, market, propType, mode, units, maintPct, taxOvr, condoOvr, tenantUtils, curRent, isOwner, isCondo, mk, insurance, utilElectric, utilWater, utilGas, heatingType]);

  const baseGr = growthOvr ? Number(growthOvr) / 100 : mk.growth.mid;
  const a = useMemo(() => calc(baseGr), [calc, baseGr]);
  const scn = useMemo(() => growthOvr ? null : { low: calc(mk.growth.low), mid: a, high: calc(mk.growth.high) }, [calc, mk.growth.low, mk.growth.high, a, growthOvr]);

  const headerStats = isOwner
    ? [{ l: "Monthly", v: $2(a.ownMo), c: "#e8e8ec" }, { l: "vs Rent", v: a.rentSave >= 0 ? "Save " + $(a.rentSave) : "+" + $(-a.rentSave) + "/mo", c: a.rentSave >= 0 ? "#34d399" : "#fb923c" }, { l: "5yr Equity", v: $(a.eq5), c: "#818cf8" }, { l: "Score", v: a.score + "/100", c: a.vc }]
    : [{ l: "Cap", v: pct(a.capRate), c: "#e8e8ec" }, { l: "CoC", v: pct(a.coc), c: "#e8e8ec" }, { l: "Mo CF", v: $(a.moCF), c: a.moCF >= 0 ? "#34d399" : "#f87171" }, { l: "Score", v: a.score + "/100", c: a.vc }];

  // Chart data preparation
  const equityChartData = useMemo(() => {
    const priceNum = parseFloat(price) || 280000;
    const rateNum = parseFloat(rate) || 3.8;
    const data = [];
    for (let year = 0; year <= 10; year++) {
      const val = priceNum * Math.pow(1 + baseGr, year);
      const { bal } = year === 0 ? { bal: a.totalMtg } : amortSchedule(a.totalMtg, rateNum / 100, amYrs, year);
      data.push({
        year,
        value: Math.round(val),
        equity: Math.round(val - bal)
      });
    }
    return data;
  }, [price, baseGr, a.totalMtg, rate, amYrs]);

  const paymentPieData = useMemo(() => {
    const data = [
      { name: 'Principal', value: a.s5.principal / 60, color: '#34d399' },
      { name: 'Interest', value: a.s5.interest / 60, color: '#f87171' },
      { name: 'Tax', value: a.moTax, color: '#fb923c' }
    ];
    if (a.moCondo > 0) data.push({ name: 'Condo', value: a.moCondo, color: '#818cf8' });
    data.push({ name: 'Insurance', value: a.moInsurance, color: '#facc15' });
    return data;
  }, [a.s5, a.moTax, a.moCondo, a.moInsurance]);

  const cashFlowChartData = useMemo(() => {
    const data = [];
    for (let year = 1; year <= 10; year++) {
      const projectedNoi = a.noi * Math.pow(1 + baseGr, year - 1);
      data.push({
        year,
        cashflow: Math.round(projectedNoi - a.annMtg)
      });
    }
    return data;
  }, [a.noi, a.annMtg, baseGr]);

  // Open save modal with defaults
  const openSaveModal = useCallback(() => {
    setSaveName(`${propType === 'condo' ? 'Condo' : propType === 'detached' ? 'House' : propType === 'duplex' ? 'Duplex' : 'Multi'} - ${$(parseFloat(price) || 280000)}`);
    setSaveAddress("");
    setSaveClient("");
    setSaveNotes("");
    setShowSaveModal(true);
  }, [propType, price]);

  // Save current property
  const saveProperty = useCallback(() => {
    const propertyData = {
      id: Date.now(),
      name: saveName || `${propType === 'condo' ? 'Condo' : propType === 'detached' ? 'House' : propType === 'duplex' ? 'Duplex' : 'Multi'} - ${$(parseFloat(price) || 280000)}`,
      address: saveAddress,
      client: saveClient,
      notes: saveNotes,
      date: new Date().toLocaleDateString(),
      mode, market, propType,
      price: parseFloat(price) || 280000,
      downPct,
      rate: parseFloat(rate) || 3.8,
      amYrs, closePct,
      curRent: parseFloat(curRent) || 1600,
      units, taxOvr, condoOvr, insurance, utilElectric, utilWater, utilGas, heatingType,
      tenantUtils, maintPct, growthOvr,
      results: { ...a }
    };
    const updated = [...savedProperties, propertyData];
    setSavedProperties(updated);
    localStorage.setItem('dealAnalyzerProperties', JSON.stringify(updated));
    setShowSaveModal(false);
    setSaveName(""); setSaveAddress(""); setSaveClient(""); setSaveNotes("");
  }, [mode, market, propType, price, downPct, rate, amYrs, closePct, curRent, units, taxOvr, condoOvr, insurance, utilElectric, utilWater, utilGas, heatingType, tenantUtils, maintPct, growthOvr, a, savedProperties, saveName, saveAddress, saveClient, saveNotes]);

  // Delete saved property
  const deleteProperty = useCallback((id) => {
    const updated = savedProperties.filter(p => p.id !== id);
    setSavedProperties(updated);
    localStorage.setItem('dealAnalyzerProperties', JSON.stringify(updated));
  }, [savedProperties]);

  // Load saved property
  const loadProperty = useCallback((prop) => {
    try {
      setMode(prop.mode || 'owner');
      setMarket(prop.market || 'saskatoon');
      setPropType(prop.propType || 'condo');
      setPrice(String(prop.price || 280000));
      setDownPct(prop.downPct || 0.20);
      setRate(String(prop.rate || 3.8));
      setAmYrs(prop.amYrs || 25);
      setClosePct(prop.closePct || 0.015);
      setCurRent(String(prop.curRent || 1600));

      // Add ownerOccupied default for backward compatibility
      const unitsWithDefault = (prop.units || []).map(u => ({
        type: u.type,
        rent: u.rent,
        ownerOccupied: u.ownerOccupied !== undefined ? u.ownerOccupied : false
      }));
      setUnits(unitsWithDefault);

      setTaxOvr(prop.taxOvr || "");
      setCondoOvr(prop.condoOvr || "");
      setInsurance(prop.insurance || "");
      setUtilElectric(prop.utilElectric || "");
      setUtilWater(prop.utilWater || "");
      setUtilGas(prop.utilGas || "");
      setHeatingType(prop.heatingType || "gas");
      setTenantUtils(prop.tenantUtils !== undefined ? prop.tenantUtils : true);
      setMaintPct(prop.maintPct || 5);
      setGrowthOvr(prop.growthOvr || "");
      setTab("main");
    } catch (error) {
      console.error('Error loading property:', error);
      alert('Error loading property: ' + error.message);
    }
  }, []);

  // Export to PDF - Professional Multi-Page Report
  const exportToPDF = useCallback(async () => {
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF();
    const priceNum = parseFloat(price) || 280000;
    const curRentNum = parseFloat(curRent) || 1600;
    const rateNum = parseFloat(rate) || 3.8;

    // Color palette
    const C = {
      brand: [99, 102, 241],
      success: [52, 211, 153],
      warning: [250, 204, 21],
      danger: [248, 113, 113],
      gray: [156, 163, 175],
      lightGray: [243, 244, 246],
      white: [255, 255, 255]
    };

    const verdictColor = a.vc === '#34d399' ? C.success : a.vc === '#facc15' ? C.warning : C.danger;

    // ============ PAGE 1: EXECUTIVE SUMMARY ============

    // Branded Header (full width purple bar)
    doc.setFillColor(...C.brand);
    doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(...C.white);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('PROPERTY INVESTMENT ANALYSIS', 105, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('eXp Realty | Alberta & Saskatchewan', 105, 23, { align: 'center' });
    doc.setFontSize(8);
    doc.text(`Prepared by Hasan Sharif, REALTOR® | ${new Date().toLocaleDateString()}`, 105, 30, { align: 'center' });

    // Property Title
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`${propType.charAt(0).toUpperCase() + propType.slice(1)} - ${$(priceNum)}`, 20, 47);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.gray);
    doc.text(`${mk.label} | ${isOwner ? 'Buying to Live In' : 'Investment Property'}`, 20, 53);

    // Verdict Card (large colored box)
    const vy = 60;
    doc.setFillColor(...verdictColor);
    doc.roundedRect(15, vy, 180, 25, 3, 3, 'F');
    doc.setTextColor(...C.white);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(a.verdict, 105, vy + 11, { align: 'center' });
    doc.setFontSize(14);
    doc.text(`Score: ${a.score}/100`, 105, vy + 20, { align: 'center' });

    // Property Overview Table
    doc.setFont('helvetica', 'normal');
    const ownershipBody = [
      ['Purchase Price', $(priceNum)],
      ['Down Payment', `${(downPct * 100).toFixed(0)}% (${$(a.down)})`],
      ['Interest Rate', `${rateNum}%`],
      ['Amortization', `${amYrs} years`],
      ['Monthly Payment', $2(a.moPmt)],
      ['Property Tax (Annual)', $(a.annTax)],
      ...(isCondo ? [['Condo Fees (Monthly)', $2(a.moCondo)]] : []),
      ['Insurance (Annual)', $(a.annInsurance)]
    ];

    // Add hybrid ownership info
    if (a.hasOwnerUnit) {
      ownershipBody.push(['Owner-Occupied Unit', unitOpts.find(([id]) => id === getOwnerUnit()?.type)?.[1]]);
      ownershipBody.push(['Rental Units', `${getRentalUnits().length} unit(s)`]);
      ownershipBody.push(['Monthly Rental Income', $(a.rentalIncome)]);
    }

    autoTable(doc, {
      startY: 92,
      head: [['Property Details', 'Value']],
      body: ownershipBody,
      theme: 'striped',
      headStyles: { fillColor: C.brand, fontSize: 11, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 0: { fontStyle: 'bold', textColor: [60, 60, 60] }, 1: { halign: 'right' } }
    });

    // Key Metrics Grid
    let my = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('KEY METRICS', 20, my);

    const metrics = isOwner ? [
      ...(a.hasRentals ? [
        ['Your Monthly Cost', $2(a.ownMo), C.brand],
        ['Rental Income Offset', `-${$(a.rentalIncome)}`, C.success],
        ['Net Out-of-Pocket', $2(a.netOwnMo), C.brand],
        ['vs Rent', a.rentSaveNet >= 0 ? `Save ${$(a.rentSaveNet)}` : `+${$(-a.rentSaveNet)}`, a.rentSaveNet >= 0 ? C.success : C.warning]
      ] : [
        ['Monthly Cost', $2(a.ownMo), C.brand],
        ['vs Rent', a.rentSave >= 0 ? `Save ${$(a.rentSave)}` : `+${$(-a.rentSave)}`, a.rentSave >= 0 ? C.success : C.warning]
      ]),
      ['5-Year Equity', $(a.eq5), C.success],
      ['10-Year Equity', $(a.eq10), C.success],
      ['Net Advantage (5yr)', $(a.netAdv5), a.netAdv5 >= 0 ? C.success : C.danger],
      ['5-Year ROI', pct(a.roi5), a.roi5 >= 0.05 ? C.success : C.warning]
    ] : (a.hasOwnerUnit ? [
      ['Rental Income', `${$(a.grossMo)}/mo (${getRentalUnits().length} units)`, C.success],
      ['Your Living Cost', $2(a.ownMo), C.brand],
      ['Rental Offset', `-${$(a.rentalIncome)}`, C.success],
      ['Net Living Cost', `${$2(a.netOwnMo)}/mo`, C.brand],
      ['vs Renting', `Save ${$2(a.rentSaveNet)}/mo`, C.success],
      ['Cap Rate (on rentals)', pct(a.capRate), a.capRate >= 0.02 ? C.success : C.warning]
    ] : [
      ['Cap Rate', pct(a.capRate), a.capRate >= 0.05 ? C.success : C.warning],
      ['Cash-on-Cash', pct(a.coc), a.coc >= 0.04 ? C.success : C.warning],
      ['DSCR', a.dscr.toFixed(2), a.dscr >= 1.25 ? C.success : C.danger],
      ['Monthly Cash Flow', $(a.moCF), a.moCF >= 0 ? C.success : C.danger],
      ['Annual Cash Flow', $(a.cashFlow), a.cashFlow >= 0 ? C.success : C.danger],
      ['GRM', a.grm.toFixed(1), a.grm < 15 ? C.success : C.warning]
    ]);

    my += 7;
    let mx = 20;
    metrics.forEach((m, i) => {
      if (i > 0 && i % 2 === 0) { mx = 20; my += 20; }
      else if (i > 0) mx = 115;

      doc.setDrawColor(...C.gray);
      doc.setLineWidth(0.5);
      doc.rect(mx, my, 80, 16);
      doc.setFontSize(8);
      doc.setTextColor(...C.gray);
      doc.setFont('helvetica', 'normal');
      doc.text(m[0], mx + 3, my + 5);
      doc.setFontSize(12);
      doc.setTextColor(...m[2]);
      doc.setFont('helvetica', 'bold');
      doc.text(m[1], mx + 77, my + 13, { align: 'right' });
    });

    // CMHC notice for owner-occupied
    if (a.hasOwnerUnit && downPct < 0.20) {
      my = Math.max(my + 22, doc.lastAutoTable.finalY + 15);
      doc.setFontSize(10);
      doc.setTextColor(...C.brand);
      doc.setFont('helvetica', 'bold');
      doc.text('⚡ CMHC ADVANTAGE', 20, my);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      const cmhcText = 'Owner-occupied multi-unit properties may qualify for 5% down with CMHC insurance (same as primary residences). This can provide significant financing advantages compared to pure investment properties. Confirm eligibility with your lender.';
      const cmhcLines = doc.splitTextToSize(cmhcText, 170);
      doc.text(cmhcLines, 20, my + 6);
    }

    // Footer on page 1
    doc.setFontSize(7);
    doc.setTextColor(...C.gray);
    doc.setFont('helvetica', 'normal');
    doc.text('Page 1 of 3', 105, 287, { align: 'center' });

    // ============ PAGE 2: FINANCIAL ANALYSIS ============
    doc.addPage();

    // Header bar (smaller on subsequent pages)
    doc.setFillColor(...C.brand);
    doc.rect(0, 0, 210, 20, 'F');
    doc.setTextColor(...C.white);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('FINANCIAL ANALYSIS', 105, 13, { align: 'center' });

    // Cost Breakdown Table
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('MONTHLY COST BREAKDOWN', 20, 30);

    autoTable(doc, {
      startY: 35,
      head: [['Cost Item', 'Monthly', 'Annual']],
      body: [
        ['Mortgage Payment', $2(a.moPmt), $(a.annMtg)],
        ['Property Tax', $2(a.moTax), $(a.annTax)],
        ...(isCondo ? [['Condo Fees', $2(a.moCondo), $(a.annCondo)]] : []),
        ['Insurance', $2(a.moInsurance), $(a.annInsurance)],
        ...(isOwner ? [['Utilities (Owner)', $2(a.moUtilitiesOwner), $(a.annUtilitiesOwner)]] : []),
        ...(isOwner ? [['TOTAL', $2(a.ownMo), $(a.ownMo * 12)]] : [])
      ],
      theme: 'grid',
      headStyles: { fillColor: C.brand, fontSize: 10, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 2: { halign: 'right' } },
      foot: isOwner ? [] : undefined
    });

    // Down Payment Comparison Table
    my = doc.lastAutoTable.finalY + 12;
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('DOWN PAYMENT SCENARIOS', 20, my);

    const downData = [0.05, 0.10, 0.15, 0.20, 0.25].map(d => {
      const dn = priceNum * d;
      const b = priceNum - dn;
      const cr = (d < 0.20 && priceNum <= 1500000) ? getCmhcRate(d) : 0;
      const cp = b * cr;
      const tm = b + cp;
      const pmt = mortgagePayment(tm, rateNum / 100, amYrs);
      const current = d === downPct;
      return [
        `${(d * 100).toFixed(0)}%${current ? ' ✓' : ''}`,
        $(dn),
        cr > 0 ? $(cp) : '-',
        $(tm),
        $2(pmt)
      ];
    });

    autoTable(doc, {
      startY: my + 5,
      head: [['Down %', 'Down $', 'CMHC', 'Mortgage', 'Payment']],
      body: downData,
      theme: 'striped',
      headStyles: { fillColor: C.brand, fontSize: 9, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } }
    });

    // Investment Signals
    if (a.signals && a.signals.length > 0) {
      my = doc.lastAutoTable.finalY + 12;
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text('DEAL SIGNALS', 20, my);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      my += 6;
      a.signals.slice(0, 6).forEach(s => {
        const col = s.c === '#34d399' ? C.success : s.c === '#facc15' ? C.warning : C.danger;
        doc.setTextColor(...col);
        doc.text('●', 22, my);
        doc.setTextColor(0, 0, 0);
        doc.text(s.x, 28, my);
        my += 5;
      });
    }

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(...C.gray);
    doc.text('Page 2 of 3', 105, 287, { align: 'center' });

    // ============ PAGE 3: PROJECTIONS ============
    doc.addPage();

    // Header bar
    doc.setFillColor(...C.brand);
    doc.rect(0, 0, 210, 20, 'F');
    doc.setTextColor(...C.white);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('LONG-TERM PROJECTIONS', 105, 13, { align: 'center' });

    // 5-Year & 10-Year Projections
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text('EQUITY BUILDING & VALUE GROWTH', 20, 30);

    autoTable(doc, {
      startY: 35,
      head: [['Timeline', 'Property Value', 'Mortgage Balance', 'Your Equity', 'Equity Gain']],
      body: [
        ['5 Years', $(a.v5), $(a.s5.bal), $(a.eq5), $(a.eqGain5)],
        ['10 Years', $(a.v10), $(a.s10.bal), $(a.eq10), $(a.eqGain10)]
      ],
      theme: 'grid',
      headStyles: { fillColor: C.brand, fontSize: 9, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold', textColor: C.success }, 4: { halign: 'right' } }
    });

    // Amortization Breakdown
    my = doc.lastAutoTable.finalY + 12;
    doc.setFontSize(12);
    doc.text('AMORTIZATION BREAKDOWN', 20, my);

    autoTable(doc, {
      startY: my + 5,
      head: [['Period', 'Total Paid', 'Principal', 'Interest', 'Interest %']],
      body: [
        ['5 Years', $(a.s5.total), $(a.s5.principal), $(a.s5.interest), `${(a.s5.interest / a.s5.total * 100).toFixed(1)}%`],
        ['10 Years', $(a.s10.total), $(a.s10.principal), $(a.s10.interest), `${(a.s10.interest / a.s10.total * 100).toFixed(1)}%`]
      ],
      theme: 'striped',
      headStyles: { fillColor: C.brand, fontSize: 9, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right', textColor: C.success }, 3: { halign: 'right', textColor: C.danger }, 4: { halign: 'right' } }
    });

    // Watermark (diagonal)
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.1 }));
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(50);
    doc.setFont('helvetica', 'bold');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.text('eXp REALTY', pageWidth / 2, pageHeight / 2, { align: 'center', angle: 45 });
    doc.restoreGraphicsState();

    // Disclaimer
    my = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(8);
    doc.setTextColor(...C.gray);
    doc.setFont('helvetica', 'italic');
    const disclaimer = 'DISCLAIMER: This analysis is for informational purposes only and should not be considered financial or investment advice. All figures are estimates based on the information provided. Actual costs, returns, and market conditions may vary. Please consult with qualified professionals including a mortgage broker, accountant, real estate agent, and lawyer before making any financial decisions.';
    const lines = doc.splitTextToSize(disclaimer, 170);
    doc.text(lines, 20, my);

    // Footer with full contact info
    doc.setLineWidth(0.5);
    doc.setDrawColor(...C.brand);
    doc.line(20, 265, 190, 265);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.brand);
    doc.text('Hasan Sharif, REALTOR®', 105, 272, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text('eXp Realty | Alberta & Saskatchewan', 105, 277, { align: 'center' });
    doc.setFontSize(8);
    doc.setTextColor(...C.gray);
    doc.text('Residential • Commercial • Farming', 105, 282, { align: 'center' });
    doc.setFontSize(8);
    doc.setTextColor(...C.brand);
    doc.text('📱 (306) 850-7687  |  ✉ hasan.sharif@exprealty.com', 105, 287, { align: 'center' });

    // Page number
    doc.setFontSize(7);
    doc.setTextColor(...C.gray);
    doc.text('Page 3 of 3', 105, 292, { align: 'center' });

    // Save
    doc.save(`Property-Analysis-${$(priceNum)}-${new Date().toISOString().split('T')[0]}.pdf`);
  }, [propType, price, mk, isOwner, downPct, a, rate, curRent, amYrs, isCondo]);

  return (
    <div style={{ minHeight: "100vh", background: "#080a12", color: "#d0d2dc", fontFamily: ff }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 16px 80px" }}>
        <div style={{ padding: "28px 0 16px", borderBottom: "1px solid #121622" }}>
          <div style={{ fontSize: 10, color: "#2d3252", letterSpacing: 3, fontWeight: 800 }}>HASAN SHARIF REALTY</div>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: "4px 0 6px", color: "#f0f0f4" }}>Deal Analyzer</h1>
          <div style={{ fontSize: 11, color: "#3d4266" }}>Tap the ? icons to learn what each metric means</div>
        </div>

        <div style={{ display: "flex", gap: 3, marginTop: 16, background: "#0c0e18", borderRadius: 9, padding: 3, width: "fit-content" }}>
          {[["owner", "🏠 Buying to Live In"], ["investor", "📈 Investment"]].map(([id, lb]) => (
            <button key={id} onClick={() => {
              setMode(id);
              // Don't clear units when switching to owner mode - allow hybrid scenarios
              if (id === "investor" && units.length === 0) {
                // Only add default unit if no units exist
                setUnits([{ type: isCondo ? "2bed" : "2bed_nc", rent: "", ownerOccupied: false }]);
              }
            }} style={{ padding: "10px 20px", borderRadius: 7, border: "none", cursor: "pointer", fontFamily: ff, background: mode === id ? "#6366f1" : "transparent", color: mode === id ? "#fff" : "#3d4266", fontSize: 12, fontWeight: 700 }}>{lb}</button>
          ))}
        </div>

        <div style={{ marginTop: 16, padding: "18px 22px", borderRadius: 12, background: "linear-gradient(135deg," + a.vc + "0A,transparent 70%)", border: "1.5px solid " + a.vc + "25", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div>
            <div style={{ fontSize: 10, color: "#4a5072", letterSpacing: 1.5, fontWeight: 700 }}>{isOwner ? "BUY vs RENT" : "INVESTMENT"} VERDICT</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: a.vc, fontFamily: fm, letterSpacing: -1 }}>{a.verdict}</div>
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {headerStats.map((s, i) => (<div key={i} style={{ textAlign: "center" }}><div style={{ fontSize: 10, color: "#3d4266", marginBottom: 2 }}>{s.l}</div><div style={{ fontSize: 17, fontWeight: 800, fontFamily: fm, color: s.c }}>{s.v}</div></div>))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 4, marginTop: 16, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {[["main", isOwner ? "Buy Analysis" : "Deal Analysis"], ["projection", "5/10yr Outlook"], ["areas", "Neighborhoods"], ["saved", `Saved (${savedProperties.length})`]].map(([id, lb]) => (<Pill key={id} on={tab === id} color="#6366f1" onClick={() => setTab(id)}>{lb}</Pill>))}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={openSaveModal} style={{ padding: "8px 16px", borderRadius: 7, border: "1.5px solid #34d399", background: "#34d39914", color: "#34d399", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: ff }}>💾 Save</button>
            <button onClick={exportToPDF} style={{ padding: "8px 16px", borderRadius: 7, border: "1.5px solid #818cf8", background: "#818cf814", color: "#818cf8", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: ff }}>📄 Export PDF</button>
          </div>
        </div>

        {tab === "main" && (<>
          <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
            <Fd l="MARKET"><select style={ss} value={market} onChange={e => setMarket(e.target.value)}>{Object.entries(MARKETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Fd>
            <Fd l="PRICE"><input style={si} type="number" value={price} onChange={e => setPrice(e.target.value)} min="0" /></Fd>
            {isOwner && <Fd l="CURRENT RENT"><input style={si} type="number" value={curRent} onChange={e => setCurRent(e.target.value)} min="0" /></Fd>}
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 10, flexWrap: "wrap" }}>
            {[["condo", "Condo"], ["detached", "Detached"], ["duplex", "Duplex/4plex"], ["multi", "Multi (5+)"]].map(([id, lb]) => (<Pill key={id} on={propType === id} color="#6366f1" onClick={() => { setPropType(id); if (!isOwner) { if (id === "condo") setUnits([{ type: "2bed", rent: "" }]); else if (id === "detached") setUnits([{ type: "2bed_nc", rent: "" }, { type: "garage", rent: "" }]); else setUnits([{ type: "2bed", rent: "" }, { type: "2bed", rent: "" }]); } }}>{lb}</Pill>))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <Fd l="DOWN %"><select style={ss} value={downPct} onChange={e => setDownPct(Number(e.target.value))}>{[0.05, 0.10, 0.15, 0.20, 0.25].map(d => <option key={d} value={d}>{(d * 100).toFixed(0)}%</option>)}</select></Fd>
            <Fd l="RATE %"><input style={si} type="number" value={rate} onChange={e => setRate(e.target.value)} min="0" max="25" /></Fd>
            <Fd l="AMORT"><select style={ss} value={amYrs} onChange={e => setAmYrs(Number(e.target.value))}><option value={25}>25yr</option><option value={30}>30yr</option></select></Fd>
            <Fd l="CLOSING"><select style={ss} value={closePct} onChange={e => setClosePct(Number(e.target.value))}><option value={0.01}>1%</option><option value={0.015}>1.5%</option><option value={0.02}>2%</option><option value={0.03}>3%</option><option value={0.05}>5%</option></select></Fd>
          </div>
          {a.cmhcAmt > 0 && <div style={{ marginTop: 6, padding: "7px 12px", background: "#facc1508", border: "1px solid #facc1518", borderRadius: 7, fontSize: 11, color: "#facc15" }}><Tip id="cmhc">{"CMHC: " + pct(a.cmhcR) + " = " + $(a.cmhcAmt) + " added to mortgage"}</Tip></div>}
          {parseFloat(price) > 0 && a.down > parseFloat(price) && <div style={{ marginTop: 6, padding: "7px 12px", background: "#f8717108", border: "1px solid #f8717118", borderRadius: 7, fontSize: 11, color: "#f87171" }}>⚠️ Down payment cannot exceed price</div>}
          {!isOwner && units.length === 0 && <div style={{ marginTop: 6, padding: "7px 12px", background: "#fb923c08", border: "1px solid #fb923c18", borderRadius: 7, fontSize: 11, color: "#fb923c" }}>⚠️ Add rental units to see investment analysis</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <Fd l={"TAX/YR (dflt " + $((parseFloat(price) || 280000) * mk.taxRate) + ")"}><input style={si} type="number" placeholder={Math.round((parseFloat(price) || 280000) * mk.taxRate)} value={taxOvr} onChange={e => setTaxOvr(e.target.value)} /></Fd>
            {isCondo && <Fd l={"CONDO FEES (dflt " + $(mk.condoFees) + ")"}><input style={si} type="number" placeholder={mk.condoFees} value={condoOvr} onChange={e => setCondoOvr(e.target.value)} /></Fd>}
            <Fd l={"INSURANCE/YR (dflt " + $((isCondo ? 50 : propType === "detached" ? 150 : 100) * 12) + ")"}><input style={si} type="number" placeholder={(isCondo ? 50 : propType === "detached" ? 150 : 100) * 12} value={insurance} onChange={e => setInsurance(e.target.value)} /></Fd>
            {!isOwner && (<>
              <Fd l="TENANT UTILS?"><div style={{ display: "flex", gap: 3, paddingTop: 2 }}><Pill on={tenantUtils} color="#34d399" onClick={() => setTenantUtils(true)}>Yes</Pill><Pill on={!tenantUtils} color="#fb923c" onClick={() => setTenantUtils(false)}>No</Pill></div></Fd>
              <Fd l="MAINT %"><select style={ss} value={maintPct} onChange={e => setMaintPct(Number(e.target.value))}><option value={0}>0%</option><option value={3}>3%</option><option value={5}>5% ✓</option><option value={8}>8%</option><option value={10}>10%</option></select></Fd>
            </>)}
          </div>

          {/* Utilities breakdown for OWNER mode */}
          {isOwner && (
            <Card sx={{ marginTop: 12, borderColor: "#818cf815", background: "#818cf805" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <SL>⚡ Monthly Utilities Estimate</SL>
                <Fd l="HEATING TYPE">
                  <select style={{...ss, width: 120}} value={heatingType} onChange={e => setHeatingType(e.target.value)}>
                    <option value="gas">Gas Furnace</option>
                    <option value="electric">Electric</option>
                    <option value="baseboard">Baseboard</option>
                  </select>
                </Fd>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Fd l={"ELECTRIC/MO (dflt $" + (heatingType === "baseboard" ? (propType === "detached" ? 520 : 380) : (propType === "detached" ? 120 : isCondo ? 80 : 100)) + ")"}>
                  <input style={si} type="number" placeholder={heatingType === "baseboard" ? (propType === "detached" ? 520 : 380) : (propType === "detached" ? 120 : isCondo ? 80 : 100)} value={utilElectric} onChange={e => setUtilElectric(e.target.value)} />
                </Fd>
                <Fd l={"WATER/MO (dflt $" + (propType === "detached" ? 80 : isCondo ? 60 : 70) + ")"}>
                  <input style={si} type="number" placeholder={propType === "detached" ? 80 : isCondo ? 60 : 70} value={utilWater} onChange={e => setUtilWater(e.target.value)} />
                </Fd>
                <Fd l={"GAS/MO (dflt $" + (heatingType === "baseboard" ? 0 : (propType === "detached" ? 150 : isCondo ? 100 : 120)) + ")"}>
                  <input style={si} type="number" placeholder={heatingType === "baseboard" ? 0 : (propType === "detached" ? 150 : isCondo ? 100 : 120)} value={utilGas} onChange={e => setUtilGas(e.target.value)} />
                </Fd>
              </div>
              {heatingType === "baseboard" && (
                <div style={{ marginTop: 10, padding: "10px 12px", background: "#f8717108", border: "1px solid #f8717118", borderRadius: 7, fontSize: 11, color: "#f87171", lineHeight: 1.6 }}>
                  <strong>⚠️ Baseboard Heating Warning:</strong> Electric baseboard heating in SK/AB climates can cost $300-500/mo during winter months (Oct-Mar). Factor this into your budget!
                </div>
              )}
              <div style={{ marginTop: 10, fontSize: 12, color: "#818cf8", fontWeight: 700 }}>
                Total Monthly Utilities: ${a.moUtilitiesOwner.toFixed(2)} · Annual: {$(a.annUtilitiesOwner)}
              </div>
            </Card>
          )}

          {isOwner && (
            <div style={{ marginTop: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <SL>Rental Units (Optional)</SL>
                <button onClick={() => setUnits([...units, { type: isCondo ? "2bed" : "2bed_nc", rent: "", ownerOccupied: false }])} style={{ padding: "5px 12px", borderRadius: 5, border: "1px solid #1c2036", background: "transparent", color: "#4a5072", fontSize: 11, cursor: "pointer", fontFamily: ff }}>+ Add</button>
              </div>
              <div style={{ fontSize: 11, color: "#4a5072", marginTop: 4 }}>Rent out basement suite, garage, or other units to offset your living costs</div>

              {units.map((u, i) => (<div key={i} style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "end", background: u.ownerOccupied ? "#6366f108" : "transparent", padding: u.ownerOccupied ? "8px" : "0", borderRadius: u.ownerOccupied ? "7px" : "0" }}>
                <Fd l="OWNER UNIT?">
                  <input
                    type="checkbox"
                    checked={u.ownerOccupied || false}
                    onChange={e => {
                      // Only one can be checked - uncheck all others
                      const nu = units.map((unit, idx) => ({
                        ...unit,
                        ownerOccupied: idx === i ? e.target.checked : false
                      }));
                      setUnits(nu);
                    }}
                    style={{
                      width: 18,
                      height: 18,
                      cursor: 'pointer',
                      accentColor: '#6366f1'
                    }}
                  />
                </Fd>
                <Fd l="TYPE"><select style={ss} value={u.type} onChange={e => { const nu = [...units]; nu[i] = { ...nu[i], type: e.target.value }; setUnits(nu); }}>{unitOpts.map(([id, lb]) => <option key={id} value={id}>{lb}</option>)}</select></Fd>
                <Fd l={u.ownerOccupied ? "RENT (potential)" : "RENT (dflt " + $(mk.rents[u.type] || 0) + ")"}><input style={si} type="number" placeholder={mk.rents[u.type] || 0} value={u.rent} onChange={e => { const nu = [...units]; nu[i] = { ...nu[i], rent: e.target.value }; setUnits(nu); }} /></Fd>
                <button onClick={() => setUnits(units.filter((_, j) => j !== i))} style={{ padding: "9px 11px", borderRadius: 5, border: "1px solid #f8717120", background: "transparent", color: "#f87171", fontSize: 11, cursor: "pointer", fontWeight: 700, marginBottom: 1 }}>✕</button>
              </div>))}

              {units.length > 0 && (
                <div style={{ marginTop: 10, fontSize: 11, color: "#8b8faa" }}>
                  {getOwnerUnit() && (
                    <div>
                      <span style={{ color: "#818cf8" }}>● Owner Unit:</span> {
                        unitOpts.find(([id]) => id === getOwnerUnit().type)?.[1]
                      } (${getOwnerUnit().rent || mk.rents[getOwnerUnit().type] || 0} potential)
                    </div>
                  )}
                  {getRentalUnits().length > 0 && (
                    <div>
                      <span style={{ color: "#34d399" }}>● Rental Income:</span> {
                        getRentalUnits().length
                      } unit{getRentalUnits().length > 1 ? 's' : ''} · ${a.rentalIncome}/mo
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!isOwner && !tenantUtils && (
            <Card sx={{ marginTop: 12, borderColor: "#fb923c15", background: "#fb923c05" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <SL>⚡ Utilities Breakdown (Owner Pays)</SL>
                <Fd l="HEATING TYPE">
                  <select style={{...ss, width: 120}} value={heatingType} onChange={e => setHeatingType(e.target.value)}>
                    <option value="gas">Gas Furnace</option>
                    <option value="electric">Electric</option>
                    <option value="baseboard">Baseboard</option>
                  </select>
                </Fd>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Fd l={"ELECTRIC/MO (dflt $" + (heatingType === "baseboard" ? (propType === "detached" ? 520 : 380) : (propType === "detached" ? 120 : isCondo ? 80 : 100)) + ")"}>
                  <input style={si} type="number" placeholder={heatingType === "baseboard" ? (propType === "detached" ? 520 : 380) : (propType === "detached" ? 120 : isCondo ? 80 : 100)} value={utilElectric} onChange={e => setUtilElectric(e.target.value)} />
                </Fd>
                <Fd l={"WATER/MO (dflt $" + (propType === "detached" ? 80 : isCondo ? 60 : 70) + ")"}>
                  <input style={si} type="number" placeholder={propType === "detached" ? 80 : isCondo ? 60 : 70} value={utilWater} onChange={e => setUtilWater(e.target.value)} />
                </Fd>
                <Fd l={"GAS/MO (dflt $" + (heatingType === "baseboard" ? 0 : (propType === "detached" ? 150 : isCondo ? 100 : 120)) + ")"}>
                  <input style={si} type="number" placeholder={heatingType === "baseboard" ? 0 : (propType === "detached" ? 150 : isCondo ? 100 : 120)} value={utilGas} onChange={e => setUtilGas(e.target.value)} />
                </Fd>
              </div>
              {heatingType === "baseboard" && (
                <div style={{ marginTop: 10, padding: "10px 12px", background: "#f8717108", border: "1px solid #f8717118", borderRadius: 7, fontSize: 11, color: "#f87171", lineHeight: 1.6 }}>
                  <strong>⚠️ Baseboard Heating Warning:</strong> Electric baseboard heating in SK/AB climates can cost $300-500/mo during winter months (Oct-Mar). This significantly impacts cash flow and vacancy costs. Budget accordingly or consider properties with gas furnaces.
                </div>
              )}
              <div style={{ marginTop: 10, fontSize: 12, color: "#818cf8", fontWeight: 700 }}>
                Total Monthly Utilities: ${a.utilCostMo.toFixed(2)} · Annual: {$(a.utilCost)}
              </div>
            </Card>
          )}
          {!isOwner && (<>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18 }}>
              <SL>Rental Units</SL>
              <button onClick={() => setUnits([...units, { type: isCondo ? "2bed" : "2bed_nc", rent: "" }])} style={{ padding: "5px 12px", borderRadius: 5, border: "1px solid #1c2036", background: "transparent", color: "#4a5072", fontSize: 11, cursor: "pointer", fontFamily: ff }}>+ Add</button>
            </div>
            {units.map((u, i) => (<div key={i} style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "end", background: u.ownerOccupied ? "#6366f108" : "transparent", padding: u.ownerOccupied ? "8px" : "0", borderRadius: u.ownerOccupied ? "7px" : "0" }}>
              <Fd l="OWNER UNIT?">
                <input
                  type="checkbox"
                  checked={u.ownerOccupied || false}
                  onChange={e => {
                    // Only one can be checked - uncheck all others
                    const nu = units.map((unit, idx) => ({
                      ...unit,
                      ownerOccupied: idx === i ? e.target.checked : false
                    }));
                    setUnits(nu);
                  }}
                  style={{
                    width: 18,
                    height: 18,
                    cursor: 'pointer',
                    accentColor: '#6366f1'
                  }}
                />
              </Fd>
              <Fd l="TYPE"><select style={ss} value={u.type} onChange={e => { const nu = [...units]; nu[i] = { ...nu[i], type: e.target.value }; setUnits(nu); }}>{unitOpts.map(([id, lb]) => <option key={id} value={id}>{lb}</option>)}</select></Fd>
              <Fd l={u.ownerOccupied ? "RENT (potential)" : "RENT (dflt " + $(mk.rents[u.type] || 0) + ")"}><input style={si} type="number" placeholder={mk.rents[u.type] || 0} value={u.rent} onChange={e => { const nu = [...units]; nu[i] = { ...nu[i], rent: e.target.value }; setUnits(nu); }} /></Fd>
              <button onClick={() => setUnits(units.filter((_, j) => j !== i))} style={{ padding: "9px 11px", borderRadius: 5, border: "1px solid #f8717120", background: "transparent", color: "#f87171", fontSize: 11, cursor: "pointer", fontWeight: 700, marginBottom: 1 }}>✕</button>
            </div>))}
            {units.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 11, color: "#8b8faa" }}>
                {getOwnerUnit() && (
                  <div>
                    <span style={{ color: "#818cf8" }}>● Owner Unit:</span> {
                      unitOpts.find(([id]) => id === getOwnerUnit().type)?.[1]
                    } (${getOwnerUnit().rent || mk.rents[getOwnerUnit().type] || 0} potential)
                  </div>
                )}
                {getRentalUnits().length > 0 && (
                  <div>
                    <span style={{ color: "#34d399" }}>● Rental Income:</span> {
                      getRentalUnits().length
                    } unit{getRentalUnits().length > 1 ? 's' : ''} · ${a.rentalIncome}/mo
                  </div>
                )}
              </div>
            )}
            {!hasOwnerUnit && <div style={{ fontSize: 11, color: "#2d3252", marginTop: 5 }}>Gross {$(a.grossMo)}/mo · Effective {$(a.egi / 12)}/mo</div>}
          </>)}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 20 }}>
            <Card><SL>Purchase</SL><Row label="Price" val={$(price)} /><Row label={"Down (" + (downPct * 100).toFixed(0) + "%)"} val={$(a.down)} />{a.cmhcAmt > 0 && <Row label="CMHC Premium" val={$(a.cmhcAmt)} color="#facc15" tip="cmhc" />}<Row label="Total Mortgage" val={$(a.totalMtg)} color="#818cf8" /><Row label="Monthly Payment" val={$2(a.moPmt)} color="#e8e8ec" /><Row label={"Closing (" + (closePct * 100).toFixed(1) + "%)"} val={$(a.closing)} /><Row label="Cash Needed" val={$(a.cashIn)} color="#fb923c" /></Card>
            {isOwner ? (
              <Card sx={{ borderColor: a.hasRentals ? "#34d39920" : "#6366f120" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <SL><Tip id="moCost">YOUR LIVING COSTS</Tip></SL>
                  {a.hasRentals && (
                    <span style={{ fontSize: 10, color: "#34d399", fontWeight: 700 }}>
                      💰 RENTAL OFFSET
                    </span>
                  )}
                </div>
                <Row label="Mortgage" val={$2(a.moPmt)} />
                <Row label="Property Tax" val={$2(a.moTax)} />
                {isCondo && <Row label="Condo Fees" val={$2(a.moCondo)} />}
                <Row label="Insurance" val={$2(a.moInsurance)} tip="insurance" />
                <Row label="Utilities" val={$2(a.moUtilitiesOwner)} />
                <div style={{ borderTop: "1.5px solid rgba(255,255,255,0.03)", margin: "10px 0" }} />
                <Row label="Total Monthly" val={$2(a.ownMo)} color="#e8e8ec" />

                {a.hasRentals && (<>
                  <div style={{ marginTop: 8, marginBottom: 8 }}></div>
                  <Row label="Rental Income Offset" val={`-${$(a.rentalIncome)}`} color="#34d399" />
                  {getRentalUnits().map((u, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0 4px 16px", fontSize: 10 }}>
                      <span style={{ color: "#4a5072" }}>• {unitOpts.find(([id]) => id === u.type)?.[1]}:</span>
                      <span style={{ color: "#8b8faa", fontFamily: fm }}>${u.rent || mk.rents[u.type] || 0}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: "2px solid #34d39940", margin: "10px 0" }} />
                  <Row label="NET OUT-OF-POCKET" val={$2(a.netOwnMo)} color="#818cf8" />
                </>)}

                <div style={{ marginTop: 10, padding: "10px 12px", background: a.rentSaveNet >= 0 ? "#34d39910" : "#fb923c10", border: "1px solid " + (a.rentSaveNet >= 0 ? "#34d39920" : "#fb923c20"), borderRadius: 7 }}>
                  <Row label="vs Renting Similar" val={$2(parseFloat(curRent) || 1600)} color="#8b8faa" />
                  <Row label={a.hasRentals ? (a.rentSaveNet >= 0 ? "YOU SAVE" : "YOU PAY EXTRA") : (a.rentSave >= 0 ? "Savings" : "Extra vs Rent")} val={$2(Math.abs(a.hasRentals ? a.rentSaveNet : a.rentSave))} color={(a.hasRentals ? a.rentSaveNet : a.rentSave) >= 0 ? "#34d399" : "#fb923c"} tip="rvb" />
                </div>

                <div style={{ marginTop: 10, fontSize: 11, color: "#4a5072", lineHeight: 1.6 }}>
                  {a.hasRentals
                    ? (a.rentSaveNet >= 0
                      ? `With rental income, you live for ${$(a.netOwnMo)}/mo while building equity and saving ${$(a.rentSaveNet)}/mo vs renting.`
                      : `Even with rental offset, costs ${$(-a.rentSaveNet)}/mo more than rent, but you build ${$(a.s5.principal)} equity over 5 years.`)
                    : (a.rentSave >= 0
                      ? `Owning costs less. You save ${$(a.rentSave)}/mo while building equity.`
                      : `Costs ${$(-a.rentSave)}/mo more, but you build ${$(a.s5.principal)} equity over 5 years.`)
                  }
                </div>
                <div style={{ marginTop: 8, padding: "8px 10px", background: "#fb923c08", border: "1px solid #fb923c18", borderRadius: 6, fontSize: 10, color: "#fb923c" }}>
                  <Tip id="ownerMaint">⚠️ Budget $200-500/mo for maintenance (not shown above)</Tip>
                </div>
              </Card>
            ) : (
              <Card sx={{ borderColor: "#6366f120" }}>
                <SL>{a.hasOwnerUnit ? "INVESTMENT + LIVING ANALYSIS" : "Operating (Annual)"}</SL>

                {a.hasOwnerUnit ? (
                  // Dual-column layout for hybrid investor
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 12 }}>
                    {/* Left column: Investment metrics */}
                    <div>
                      <div style={{ fontSize: 10, color: "#818cf8", fontWeight: 700, marginBottom: 8, letterSpacing: 0.8 }}>
                        RENTAL INVESTMENT
                      </div>

                      <div style={{ fontSize: 11 }}>
                        <Row label="Rental Income" val={`${$(a.grossMo)}/mo`} color="#34d399" />
                        {getRentalUnits().map((u, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0 4px 16px", fontSize: 10 }}>
                            <span style={{ color: "#4a5072" }}>• {unitOpts.find(([id]) => id === u.type)?.[1]}:</span>
                            <span style={{ color: "#8b8faa", fontFamily: fm }}>${u.rent || mk.rents[u.type] || 0}</span>
                          </div>
                        ))}

                        <div style={{ marginTop: 8 }}></div>
                        <Row label="EGI (after vacancy)" val={`${$(a.egi / 12)}/mo`} />
                        <Row label="Operating Costs" val={`-${$(a.opex / 12)}/mo`} color="#f87171" />
                        <div style={{ borderTop: "1px solid #1c2036", margin: "8px 0" }} />
                        <Row label="NOI" val={`${$(a.noi / 12)}/mo`} color="#34d399" />
                      </div>

                      <div style={{ marginTop: 12, padding: "8px", background: "#6366f108", borderRadius: 5, fontSize: 10 }}>
                        <Row label="Cap Rate" val={pct(a.capRate)} />
                        <Row label="Cash-on-Cash" val={pct(a.coc)} />
                        <Row label="DSCR" val={a.dscr.toFixed(2)} />
                      </div>
                    </div>

                    {/* Right column: Owner living situation */}
                    <div>
                      <div style={{ fontSize: 10, color: "#34d399", fontWeight: 700, marginBottom: 8, letterSpacing: 0.8 }}>
                        YOUR LIVING COSTS
                      </div>

                      <div style={{ marginBottom: 8, padding: "6px 8px", background: "#6366f108", borderRadius: 5, fontSize: 11 }}>
                        <div style={{ fontSize: 9, color: "#8b8faa" }}>Owner Unit:</div>
                        <div style={{ fontSize: 11, color: "#e8e8ec", fontWeight: 700 }}>
                          {unitOpts.find(([id]) => id === getOwnerUnit()?.type)?.[1]}
                        </div>
                        <div style={{ fontSize: 9, color: "#4a5072", marginTop: 2 }}>
                          (${getOwnerUnit()?.rent || mk.rents[getOwnerUnit()?.type] || 0} potential rent)
                        </div>
                      </div>

                      <div style={{ fontSize: 11 }}>
                        <Row label="Your Monthly" val={$2(a.ownMo)} />
                        <Row label="Rental Offset" val={`-${$(a.rentalIncome)}`} color="#34d399" />
                        <div style={{ borderTop: "2px solid #818cf840", margin: "8px 0" }} />
                        <Row label="NET COST" val={`${$2(a.netOwnMo)}/mo`} color="#818cf8" />

                        <div style={{ marginTop: 8 }}></div>
                        <Row label="vs Renting" val={$2(parseFloat(curRent) || 1600)} color="#8b8faa" />
                        <Row label="YOU SAVE" val={`${$2(a.rentSaveNet)}/mo`} color="#34d399" />
                      </div>
                    </div>
                  </div>
                ) : (
                  // Traditional investor layout (unchanged)
                  <div>
                    <Row label="Effective Income" val={$(a.egi)} />
                    <Row label="Property Tax" val={$(a.annTax)} />
                    {a.annCondo > 0 && <Row label="Condo Fees" val={$(a.annCondo)} />}
                    {tenantUtils ? <Row label="Utilities" val="Tenant pays" color="#34d399" /> : <Row label="Utilities" val={$(a.utilCost)} />}
                    <Row label={"Maint (" + maintPct + "%)"} val={$(a.maint)} tip="maint" />
                    <div style={{ borderTop: "1.5px solid rgba(255,255,255,0.03)", margin: "10px 0" }} />
                    <Row label="NOI" val={$(a.noi)} color={a.noi >= 0 ? "#34d399" : "#f87171"} tip="noi" />
                    <Row label="Cash Flow" val={$(a.cashFlow)} color={a.cashFlow >= 0 ? "#34d399" : "#f87171"} tip="cf" />
                  </div>
                )}

                {/* CMHC notice for owner-occupied */}
                {a.hasOwnerUnit && downPct < 0.20 && (
                  <div style={{ marginTop: 12, padding: "10px 12px", background: "#818cf808", border: "1px solid #818cf820", borderRadius: 7, fontSize: 10, color: "#8b8faa", lineHeight: 1.5 }}>
                    <span style={{ color: "#818cf8", fontWeight: 700 }}>⚡ CMHC ADVANTAGE:</span> Owner-occupied multi-unit properties may qualify for 5% down with CMHC insurance (same as primary residences). Confirm eligibility with your lender.
                  </div>
                )}

                {/* Investment note for pure investment < 20% */}
                {!a.hasOwnerUnit && !isOwner && downPct < 0.20 && a.showInvestmentWarning && (
                  <div style={{ marginTop: 12, padding: "10px 12px", background: "#6366f108", border: "1px solid #6366f120", borderRadius: 7, fontSize: 10, color: "#8b8faa", lineHeight: 1.6 }}>
                    <span style={{ color: "#818cf8", fontWeight: 700 }}>📊 SCENARIO ANALYSIS:</span> Conventional lenders require 20% min for pure investment. Numbers shown assume <span style={{ color: "#e8e8ec" }}>NO CMHC</span> — useful for private/alternative lender comparisons or joint ventures. Rates may be 1–2% higher with alternative lenders.
                  </div>
                )}
              </Card>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginTop: 14 }}>
            {isOwner ? (<>
              <Metric label={a.hasRentals ? "Net Cost" : "Monthly"} val={a.hasRentals ? $2(a.netOwnMo) : $2(a.ownMo)} good={(a.hasRentals ? a.rentSaveNet : a.rentSave) >= 0} tip="moCost" />
              <Metric label="vs Rent" val={(a.hasRentals ? a.rentSaveNet : a.rentSave) >= 0 ? "-" + $(a.hasRentals ? a.rentSaveNet : a.rentSave) : "+" + $(-1 * (a.hasRentals ? a.rentSaveNet : a.rentSave))} good={(a.hasRentals ? a.rentSaveNet : a.rentSave) >= 0} tip="rvb" />
              <Metric label="5yr Equity" val={$(a.eq5)} good={true} tip="equity" />
              <Metric label="10yr Equity" val={$(a.eq10)} good={true} tip="equity" />
              <Metric label="Principal 5yr" val={$(a.s5.principal)} good={true} tip="princ" />
              <Metric label="Interest 5yr" val={$(a.s5.interest)} good={false} tip="princ" />
              <Metric label="5yr Value" val={$(a.v5)} good={true} tip="appr" />
              <Metric label="Net Gain 5yr" val={$(a.netAdv5)} good={a.netAdv5 >= 0} />
            </>) : (<>
              <Metric label="Cap Rate" val={pct(a.capRate)} good={a.capRate >= 0.05} tip="capRate" />
              <Metric label="CoC" val={pct(a.coc)} good={a.coc >= 0.04} tip="coc" />
              <Metric label="DSCR" val={a.dscr.toFixed(2)} good={a.dscr >= 1.25} tip="dscr" />
              <Metric label="GRM" val={a.grm.toFixed(1)} good={a.grm > 0 && a.grm <= 15} tip="grm" />
              <Metric label={a.hasOwnerUnit ? "Net Living" : "Mo CF"} val={a.hasOwnerUnit ? $(a.netOwnMo) : $(a.moCF)} good={a.hasOwnerUnit ? (a.netOwnMo < parseFloat(curRent)) : (a.moCF >= 0)} tip="cf" />
              <Metric label="Ann CF" val={$(a.cashFlow)} good={a.cashFlow >= 0} tip="cf" />
              <Metric label="5yr ROI" val={pct(a.roi5)} good={a.roi5 >= 0.06} />
              <Metric label="10yr ROI" val={pct(a.roi10)} good={a.roi10 >= 0.06} />
            </>)}
          </div>
          <Card sx={{ marginTop: 14 }}><SL>Signals</SL>{a.signals.map((s, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: s.c, flexShrink: 0 }} /><span style={{ fontSize: 12, color: s.c }}>{s.x}</span></div>))}</Card>

          {/* Visual Charts Section */}
          <div style={{ marginTop: 20 }}>
            <SL>📊 Visual Analysis</SL>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
              <Card>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#818cf8", marginBottom: 10 }}>Equity Building (10 Years)</div>
                <EquityBuildingChart data={equityChartData} />
              </Card>
              <Card>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#818cf8", marginBottom: 10 }}>Monthly Payment Breakdown</div>
                <MonthlyPaymentPie data={paymentPieData} />
              </Card>
            </div>
            {!isOwner && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                <Card>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#818cf8", marginBottom: 10 }}>Annual Cash Flow</div>
                  <CashFlowChart data={cashFlowChartData} />
                </Card>
                <Card>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#818cf8", marginBottom: 10 }}>5-Year ROI</div>
                  <ROIGauge roi={a.roi5} />
                </Card>
              </div>
            )}
            {isOwner && (
              <Card sx={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#818cf8", marginBottom: 10 }}>5-Year Cost Comparison</div>
                <RentVsOwnChart rentTotal={curRent * 60} ownTotal={a.ownMo * 60} equityGain={a.eq5} />
                <div style={{ marginTop: 10, padding: "8px 10px", background: a.netAdv5 >= 0 ? "#34d39908" : "#f8717108", border: a.netAdv5 >= 0 ? "1px solid #34d39918" : "1px solid #f8717118", borderRadius: 6, fontSize: 11, color: a.netAdv5 >= 0 ? "#34d399" : "#f87171", textAlign: "center" }}>
                  {a.netAdv5 >= 0 ? `✓ Owning is ${$(a.netAdv5)} better than renting over 5 years` : `Renting saves ${$(-a.netAdv5)} over 5 years, but you miss ${$(a.eq5)} equity`}
                </div>
              </Card>
            )}
          </div>

          <div style={{ marginTop: 18 }}><SL>Down Payment Comparison</SL>
            {!isOwner && !hasOwnerUnit && <div style={{ fontSize: 9, color: "#3d4266", marginBottom: 6 }}>* Scenario analysis — conventional lenders require 20%+ for pure investment. Click any row to model it.</div>}
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead><tr style={{ borderBottom: "2px solid #151a28" }}>{["%", "Down", "CMHC", "Mortgage", "Payment", isOwner ? "Mo Cost" : "Mo CF", "Cash In"].map(h => <th key={h} style={{ padding: "7px 6px", color: "#3d4266", fontWeight: 700, textAlign: "right", fontSize: 10 }}>{h}</th>)}</tr></thead>
              <tbody>{[0.05, 0.10, 0.15, 0.20, 0.25].map(d => {
                const priceNum = parseFloat(price) || 280000;
                const curRentNum = parseFloat(curRent) || 1600;
                const rateNum = parseFloat(rate) || 3.8;
                const dn = priceNum * d, b = priceNum - dn, cr = (d < 0.20 && priceNum <= 1500000 && (isOwner || hasOwnerUnit)) ? getCmhcRate(d) : 0, cp = b * cr, tm = b + cp;
                const pmt = mortgagePayment(tm, rateNum / 100, amYrs), ci = dn + priceNum * closePct;
                const mc = pmt + a.moTax + a.moCondo, mcf = a.noi / 12 - pmt, act = d === downPct;
                return (<tr key={d} onClick={() => setDownPct(d)} style={{ borderBottom: "1px solid #0e1019", background: act ? "#6366f108" : "transparent", cursor: "pointer" }}>
                  <td style={{ padding: "7px 6px", textAlign: "right", color: act ? "#818cf8" : "#5a5e80", fontWeight: act ? 700 : 500 }}>
                    {(d * 100).toFixed(0)}%{!isOwner && !hasOwnerUnit && d < 0.20 && <span style={{ fontSize: 8, color: "#4a5072", marginLeft: 2 }}>*</span>}
                  </td>
                  <td style={{ padding: "7px 6px", textAlign: "right", color: "#8b8faa", fontFamily: fm }}>{$(dn)}</td>
                  <td style={{ padding: "7px 6px", textAlign: "right", color: cr ? "#facc15" : "#1c2036", fontFamily: fm }}>{cr ? $(cp) : "—"}</td>
                  <td style={{ padding: "7px 6px", textAlign: "right", color: "#8b8faa", fontFamily: fm }}>{$(tm)}</td>
                  <td style={{ padding: "7px 6px", textAlign: "right", color: "#e8e8ec", fontFamily: fm, fontWeight: 700 }}>{$2(pmt)}</td>
                  <td style={{ padding: "7px 6px", textAlign: "right", fontFamily: fm, fontWeight: 700, color: isOwner ? (mc <= curRentNum ? "#34d399" : "#fb923c") : (mcf >= 0 ? "#34d399" : "#f87171") }}>{isOwner ? $2(mc) : $(mcf)}</td>
                  <td style={{ padding: "7px 6px", textAlign: "right", color: "#fb923c", fontFamily: fm }}>{$(ci)}</td>
                </tr>);
              })}</tbody>
            </table>
          </div>
        </>)}

        {tab === "projection" && (<>
          <Card sx={{ marginTop: 18, borderColor: "#6366f120" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8" }}><Tip id="appr">APPRECIATION RATE</Tip></div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 10, color: "#3d4266" }}>Custom:</span><input style={{ ...si, width: 64, padding: "6px 8px", fontSize: 12, textAlign: "center" }} type="number" step={0.5} placeholder="auto" value={growthOvr} onChange={e => setGrowthOvr(e.target.value)} /></div>
            </div>
            <div style={{ fontSize: 11, color: "#4a5072", lineHeight: 1.6, marginBottom: 10 }}>Real estate does not grow steadily. 3 scenarios show the realistic range.</div>
            {!growthOvr && <div style={{ display: "flex", gap: 8 }}>{[["Conservative", mk.growth.low, "#fb923c"], ["Moderate", mk.growth.mid, "#facc15"], ["Optimistic", mk.growth.high, "#34d399"]].map(([lb, r, c]) => (<div key={lb} style={{ flex: 1, padding: "8px 12px", borderRadius: 8, background: c + "08", border: "1px solid " + c + "18", textAlign: "center" }}><div style={{ fontSize: 10, color: c, fontWeight: 700 }}>{lb}</div><div style={{ fontSize: 16, fontWeight: 800, color: c, fontFamily: fm }}>{pct1(r)}/yr</div></div>))}</div>}
          </Card>
          {scn && !growthOvr ? [5, 10].map(yr => {
            const sch = yr === 5 ? a.s5 : a.s10;
            return (<div key={yr} style={{ marginTop: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#e8e8ec", marginBottom: 10 }}>{yr}-Year Outlook</div>
              <Card sx={{ marginBottom: 10 }}>
                <SL><Tip id="princ">{"Mortgage (" + yr + "yr)"}</Tip></SL>
                <Row label="Total Paid" val={$(sch.total)} /><Row label="Principal (equity)" val={$(sch.principal)} color="#34d399" /><Row label="Interest (bank)" val={$(sch.interest)} color="#fb923c" /><Row label="Balance Left" val={$(sch.bal)} />
                <div style={{ marginTop: 8, height: 8, borderRadius: 4, background: "#151a28", overflow: "hidden", display: "flex" }}><div style={{ width: (sch.principal / sch.total * 100) + "%", background: "#34d399" }} /><div style={{ flex: 1, background: "#fb923c" }} /></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#3d4266", marginTop: 4 }}><span>{"Principal " + (sch.principal / sch.total * 100).toFixed(0) + "%"}</span><span>{"Interest " + (sch.interest / sch.total * 100).toFixed(0) + "%"}</span></div>
              </Card>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[["Conservative", scn.low, "#fb923c"], ["Moderate", scn.mid, "#facc15"], ["Optimistic", scn.high, "#34d399"]].map(([lb, sc, c]) => {
                  const val = yr === 5 ? sc.v5 : sc.v10;
                  const eq = yr === 5 ? sc.eq5 : sc.eq10;
                  const eG = eq - sc.cashIn;
                  return (<Card key={lb} sx={{ borderColor: c + "18" }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: c, marginBottom: 8 }}>{lb} ({pct1(sc.gr)}/yr)</div>
                    <Row label="Value" val={$(val)} color={c} /><Row label="Equity" val={$(eq)} /><Row label="Gain" val={$(eG)} color={eG >= 0 ? "#34d399" : "#f87171"} />
                    {isOwner && (<><div style={{ borderTop: "1px solid rgba(255,255,255,0.03)", margin: "8px 0" }} /><Row label={"Rent (" + yr + "yr)"} val={$(curRent * yr * 12)} color="#f87171" /><Row label="Net Advantage" val={$(eG - (a.ownMo * yr * 12 - curRent * yr * 12))} color={(eG - (a.ownMo * yr * 12 - curRent * yr * 12)) >= 0 ? "#34d399" : "#f87171"} /></>)}
                    {!isOwner && (<><div style={{ borderTop: "1px solid rgba(255,255,255,0.03)", margin: "8px 0" }} /><Row label="Cash Flow" val={$(sc.cashFlow * yr)} color={sc.cashFlow >= 0 ? "#34d399" : "#f87171"} /><Row label="Total Return" val={$(eG + sc.cashFlow * yr)} color="#e8e8ec" /></>)}
                  </Card>);
                })}
              </div>
            </div>);
          }) : (<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 18 }}>
            {[{ yr: 5, sch: a.s5, val: a.v5, eq: a.eq5 }, { yr: 10, sch: a.s10, val: a.v10, eq: a.eq10 }].map(p => (
              <Card key={p.yr}><div style={{ fontSize: 18, fontWeight: 800, color: "#818cf8", fontFamily: fm, marginBottom: 12 }}>{p.yr}-YEAR</div>
                <SL>Mortgage</SL><Row label="Paid" val={$(p.sch.total)} /><Row label="Principal" val={$(p.sch.principal)} color="#34d399" /><Row label="Interest" val={$(p.sch.interest)} color="#fb923c" /><Row label="Balance" val={$(p.sch.bal)} />
                <div style={{ marginTop: 12 }}><SL>If You Sell</SL></div>
                <Row label={"Value (" + growthOvr + "%/yr)"} val={$(p.val)} color="#818cf8" /><Row label="Equity" val={$(p.eq)} color="#34d399" /><Row label="Gain" val={$(p.eq - a.cashIn)} color={(p.eq - a.cashIn) >= 0 ? "#34d399" : "#f87171"} />
              </Card>
            ))}
          </div>)}
        </>)}

        {tab === "areas" && (<div style={{ marginTop: 18 }}>
          <SL>{mk.label}</SL>
          {mk.hoods.map((h, i) => (<Card key={i} sx={{ marginTop: 7, cursor: "pointer" }} onClick={() => { setPrice(String(h.p)); setGrowthOvr((h.g * 100).toFixed(1)); setTab("main"); }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ padding: "3px 8px", borderRadius: 5, fontSize: 10, fontWeight: 800, background: h.t.startsWith("A") ? "#34d39912" : h.t === "B+" ? "#facc1512" : "#fb923c12", color: h.t.startsWith("A") ? "#34d399" : h.t === "B+" ? "#facc15" : "#fb923c" }}>{h.t}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#e0e1e8" }}>{h.n}</span>
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ textAlign: "right" }}><div style={{ fontSize: 9, color: "#3d4266" }}>Price</div><div style={{ fontSize: 13, fontWeight: 700, color: "#8b8faa", fontFamily: fm }}>{$(h.p)}</div></div>
                <div style={{ textAlign: "right" }}><div style={{ fontSize: 9, color: "#3d4266" }}>Growth</div><div style={{ fontSize: 13, fontWeight: 700, color: "#818cf8", fontFamily: fm }}>{pct1(h.g)}/yr</div></div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: "#4a5072", marginTop: 4 }}>{h.desc} · <span style={{ color: "#818cf8", fontWeight: 600 }}>Click to analyze</span></div>
          </Card>))}
        </div>)}

        {tab === "saved" && (<div style={{ marginTop: 18 }}>
          <SL>💾 Saved Properties ({savedProperties.length})</SL>
          {savedProperties.length === 0 ? (
            <Card sx={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontSize: 14, color: "#4a5072", marginBottom: 8 }}>No saved properties yet</div>
              <div style={{ fontSize: 11, color: "#3d4266" }}>Click "Save" button to save properties for comparison</div>
            </Card>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10, marginTop: 10 }}>
                {savedProperties.map((prop) => (
                  <Card key={prop.id} sx={{ cursor: "pointer", position: "relative", borderColor: prop.results.vc + "25" }} onClick={() => loadProperty(prop)}>
                    <button onClick={(e) => { e.stopPropagation(); deleteProperty(prop.id); }} style={{ position: "absolute", top: 8, right: 8, padding: "4px 8px", borderRadius: 5, border: "1px solid #f8717120", background: "transparent", color: "#f87171", fontSize: 10, cursor: "pointer", fontWeight: 700 }}>✕</button>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#e0e1e8", marginBottom: 2, paddingRight: 30 }}>{prop.name}</div>
                    {prop.address && <div style={{ fontSize: 11, color: "#818cf8", marginBottom: 2 }}>📍 {prop.address}</div>}
                    {prop.client && <div style={{ fontSize: 11, color: "#34d399", marginBottom: 2 }}>👤 {prop.client}</div>}
                    <div style={{ fontSize: 10, color: "#4a5072", marginBottom: 8 }}>{prop.date} · {prop.market === 'saskatoon' ? 'Saskatoon' : 'Calgary'} · {prop.mode === 'owner' ? '🏠 Owner' : '📈 Investor'}</div>
                    <div style={{ padding: "6px 10px", borderRadius: 6, background: prop.results.vc + "14", border: "1px solid " + prop.results.vc + "25", marginBottom: 8 }}>
                      <div style={{ fontSize: 10, color: prop.results.vc, fontWeight: 700 }}>{prop.results.verdict}</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: prop.results.vc, fontFamily: fm }}>{prop.results.score}/100</div>
                    </div>
                    {prop.mode === 'owner' ? (
                      <div style={{ fontSize: 10, color: "#6b7194" }}>
                        <div>Monthly: {$2(prop.results.ownMo)}</div>
                        <div>vs Rent: {prop.results.rentSave >= 0 ? 'Save ' + $(prop.results.rentSave) : '+' + $(-prop.results.rentSave)}</div>
                        <div>5yr Equity: {$(prop.results.eq5)}</div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 10, color: "#6b7194" }}>
                        <div>Cap: {pct(prop.results.capRate)}</div>
                        <div>CoC: {pct(prop.results.coc)}</div>
                        <div>Cash Flow: {$(prop.results.cashFlow)}/yr</div>
                      </div>
                    )}
                    {prop.notes && <div style={{ marginTop: 6, fontSize: 10, color: "#4a5072", fontStyle: "italic", borderTop: "1px solid #1c2036", paddingTop: 6 }}>📝 {prop.notes}</div>}
                    <div style={{ marginTop: 8, fontSize: 9, color: "#818cf8", fontWeight: 600 }}>Click to load</div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>)}

        <div style={{ marginTop: 28, padding: "10px 14px", borderRadius: 8, fontSize: 10, color: "#1c2036" }}>Estimates only. Not guaranteed. Consult your mortgage broker and accountant.</div>
      </div>

      {/* Save Property Modal */}
      {showSaveModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setShowSaveModal(false)}>
          <div style={{ background: "#10131c", border: "1px solid #1c2036", borderRadius: 16, padding: 24, maxWidth: 480, width: "100%", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#e8e8ec" }}>💾 Save Property</div>
                <div style={{ fontSize: 11, color: "#4a5072", marginTop: 2 }}>Add details to identify this analysis</div>
              </div>
              <button onClick={() => setShowSaveModal(false)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #1c2036", background: "transparent", color: "#4a5072", fontSize: 14, cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Fd l="PROPERTY NAME *">
                <input style={si} type="text" value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="e.g. 123 Main St Duplex" />
              </Fd>
              <Fd l="ADDRESS">
                <input style={si} type="text" value={saveAddress} onChange={e => setSaveAddress(e.target.value)} placeholder="e.g. 123 Main Street, Saskatoon" />
              </Fd>
              <Fd l="CLIENT / BUYER">
                <input style={si} type="text" value={saveClient} onChange={e => setSaveClient(e.target.value)} placeholder="e.g. John & Jane Smith" />
              </Fd>
              <Fd l="NOTES">
                <textarea style={{ ...si, minHeight: 60, resize: "vertical", fontFamily: ff }} value={saveNotes} onChange={e => setSaveNotes(e.target.value)} placeholder="e.g. MLS# 12345, needs new roof, great location..." />
              </Fd>
            </div>

            <div style={{ marginTop: 16, padding: "10px 12px", background: "#0c0e18", borderRadius: 8, fontSize: 11, color: "#4a5072" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Type</span>
                <span style={{ color: "#8b8faa" }}>{propType === 'condo' ? 'Condo' : propType === 'detached' ? 'House' : propType === 'duplex' ? 'Duplex' : 'Multi'}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span>Price</span>
                <span style={{ color: "#8b8faa" }}>{$(parseFloat(price) || 280000)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span>Score</span>
                <span style={{ color: a.vc, fontWeight: 700 }}>{a.verdict} ({a.score}/100)</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
              <button onClick={() => setShowSaveModal(false)} style={{ flex: 1, padding: "12px", borderRadius: 8, border: "1px solid #1c2036", background: "transparent", color: "#4a5072", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: ff }}>Cancel</button>
              <button onClick={saveProperty} style={{ flex: 2, padding: "12px", borderRadius: 8, border: "none", background: "#34d399", color: "#080a12", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: ff }}>💾 Save Property</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
