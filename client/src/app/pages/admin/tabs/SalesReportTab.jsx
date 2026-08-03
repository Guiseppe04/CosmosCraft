import { motion } from 'motion/react'
import { BarChart3, DollarSign, ShoppingBag, TrendingUp, Clock, Calendar } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { formatCurrency } from '../../../utils/formatCurrency'

export function SalesReportTab({ salesReport }) {
  return (
    <motion.div key="sales-report" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      {salesReport ? (
        <div className="space-y-8">
          <div className="text-center border-b border-[var(--border)] pb-6">
            <h1 className="text-white text-3xl font-bold mb-2">Sales Performance Report</h1>
            <p className="text-[var(--text-muted)] text-sm mt-2">Report generated on {new Date().toLocaleDateString()}</p>
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
