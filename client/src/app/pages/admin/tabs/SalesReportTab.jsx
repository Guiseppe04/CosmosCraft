import { motion } from 'motion/react'
import { BarChart3, DollarSign, ShoppingBag, TrendingUp, Clock, Calendar, Printer, CreditCard } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { formatCurrency } from '../../../utils/formatCurrency'
import { formatPaymentMethod } from '../../../utils/paymentMethodUtils'

function printSalesReport(salesReport) {
  if (!salesReport) return
  const reportDate = new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Sales Performance Report</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #333; background: #fff; }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #D4AF37; }
        .header h1 { color: #1a1a2e; font-size: 28px; margin-bottom: 5px; }
        .header p { color: #666; font-size: 13px; }
        .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
        .summary-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #D4AF37; }
        .summary-card .label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px; }
        .summary-card .value { font-size: 22px; font-weight: bold; color: #1a1a2e; }
        .section { margin-bottom: 25px; }
        .section h2 { color: #1a1a2e; font-size: 18px; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid #D4AF37; }
        .channel-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; }
        .channel-card { padding: 15px; border-radius: 8px; text-align: center; }
        .channel-card h3 { font-size: 14px; margin-bottom: 8px; }
        .channel-card .amount { font-size: 20px; font-weight: bold; }
        .channel-card .tx { font-size: 12px; color: #666; }
        .perf-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; }
        .perf-card { background: #f8f9fa; padding: 15px; border-radius: 8px; }
        .perf-card h3 { font-size: 14px; margin-bottom: 10px; color: #1a1a2e; }
        .perf-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee; font-size: 13px; }
        .perf-row:last-child { border-bottom: 0; }
        .perf-label { color: #666; }
        .perf-value { font-weight: bold; color: #1a1a2e; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { background-color: #D4AF37; color: #000; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
        td { padding: 10px 12px; border-bottom: 1px solid #ddd; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .rank-1 { background-color: #FFF3CD !important; font-weight: bold; }
        .rank-2 { background-color: #F0F0F0 !important; }
        .rank-3 { background-color: #FFE5CC !important; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; }
        .badge-gold { background: #FFF3CD; color: #856404; }
        .badge-green { background: #D4EDDA; color: #155724; }
        .badge-blue { background: #D1ECF1; color: #0C5460; }
        .badge-purple { background: #E8DAEF; color: #6C3483; }
        .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center; color: #999; font-size: 11px; }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
          .summary-grid, .channel-grid, .perf-grid { break-inside: avoid; }
          table { break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>CosmosCraft</h1>
        <h2>Sales Performance Report</h2>
        <p>Generated on ${reportDate}</p>
      </div>

      <div class="summary-grid">
        <div class="summary-card">
          <div class="label">Total Gross Sales</div>
          <div class="value">${formatCurrency(salesReport.totalGrossSales || 0)}</div>
        </div>
        <div class="summary-card">
          <div class="label">Total Transactions</div>
          <div class="value">${salesReport.totalTransactions || 0}</div>
        </div>
        <div class="summary-card">
          <div class="label">Avg per Transaction</div>
          <div class="value">${formatCurrency(salesReport.averagePerTransaction || 0)}</div>
        </div>
        <div class="summary-card">
          <div class="label">Customization Orders</div>
          <div class="value">${salesReport.customizationOrders || 0}</div>
        </div>
      </div>

      <div class="section">
        <h2>Sales Breakdown by Channel</h2>
        <div class="channel-grid">
          <div class="channel-card" style="background:#D4EDDA;border:1px solid #C3E6CB;">
            <h3 style="color:#155724;">Walk-in Sales</h3>
            <div class="amount" style="color:#155724;">${formatCurrency(salesReport.walkInSales || 0)}</div>
            <div class="tx">${salesReport.walkInTransactions || 0} transactions</div>
          </div>
          <div class="channel-card" style="background:#D1ECF1;border:1px solid #BEE5EB;">
            <h3 style="color:#0C5460;">Online Sales</h3>
            <div class="amount" style="color:#0C5460;">${formatCurrency(salesReport.onlineSales || 0)}</div>
            <div class="tx">${salesReport.onlineTransactions || 0} transactions</div>
          </div>
          <div class="channel-card" style="background:#E8DAEF;border:1px solid #D2B4DE;">
            <h3 style="color:#6C3483;">Customization</h3>
            <div class="amount" style="color:#6C3483;">${formatCurrency(salesReport.customizationSales || 0)}</div>
            <div class="tx">${salesReport.customizationTransactions || 0} transactions</div>
          </div>
        </div>
      </div>

      <div class="section">
        <h2>Performance Overview</h2>
        <div class="perf-grid">
          <div class="perf-card">
            <h3>Daily Performance</h3>
            <div class="perf-row"><span class="perf-label">Revenue</span><span class="perf-value">${formatCurrency(salesReport.dailySales || 0)}</span></div>
            <div class="perf-row"><span class="perf-label">Transactions</span><span class="perf-value">${salesReport.dailyTransactions || 0}</span></div>
          </div>
          <div class="perf-card">
            <h3>Weekly Performance</h3>
            <div class="perf-row"><span class="perf-label">Revenue</span><span class="perf-value">${formatCurrency(salesReport.weeklySales || 0)}</span></div>
            <div class="perf-row"><span class="perf-label">Transactions</span><span class="perf-value">${salesReport.weeklyTransactions || 0}</span></div>
          </div>
          <div class="perf-card">
            <h3>Monthly Performance</h3>
            <div class="perf-row"><span class="perf-label">Revenue</span><span class="perf-value">${formatCurrency(salesReport.monthlySales || 0)}</span></div>
            <div class="perf-row"><span class="perf-label">Transactions</span><span class="perf-value">${salesReport.monthlyTransactions || 0}</span></div>
          </div>
        </div>
      </div>

      ${(salesReport.bestSellingProducts || []).length > 0 ? `
      <div class="section">
        <h2>Top Performing Products</h2>
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Product</th>
              <th>Units Sold</th>
              <th>Revenue</th>
              <th>Category</th>
            </tr>
          </thead>
          <tbody>
            ${salesReport.bestSellingProducts.map((product, i) => `
              <tr class="${i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : ''}">
                <td>${i + 1}</td>
                <td>${product.name}</td>
                <td>${product.units}</td>
                <td>${formatCurrency(product.revenue)}</td>
                <td><span class="badge badge-gold">${product.category}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}

      <div class="footer">
        <p>CosmosCraft Guitar Customization & Services</p>
        <p>This is an automated report. For inquiries, contact support@cosmoscraft.com</p>
      </div>
    </body>
    </html>
  `

  const printWindow = window.open('', '_blank')
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.onload = () => {
    printWindow.focus()
    printWindow.print()
  }
}

export function SalesReportTab({ salesReport }) {
  return (
    <motion.div key="sales-report" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      {salesReport ? (
        <div className="space-y-8">
          <div className="flex items-center justify-between no-print">
            <div className="text-center border-b border-[var(--border)] pb-6 flex-1">
              <h1 className="text-white text-3xl font-bold mb-2">Sales Performance Report</h1>
              <p className="text-[var(--text-muted)] text-sm mt-2">Report generated on {new Date().toLocaleDateString()}</p>
            </div>
            <button
              onClick={() => printSalesReport(salesReport)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--gold-primary)] text-black font-semibold rounded-lg hover:opacity-90 transition-opacity ml-4"
            >
              <Printer className="w-4 h-4" />
              Print Report
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { icon: DollarSign, label: 'Total Gross Sales', value: formatCurrency(salesReport.totalGrossSales || 0), color: 'var(--gold-primary)', bg: 'from-[var(--gold-primary)]/10', border: 'border-[var(--gold-primary)]/30' },
              { icon: ShoppingBag, label: 'Total Transactions', value: salesReport.totalTransactions || 0, color: '#60a5fa', bg: 'from-blue-500/10', border: 'border-blue-500/30' },
              { icon: TrendingUp, label: 'Avg per Transaction', value: formatCurrency(salesReport.averagePerTransaction || 0), color: '#34d399', bg: 'from-green-500/10', border: 'border-green-500/30' },
              { icon: BarChart3, label: 'Customization Orders', value: salesReport.customizationOrders || 0, color: '#a78bfa', bg: 'from-purple-500/10', border: 'border-purple-500/30' },
            ].map((s) => {
              const Icon = s.icon
              return (
                <div key={s.label} className={`bg-gradient-to-br ${s.bg} to-transparent border ${s.border} rounded-2xl p-6 text-center`}>
                  <Icon className="w-8 h-8 mx-auto mb-3" style={{ color: s.color }} />
                  <h3 className="text-white text-sm font-medium mb-1">{s.label}</h3>
                  <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                </div>
              )
            })}
          </div>

          <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
            <h2 className="text-white text-xl font-semibold mb-6 text-center">Sales Breakdown by Channel</h2>
            <div className="h-80 min-h-[250px] w-full mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { category: 'Walk-in', amount: salesReport.walkInSales || 0 },
                  { category: 'Online', amount: salesReport.onlineSales || 0 },
                  { category: 'Customization', amount: salesReport.customizationSales || 0 },
                ]} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="category" stroke="var(--text-muted)" fontSize={12} tick={{ fill: 'var(--text-muted)' }} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} tick={{ fill: 'var(--text-muted)' }} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--surface-dark)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white' }} formatter={(v) => [formatCurrency(v), 'Revenue']} />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {['#10B981', '#3B82F6', '#8B5CF6'].map((color, idx) => <Cell key={idx} fill={color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              {[
                { label: 'Walk-in Sales', sales: salesReport.walkInSales, tx: salesReport.walkInTransactions, cls: 'bg-green-500/10 border-green-500/30 text-green-400' },
                { label: 'Online Sales', sales: salesReport.onlineSales, tx: salesReport.onlineTransactions, cls: 'bg-blue-500/10 border-blue-500/30 text-blue-400' },
                { label: 'Customization', sales: salesReport.customizationSales, tx: salesReport.customizationTransactions, cls: 'bg-purple-500/10 border-purple-500/30 text-purple-400' },
              ].map(ch => (
                <div key={ch.label} className={`p-4 border rounded-lg ${ch.cls}`}>
                  <p className="font-semibold">{ch.label}</p>
                  <p className="text-white text-lg">{formatCurrency(ch.sales || 0)}</p>
                  <p className="text-[var(--text-muted)] text-sm">{ch.tx || 0} transactions</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: 'Daily Performance', icon: Clock, sales: salesReport.dailySales, tx: salesReport.dailyTransactions, iconCls: 'text-[var(--gold-primary)]' },
              { label: 'Weekly Performance', icon: Calendar, sales: salesReport.weeklySales, tx: salesReport.weeklyTransactions, iconCls: 'text-blue-400' },
              { label: 'Monthly Performance', icon: BarChart3, sales: salesReport.monthlySales, tx: salesReport.monthlyTransactions, iconCls: 'text-green-400' },
            ].map(p => {
              const Icon = p.icon
              return (
                <div key={p.label} className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Icon className={`w-6 h-6 ${p.iconCls}`} />
                    <h3 className="text-white text-lg font-semibold">{p.label}</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
                      <span className="text-[var(--text-muted)]">Revenue</span>
                      <span className="text-[var(--gold-primary)] font-bold">{formatCurrency(p.sales || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-[var(--text-muted)]">Transactions</span>
                      <span className="text-white font-medium">{p.tx || 0}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {(salesReport.bestSellingProducts || []).length > 0 && (
            <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
              <h2 className="text-white text-xl font-semibold mb-6">Top Performing Products</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[var(--bg-primary)] border-b border-[var(--border)]">
                    <tr>
                      {['Rank', 'Product', 'Units Sold', 'Revenue', 'Category'].map(h => (
                        <th key={h} className="text-left py-4 px-6 text-[var(--text-muted)] font-semibold uppercase text-xs tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {salesReport.bestSellingProducts.map((product, i) => (
                      <tr key={i} className="hover:bg-[var(--bg-primary)]/50 transition-colors">
                        <td className="py-4 px-6">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${i === 0 ? 'bg-[var(--gold-primary)]' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-orange-600' : 'bg-[var(--bg-primary)]'}`}>{i + 1}</div>
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

        {(salesReport.appointmentPaymentMethods || []).length > 0 && (
          <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
            <h2 className="text-white text-xl font-semibold mb-6">Appointment Payments by Method</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {salesReport.appointmentPaymentMethods.map((entry) => (
                <div key={entry.method} className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl p-4 text-center">
                  <div className="w-10 h-10 rounded-xl bg-[var(--gold-primary)]/20 flex items-center justify-center mx-auto mb-2">
                    <CreditCard className="w-5 h-5 text-[var(--gold-primary)]" />
                  </div>
                  <p className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wider">{formatPaymentMethod(entry.method)}</p>
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