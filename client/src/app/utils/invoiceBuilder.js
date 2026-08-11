import { formatCurrency } from './formatCurrency.js'

function escapeReceiptHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function getOrderCustomerName(order) {
  if (order.first_name && order.last_name) return `${order.first_name} ${order.last_name}`
  return order.customer_name || order.user_name || order.name || 'N/A'
}

function getOrderAddress(order) {
  if (!order.shipping_line1) return 'N/A'
  return [
    order.shipping_line1,
    order.shipping_line2,
    order.shipping_city,
    order.shipping_province,
    order.shipping_postal_code,
  ].filter(Boolean).join(', ')
}

function getOrderPaymentMethodLabel(order) {
  const rawMethod = (
    order.payment_method
    || order.payment?.method
    || order.payment?.payment_method
    || ''
  )
  const methodLower = String(rawMethod).toLowerCase()

  if (methodLower.includes('gcash') || methodLower.includes('g-cash')) return 'GCash'
  if (
    methodLower.includes('bank')
    || methodLower.includes('transfer')
    || methodLower.includes('bdo')
    || methodLower.includes('bpi')
    || methodLower.includes('unionbank')
  ) return 'Bank Transfer'
  if (methodLower.includes('cod') || methodLower.includes('cash')) return 'COD'

  return String(rawMethod).replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function getOrderSubtotal(order) {
  if (order.subtotal != null) return Number(order.subtotal) || 0
  if (order.items?.length) {
    return order.items.reduce((sum, item) => (
      sum + ((Number(item.unit_price ?? item.price ?? 0) || 0) * (Number(item.quantity ?? item.qty ?? 1) || 1))
    ), 0)
  }
  const total = Number(order.total || order.total_amount || 0) || 0
  const shipping = Number(order.shipping_cost ?? order.shipping_fee ?? 0) || 0
  const tax = Number(order.tax_amount || 0) || 0
  return Math.max(total - shipping - tax, 0)
}

function getOrderShippingAmount(order) {
  return Number(order.shipping_cost ?? order.shipping_fee ?? 0) || 0
}

export function buildInvoiceHtml(order) {
  const customerName = getOrderCustomerName(order)
  const orderAddress = getOrderAddress(order)
  const paymentMethod = getOrderPaymentMethodLabel(order)
  const subtotal = getOrderSubtotal(order)
  const shipping = getOrderShippingAmount(order)
  const discount = Number(order.discount_amount || 0) || 0
  const total = Math.max(subtotal + shipping - discount, 0)
  const createdAt = order.created_at ? new Date(order.created_at) : null
  const receiptDate = createdAt ? createdAt.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'
  const receiptTime = createdAt ? createdAt.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : 'N/A'
  const itemsMarkup = (order.items || []).map((item, idx) => {
    const quantity = Number(item.quantity ?? item.qty ?? 1) || 1
    const unitPrice = Number(item.unit_price ?? item.price ?? 0) || 0
    const lineTotal = Number(item.subtotal ?? (unitPrice * quantity))
    const itemName = item.product_name || item.name || item.product_sku || 'Product'

    return `
      <tr>
        <td>${escapeReceiptHtml(itemName)}</td>
        <td class="num qty">${quantity}</td>
        <td class="num">${formatCurrency(unitPrice)}</td>
        <td class="num">${formatCurrency(lineTotal)}</td>
      </tr>
    `
  }).join('')

  const paymentReference = order.payment?.reference_number || order.payment_reference_number || ''
  const customerPhone = order.contact_phone || order.customer_phone || order.phone || ''

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Invoice ${escapeReceiptHtml(order.order_number || order.order_id || '')}</title>
        <style>
          :root { color-scheme: light; }
          * { box-sizing: border-box; }
          body {
            font-family: Arial, Helvetica, sans-serif;
            background: #ffffff;
            color: #111111;
            margin: 0;
            padding: 28px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .sheet {
            max-width: 720px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            padding: 28px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            gap: 24px;
            border-bottom: 1px solid #111111;
            padding-bottom: 18px;
            margin-bottom: 18px;
          }
          .brand {
            font-size: 24px;
            font-weight: 800;
            letter-spacing: 0.04em;
            text-transform: uppercase;
          }
          .brand-sub {
            font-size: 12px;
            color: #6b7280;
            margin-top: 4px;
            text-transform: uppercase;
            letter-spacing: 0.18em;
          }
          .invoice-meta {
            text-align: right;
          }
          .invoice-meta .label {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.18em;
            color: #6b7280;
          }
          .invoice-meta .value {
            font-size: 14px;
            font-weight: 600;
            margin-top: 2px;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
            margin-bottom: 18px;
          }
          .panel {
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            padding: 12px 14px;
          }
          .panel h3 {
            margin: 0 0 8px;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.18em;
            color: #6b7280;
          }
          .panel p {
            margin: 3px 0;
            font-size: 13px;
            line-height: 1.4;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 4px;
            font-size: 13px;
          }
          thead th {
            text-align: left;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: #6b7280;
            border-bottom: 1px solid #111111;
            padding: 6px 0;
          }
          tbody td {
            border-bottom: 1px solid #e5e7eb;
            padding: 7px 0;
            vertical-align: top;
          }
          .num { text-align: right; }
          .qty { padding-right: 10px; }
          .summary {
            margin-top: 18px;
            margin-left: auto;
            width: min(100%, 280px);
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            font-size: 13px;
          }
          .summary-total {
            font-weight: 800;
            font-size: 15px;
            border-top: 1px solid #111111;
            margin-top: 6px;
            padding-top: 6px;
          }
          .footer {
            margin-top: 22px;
            text-align: center;
            font-size: 11px;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.14em;
          }
          @media print {
            body { background: #fff; padding: 0; }
            .sheet { border: 0; border-radius: 0; padding: 0; max-width: none; }
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="header">
            <div>
              <div class="brand">CosmosCraft</div>
              <div class="brand-sub">Shop Invoice</div>
            </div>
            <div class="invoice-meta">
              <div>
                <div class="label">Invoice No.</div>
                <div class="value">${escapeReceiptHtml(order.order_number || order.order_id || 'N/A')}</div>
              </div>
              <div style="margin-top:10px;">
                <div class="label">Date</div>
                <div class="value">${receiptDate} &nbsp; ${receiptTime}</div>
              </div>
            </div>
          </div>

          <div class="meta-grid">
            <div class="panel">
              <h3>Customer</h3>
              <p><strong>${escapeReceiptHtml(customerName)}</strong></p>
              <p>${escapeReceiptHtml(order.email || 'No email provided')}</p>
              <p>${escapeReceiptHtml(customerPhone || 'No phone provided')}</p>
              ${orderAddress !== 'N/A' ? `<p>${escapeReceiptHtml(orderAddress)}</p>` : ''}
            </div>
            <div class="panel">
              <h3>Order</h3>
              <p><strong>Payment:</strong> ${escapeReceiptHtml(paymentMethod)}</p>
              ${paymentReference ? `<p><strong>Reference:</strong> ${escapeReceiptHtml(paymentReference)}</p>` : ''}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th class="num qty">Qty</th>
                <th class="num">Unit Price</th>
                <th class="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsMarkup || '<tr><td colspan="4" style="text-align:center; color:#6b7280;">No items listed</td></tr>'}
            </tbody>
          </table>

          <div class="summary">
            <div class="summary-row"><span>Subtotal</span><strong>${formatCurrency(subtotal)}</strong></div>
            <div class="summary-row"><span>Shipping</span><strong>${formatCurrency(shipping)}</strong></div>
            ${discount > 0 ? `<div class="summary-row"><span>Discount</span><strong>${formatCurrency(discount)}</strong></div>` : ''}
            <div class="summary-row total"><span>Total</span><span>${formatCurrency(total)}</span></div>
          </div>

          <div class="footer">Thank you for choosing CosmosCraft.</div>
        </div>
      </body>
    </html>
  `
}
