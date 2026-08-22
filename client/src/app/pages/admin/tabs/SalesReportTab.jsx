import { useState, useMemo } from "react";
import { motion } from "motion/react";
import { BarChart3, DollarSign, ShoppingBag, TrendingUp, Printer, CreditCard, Calendar, ArrowDownRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays, startOfWeek, startOfMonth, subMonths, startOfDay, endOfDay } from "date-fns";
import { formatCurrency } from "../../../utils/formatCurrency";

const PRESETS = [
  { key: "all", label: "All Time" },
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
];

function getPresetRange(preset) {
  const now = new Date();
  switch (preset) {
    case "today":
      return { start_date: format(startOfDay(now), "yyyy-MM-dd"), end_date: format(endOfDay(now), "yyyy-MM-dd") };
    case "week":
      return { start_date: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"), end_date: format(endOfDay(now), "yyyy-MM-dd") };
    case "month":
      return { start_date: format(startOfMonth(now), "yyyy-MM-dd"), end_date: format(endOfDay(now), "yyyy-MM-dd") };
    case "last_month": {
      const last = subMonths(now, 1);
      return { start_date: format(startOfMonth(last), "yyyy-MM-dd"), end_date: format(endOfMonth(last), "yyyy-MM-dd") };
    }
    default:
      return {};
  }
}

function groupWeekly(data) {
  const weeks = [];
  for (let i = 0; i < data.length; i += 7) {
    const chunk = data.slice(i, Math.min(i + 7, data.length));
    weeks.push({
      date: chunk[0].date,
      label: `W${Math.floor(i / 7) + 1}`,
      gross: chunk.reduce((s, d) => s + d.gross, 0),
      net: chunk.reduce((s, d) => s + d.net, 0),
      transactions: chunk.reduce((s, d) => s + d.transactions, 0),
    });
  }
  return weeks;
}

function printSalesReport(salesReport, dateLabel) {
  if (!salesReport) return;
  const reportDate = new Date().toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const channels = salesReport.channels || {};
  const adjustmentsByType = salesReport.adjustmentsByType || [];
  const bestSellingProducts = salesReport.bestSellingProducts || [];
  const topAdjustedProducts = salesReport.topAdjustedProducts || [];
  const refundReasons = salesReport.refundReasons || [];
  const appointmentPaymentMethods = salesReport.appointmentPaymentMethods || [];

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Sales Report</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #333; background: #fff; font-size: 12px; }
        .header { text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #D4AF37; }
        .header h1 { color: #1a1a2e; font-size: 22px; margin-bottom: 4px; }
        .header p { color: #666; font-size: 11px; }
        .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
        .kpi-card { padding: 12px; border-radius: 6px; text-align: center; border: 1px solid #e5e7eb; }
        .kpi-card .label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
        .kpi-card .value { font-size: 18px; font-weight: bold; color: #1a1a2e; }
        .kpi-card.highlight { border-color: #D4AF37; background: #FFF9E6; }
        .kpi-card.adjustment { border-color: #FCA5A5; background: #FEF2F2; }
        .kpi-card.net { border-color: #D4AF37; background: #FFF9E6; }
        .section { margin-bottom: 18px; }
        .section h2 { color: #1a1a2e; font-size: 14px; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #D4AF37; }
        .channel-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 15px; }
        .channel-card { padding: 10px; border-radius: 6px; border: 1px solid #e5e7eb; }
        .channel-card h3 { font-size: 11px; margin-bottom: 4px; }
        .channel-card .amount { font-size: 14px; font-weight: bold; }
        .channel-card .tx { font-size: 10px; color: #666; }
        .adj-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 10px; }
        .adj-card { padding: 8px; border-radius: 6px; background: #f8f9fa; text-align: center; }
        .adj-card .label { font-size: 10px; color: #666; }
        .adj-card .value { font-size: 14px; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 10px; }
        th { background-color: #f3f4f6; color: #000; padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #ddd; }
        td { padding: 6px 8px; border-bottom: 1px solid #eee; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; text-align: center; color: #999; font-size: 10px; }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
          table { break-inside: avoid; }
          .kpi-grid, .channel-grid, .adj-grid { break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>CosmosCraft</h1>
        <h2>Sales Performance Report</h2>
        <p>${dateLabel ? `Period: ${dateLabel}` : "All Time"} | Generated on ${reportDate}</p>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="label">Gross Sales</div>
          <div class="value">${formatCurrency(salesReport.grossSales || 0)}</div>
        </div>
        <div class="kpi-card adjustment">
          <div class="label">Adjustments</div>
          <div class="value" style="color:#dc2626;">-${formatCurrency(salesReport.totalAdjustments || 0)}</div>
        </div>
        <div class="kpi-card highlight">
          <div class="label">Net Sales</div>
          <div class="value">${formatCurrency(salesReport.netSales || 0)}</div>
        </div>
        <div class="kpi-card">
          <div class="label">Transactions</div>
          <div class="value">${salesReport.totalTransactions || 0}</div>
        </div>
        <div class="kpi-card">
          <div class="label">Avg Transaction</div>
          <div class="value">${formatCurrency(salesReport.averagePerTransaction || 0)}</div>
        </div>
        <div class="kpi-card">
          <div class="label">Customization Orders</div>
          <div class="value">${salesReport.customizationOrders || 0}</div>
        </div>
      </div>

      <div class="section">
        <h2>Channel Breakdown</h2>
        <div class="channel-grid">
          ${Object.entries(channels).map(([key, ch]) => {
            const labels = { walkIn: "Walk-in", online: "Online", customization: "Customization", appointments: "Appointments" };
            const colors = { walkIn: "#059669", online: "#2563EB", customization: "#7C3AED", appointments: "#D97706" };
            return `
              <div class="channel-card">
                <h3 style="color:${colors[key] || '#333'};">${labels[key] || key}</h3>
                <div class="amount" style="color:${colors[key] || '#333'};">${formatCurrency(ch.gross || 0)}</div>
                <div class="tx">Net: ${formatCurrency(ch.net || 0)} | ${ch.transactions || 0} txns</div>
              </div>
            `;
          }).join("")}
        </div>
      </div>

      <div class="section">
        <h2>Sales Adjustments</h2>
        <div class="adj-grid">
          ${adjustmentsByType.map(a => `
            <div class="adj-card">
              <div class="label">${a.type.charAt(0).toUpperCase() + a.type.slice(1)}s</div>
              <div class="value" style="color:#dc2626;">${a.count} (${formatCurrency(a.amount)})</div>
            </div>
          `).join("")}
        </div>
        <table>
          <thead>
            <tr><th>Type</th><th>Count</th><th>Amount</th></tr>
          </thead>
          <tbody>
            ${adjustmentsByType.map(a => `
              <tr><td>${a.type}</td><td>${a.count}</td><td>${formatCurrency(a.amount)}</td></tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      ${bestSellingProducts.length > 0 ? `
      <div class="section">
        <h2>Top Performing Products</h2>
        <table>
          <thead>
            <tr><th>Rank</th><th>Product</th><th>Units</th><th>Revenue</th><th>Category</th></tr>
          </thead>
          <tbody>
            ${bestSellingProducts.map((p, i) => `
              <tr>
                <td>${i + 1}</td><td>${p.name}</td><td>${p.units}</td><td>${formatCurrency(p.revenue)}</td><td>${p.category || ""}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      ` : ""}

      ${topAdjustedProducts.length > 0 ? `
      <div class="section">
        <h2>Top Adjusted / Returned Products</h2>
        <table>
          <thead>
            <tr><th>Product</th><th>Adjustment Amount</th><th>Reason</th></tr>
          </thead>
          <tbody>
            ${topAdjustedProducts.map(p => `
              <tr><td>${p.name}</td><td>${formatCurrency(p.adjustmentAmount)}</td><td>${p.reason}</td></tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      ` : ""}

      ${refundReasons.length > 0 ? `
      <div class="section">
        <h2>Refund Reasons</h2>
        <table>
          <thead>
            <tr><th>Reason</th><th>Count</th><th>Amount</th></tr>
          </thead>
          <tbody>
            ${refundReasons.map(r => `
              <tr><td>${r.reason}</td><td>${r.count}</td><td>${formatCurrency(r.amount)}</td></tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      ` : ""}

      ${appointmentPaymentMethods.length > 0 ? `
      <div class="section">
        <h2>Appointment Payment Methods</h2>
        <table>
          <thead>
            <tr><th>Method</th><th>Appointments</th><th>Revenue</th></tr>
          </thead>
          <tbody>
            ${appointmentPaymentMethods.map(m => `
              <tr><td>${m.method}</td><td>${m.appointments}</td><td>${formatCurrency(m.revenue)}</td></tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      ` : ""}

      <div class="footer">
        <p>CosmosCraft Guitar Customization & Services</p>
        <p>This is an automated report. For inquiries, contact support@cosmoscraft.com</p>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
}

export function SalesReportTab({ salesReport, fetchSalesReport }) {
  const [preset, setPreset] = useState("all")
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")
  const [activePreset, setActivePreset] = useState("all")

  const dateLabel = useMemo(() => {
    if (!salesReport?.dailyTrend?.length && preset === "all") return "All Time"
    const range = getPresetRange(preset)
    if (range.start_date && range.end_date) {
      if (range.start_date === range.end_date) return range.start_date
      return `${range.start_date} — ${range.end_date}`
    }
    return "Custom Range"
  }, [preset, salesReport])

  const applyPreset = (key) => {
    setActivePreset(key)
    setPreset(key)
    const range = getPresetRange(key)
    fetchSalesReport(range)
  }

  const applyCustom = () => {
    if (!customStart && !customEnd) return
    setActivePreset("custom")
    setPreset("custom")
    fetchSalesReport({
      start_date: customStart || undefined,
      end_date: customEnd || undefined,
    })
  }

  const channels = salesReport?.channels || {}
  const walkIn = channels.walkIn || {}
  const online = channels.online || {}
  const customization = channels.customization || {}
  const appointments = channels.appointments || {}

  const channelData = useMemo(() => {
    const entries = [
      { key: "walkIn", channel: "Walk-in / POS", ...walkIn, color: "#10B981" },
      { key: "online", channel: "Online Orders", ...online, color: "#3B82F6" },
      { key: "customization", channel: "Customization", ...customization, color: "#8B5CF6" },
      { key: "appointments", channel: "Appointments", ...appointments, color: "#F59E0B" },
    ];
    const netSales = salesReport?.netSales || 0;
    return entries.map((c) => ({
      ...c,
      pct: netSales > 0 ? Number(((c.net || 0) / netSales) * 100).toFixed(1) : "0.0",
    }));
  }, [salesReport, walkIn, online, customization, appointments]);

  const chartData = useMemo(() => {
    const daily = (salesReport?.dailyTrend || []).map((d) => ({
      date: d.date,
      label: d.date,
      gross: d.revenue || 0,
      net: d.revenue || 0,
      transactions: d.transactions || 0,
    }));
    if (preset === "all") {
      const weekly = groupWeekly(daily);
      if (weekly.length <= 12) return weekly;
      const monthly = [];
      for (let i = 0; i < weekly.length; i += 4) {
        const chunk = weekly.slice(i, Math.min(i + 4, weekly.length));
        monthly.push({
          date: chunk[0].date,
          label: `M${Math.floor(i / 4) + 1}`,
          gross: chunk.reduce((s, d) => s + d.gross, 0),
          net: chunk.reduce((s, d) => s + d.net, 0),
          transactions: chunk.reduce((s, d) => s + d.transactions, 0),
        });
      }
      return monthly;
    }
    return daily;
  }, [salesReport, preset]);

  const sortedProducts = useMemo(() => {
    const products = salesReport?.bestSellingProducts || []
    return [...products].sort((a, b) => b.units - a.units)
  }, [salesReport])

  const kpis = [
    { label: "Gross Sales", value: formatCurrency(salesReport?.grossSales || 0), icon: DollarSign, color: "#fff", bg: "bg-white", border: "border-gray-200" },
    { label: "Sales Adjustments", value: `-${formatCurrency(salesReport?.totalAdjustments || 0)}`, icon: ArrowDownRight, color: "#fca5a5", bg: "bg-red-50", border: "border-red-200" },
    { label: "Net Sales", value: formatCurrency(salesReport?.netSales || 0), icon: TrendingUp, color: "#D4AF37", bg: "bg-[#FFF9E6]", border: "border-[#D4AF37]" },
    { label: "Transactions", value: salesReport?.totalTransactions || 0, icon: ShoppingBag, color: "#60a5fa", bg: "bg-blue-50", border: "border-blue-200" },
    { label: "Avg Transaction", value: formatCurrency(salesReport?.averagePerTransaction || 0), icon: BarChart3, color: "#34d399", bg: "bg-green-50", border: "border-green-200" },
    { label: "Customization Orders", value: salesReport?.customizationOrders || 0, icon: Calendar, color: "#a78bfa", bg: "bg-purple-50", border: "border-purple-200" },
  ]

  return (
    <motion.div key="sales-report" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      {salesReport ? (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 no-print">
            <div className="text-center border-b border-[var(--border)] pb-4 flex-1">
              <h1 className="text-white text-3xl font-bold mb-1">Sales Performance Report</h1>
              <p className="text-[var(--text-muted)] text-sm mt-1">
                {dateLabel} | Generated on {new Date().toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={() => printSalesReport(salesReport, dateLabel)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--gold-primary)] text-black font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              <Printer className="w-4 h-4" />
              Print Report
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 no-print">
            {PRESETS.map(p => (
              <button
                key={p.key}
                onClick={() => applyPreset(p.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activePreset === p.key
                    ? "bg-[var(--gold-primary)] text-black"
                    : "bg-[var(--surface-dark)] border border-[var(--border)] text-white hover:border-[var(--gold-primary)]"
                }`}
              >
                {p.label}
              </button>
            ))}
            <div className="flex items-center gap-2 ml-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-white text-sm focus:border-[var(--gold-primary)] focus:outline-none"
              />
              <span className="text-[var(--text-muted)]">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-white text-sm focus:border-[var(--gold-primary)] focus:outline-none"
              />
              <button
                onClick={applyCustom}
                className="px-3 py-1.5 bg-[var(--surface-dark)] border border-[var(--border)] text-white rounded-lg text-sm font-medium hover:border-[var(--gold-primary)] transition-colors"
              >
                Apply
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {kpis.map((kpi) => {
              const Icon = kpi.icon
              return (
                <div key={kpi.label} className={`${kpi.bg} border ${kpi.border} rounded-xl p-4 text-center`}>
                  <Icon className="w-6 h-6 mx-auto mb-2" style={{ color: kpi.color }} />
                  <h3 className="text-[var(--text-muted)] text-xs font-medium mb-1">{kpi.label}</h3>
                  <p className="text-lg font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
                </div>
              )
            })}
          </div>

          <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
            <h2 className="text-white text-xl font-semibold mb-6 text-center">Channel Breakdown</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {channelData.map(ch => (
                <div key={ch.key} className={`p-4 border rounded-lg ${ch.key === "walkIn" ? "bg-green-500/10 border-green-500/30 text-green-400" : ch.key === "online" ? "bg-blue-500/10 border-blue-500/30 text-blue-400" : ch.key === "customization" ? "bg-purple-500/10 border-purple-500/30 text-purple-400" : "bg-orange-500/10 border-orange-500/30 text-orange-400"}`}>
                  <p className="font-semibold text-white">{ch.channel}</p>
                  <p className="text-white text-lg font-bold">{formatCurrency(ch.gross || 0)}</p>
                  <p className="text-red-300 text-xs">Adjustments: -{formatCurrency(ch.adjustments || 0)}</p>
                  <p className="text-white font-medium text-sm">Net: {formatCurrency(ch.net || 0)}</p>
                  <p className="text-[var(--text-muted)] text-xs">{ch.transactions || 0} transactions</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
            <h2 className="text-white text-xl font-semibold mb-4">Sales Adjustments Detail</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {(salesReport.adjustmentsByType || []).map(a => (
                <div key={a.type} className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg p-3 text-center">
                  <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider">{a.type}s</p>
                  <p className="text-red-400 font-bold">{a.count}</p>
                  <p className="text-red-300 text-sm">{formatCurrency(a.amount)}</p>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-primary)] border-b border-[var(--border)]">
                  <tr>
                    <th className="text-left py-3 px-4 text-[var(--text-muted)] font-semibold uppercase text-xs tracking-wider">Channel</th>
                    <th className="text-left py-3 px-4 text-[var(--text-muted)] font-semibold uppercase text-xs tracking-wider">Count</th>
                    <th className="text-left py-3 px-4 text-[var(--text-muted)] font-semibold uppercase text-xs tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {(salesReport.adjustmentsByChannel || []).map((a) => (
                    <tr key={a.channel} className="hover:bg-[var(--bg-primary)]/50 transition-colors">
                      <td className="py-3 px-4 text-white font-medium capitalize">{a.channel}</td>
                      <td className="py-3 px-4 text-white">{a.count}</td>
                      <td className="py-3 px-4 text-red-400 font-medium">{formatCurrency(a.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-right text-sm text-[var(--text-muted)]">
              Adjustment Rate: <span className="text-red-400 font-bold">{salesReport.adjustmentRate || 0}%</span>
            </div>
          </div>

          <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
            <h2 className="text-white text-xl font-semibold mb-6">Performance</h2>
            {preset !== "all" && salesReport?.dailyTrend?.length > 0 ? (
              <div className="h-80 min-h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesReport.dailyTrend} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} tick={{ fill: "var(--text-muted)" }} />
                    <YAxis stroke="var(--text-muted)" fontSize={12} tick={{ fill: "var(--text-muted)" }} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ backgroundColor: "var(--surface-dark)", border: "1px solid var(--border)", borderRadius: "8px", color: "white" }} formatter={(v) => [formatCurrency(v), "Revenue"]} />
                    <Bar dataKey="revenue" radius={[4, 4, 0, 0]} fill="#D4AF37" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: "Daily Performance", sales: salesReport?.dailySales, tx: salesReport?.dailyTransactions },
                  { label: "Weekly Performance", sales: salesReport?.weeklySales, tx: salesReport?.weeklyTransactions },
                  { label: "Monthly Performance", sales: salesReport?.monthlySales, tx: salesReport?.monthlyTransactions },
                ].map(p => (
                  <div key={p.label} className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl p-4">
                    <h3 className="text-white font-semibold mb-3">{p.label}</h3>
                    <div className="flex justify-between py-2 border-b border-[var(--border)]">
                      <span className="text-[var(--text-muted)]">Revenue</span>
                      <span className="text-[var(--gold-primary)] font-bold">{formatCurrency(p.sales || 0)}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-[var(--text-muted)]">Transactions</span>
                      <span className="text-white font-medium">{p.tx || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {(salesReport.bestSellingProducts || []).length > 0 && (
            <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
              <h2 className="text-white text-xl font-semibold mb-6">Top Performing Products</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[var(--bg-primary)] border-b border-[var(--border)]">
                    <tr>
                      {["Rank", "Product", "Units Sold", "Revenue", "Category"].map(h => (
                        <th key={h} className="text-left py-4 px-6 text-[var(--text-muted)] font-semibold uppercase text-xs tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {salesReport.bestSellingProducts.map((product, i) => (
                      <tr key={i} className="hover:bg-[var(--bg-primary)]/50 transition-colors">
                        <td className="py-4 px-6">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${i === 0 ? "bg-[var(--gold-primary)]" : i === 1 ? "bg-gray-400" : i === 2 ? "bg-orange-600" : "bg-[var(--bg-primary)]"}`}>{i + 1}</div>
                        </td>
                        <td className="py-4 px-6 text-white font-medium">{product.name}</td>
                        <td className="py-4 px-6 text-white font-medium">{product.units}</td>
                        <td className="py-4 px-6 text-[var(--gold-primary)] font-bold">{formatCurrency(product.revenue)}</td>
                        <td className="py-4 px-6"><span className="px-3 py-1 bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] rounded-full text-sm">{product.category}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(salesReport.topAdjustedProducts || []).length > 0 && (
            <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
              <h2 className="text-white text-xl font-semibold mb-6">Top Adjusted / Returned Products</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[var(--bg-primary)] border-b border-[var(--border)]">
                    <tr>
                      {["Product", "Adjustment Amount", "Reason"].map(h => (
                        <th key={h} className="text-left py-4 px-6 text-[var(--text-muted)] font-semibold uppercase text-xs tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {salesReport.topAdjustedProducts.map((product, i) => (
                      <tr key={i} className="hover:bg-[var(--bg-primary)]/50 transition-colors">
                        <td className="py-4 px-6 text-white font-medium">{product.name}</td>
                        <td className="py-4 px-6 text-red-400 font-bold">{formatCurrency(product.adjustmentAmount)}</td>
                        <td className="py-4 px-6 text-[var(--text-muted)]">{product.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(salesReport.refundReasons || []).length > 0 && (
            <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
              <h2 className="text-white text-xl font-semibold mb-6">Refund Reasons</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[var(--bg-primary)] border-b border-[var(--border)]">
                    <tr>
                      {["Reason", "Count", "Amount"].map(h => (
                        <th key={h} className="text-left py-4 px-6 text-[var(--text-muted)] font-semibold uppercase text-xs tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {salesReport.refundReasons.map((r, i) => (
                      <tr key={i} className="hover:bg-[var(--bg-primary)]/50 transition-colors">
                        <td className="py-4 px-6 text-white font-medium">{r.reason}</td>
                        <td className="py-4 px-6 text-white">{r.count}</td>
                        <td className="py-4 px-6 text-red-400 font-bold">{formatCurrency(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(salesReport.appointmentPaymentMethods || []).length > 0 && (
            <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
              <h2 className="text-white text-xl font-semibold mb-6">Appointment Payment Methods</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {salesReport.appointmentPaymentMethods.map((entry) => (
                  <div key={entry.method} className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl p-4 text-center">
                    <div className="w-10 h-10 rounded-xl bg-[var(--gold-primary)]/20 flex items-center justify-center mx-auto mb-2">
                      <CreditCard className="w-5 h-5 text-[var(--gold-primary)]" />
                    </div>
                    <p className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wider">{entry.method}</p>
                    <p className="text-white text-lg font-bold mt-1">{entry.appointments || 0} appointments</p>
                    <p className="text-[var(--gold-primary)] text-sm mt-1">{formatCurrency(entry.revenue || 0)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12">
          <BarChart3 className="w-16 h-16 text-[var(--gold-primary)] mx-auto mb-4" />
          <h2 className="text-white text-xl font-semibold mb-2">Loading Sales Report...</h2>
          <p className="text-[var(--text-muted)]">Fetching comprehensive sales analytics data.</p>
        </div>
      )}
    </motion.div>
  )
}
