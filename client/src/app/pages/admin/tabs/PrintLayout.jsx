// PrintLayout.jsx – Print-friendly layout for Sales Report
import { fmt } from "../../../utils/formatCurrency";


export default function PrintLayout({ salesReport }) {
  const grossSales = salesReport?.grossSales ?? 0;
  const adjustments = salesReport?.totalAdjustments ?? 0;
  const netSales = salesReport?.netSales ?? 0;
  const totalTxns = salesReport?.totalTransactions ?? 0;
  const avgTxn = totalTxns ? netSales / totalTxns : 0;
  const adjustmentRate = grossSales ? (adjustments / grossSales) * 100 : 0;
  const totalPaymentAmount = paymentMethods.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="print-only bg-white text-black p-0" style={{ fontFamily: "Inter, sans-serif", fontSize: "11pt" }}>
      <style>{`
        @media print {
          .print-only { display: block !important; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 18mm 16mm; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #E2E8F0; padding: 6px 10px; font-size: 9pt; }
          th { background: #F8FAFC; font-weight: 600; }
          .page-break { page-break-before: always; }
          h2 { font-family: Outfit, sans-serif; font-size: 13pt; font-weight: 700; margin-top: 16pt; margin-bottom: 6pt; }
          h3 { font-family: Outfit, sans-serif; font-size: 11pt; font-weight: 600; margin-top: 10pt; margin-bottom: 4pt; }
        }
      `}</style>

      {/* Cover Header */}
      <div style={{ borderBottom: "2px solid #4338CA", paddingBottom: "12pt", marginBottom: "16pt" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ fontSize: "9pt", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4pt" }}>Sales Report</p>
            <h1 style={{ fontFamily: "Outfit, sans-serif", fontSize: "20pt", fontWeight: 800, color: "#0F172A", margin: 0 }}>CosmosCraft</h1>
            <p style={{ fontSize: "10pt", color: "#334155", marginTop: "4pt" }}>Report Period: {salesReport?.dateLabel || "All Time"}</p>
          </div>
          <div style={{ textAlign: "right", fontSize: "9pt", color: "#64748B" }}>
            <p>Generated: {new Date().toLocaleDateString()}</p>
            <p>Prepared by: Admin</p>
          </div>
        </div>
      </div>

      {/* Summary KPIs */}
      <h2>Executive Summary</h2>
      <table>
        <tbody>
          <tr><th style={{ width: "50%" }}>Gross Sales</th><td style={{ fontFamily: "JetBrains Mono, monospace", textAlign: "right" }}>{fmt.currency(grossSales)}</td></tr>
          <tr><th>Sales Adjustments (Refunds + Returns + Voids)</th><td style={{ fontFamily: "JetBrains Mono, monospace", textAlign: "right", color: "#DC2626" }}>({fmt.currency(adjustments)})</td></tr>
          <tr style={{ background: "#EEF2FF" }}><th style={{ color: "#4338CA" }}>Net Sales</th><td style={{ fontFamily: "JetBrains Mono, monospace", textAlign: "right", fontWeight: 700, color: "#4338CA" }}>{fmt.currency(netSales)}</td></tr>
          <tr><th>Total Transactions</th><td style={{ fontFamily: "JetBrains Mono, monospace", textAlign: "right" }}>{fmt.integer(totalTxns)}</td></tr>
          <tr><th>Average Transaction Value</th><td style={{ fontFamily: "JetBrains Mono, monospace", textAlign: "right" }}>{fmt.currency(avgTxn)}</td></tr>
          <tr><th>Adjustment Rate</th><td style={{ fontFamily: "JetBrains Mono, monospace", textAlign: "right" }}>{adjustmentRate.toFixed(2)}%</td></tr>
        </tbody>
      </table>

      {/* Sales by Channel */}
      <div className="page-break" />
      <h2>1. Sales by Channel</h2>
      <table>
        <thead>
          <tr>
            <th>Channel</th>
            <th style={{ textAlign: "right" }}>Transactions</th>
            <th style={{ textAlign: "right" }}>Gross Sales</th>
            <th style={{ textAlign: "right" }}>Adjustments</th>
            <th style={{ textAlign: "right" }}>Net Sales</th>
            <th style={{ textAlign: "right" }}>% of Sales</th>
          </tr>
        </thead>
        <tbody>
          {channelData.map((c) => (
            <tr key={c.channel}>
              <td>{c.channel}</td>
              <td style={{ textAlign: "right", fontFamily: "monospace" }}>{fmt.integer(c.transactions)}</td>
              <td style={{ textAlign: "right", fontFamily: "monospace" }}>{fmt.currency(c.gross)}</td>
              <td style={{ textAlign: "right", fontFamily: "monospace", color: "#DC2626" }}>({fmt.currency(c.adjustments)})</td>
              <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{fmt.currency(c.net)}</td>
              <td style={{ textAlign: "right", fontFamily: "monospace" }}>{(c.net / netSales * 100).toFixed(1)}%</td>
            </tr>
          ))}
          <tr style={{ background: "#F8FAFC", fontWeight: 700 }}>
            <td>Total</td>
            <td style={{ textAlign: "right", fontFamily: "monospace" }}>{fmt.integer(channelData.reduce((s, c) => s + c.transactions, 0))}</td>
            <td style={{ textAlign: "right", fontFamily: "monospace" }}>{fmt.currency(grossSales)}</td>
            <td style={{ textAlign: "right", fontFamily: "monospace", color: "#DC2626" }}>({fmt.currency(adjustments)})</td>
            <td style={{ textAlign: "right", fontFamily: "monospace", color: "#4338CA" }}>{fmt.currency(netSales)}</td>
            <td style={{ textAlign: "right", fontFamily: "monospace" }}>100%</td>
          </tr>
        </tbody>
      </table>

      {/* Refunds / Returns / Voids */}
      <h2>2. Refunds / Returns / Voids</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th><th>Transaction</th><th>Channel</th><th>Type</th>
            <th style={{ textAlign: "right" }}>Amount</th><th>Reason</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {adjustmentHistory.map((a, i) => (
            <tr key={i}>
              <td>{a.date}</td>
              <td style={{ fontFamily: "monospace", fontSize: "8pt" }}>{a.transaction}</td>
              <td>{a.channel}</td>
              <td>{a.type}</td>
              <td style={{ textAlign: "right", fontFamily: "monospace", color: "#DC2626" }}>{fmt.currency(a.amount)}</td>
              <td>{a.reason}</td>
              <td>{a.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Top Selling Products */}
      <div className="page-break" />
      <h2>3. Top Selling Products</h2>
      <table>
        <thead>
          <tr>
            <th style={{ width: "40pt" }}>#</th>
            <th>Product</th><th>SKU</th>
            <th style={{ textAlign: "right" }}>Units Sold</th>
            <th style={{ textAlign: "right" }}>Gross Sales</th>
            <th style={{ textAlign: "right" }}>Net Sales</th>
          </tr>
        </thead>
        <tbody>
          {topProducts.map((p) => (
            <tr key={p.sku}>
              <td style={{ textAlign: "center" }}>{p.rank}</td>
              <td>{p.product}</td>
              <td style={{ fontFamily: "monospace", fontSize: "8pt" }}>{p.sku}</td>
              <td style={{ textAlign: "right", fontFamily: "monospace" }}>{fmt.integer(p.units)}</td>
              <td style={{ textAlign: "right", fontFamily: "monospace" }}>{fmt.currency(p.gross)}</td>
              <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{fmt.currency(p.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Customization Performance */}
      <h2>4. Customization Performance</h2>
      <table>
        <thead>
          <tr>
            <th>Customization Type</th>
            <th style={{ textAlign: "right" }}>Orders</th>
            <th style={{ textAlign: "right" }}>Gross Sales</th>
            <th style={{ textAlign: "right" }}>Net Sales</th>
          </tr>
        </thead>
        <tbody>
          {customizationTypes.map((c) => (
            <tr key={c.type}>
              <td>{c.type}</td>
              <td style={{ textAlign: "right", fontFamily: "monospace" }}>{c.orders}</td>
              <td style={{ textAlign: "right", fontFamily: "monospace" }}>{fmt.currency(c.gross)}</td>
              <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{fmt.currency(c.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Payment Methods */}
      <h2>5. Payment Methods</h2>
      <table>
        <thead>
          <tr>
            <th>Payment Method</th>
            <th style={{ textAlign: "right" }}>Transactions</th>
            <th style={{ textAlign: "right" }}>Amount</th>
            <th style={{ textAlign: "right" }}>% of Total</th>
          </tr>
        </thead>
        <tbody>
          {paymentMethods.map((p) => (
            <tr key={p.method}>
              <td>{p.method}</td>
              <td style={{ textAlign: "right", fontFamily: "monospace" }}>{fmt.integer(p.transactions)}</td>
              <td style={{ textAlign: "right", fontFamily: "monospace" }}>{fmt.currency(p.amount)}</td>
              <td style={{ textAlign: "right", fontFamily: "monospace" }}>{((p.amount / totalPaymentAmount) * 100).toFixed(1)}%</td>
            </tr>
          ))}
          <tr style={{ background: "#F8FAFC", fontWeight: 700 }}>
            <td>Total</td>
            <td style={{ textAlign: "right", fontFamily: "monospace" }}>{fmt.integer(paymentMethods.reduce((s, p) => s + p.transactions, 0))}</td>
            <td style={{ textAlign: "right", fontFamily: "monospace", color: "#4338CA" }}>{fmt.currency(totalPaymentAmount)}</td>
            <td style={{ textAlign: "right", fontFamily: "monospace" }}>100%</td>
          </tr>
        </tbody>
      </table>

      {/* Footer */}
      <div style={{ borderTop: "1px solid #E2E8F0", marginTop: "20pt", paddingTop: "8pt", display: "flex", justifyContent: "space-between", fontSize: "8pt", color: "#94A3B8" }}>
        <span>CosmosCraft — POS System</span>
        <span>Report Period: {salesReport?.dateLabel || "All Time"} · Generated: {new Date().toLocaleDateString()}</span>
      </div>
    </div>
  );
}
