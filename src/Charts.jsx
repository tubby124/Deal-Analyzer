import { LineChart, Line, PieChart, Pie, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = {
  principal: '#34d399',
  interest: '#f87171',
  tax: '#fb923c',
  condo: '#818cf8',
  insurance: '#facc15',
  rent: '#f87171',
  own: '#34d399',
  equity: '#34d399',
  value: '#818cf8',
  cashflow: '#34d399',
  negative: '#f87171'
};

export function EquityBuildingChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a1e30" />
        <XAxis dataKey="year" stroke="#4a5072" style={{ fontSize: 11 }} />
        <YAxis stroke="#4a5072" style={{ fontSize: 11 }} tickFormatter={(val) => `$${(val/1000).toFixed(0)}K`} />
        <Tooltip
          contentStyle={{ background: '#10131c', border: '1px solid #1a1e30', borderRadius: 8, fontSize: 11 }}
          formatter={(val) => `$${val.toLocaleString()}`}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="equity" stroke={COLORS.equity} strokeWidth={3} name="Your Equity" dot={{ r: 4 }} />
        <Line type="monotone" dataKey="value" stroke={COLORS.value} strokeWidth={2} name="Property Value" strokeDasharray="5 5" />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function MonthlyPaymentPie({ data }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
          dataKey="value"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelStyle={{ fontSize: 10, fill: '#d0d2dc' }}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: '#10131c', border: '1px solid #1a1e30', borderRadius: 8, fontSize: 11 }}
          formatter={(val) => `$${val.toFixed(2)}`}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CashFlowChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a1e30" />
        <XAxis dataKey="year" stroke="#4a5072" style={{ fontSize: 11 }} />
        <YAxis stroke="#4a5072" style={{ fontSize: 11 }} tickFormatter={(val) => `$${(val/1000).toFixed(0)}K`} />
        <Tooltip
          contentStyle={{ background: '#10131c', border: '1px solid #1a1e30', borderRadius: 8, fontSize: 11 }}
          formatter={(val) => `$${val.toLocaleString()}`}
        />
        <Bar dataKey="cashflow" name="Annual Cash Flow">
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.cashflow >= 0 ? COLORS.cashflow : COLORS.negative} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RentVsOwnChart({ rentTotal, ownTotal, equityGain }) {
  const data = [
    { name: 'Renting (5yr)', value: rentTotal, color: COLORS.rent },
    { name: 'Owning (5yr)', value: ownTotal, color: COLORS.own }
  ];

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 10, left: 80, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a1e30" />
        <XAxis type="number" stroke="#4a5072" style={{ fontSize: 11 }} tickFormatter={(val) => `$${(val/1000).toFixed(0)}K`} />
        <YAxis type="category" dataKey="name" stroke="#4a5072" style={{ fontSize: 11 }} />
        <Tooltip
          contentStyle={{ background: '#10131c', border: '1px solid #1a1e30', borderRadius: 8, fontSize: 11 }}
          formatter={(val) => `$${val.toLocaleString()}`}
        />
        <Bar dataKey="value">
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ROIGauge({ roi }) {
  const percentage = Math.min(Math.max(roi * 100, 0), 15);
  const color = roi >= 0.08 ? COLORS.cashflow : roi >= 0.04 ? COLORS.insurance : COLORS.negative;

  return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <svg width="200" height="120" viewBox="0 0 200 120">
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style={{ stopColor: '#f87171', stopOpacity: 1 }} />
            <stop offset="50%" style={{ stopColor: '#facc15', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#34d399', stopOpacity: 1 }} />
          </linearGradient>
        </defs>
        {/* Background arc */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="#1a1e30"
          strokeWidth="20"
          strokeLinecap="round"
        />
        {/* Colored arc */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth="20"
          strokeLinecap="round"
          strokeDasharray={`${(percentage / 15) * 251} 251`}
        />
        {/* Needle */}
        <line
          x1="100"
          y1="100"
          x2={100 + 70 * Math.cos(Math.PI - (percentage / 15) * Math.PI)}
          y2={100 - 70 * Math.sin(Math.PI - (percentage / 15) * Math.PI)}
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="100" cy="100" r="5" fill={color} />
        {/* Labels */}
        <text x="20" y="115" fill="#4a5072" fontSize="10">0%</text>
        <text x="90" y="25" fill="#4a5072" fontSize="10">8%</text>
        <text x="170" y="115" fill="#4a5072" fontSize="10">15%</text>
      </svg>
      <div style={{ fontSize: 24, fontWeight: 900, color, fontFamily: "'JetBrains Mono', monospace" }}>
        {(roi * 100).toFixed(1)}%
      </div>
      <div style={{ fontSize: 11, color: '#4a5072', marginTop: 4 }}>
        {roi >= 0.08 ? 'Excellent ROI' : roi >= 0.04 ? 'Fair ROI' : 'Low ROI'}
      </div>
    </div>
  );
}
