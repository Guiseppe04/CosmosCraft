import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  ShoppingBag, Eye, Edit, Search, Filter,
  Package, CreditCard, RefreshCw, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, Clock, AlertCircle, Loader2,
  FileText, Image as ImageIcon, ExternalLink, Save, User,
  History, DollarSign, Trash2, Check, X, Printer,
} from 'lucide-react'
import { formatCurrency } from '../../utils/formatCurrency'
import { adminApi } from '../../utils/adminApi'
import {
  PAYMENT_STATUS_MAP,
  getAllowedPaymentStatuses,
  getPaymentStatusConfig as getOrderPaymentStatusConfig,
  normalizePaymentStatus,
} from '../../utils/orderPaymentStatus'

const ORDER_STATUS_LIFECYCLE = [
  { value: 'pending', label: 'Pending', color: '#f59e0b', bgColor: 'bg-amber-500/20', textColor: 'text-amber-400', borderColor: 'border-amber-500/30' },
  { value: 'processing', label: 'Processing', color: '#60a5fa', bgColor: 'bg-blue-500/20', textColor: 'text-blue-400', borderColor: 'border-blue-500/30' },
  { value: 'shipped', label: 'Shipped', color: '#38bdf8', bgColor: 'bg-sky-500/20', textColor: 'text-sky-400', borderColor: 'border-sky-500/30' },
  { value: 'out_for_delivery', label: 'Out for Delivery', color: '#818cf8', bgColor: 'bg-indigo-500/20', textColor: 'text-indigo-400', borderColor: 'border-indigo-500/30' },
  { value: 'delivered', label: 'Delivered', color: '#22c55e', bgColor: 'bg-green-500/20', textColor: 'text-green-400', borderColor: 'border-green-500/30' },
  { value: 'cancelled', label: 'Cancelled', color: '#f87171', bgColor: 'bg-red-500/20', textColor: 'text-red-400', borderColor: 'border-red-500/30' },
]

const ORDER_STATUS_MAP = Object.fromEntries(ORDER_STATUS_LIFECYCLE.map(s => [s.value, s]))

const ORDER_STATUS_TABS = [
  { id: 'all', label: 'All', color: '#d4af37', bgColor: 'bg-[var(--gold-primary)]/20', textColor: 'text-[var(--gold-primary)]', borderColor: 'border-[var(--gold-primary)]/30' },
  { id: 'pending', label: 'Pending', color: '#d4af37', bgColor: 'bg-[var(--gold-primary)]/20', textColor: 'text-[var(--gold-primary)]', borderColor: 'border-[var(--gold-primary)]/30' },
  { id: 'processing', label: 'Processing', color: '#d4af37', bgColor: 'bg-[var(--gold-primary)]/20', textColor: 'text-[var(--gold-primary)]', borderColor: 'border-[var(--gold-primary)]/30' },
  { id: 'shipped', label: 'Shipped', color: '#d4af37', bgColor: 'bg-[var(--gold-primary)]/20', textColor: 'text-[var(--gold-primary)]', borderColor: 'border-[var(--gold-primary)]/30' },
  { id: 'out_for_delivery', label: 'Out for Delivery', color: '#d4af37', bgColor: 'bg-[var(--gold-primary)]/20', textColor: 'text-[var(--gold-primary)]', borderColor: 'border-[var(--gold-primary)]/30' },
  { id: 'delivered', label: 'Delivered', color: '#d4af37', bgColor: 'bg-[var(--gold-primary)]/20', textColor: 'text-[var(--gold-primary)]', borderColor: 'border-[var(--gold-primary)]/30' },
  { id: 'cancelled', label: 'Cancelled', color: '#d4af37', bgColor: 'bg-[var(--gold-primary)]/20', textColor: 'text-[var(--gold-primary)]', borderColor: 'border-[var(--gold-primary)]/30' },
]

const TIMELINE_STEPS = [
  { status: 'pending', label: 'Order Placed', desc: 'Order created, awaiting payment' },
  { status: 'processing', label: 'Processing', desc: 'Payment received, preparing for shipment' },
  { status: 'shipped', label: 'Shipped', desc: 'Order shipped with tracking number' },
  { status: 'out_for_delivery', label: 'Out for Delivery', desc: 'Out for delivery with rider details' },
  { status: 'delivered', label: 'Delivered', desc: 'Successfully delivered to customer' },
]

const PAGE_SIZE = 10

function getOrderStatusConfig(status) {
  return ORDER_STATUS_MAP[status] || ORDER_STATUS_LIFECYCLE[0]
}

