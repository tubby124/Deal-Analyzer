# 🏠 Deal Analyzer - Hasan Sharif Realty

A professional real estate investment and purchase analyzer for Canadian markets (Saskatoon & Calgary).

## 🚀 Quick Start

```bash
npm install
npm run dev
```

Open **http://localhost:5173/** in your browser

## ✨ Features

### Two Analysis Modes:
1. **🏠 Buying to Live In** - Compare owning vs renting
2. **📈 Investment Property** - Analyze cash flow and returns

### Calculations Include:
- ✅ **Accurate Canadian mortgage calculations** with monthly compounding
- ✅ **CMHC insurance** (automatic under 20% down)
- ✅ **Property taxes** (market-specific rates)
- ✅ **Condo fees** (with override option)
- ✅ **Property insurance** (defaults: $50/mo condos, $150/mo houses)
- ✅ **Cap Rate, CoC, DSCR, GRM** - All standard investment metrics
- ✅ **5 & 10 year projections** with appreciation scenarios
- ✅ **Amortization breakdown** - principal vs interest over time
- ✅ **Net advantage calculator** - true position vs renting

### Property Types Supported:
- Condos
- Detached houses
- Duplexes/4-plexes
- Multi-family (5+ units)

## 📊 How It Works

### For Owners (Buy vs Rent):
1. Enter property price and your current rent
2. Set down payment (5-25%)
3. See monthly costs vs rent
4. View 5-year equity building
5. Get buy/rent recommendation with score

### For Investors:
1. Add rental units with market rents
2. Set vacancy rate, maintenance %
3. Calculate NOI and cash flow
4. Check cap rate, CoC, DSCR
5. Project 5/10 year returns

## 🧮 The Math is Accurate!

All calculations tested and verified:
- Mortgage: Canadian formula with monthly compounding
- CMHC: 4.0% (5-10%), 3.1% (10-15%), 2.8% (15-20%)
- Property tax: 1.35% Saskatoon, 0.68% Calgary
- Vacancy: 5% Saskatoon, 6% Calgary
- All metrics match industry standards

## 💡 Key Improvements Made

### ✅ Fixed:
- Input responsiveness - can now type multi-digit numbers smoothly
- Added property insurance (was missing)
- Added input validation (no negative numbers)
- Added maintenance budget warning for owners
- Improved closing cost clarity
- Better error messages for missing data

### 📈 Accuracy:
- All calculations mathematically verified
- ROI uses proper CAGR (Compound Annual Growth Rate)
- Net advantage correctly accounts for opportunity cost
- Amortization schedules match bank calculators

## 🏘️ Markets Included

### Saskatoon:
- 9 neighborhoods from A to B- tier
- Price range: $260K - $480K
- Growth rates: 3.5% - 5.5%/year

### Calgary:
- 7 neighborhoods from A to B- tier
- Price range: $320K - $620K
- Growth rates: 3% - 5%/year

## 🎨 Built With

- **React 18** - UI framework
- **Vite** - Lightning fast dev server
- **Custom calculations** - No external finance libraries
- **Responsive design** - Works on all devices

## 📝 Tips for Users

### Owner Mode:
- Budget $200-500/mo for maintenance (not shown in monthly cost)
- 20%+ down payment avoids CMHC insurance
- Compare "Net Advantage" at 5 years to see true position

### Investor Mode:
- Target: Cap rate 5%+, CoC 4%+, DSCR 1.25+
- Use 5% maintenance minimum (8-10% for older properties)
- Factor in vacancy even in tight markets
- Remember: negative cash flow can still build wealth through appreciation + principal paydown

## 🔧 Customization

Override any default:
- Property tax (default: market rate)
- Condo fees (default: market average)
- Insurance (default: $600-1800/yr)
- Rent (per unit type)
- Growth rate (custom appreciation scenario)

## 📱 Pro Tips

1. Click **neighborhood cards** to auto-populate price & growth rate
2. Use the **?** icons to understand each metric
3. Try **different down payments** - table shows all scenarios
4. Check **3 appreciation scenarios** (conservative, moderate, optimistic)
5. Switch property types to see how condos vs houses compare

## ⚠️ Disclaimer

**Estimates only. Not guaranteed.**

Consult your:
- Mortgage broker for exact rates
- Accountant for tax implications
- Real estate agent for market conditions
- Lawyer for closing costs

This tool helps you understand the numbers, but always verify with professionals before making decisions.

## 🎯 What Makes This Different

Unlike simple mortgage calculators:
- ✅ Considers **total ownership cost** (tax, insurance, maintenance)
- ✅ Compares to **renting opportunity cost**
- ✅ Shows **equity building** over time
- ✅ Accounts for **appreciation** with realistic scenarios
- ✅ Includes **CMHC insurance** automatically
- ✅ Calculates **real investment returns** (not just cash flow)

Built for the Canadian market with accurate rates, fees, and appreciation data.

---

Made with ❤️ for smart real estate decisions