function getPaymentStatusConfig(status) {
  return getOrderPaymentStatusConfig(status)
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
  const method = order.payment_method || order.payment?.method || order.payment?.payment_method || 'Unknown'
  const methodLower = String(method).toLowerCase()
  if (methodLower.includes('gcash') || methodLower.includes('g-cash')) return 'GCash'
  if (methodLower.includes('bank') || methodLower.includes('transfer') || methodLower.includes('bdo') || methodLower.includes('bpi') || methodLower.includes('unionbank')) return 'Bank Transfer'
  if (methodLower.includes('cod') || methodLower.includes('cash')) return 'Cash on Delivery'
  return String(method).replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
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

function getOrderTotal(order) {
  return Math.max(getOrderSubtotal(order) + getOrderShippingAmount(order), 0)
}

function getOrderRiderDetails(order) {
  return order.rider_details || [order.rider_name, order.rider_contact].filter(Boolean).join(' • ')
}

function escapeReceiptHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function buildReceiptHtml(order) {
  const customerName = getOrderCustomerName(order)
  const orderAddress = getOrderAddress(order)
  const paymentMethod = getOrderPaymentMethodLabel(order)
  const subtotal = getOrderSubtotal(order)
  const shipping = getOrderShippingAmount(order)
  const total = getOrderTotal(order)
  const createdAt = order.created_at ? new Date(order.created_at) : null
  const receiptDate = createdAt ? createdAt.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'
  const receiptTime = createdAt ? createdAt.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : 'N/A'
  const riderDetails = getOrderRiderDetails(order)
  const itemsMarkup = (order.items || []).map((item) => {
    const quantity = Number(item.quantity ?? item.qty ?? 1) || 1
    const unitPrice = Number(item.unit_price ?? item.price ?? 0) || 0
    const lineTotal = unitPrice * quantity
    const itemName = item.product_name || item.name || item.product_sku || 'Product'

    return `
      <tr>
        <td>${escapeReceiptHtml(itemName)}</td>
        <td style="text-align:center;">${quantity}</td>
        <td style="text-align:right;">${formatCurrency(unitPrice)}</td>
        <td style="text-align:right;">${formatCurrency(lineTotal)}</td>
      </tr>
    `
  }).join('')

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Receipt ${escapeReceiptHtml(order.order_number || order.order_id || '')}</title>
        <style>
          body { font-family: Arial, sans-serif; background: #f6f1e7; color: #161616; margin: 0; padding: 24px; }
          .receipt { max-width: 820px; margin: 0 auto; background: #fffdf8; border: 1px solid #d6c6a3; border-radius: 18px; padding: 28px; }
          .topbar { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #d4af37; padding-bottom: 18px; margin-bottom: 20px; }
          .brand { font-size: 28px; font-weight: 700; letter-spacing: 0.04em; }
          .muted { color: #6a6458; }
          .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin: 18px 0; }
          .panel { background: #faf5ea; border: 1px solid #eadcb9; border-radius: 14px; padding: 14px 16px; }
          .panel h3 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.14em; color: #8a7a4e; }
          .panel p { margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 18px; }
          th, td { padding: 12px 8px; border-bottom: 1px solid #ece4d0; font-size: 14px; vertical-align: top; }
          th { text-align: left; color: #6a6458; font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; }
          .totals { margin-top: 20px; margin-left: auto; width: min(100%, 320px); }
          .totals-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ece4d0; }
          .totals-row.total { font-weight: 700; font-size: 18px; color: #7a5d09; border-bottom: 0; padding-top: 14px; }
          .status { display: inline-block; padding: 6px 10px; border-radius: 999px; background: #f7edd0; color: #7a5d09; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
          .footnote { margin-top: 24px; color: #6a6458; font-size: 12px; text-align: center; }
          @media print {
            body { background: #fff; padding: 0; }
            .receipt { border: 0; border-radius: 0; padding: 0; max-width: none; }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="topbar">
            <div>
              <div class="brand">CosmosCraft</div>
              <p class="muted">Order receipt</p>
            </div>
            <div style="text-align:right;">
              <p style="margin:0 0 8px;"><strong>Receipt #:</strong> ${escapeReceiptHtml(order.order_number || order.order_id || 'N/A')}</p>
              <p style="margin:0 0 8px;"><strong>Date:</strong> ${receiptDate}</p>
              <p style="margin:0;"><strong>Time:</strong> ${receiptTime}</p>
            </div>
          </div>

          <div class="meta">
            <div class="panel">
              <h3>Customer</h3>
              <p><strong>${escapeReceiptHtml(customerName)}</strong></p>
              <p>${escapeReceiptHtml(order.email || 'No email provided')}</p>
              <p>${escapeReceiptHtml(order.contact_phone || order.customer_phone || order.phone || 'No phone provided')}</p>
              <p>${escapeReceiptHtml(orderAddress)}</p>
            </div>
            <div class="panel">
              <h3>Order</h3>
              <p><strong>Status:</strong> <span class="status">${escapeReceiptHtml(String(order.status || 'pending').replace(/_/g, ' '))}</span></p>
              <p><strong>Payment:</strong> ${escapeReceiptHtml(paymentMethod)}</p>
              <p><strong>Payment Status:</strong> ${escapeReceiptHtml(String(order.payment_status || 'pending').replace(/_/g, ' '))}</p>
              ${order.tracking_number ? `<p><strong>Tracking #:</strong> ${escapeReceiptHtml(order.tracking_number)}</p>` : ''}
              ${riderDetails ? `<p><strong>Rider Details:</strong> ${escapeReceiptHtml(riderDetails)}</p>` : ''}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th style="text-align:center;">Qty</th>
                <th style="text-align:right;">Unit Price</th>
                <th style="text-align:right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsMarkup || '<tr><td colspan="4" style="text-align:center;" class="muted">No items listed</td></tr>'}
            </tbody>
          </table>

          <div class="totals">
            <div class="totals-row"><span>Subtotal</span><strong>${formatCurrency(subtotal)}</strong></div>
            <div class="totals-row"><span>Shipping</span><strong>${formatCurrency(shipping)}</strong></div>
            <div class="totals-row total"><span>Total</span><span>${formatCurrency(total)}</span></div>
          </div>

          <p class="footnote">Thank you for choosing CosmosCraft.</p>
        </div>
      </body>
    </html>
  `
}

function printOrderReceipt(order) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const receiptHtml = buildReceiptHtml(order)
  const iframe = document.createElement('iframe')

  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'

  const cleanup = () => {
    window.setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
    }, 250)
  }

  iframe.onload = () => {
    const frameWindow = iframe.contentWindow
    if (!frameWindow) {
      cleanup()
      return
    }

    const handleAfterPrint = () => {
      frameWindow.removeEventListener('afterprint', handleAfterPrint)
      cleanup()
    }

    frameWindow.addEventListener('afterprint', handleAfterPrint)
    frameWindow.focus()

    window.setTimeout(() => {
      try {
        frameWindow.print()
      } catch {
        handleAfterPrint()
      }
    }, 150)
  }

  document.body.appendChild(iframe)

  const frameDocument = iframe.contentDocument || iframe.contentWindow?.document
  if (!frameDocument) {
    cleanup()
    return
  }

  frameDocument.open()
  frameDocument.write(receiptHtml)
  frameDocument.close()
}

function ImageZoomModal({ src, alt, onClose }) {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })

  const handleWheel = (e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setScale(s => Math.max(0.5, Math.min(3, s + delta)))
  }

  const handleMouseDown = (e) => {
    setIsDragging(true)
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y }
  }

  const handleMouseMove = (e) => {
    if (!isDragging) return
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    })
  }

  const handleMouseUp = () => setIsDragging(false)

  const resetZoom = () => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-8"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      <div
        className="w-full h-full overflow-hidden flex items-center justify-center"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-full object-contain select-none"
          style={{
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
          draggable={false}
        />
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 px-4 py-2 rounded-full">
        <button
          onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
          className="text-white hover:text-[var(--gold-primary)] transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-white text-sm min-w-[60px] text-center">{Math.round(scale * 100)}%</span>
        <button
          onClick={() => setScale(s => Math.min(3, s + 0.25))}
          className="text-white hover:text-[var(--gold-primary)] transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        <button
          onClick={resetZoom}
          className="ml-2 text-white hover:text-[var(--gold-primary)] transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  )
}

function ReceiptPanel({ order }) {
  const subtotal = getOrderSubtotal(order)
  const shipping = getOrderShippingAmount(order)
  const total = getOrderTotal(order)
  const customerName = getOrderCustomerName(order)
  const orderAddress = getOrderAddress(order)
  const riderDetails = getOrderRiderDetails(order)

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-[var(--gold-primary)]/30 bg-gradient-to-br from-[var(--gold-primary)]/10 via-[var(--bg-primary)]/70 to-[var(--surface-dark)] p-5">
        <div className="mb-5 flex flex-col gap-4 border-b border-[var(--gold-primary)]/20 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gold-primary)]">CosmosCraft</p>
            <h3 className="mt-2 text-2xl font-bold text-white">Order Receipt</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Reference #{order.order_number || order.order_id?.slice(0, 8)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => printOrderReceipt(order)}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--gold-primary)] px-4 py-2.5 text-sm font-semibold text-black transition-all hover:shadow-[0_0_20px_rgba(212,175,55,0.3)]"
            >
              <Printer className="h-4 w-4" />
              Print Receipt
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)]/70 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">Customer</p>
            <p className="mt-3 text-lg font-semibold text-white">{customerName}</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{order.email || 'No email provided'}</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{order.contact_phone || order.customer_phone || order.phone || 'No phone provided'}</p>
            <p className="mt-3 text-sm leading-6 text-white">{orderAddress}</p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)]/70 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">Order Summary</p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[var(--text-muted)]">Created</span>
                <span className="text-right text-white">{order.created_at ? new Date(order.created_at).toLocaleString() : 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[var(--text-muted)]">Status</span>
                <span className="rounded-full border border-[var(--gold-primary)]/30 bg-[var(--gold-primary)]/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">
                  {String(order.status || 'pending').replace(/_/g, ' ')}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[var(--text-muted)]">Payment Method</span>
                <span className="text-right text-white">{getOrderPaymentMethodLabel(order)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[var(--text-muted)]">Payment Status</span>
                <span className="text-right text-white">{String(order.payment_status || 'pending').replace(/_/g, ' ')}</span>
              </div>
              {order.tracking_number && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[var(--text-muted)]">Tracking Number</span>
                  <span className="text-right text-white">{order.tracking_number}</span>
                </div>
              )}
              {riderDetails && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[var(--text-muted)]">Rider Details</span>
                  <span className="text-right text-white">{riderDetails}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)]/70">
          <div className="grid grid-cols-[1.6fr_0.5fr_0.8fr_0.8fr] gap-3 border-b border-[var(--border)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
            <span>Item</span>
            <span className="text-center">Qty</span>
            <span className="text-right">Unit Price</span>
            <span className="text-right">Amount</span>
          </div>
          <div>
            {(order.items || []).length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">No items found for this order.</div>
            ) : (
              order.items.map((item, idx) => {
                const quantity = Number(item.quantity ?? item.qty ?? 1) || 1
                const unitPrice = Number(item.unit_price ?? item.price ?? 0) || 0
                const amount = unitPrice * quantity
                return (
                  <div key={`${item.product_id || item.customization_id || idx}`} className="grid grid-cols-[1.6fr_0.5fr_0.8fr_0.8fr] gap-3 border-b border-[var(--border)]/50 px-4 py-3 text-sm last:border-b-0">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">{item.product_name || item.name || item.product_sku || 'Product'}</p>
                      {(item.notes || item.customization_id) && (
                        <p className="mt-1 truncate text-xs text-[var(--text-muted)]">{item.notes || `Customization ${item.customization_id}`}</p>
                      )}
                    </div>
                    <span className="text-center text-white">{quantity}</span>
                    <span className="text-right text-white">{formatCurrency(unitPrice)}</span>
                    <span className="text-right font-semibold text-[var(--gold-primary)]">{formatCurrency(amount)}</span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)]/80">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
              Amount Summary
            </p>
          </div>

          <div className="px-4 py-4">
            <div className="ml-auto grid w-full max-w-md grid-cols-[minmax(0,1fr)_auto] items-center gap-x-12 text-sm">
              <span className="text-right text-[var(--text-muted)]">Subtotal</span>
              <span className="text-right font-medium tabular-nums text-white">{formatCurrency(subtotal)}</span>
            </div>
          </div>

          <div className="border-t border-[var(--border)]/50 px-4 py-4">
            <div className="ml-auto grid w-full max-w-md grid-cols-[minmax(0,1fr)_auto] items-center gap-x-12 text-sm">
              <span className="text-right text-[var(--text-muted)]">Shipping</span>
              <span className="text-right font-medium tabular-nums text-white">{formatCurrency(shipping)}</span>
            </div>
          </div>

          <div className="border-t border-[var(--gold-primary)]/20 bg-[var(--gold-primary)]/8 px-4 py-4">
            <div className="ml-auto grid w-full max-w-md grid-cols-[minmax(0,1fr)_auto] items-center gap-x-12">
              <span className="text-right text-base font-semibold text-white">Total</span>
              <span className="text-right text-xl font-bold tabular-nums text-[var(--gold-primary)]">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function OrderDetailsModal({ order, onClose, onUpdatePaymentStatus, onUpdateOrderStatus, onVerifyPayment, user, initialSection = 'details' }) {
  const [activeSection, setActiveSection] = useState(initialSection)

  useEffect(() => {
    setActiveSection(initialSection)
  }, [initialSection, order.order_id])

  const orderStatusConfig = getOrderStatusConfig(order.status || 'pending')
  const paymentConfig = getPaymentStatusConfig(order.payment_status || 'pending')

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl p-6 w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-xl font-bold text-white">Order #{order.order_number || order.order_id?.slice(0, 8)}</h2>
            <div className="flex items-center gap-2 mt-2">
              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${orderStatusConfig.bgColor} ${orderStatusConfig.textColor} ${orderStatusConfig.borderColor}`}>
                {orderStatusConfig.label}
              </span>
              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${paymentConfig.bgColor} ${paymentConfig.textColor} ${paymentConfig.borderColor}`}>
                {paymentConfig.label}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="flex gap-2 mb-4 border-b border-[var(--border)] pb-2">
          <button
            onClick={() => setActiveSection('details')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeSection === 'details'
                ? 'bg-[var(--gold-primary)] text-black'
                : 'text-[var(--text-muted)] hover:text-white'
            }`}
          >
            <Eye className="w-4 h-4 inline mr-2" />
            View Details
          </button>
          <button
            onClick={() => setActiveSection('receipt')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeSection === 'receipt'
                ? 'bg-[var(--gold-primary)] text-black'
                : 'text-[var(--text-muted)] hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Receipt
          </button>
          <button
            onClick={() => setActiveSection('payment')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeSection === 'payment'
                ? 'bg-[var(--gold-primary)] text-black'
                : 'text-[var(--text-muted)] hover:text-white'
            }`}
          >
            <CreditCard className="w-4 h-4 inline mr-2" />
            Update Payment Status
          </button>
          <button
            onClick={() => setActiveSection('order')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeSection === 'order'
                ? 'bg-[var(--gold-primary)] text-black'
                : 'text-[var(--text-muted)] hover:text-white'
            }`}
          >
            <Package className="w-4 h-4 inline mr-2" />
            Update Order Status
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeSection === 'details' && (
            <div className="space-y-4">
              <div className="bg-[var(--bg-primary)]/50 rounded-xl p-4">
                <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-3">Customer</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[var(--text-muted)] text-xs">Name</p>
                    <p className="text-white font-medium">{getOrderCustomerName(order)}</p>
                  </div>
                  <div>
                    <p className="text-[var(--text-muted)] text-xs">Email</p>
                    <p className="text-white">{order.email || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[var(--text-muted)] text-xs">Phone</p>
                    <p className="text-white">{order.contact_phone || order.customer_phone || order.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[var(--text-muted)] text-xs">Address</p>
                    <p className="text-white text-sm">{getOrderAddress(order)}</p>
                  </div>
                </div>
              </div>

              {order.items?.length > 0 && (
                <div>
                  <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-3">Items</p>
                  <div className="space-y-2">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-[var(--bg-primary)]/50 rounded-lg">
                        <div className="w-12 h-12 rounded-lg bg-[var(--surface-dark)] overflow-hidden flex-shrink-0">
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.product_name || item.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-5 h-5 text-[var(--text-muted)]" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{item.product_name || item.name || 'Product'}</p>
                          <p className="text-[var(--text-muted)] text-xs">Qty: {item.quantity || item.qty || 1}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[var(--gold-primary)] font-semibold">{formatCurrency((item.unit_price || item.price || 0) * (item.quantity || item.qty || 1))}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[var(--bg-primary)]/50 rounded-lg p-4">
                  <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">Created</p>
                  <p className="text-white text-sm">{order.created_at ? new Date(order.created_at).toLocaleString() : '—'}</p>
                </div>
                <div className="bg-[var(--bg-primary)]/50 rounded-lg p-4">
                  <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">Payment Method</p>
                  <p className="text-white text-sm">{getOrderPaymentMethodLabel(order)}</p>
                </div>
                {order.tracking_number && (
                  <div className="bg-[var(--bg-primary)]/50 rounded-lg p-4">
                    <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">Tracking Number</p>
                    <p className="text-white text-sm">{order.tracking_number}</p>
                  </div>
                )}
                {getOrderRiderDetails(order) && (
                  <div className="bg-[var(--bg-primary)]/50 rounded-lg p-4">
                    <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">Rider Details</p>
                    <p className="text-white text-sm">{getOrderRiderDetails(order)}</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-3">Timeline</p>
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-[var(--border)]" />
                  <div className="space-y-4">
                    {TIMELINE_STEPS.map((step, idx) => {
                      const currentStatus = order.status || 'pending'
                      const stepConfig = getOrderStatusConfig(step.status)
                      const stepIndex = ORDER_STATUS_LIFECYCLE.findIndex(s => s.value === step.status)
                      const currentIndex = ORDER_STATUS_LIFECYCLE.findIndex(s => s.value === currentStatus)
                      const isCompleted = currentStatus === 'cancelled'
                        ? step.status === 'cancelled'
                        : stepIndex < currentIndex || (stepIndex === 0 && currentStatus !== 'cancelled')
                      const isCurrent = step.status === currentStatus && currentStatus !== 'cancelled'
                      const isCancelled = currentStatus === 'cancelled' && step.status !== 'cancelled'

                      return (
                        <div key={step.status} className="flex items-start gap-4 relative">
                          <div className={`z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                            isCompleted
                              ? 'bg-green-500 text-white'
                              : isCurrent
                                ? `${stepConfig.bgColor} ${stepConfig.textColor} border ${stepConfig.borderColor}`
                                : isCancelled
                                  ? 'bg-red-500/50 text-red-300'
                                  : 'bg-[var(--surface-dark)] text-[var(--text-muted)] border border-[var(--border)]'
                          }`}>
                            {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm font-semibold ${
                              isCompleted ? 'text-green-400' : isCurrent ? stepConfig.textColor : isCancelled ? 'text-red-400' : 'text-[var(--text-muted)]'
                            }`}>
                              {step.label}
                            </p>
                            <p className="text-xs text-[var(--text-muted)]">{step.desc}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="bg-[var(--bg-primary)]/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Subtotal</span>
                  <span className="text-white">{formatCurrency(getOrderSubtotal(order))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Shipping</span>
                  <span className="text-white">{formatCurrency(getOrderShippingAmount(order))}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-[var(--border)]">
                  <span className="text-white font-semibold">Total</span>
                  <span className="text-[var(--gold-primary)] font-bold">{formatCurrency(getOrderTotal(order))}</span>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'receipt' && (
            <ReceiptPanel order={order} />
          )}

          {activeSection === 'payment' && (
            <PaymentVerificationPanel
              order={order}
              onVerify={onVerifyPayment}
              user={user}
            />
          )}

          {activeSection === 'order' && (
            <OrderStatusPanel
              order={order}
              onUpdate={onUpdateOrderStatus}
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function PaymentVerificationPanel({ order, onVerify, user }) {
  const currentPaymentStatus = normalizePaymentStatus(order.payment_status)
  const availableStatuses = useMemo(
    () => getAllowedPaymentStatuses(currentPaymentStatus),
    [currentPaymentStatus]
  )
  const [selectedStatus, setSelectedStatus] = useState(currentPaymentStatus)
  const [referenceNumber, setReferenceNumber] = useState(order.payment?.reference_number || '')
  const [notes, setNotes] = useState('')
  const [showImageModal, setShowImageModal] = useState(false)
  const [imageToView, setImageToView] = useState(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    const fallbackStatus = availableStatuses[0]?.value || currentPaymentStatus
    setSelectedStatus((prevStatus) => (
      availableStatuses.some((status) => status.value === prevStatus)
        ? prevStatus
        : fallbackStatus
    ))
    setReferenceNumber(order.payment?.reference_number || '')
    setNotes('')
  }, [availableStatuses, currentPaymentStatus, order.order_id, order.payment?.reference_number])

  const handleVerify = async () => {
    setIsVerifying(true)
    try {
      await onVerify(order.order_id, selectedStatus, referenceNumber, notes)
    } finally {
      setIsVerifying(false)
      setShowConfirm(false)
    }
  }

  const paymentProofUrl = order.payment?.proof_url || order.proof_url

  return (
    <div className="space-y-4">
      <div className="bg-[var(--bg-primary)]/50 rounded-xl p-4">
        <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-[var(--gold-primary)]" />
          Payment Verification
        </h4>

        {paymentProofUrl ? (
          <div className="mb-4">
            <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">Payment Proof</p>
            <div
              className="relative cursor-zoom-in rounded-lg border border-[var(--border)] overflow-hidden"
              onClick={() => { setImageToView(paymentProofUrl); setShowImageModal(true) }}
            >
              <img
                src={paymentProofUrl}
                alt="Payment Proof"
                className="w-full h-48 object-contain bg-[var(--bg-primary)]/50"
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="bg-black/60 px-3 py-1.5 rounded-full text-white text-sm">Click to zoom</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-4 p-4 bg-[var(--surface-dark)] rounded-lg border border-[var(--border)]">
            <p className="text-[var(--text-muted)] text-sm text-center">No payment proof uploaded</p>
          </div>
        )}

        <div className="mb-4">
          <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">Transaction Reference Number</p>
          <input
            type="text"
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            placeholder="Enter reference number (e.g., GCash ref #)"
            className="w-full px-4 py-3 bg-[var(--surface-dark)] border border-[var(--border)] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
          />
        </div>

        <div className="mb-4">
          <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">Select Payment Status</p>
          <div className="grid grid-cols-2 gap-2">
            {availableStatuses.map((status) => {
              const isActive = selectedStatus === status.value
              return (
                <button
                  key={status.value}
                  type="button"
                  onClick={() => setSelectedStatus(status.value)}
                  className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                    isActive
                      ? `${status.bgColor} ${status.textColor} ${status.borderColor}`
                      : 'bg-[var(--bg-primary)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--gold-primary)]/50'
                  }`}
                >
                  {status.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mb-4">
          <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">Admin Notes</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this payment verification..."
            rows={3}
            className="w-full px-4 py-3 bg-[var(--surface-dark)] border border-[var(--border)] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] resize-none"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-4">
          <User className="w-3 h-3" />
          <span>Verifying admin: {user?.firstName ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}` : user?.email || 'Admin'}</span>
          <span className="mx-1">•</span>
          <Clock className="w-3 h-3" />
          <span>{new Date().toLocaleString()}</span>
        </div>

        {showConfirm ? (
          <div className="bg-[var(--bg-primary)]/50 rounded-lg p-4 border border-[var(--gold-primary)]/50">
            <p className="text-white text-sm mb-3">Confirm payment status update to <span className="font-semibold">{PAYMENT_STATUS_MAP[selectedStatus]?.label}</span>?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2 bg-[var(--surface-dark)] border border-[var(--border)] rounded-lg text-white text-sm hover:border-[var(--gold-primary)]/50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleVerify}
                disabled={isVerifying}
                className={`flex-1 px-4 py-2 bg-green-500 rounded-lg text-white text-sm font-medium hover:shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-all flex items-center justify-center gap-2 ${
                  isVerifying ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Confirm
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirm(true)}
            disabled={!availableStatuses.some((status) => status.value === selectedStatus)}
            className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 rounded-lg text-white font-semibold hover:shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Update Payment Status
          </button>
        )}
      </div>

      {order.payment_history && order.payment_history.length > 0 && (
        <div className="bg-[var(--bg-primary)]/50 rounded-xl p-4">
          <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
            <History className="w-4 h-4 text-[var(--gold-primary)]" />
            Payment Audit Log
          </h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {order.payment_history.map((entry, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs p-2 bg-[var(--surface-dark)] rounded-lg">
                <div className="flex-1">
                  <p className="text-white">{entry.action}</p>
                  <p className="text-[var(--text-muted)]">
                    By: {entry.admin_name || entry.admin_email || 'System'}
                  </p>
                </div>
                <p className="text-[var(--text-muted)]">
                  {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '—'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showImageModal && (
          <ImageZoomModal
            src={imageToView}
            alt="Payment Proof"
            onClose={() => setShowImageModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function OrderStatusPanel({ order, onUpdate }) {
  const [selectedStatus, setSelectedStatus] = useState(order.status || 'pending')
  const [trackingInfo, setTrackingInfo] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleUpdate = async () => {
    setIsUpdating(true)
    try {
      await onUpdate(order.order_id, selectedStatus, trackingInfo)
    } finally {
      setIsUpdating(false)
      setShowConfirm(false)
    }
  }

  const requiresTracking = selectedStatus === 'shipped' || selectedStatus === 'out_for_delivery'

  return (
    <div className="space-y-4">
      <div className="bg-[var(--bg-primary)]/50 rounded-xl p-4">
        <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
          <Package className="w-4 h-4 text-[var(--gold-primary)]" />
          Update Order Status
        </h4>

        <div className="mb-4">
          <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">Select Order Status</p>
          <div className="grid grid-cols-3 gap-2">
            {ORDER_STATUS_LIFECYCLE.map((status) => {
              const isActive = selectedStatus === status.value
              return (
                <button
                  key={status.value}
                  type="button"
                  onClick={() => setSelectedStatus(status.value)}
                  className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                    isActive
                      ? `${status.bgColor} ${status.textColor} ${status.borderColor}`
                      : 'bg-[var(--bg-primary)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--gold-primary)]/50'
                  }`}
                >
                  {status.label}
                </button>
              )
            })}
          </div>
        </div>

        {requiresTracking && (
          <div className="mb-4">
            <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">
              {selectedStatus === 'shipped' ? 'Tracking Number' : 'Rider Details'}
            </p>
            <input
              type="text"
              value={trackingInfo}
              onChange={(e) => setTrackingInfo(e.target.value)}
              placeholder={selectedStatus === 'shipped' ? 'Enter tracking number' : 'Enter rider name & contact'}
              className="w-full px-4 py-3 bg-[var(--surface-dark)] border border-[var(--border)] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
            />
          </div>
        )}

        {showConfirm ? (
          <div className="bg-[var(--bg-primary)]/50 rounded-lg p-4 border border-[var(--gold-primary)]/50">
            <p className="text-white text-sm mb-3">Confirm order status update to <span className="font-semibold">{ORDER_STATUS_MAP[selectedStatus]?.label}</span>?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2 bg-[var(--surface-dark)] border border-[var(--border)] rounded-lg text-white text-sm hover:border-[var(--gold-primary)]/50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={isUpdating}
                className={`flex-1 px-4 py-2 bg-[var(--gold-primary)] rounded-lg text-black text-sm font-medium hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all flex items-center justify-center gap-2 ${
                  isUpdating ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Confirm
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirm(true)}
            className="w-full px-4 py-3 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] rounded-lg text-black font-semibold hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Update Order Status
          </button>
        )}
      </div>
    </div>
  )
}

export function OrderManagement({ orders, onRefresh, user }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [page, setPage] = useState(1)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [selectedSection, setSelectedSection] = useState('details')
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false)
  const [isUpdatingOrder, setIsUpdatingOrder] = useState(false)

  const filteredOrders = useMemo(() => {
    let result = [...orders]
    
    if (statusFilter !== 'all') {
      result = result.filter(o => o.status === statusFilter)
    }
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(o =>
        o.order_number?.toLowerCase().includes(q) ||
        o.order_id?.toLowerCase().includes(q) ||
        o.customer_name?.toLowerCase().includes(q) ||
        o.first_name?.toLowerCase().includes(q) ||
        o.last_name?.toLowerCase().includes(q) ||
        o.email?.toLowerCase().includes(q)
      )
    }
    
    result.sort((a, b) => {
      const aVal = a.created_at ? new Date(a.created_at).getTime() : 0
      const bVal = b.created_at ? new Date(b.created_at).getTime() : 0
      const aAmt = a.total || a.total_amount || 0
      const bAmt = b.total || b.total_amount || 0
      
      if (sortBy === 'newest') return bVal - aVal
      if (sortBy === 'oldest') return aVal - bVal
      if (sortBy === 'highest') return bAmt - aAmt
      if (sortBy === 'lowest') return aAmt - bAmt
      return 0
    })
    
    return result
  }, [orders, statusFilter, searchQuery, sortBy])

  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredOrders.slice(start, start + PAGE_SIZE)
  }, [filteredOrders, page])

  const totalPages = Math.ceil(filteredOrders.length / PAGE_SIZE)

  const handleUpdatePaymentStatus = async (orderId, newStatus, referenceNumber, notes) => {
    setIsUpdatingPayment(true)
    try {
      await adminApi.updatePaymentStatus(orderId, newStatus, { reference_number: referenceNumber, notes, admin_name: user?.firstName ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}` : user?.email, admin_email: user?.email })
      onRefresh()
      setSelectedOrder(null)
    } catch (error) {
      console.error('Failed to update payment status:', error)
    } finally {
      setIsUpdatingPayment(false)
    }
  }

  const handleUpdateOrderStatus = async (orderId, newStatus, trackingInfo) => {
    setIsUpdatingOrder(true)
    try {
      const updateData = { status: newStatus }
      if (newStatus === 'shipped' && trackingInfo) {
        updateData.tracking_number = trackingInfo
      }
      if (newStatus === 'out_for_delivery') {
        // Need both tracking number and rider details for out_for_delivery
        if (trackingInfo) {
          updateData.rider_details = trackingInfo
        }
      }
      await adminApi.updateOrder(orderId, updateData)
      onRefresh()
      setSelectedOrder(null)
    } catch (error) {
      console.error('Failed to update order status:', error)
    } finally {
      setIsUpdatingOrder(false)
    }
  }

  const handleVerifyPayment = async (orderId, newStatus, referenceNumber, notes) => {
    setIsUpdatingPayment(true)
    try {
      const adminName = user?.firstName ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}` : user?.email
      
      await adminApi.updatePaymentStatus(orderId, newStatus, {
        reference_number: referenceNumber,
        admin_notes: notes,
        admin_name: adminName,
        admin_email: user?.email
      })
      onRefresh()
      setSelectedOrder(null)
    } catch (error) {
      console.error('Failed to verify payment:', error)
    } finally {
      setIsUpdatingPayment(false)
    }
  }

  return (
    <motion.div key="order-management" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {ORDER_STATUS_TABS.map((tab) => {
            const isActive = statusFilter === tab.id
            const chipStyles = isActive
              ? `${tab.bgColor} ${tab.textColor} border ${tab.borderColor}`
              : 'bg-[var(--surface-dark)] text-[var(--text-muted)] hover:text-white'
            const tabCount = tab.id === 'all'
              ? orders.length
              : orders.filter(o => o.status === tab.id).length
            return (
              <button
                key={tab.id}
                onClick={() => { setStatusFilter(tab.id); setPage(1) }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${chipStyles}`}
              >
                {tab.label}
                <span className="ml-2 text-xs opacity-70">({tabCount})</span>
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)] text-sm">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="highest">Highest value</option>
            <option value="lowest">Lowest value</option>
          </select>
        </div>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search orders by ID, customer name, or email..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
            className="w-full pl-10 pr-4 py-3 bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
          />
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-[var(--surface-dark)] rounded-xl border border-[var(--border)]">
          <ShoppingBag className="w-12 h-12 text-[var(--text-muted)] mb-4" />
          <p className="text-[var(--text-muted)]">No orders found</p>
        </div>
      ) : (
        <>
          <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[var(--bg-primary)]/50 border-b border-[var(--border)]">
                  <tr>
                    <th className="p-4 text-left text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Order ID</th>
                    <th className="p-4 text-left text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Date</th>
                    <th className="p-4 text-left text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Customer</th>
                    <th className="p-4 text-right text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Total</th>
                    <th className="p-4 text-left text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Payment</th>
                    <th className="p-4 text-center text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Items</th>
                    <th className="p-4 text-left text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Status</th>
                    <th className="p-4 text-center text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((order) => {
                    const orderStatus = order.status || 'pending'
                    const statusConfig = getOrderStatusConfig(orderStatus)
                    const paymentConfig = getPaymentStatusConfig(order.payment_status || 'pending')
                    const itemCount = order.items?.length || 0

                    const rowHighlight = {
                      shipped: 'bg-sky-500/5 border-l-2 border-l-sky-400',
                      out_for_delivery: 'bg-indigo-500/10 border-l-2 border-l-indigo-400',
                      delivered: 'bg-green-500/5 opacity-60',
                    }
                    const highlightClass = rowHighlight[orderStatus] || ''

                    return (
                      <tr key={order.order_id} className={`border-b border-[var(--border)]/30 hover:bg-white/5 transition-colors ${highlightClass}`}>
                        <td className="p-4">
                          <p className="text-white font-mono text-sm font-semibold">#{order.order_number || order.order_id?.slice(0, 8)}</p>
                        </td>
                        <td className="p-4 text-[var(--text-muted)] text-sm">
                          {order.created_at ? new Date(order.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="p-4">
                          <p className="text-white text-sm font-medium">{order.first_name && order.last_name ? `${order.first_name} ${order.last_name}` : order.customer_name || order.user_name || 'N/A'}</p>
                          <p className="text-[var(--text-muted)] text-xs">{order.email || order.customer_email || 'N/A'}</p>
                        </td>
                        <td className="p-4 text-right font-bold text-[var(--gold-primary)]">
                          {formatCurrency(getOrderTotal(order))}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${paymentConfig.bgColor} ${paymentConfig.textColor} ${paymentConfig.borderColor}`}>
                            {paymentConfig.label}
                          </span>
                        </td>
                        <td className="p-4 text-center text-[var(--text-muted)] text-sm">{itemCount}</td>
                        <td className="p-4">
                          <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] border-[var(--gold-primary)]/30">
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => {
                                setSelectedSection('details')
                                setSelectedOrder(order)
                              }}
                              className="p-2 hover:bg-[var(--gold-primary)]/10 rounded-lg transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4 text-[var(--text-muted)]" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedSection('receipt')
                                setSelectedOrder(order)
                              }}
                              className="p-2 hover:bg-[var(--gold-primary)]/10 rounded-lg transition-colors"
                              title="View Receipt"
                            >
                              <Printer className="w-4 h-4 text-[var(--text-muted)]" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-[var(--text-muted)] text-sm">
                Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, filteredOrders.length)} of {filteredOrders.length} orders
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 hover:bg-[var(--surface-dark)] rounded-lg transition-colors disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4 text-white" />
                </button>
                <span className="text-white text-sm">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 hover:bg-[var(--surface-dark)] rounded-lg transition-colors disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {selectedOrder && (
          <OrderDetailsModal
            order={selectedOrder}
            onClose={() => setSelectedOrder(null)}
            onUpdatePaymentStatus={handleUpdatePaymentStatus}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onVerifyPayment={handleVerifyPayment}
            user={user}
            initialSection={selectedSection}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
