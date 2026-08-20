import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { Package, Search, X, Printer, Download, ArrowUpDown, Grid3X3, List, Plus, RotateCcw, AlertTriangle } from 'lucide-react'
import { posApi } from '../../utils/posApi'
import { formatCurrency } from '../../utils/formatCurrency'
import { useSmartPolling } from '../../hooks/useSmartPolling'
import { useAuth } from '../../context/AuthContext'
import { hasRole } from '../../utils/roles'

function EmptyState({ icon: Icon, label, description }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] py-16 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--gold-primary)]/15">
        <Icon className="h-7 w-7 text-[var(--gold-primary)]" />
      </div>
      <p className="font-semibold text-[var(--text-light)]">{label}</p>
      {description ? <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p> : null}
    </div>
  )
}

function StatusBadge({ label, variant = 'default' }) {
  const variants = {
    default: 'border-gray-500/30 bg-gray-500/20 text-gray-300',
    success: 'border-green-500/30 bg-green-500/20 text-green-300',
    warning: 'border-amber-500/30 bg-amber-500/20 text-amber-300',
    info: 'border-blue-500/30 bg-blue-500/20 text-blue-300',
  }

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${variants[variant] || variants.default}`}>
      {label}
    </span>
  )
}

function normalizeSales(payload) {
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatStatusLabel(status) {
  const labels = {
    pending: 'Pending',
    completed: 'Completed',
    cancelled: 'Cancelled',
    canceled: 'Cancelled',
    refunded: 'Refunded',
    refund_requested: 'Refund Requested',
    failed: 'Failed',
    processing: 'Processing',
    paid: 'Paid',
    void: 'Void',
    voided: 'Voided',
    returned: 'Returned',
  }
  return labels[String(status || '').toLowerCase()] || String(status || 'pending').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function getStatusVariant(status) {
  const value = String(status || '').toLowerCase()
  if (value === 'completed') return 'success'
  if (value === 'voided' || value === 'returned') return 'warning'
  if (value === 'cancelled' || value === 'canceled') return 'default'
  return 'warning'
}

function buildPosReceiptHtml(sale) {
  const createdAt = formatDateTime(sale?.created_at)
  const saleNumber = escapeHtml(sale?.sale_number || '')
  const customerName = escapeHtml(sale?.customer_name || '')
  const customerPhone = escapeHtml(sale?.customer_phone || '')
  const paymentMethod = escapeHtml(String(sale?.payment_method || 'cash').replace(/_/g, ' ')).replace(/\b\w/g, (c) => c.toUpperCase())
  const referenceNumber = escapeHtml(sale?.reference_number || '')
  const subtotal = Number(sale?.subtotal || 0)
  const taxAmount = Number(sale?.tax_amount || sale?.taxAmount || 0)
  const totalAmount = Number(sale?.total_amount || sale?.totalAmount || subtotal + taxAmount)
  const rawCashReceived = sale?.cash_received ?? sale?.cashReceived ?? sale?.amount_received ?? sale?.received_amount
  const cashReceived = rawCashReceived == null ? null : Number(rawCashReceived)
  const rawChange = sale?.change_amount ?? sale?.changeAmount
  const changeAmount = rawChange == null
    ? (cashReceived != null ? Math.max(0, cashReceived - totalAmount) : null)
    : Number(rawChange)
  const isCashPayment = String(sale?.payment_method || 'cash').toLowerCase() === 'cash'
  const isGcashPayment = String(sale?.payment_method || 'cash').toLowerCase() === 'gcash'
  const items = Array.isArray(sale?.items) ? sale.items : []

  const formatItemName = (value) => {
    const escaped = escapeHtml(value || 'Item')
    const words = escaped.split(' ')
    const lines = []
    for (let i = 0; i < words.length; i += 2) {
      lines.push(words.slice(i, i + 2).join(' '))
    }
    return lines.join('<br/>')
  }

  const rows = items.map((item) => {
  const name = formatItemName(item?.item_name || item?.name)
  const qty = Number(item?.quantity || 0)
  const unitPrice = Number(item?.unit_price || item?.price || 0)
  const lineTotal = Number(item?.subtotal || (qty * unitPrice))

  return `
    <tr>
      <td class="item">${name}</td>
      <td class="qty">${qty}</td>
      <td class="price">${escapeHtml(formatCurrency(unitPrice))}</td>
      <td class="total">${escapeHtml(formatCurrency(lineTotal))}</td>
    </tr>
  `
}).join('')

return `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>POS Receipt ${saleNumber}</title>

      <style>
        :root {
          color-scheme: light;
        }

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          padding: 20px;
          background: #f3f4f6;
          color: #111827;
          font-family: 'Courier New', Courier, monospace;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .sheet {
          width: 100%;
          max-width: 320px;
          margin: 0 auto;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 18px;
          font-size: 12px;
          line-height: 1.5;
        }

        /* =========================
           HEADER
        ========================= */

        .header {
          text-align: center;
          margin-bottom: 14px;
          border-bottom: 1px dashed #111827;
          padding-bottom: 10px;
        }

        .brand {
          font-weight: 700;
          font-size: 14px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .invoice-title {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 6px;
        }

        /* =========================
           CUSTOMER / SALE INFO
        ========================= */

        .meta {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px 12px;
          font-size: 11px;
          margin-bottom: 10px;
        }

        .meta-label {
          color: #6b7280;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* =========================
           PAYMENT INFO
        ========================= */

        .payment-info {
          margin-top: 10px;
          font-size: 11px;
        }

        .payment-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 2px 0;
        }

        /* =========================
           ITEMS TABLE
        ========================= */

        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          margin-top: 4px;
          font-size: 11px;
        }

        thead th {
          text-align: left;
          font-size: 10px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: #6b7280;
          border-bottom: 1px solid #111827;
          padding: 4px 0;
          vertical-align: middle;
        }

        tbody td {
          border-bottom: 1px solid #e5e7eb;
          padding: 5px 0;
          vertical-align: middle;
          line-height: 1.4;
          overflow-wrap: break-word;
        }

        /* Item column */
        th.item,
        td.item {
          width: 44%;
          text-align: left;
          padding-right: 8px;
          vertical-align: middle;
        }

        /* Quantity column */
        th.qty,
        td.qty {
          width: 12%;
          text-align: right;
          padding: 5px 6px 5px 2px;
          white-space: nowrap;
          vertical-align: middle;
        }

        /* Price column */
        th.price,
        td.price {
          width: 22%;
          text-align: right;
          padding-left: 4px;
          white-space: nowrap;
          vertical-align: middle;
        }

        /* Total column */
        th.total,
        td.total {
          width: 22%;
          text-align: right;
          padding-left: 4px;
          white-space: nowrap;
          vertical-align: middle;
        }

        /* =========================
           SUMMARY
        ========================= */

        .summary {
          margin-top: 10px;
          font-size: 11px;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 2px 0;
        }

        .summary-total {
          font-weight: 700;
          font-size: 13px;
          border-top: 1px solid #111827;
          margin-top: 4px;
          padding-top: 4px;
        }

        /* =========================
           FOOTER
        ========================= */

        .footer {
          margin-top: 14px;
          text-align: center;
          font-size: 10px;
          color: #6b7280;
          border-top: 1px dashed #111827;
          padding-top: 8px;
        }

        /* =========================
           PRINT
        ========================= */

        @media print {
          body {
            background: #fff;
            padding: 0;
          }

          .sheet {
            width: 100%;
            max-width: none;
            border: 0;
            border-radius: 0;
            padding: 14px 16px;
          }
        }
      </style>
    </head>

    <body>
      <main class="sheet">

        <!-- HEADER -->
        <section class="header">
          <div class="brand">Cosmos Craft</div>
          <div class="invoice-title">Invoice</div>
          <div>${saleNumber}</div>
        </section>

        <!-- SALE INFORMATION -->
        <section class="meta">
          <div>
            <span class="meta-label">Date</span><br />
            ${createdAt || ''}
          </div>

          <div>
            <span class="meta-label">Payment</span><br />
            ${paymentMethod}
          </div>

        </section>

        <!-- GCASH PAYMENT INFORMATION -->
        ${
          isGcashPayment
            ? `
              <section class="payment-info">
                <div class="payment-row">
                  <span>Reference No.</span>
                  <span>${referenceNumber}</span>
                </div>

              
            `
            : ''
        }

        <!-- ITEMS -->
        <table>
          <thead>
            <tr>
              <th class="item">Item</th>
              <th class="qty">Qty</th>
              <th class="price">Price</th>
              <th class="total">Total</th>
            </tr>
          </thead>

          <tbody>
            ${
              rows ||
              `
                <tr>
                  <td
                    colspan="4"
                    style="
                      text-align: center;
                      padding: 8px 0;
                    "
                  >
                    No items
                  </td>
                </tr>
              `
            }
          </tbody>
        </table>

        <!-- SUMMARY -->
        <section class="summary">

          <div class="summary-row">
            <span>Subtotal</span>
            <span>
              ${escapeHtml(formatCurrency(subtotal))}
            </span>
          </div>

          <div class="summary-row">
            <span>Tax</span>
            <span>
              ${escapeHtml(formatCurrency(taxAmount))}
            </span>
          </div>

          <div class="summary-row summary-total">
            <span>Total</span>
            <span>
              ${escapeHtml(formatCurrency(totalAmount))}
            </span>
          </div>

          ${
            isCashPayment && cashReceived != null
              ? `
                <div class="payment-row">
                  <span>Cash Received</span>
                  <span>
                    ${escapeHtml(formatCurrency(cashReceived))}
                  </span>
                </div>
              `
              : ''
          }

          ${
            isCashPayment && changeAmount != null
              ? `
                <div class="payment-row">
                  <span>Change</span>
                  <span>
                    ${escapeHtml(formatCurrency(changeAmount))}
                  </span>
                </div>
              `
              : ''
          }

        </section>

        <!-- FOOTER -->
        <div class="footer">
          Thank you for your purchase!
        </div>

      </main>
    </body>
  </html>
`;
}

export function PosWorkspace({
  inventoryItems = [],
  showToast,
  heading = 'Point of Sale',
  description = 'Create and record walk-in sales.',
}) {
  const { user } = useAuth()
  const isAdmin = hasRole(user?.role, 'admin')
  const [searchQuery, setSearchQuery] = useState('')
  const [voidReturnModal, setVoidReturnModal] = useState({ open: false, mode: null, sale: null })
  const [voidReturnReason, setVoidReturnReason] = useState('')
  const [voidReturnConditions, setVoidReturnConditions] = useState({})
  const [voidReturnSubmitting, setVoidReturnSubmitting] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [catalogSort, setCatalogSort] = useState('name_asc')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [catalogView, setCatalogView] = useState('grid')
  const [cashReceived, setCashReceived] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [cart, setCart] = useState([])
  const [recentSales, setRecentSales] = useState([])
  const [dailySummary, setDailySummary] = useState(null)
  const [loadingRecent, setLoadingRecent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedSale, setSelectedSale] = useState(null)
  const [loadingSaleDetails, setLoadingSaleDetails] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [historySales, setHistorySales] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false)
  const [historyOffset, setHistoryOffset] = useState(0)
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyHasMore, setHistoryHasMore] = useState(false)

  const prevSalesRef = useRef(null)
  const prevSummaryRef = useRef(null)

  const visibleInventory = useMemo(
    () => inventoryItems
      .map((item) => ({
        ...item,
        stock: Number(item.stock || 0),
        price: Number(item.price || 0),
      }))
      .filter((item) => item.product_id && Number(item.stock) > 0),
    [inventoryItems]
  )

  const categoryOptions = useMemo(() => {
    const map = new Map()
    visibleInventory.forEach((item) => {
      const id = String(item.category_id || '').trim()
      const label = String(item.category_name || item.category || '').trim()
      if (id || label) {
        map.set(id || label, { value: id || label, label: label || 'Uncategorized' })
      }
    })
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label))
  }, [visibleInventory])

  const catalog = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const filtered = visibleInventory
      .filter((item) => {
        if (categoryFilter !== 'all') {
          const categoryKey = String(item.category_id || item.category_name || item.category || '').trim()
          if (categoryKey !== categoryFilter) return false
        }
        if (!query) return true
        return String(item.name || '').toLowerCase().includes(query) || String(item.sku || '').toLowerCase().includes(query)
      })
      .sort((a, b) => {
        if (catalogSort === 'price_asc') return Number(a.price || 0) - Number(b.price || 0)
        if (catalogSort === 'price_desc') return Number(b.price || 0) - Number(a.price || 0)
        if (catalogSort === 'stock_desc') return Number(b.stock || 0) - Number(a.stock || 0)
        return String(a.name || '').localeCompare(String(b.name || ''))
      })

    return filtered.slice(0, 30)
  }, [searchQuery, visibleInventory, catalogSort, categoryFilter])

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0),
    [cart]
  )
  const resolveCatalogImage = useCallback((item) => {
    if (!item) return null
    if (item.primary_image) return item.primary_image
    if (item.image_url) return item.image_url
    if (item.product_image) return item.product_image
    if (item.preview_url) return item.preview_url
    if (item.image) return item.image
    if (Array.isArray(item.images) && item.images.length > 0) {
      const first = item.images[0]
      if (typeof first === 'string') return first
      if (first?.url) return first.url
    }
    return null
  }, [])
  const tax = 0
  const total = subtotal
  const change = Math.max(0, Number(cashReceived || 0) - total)
  const isCashPayment = paymentMethod === 'cash'
  const isGcashPayment = paymentMethod === 'gcash'
  const isCashReceivedEmpty = isCashPayment && String(cashReceived || '').trim() === ''
  const isReferenceEmpty = isGcashPayment && String(referenceNumber || '').trim() === ''
  const disablePlaceOrder = submitting || cart.length === 0 || isCashReceivedEmpty || isReferenceEmpty

  const resetSaleForm = useCallback(() => {
    setCart([])
    setCashReceived('')
    setCustomerName('')
    setCustomerPhone('')
    setReferenceNumber('')
    setPaymentMethod('cash')
  }, [])

  useEffect(() => {
    if (paymentMethod === 'cash') {
      setReferenceNumber('')
    }
  }, [paymentMethod])

  const loadRecentSales = useCallback(async (options = {}) => {
    const { silent = false } = options
    if (!silent) setLoadingRecent(true)
    try {
      const [salesRes, summaryRes] = await Promise.all([
        posApi.listSales({ limit: 8 }),
        posApi.getDailySummary(),
      ])
      const nextSales = normalizeSales(salesRes)
      const nextSummary = summaryRes?.data || null
      const salesChanged = JSON.stringify(prevSalesRef.current || []) !== JSON.stringify(nextSales)
      const summaryChanged = JSON.stringify(prevSummaryRef.current || null) !== JSON.stringify(nextSummary)
      if (salesChanged) {
        prevSalesRef.current = nextSales
        setRecentSales(nextSales)
      }
      if (summaryChanged) {
        prevSummaryRef.current = nextSummary
        setDailySummary(nextSummary)
      }
      return salesChanged || summaryChanged ? salesRes : null
    } catch (error) {
      if (!silent) showToast?.(error.message, 'error')
      throw error
    } finally {
      if (!silent) setLoadingRecent(false)
    }
  }, [showToast])

  const loadSaleDetails = useCallback(async (saleId) => {
    setLoadingSaleDetails(true)
    try {
      const res = await posApi.getSale(saleId)
      setSelectedSale(res?.data || null)
    } catch (error) {
      showToast?.(error.message, 'error')
    } finally {
      setLoadingSaleDetails(false)
    }
  }, [showToast])

  const loadHistorySales = useCallback(async (options = {}) => {
    const { reset = false } = options
    if (reset) {
      setHistoryLoading(true)
    } else {
      setHistoryLoadingMore(true)
    }
    try {
      const nextOffset = reset ? 0 : historyOffset
      const res = await posApi.listSales({ limit: 20, offset: nextOffset })
      const nextSales = normalizeSales(res)
      const total = Number(res?.pagination?.total || 0)
      const loadedCount = reset ? nextSales.length : historySales.length + nextSales.length
      setHistorySales((prev) => (reset ? nextSales : [...prev, ...nextSales]))
      setHistoryOffset(nextOffset + nextSales.length)
      setHistoryTotal(total)
      setHistoryHasMore(loadedCount < total)
    } catch (error) {
      showToast?.(error.message, 'error')
    } finally {
      setHistoryLoading(false)
      setHistoryLoadingMore(false)
    }
  }, [historyOffset, historySales.length, showToast])

  const openHistoryModal = useCallback(() => {
    setShowHistoryModal(true)
    loadHistorySales({ reset: true })
  }, [loadHistorySales])

  const lastSaleTimestampRef = useRef(null)
  const latestSalesRef = useRef(null)

  const pollRecentSales = useCallback(async () => {
    const result = await loadRecentSales({ silent: true })
    if (result?.data?.length > 0) {
      const latestSale = result.data[0]
      const latestTimestamp = latestSale.created_at
      
      if (lastSaleTimestampRef.current && new Date(latestTimestamp) > new Date(lastSaleTimestampRef.current)) {
        lastSaleTimestampRef.current = latestTimestamp
        showToast?.(`New sale: ${latestSale.sale_number}`, 'info')
      } else if (!lastSaleTimestampRef.current) {
        lastSaleTimestampRef.current = latestTimestamp
      }
      latestSalesRef.current = result.data
    }
    return result
  }, [loadRecentSales, showToast])

  useSmartPolling(pollRecentSales, {
    interval: 5000,
    maxInterval: 60000,
    backoffFactor: 1.5,
  })

  const addToCart = useCallback((product) => {
    setCart((prev) => {
      const existing = prev.find((entry) => entry.product_id === product.product_id)
      if (existing) {
        return prev.map((entry) =>
          entry.product_id === product.product_id
            ? { ...entry, quantity: Math.min(entry.quantity + 1, Number(product.stock || 0)) }
            : entry
        )
      }
      return [...prev, { ...product, quantity: 1 }]
    })
  }, [])

  const updateQuantity = useCallback((productId, nextQuantity, maxStock) => {
    setCart((prev) => {
      if (nextQuantity <= 0) return prev.filter((entry) => entry.product_id !== productId)
      return prev.map((entry) =>
        entry.product_id === productId
          ? { ...entry, quantity: Math.min(nextQuantity, Number(maxStock || entry.stock || 0)) }
          : entry
      )
    })
  }, [])

  const completeSale = useCallback(async () => {
    if (cart.length === 0) {
      showToast?.('Add items to the cart', 'error')
      return
    }

    if (paymentMethod === 'cash' && String(cashReceived || '').trim() === '') {
      showToast?.('Cash received is required for cash payments', 'error')
      return
    }

    if (paymentMethod === 'gcash' && !referenceNumber.trim()) {
      showToast?.('GCash reference number is required', 'error')
      return
    }

    if (paymentMethod === 'cash' && Number(cashReceived || 0) < total) {
      showToast?.('Cash received is below the total', 'error')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        customerName: customerName.trim() || null,
        customerPhone: customerPhone.trim() || null,
        subtotal,
        taxAmount: tax,
        totalAmount: total,
        paymentMethod,
        cashReceived: paymentMethod === 'cash' ? Number(cashReceived) : null,
        referenceNumber: paymentMethod === 'cash' ? null : (referenceNumber.trim() || null),
        items: cart.map(item => ({
          product_id: item.product_id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.price * item.quantity
        }))
      }

      const result = await posApi.createSale(payload)
      resetSaleForm()
      await loadRecentSales()
      showToast?.(`POS sale ${result?.data?.sale_number || 'saved'} recorded`, 'success')
    } catch (error) {
      showToast?.(error.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }, [cart, cashReceived, customerName, customerPhone, loadRecentSales, paymentMethod, referenceNumber, resetSaleForm, showToast, subtotal, tax, total])

  const handlePrintSaleReceipt = useCallback((sale) => {
    if (!sale) {
      showToast?.('No sale selected for receipt printing.', 'error')
      return
    }
    const printWindow = window.open('', '_blank', 'width=980,height=780')
    if (!printWindow) {
      showToast?.('Please allow popups to print the receipt.', 'error')
      return
    }
    printWindow.document.open()
    printWindow.document.write(buildPosReceiptHtml(sale))
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
    }, 150)
  }, [showToast])

  const openVoidReturnModal = useCallback((sale, mode) => {
    if (!isAdmin) {
      showToast?.('Only admins can void or return sales', 'error')
      return
    }
    if (String(sale?.status || '').toLowerCase() !== 'completed') {
      showToast?.('Only completed sales can be voided or returned', 'error')
      return
    }
    setVoidReturnModal({ open: true, mode, sale })
    setVoidReturnReason('')
    setVoidReturnConditions({})
  }, [isAdmin, showToast])

  const closeVoidReturnModal = useCallback(() => {
    setVoidReturnModal({ open: false, mode: null, sale: null })
    setVoidReturnReason('')
    setVoidReturnConditions({})
  }, [])

  const handleVoidReturn = useCallback(async () => {
    const { mode, sale } = voidReturnModal
    if (!sale) return

    if (!voidReturnReason.trim()) {
      showToast?.('A reason is required for void/return', 'error')
      return
    }

    if (mode === 'return') {
      const items = (sale.items || []).filter((item) => item.product_id)
      if (items.length === 0) {
        showToast?.('No returnable product items found', 'error')
        return
      }
      for (const item of items) {
        if (!voidReturnConditions[item.item_id]) {
          showToast?.(`Select condition for ${item.item_name}`, 'error')
          return
        }
      }
    }

    setVoidReturnSubmitting(true)
    try {
      if (mode === 'void') {
        await posApi.voidSale(sale.sale_id, { reason: voidReturnReason.trim() })
        showToast?.(`Sale ${sale.sale_number} voided`, 'success')
      } else {
        const items = (sale.items || [])
          .filter((item) => item.product_id)
          .map((item) => ({
            item_id: item.item_id,
            quantity: item.quantity,
            item_condition: voidReturnConditions[item.item_id] || 'resalable',
          }))
        await posApi.returnSale(sale.sale_id, { reason: voidReturnReason.trim(), items })
        showToast?.(`Sale ${sale.sale_number} returned`, 'success')
      }
      closeVoidReturnModal()
      setSelectedSale(null)
      await loadRecentSales()
    } catch (error) {
      showToast?.(error.message, 'error')
    } finally {
      setVoidReturnSubmitting(false)
    }
  }, [closeVoidReturnModal, loadRecentSales, showToast, voidReturnConditions, voidReturnModal, voidReturnReason])

  const expectedRestockCount = useMemo(() => {
    if (!voidReturnModal.sale) return 0
    if (voidReturnModal.mode === 'void') {
      return (voidReturnModal.sale.items || []).filter((item) => item.product_id).reduce((sum, item) => sum + Number(item.quantity || 0), 0)
    }
    return (voidReturnModal.sale.items || [])
      .filter((item) => item.product_id && voidReturnConditions[item.item_id] === 'resalable')
      .reduce((sum, item) => sum + Number(item.quantity || 0), 0)
  }, [voidReturnModal, voidReturnConditions])

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-light)]">{heading}</h3>
            <p className="text-sm text-[var(--text-muted)]">{description}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:w-auto">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/60 px-4 py-2.5">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">Today</p>
              <p className="text-sm font-semibold text-[var(--text-light)]">{formatCurrency(Number(dailySummary?.total_sales || 0))}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/60 px-4 py-2.5">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">Sales</p>
              <p className="text-sm font-semibold text-[var(--text-light)]">{Number(dailySummary?.total_transactions || 0)} today</p>
            </div>
          </div>
        </div>
      </div>

        <div className="grid gap-6 xl:grid-cols-[1.35fr,0.95fr]">
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Total Products</p>
                <p className="mt-2 text-2xl font-bold text-[var(--text-light)]">{visibleInventory.length}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Categories</p>
                <p className="mt-2 text-2xl font-bold text-[var(--text-light)]">{categoryOptions.length}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Transactions</p>
                <p className="mt-2 text-2xl font-bold text-[var(--text-light)]">{Number(dailySummary?.total_transactions || 0)}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Cart Items</p>
                <p className="mt-2 text-2xl font-bold text-[var(--text-light)]">{cart.reduce((acc, item) => acc + Number(item.quantity || 0), 0)}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-5">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-lg font-semibold text-[var(--text-light)]">All Products</h4>
                {/* <button
                  type="button"
                  onClick={() => { setCategoryFilter('all'); setSearchQuery('') }}
                  className="text-xs font-semibold text-[var(--gold-primary)] hover:text-[var(--gold-secondary)]"
                >
                  See all
                </button> */}
              </div>

              <div className="mb-4 flex flex-wrap items-center gap-2 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setCategoryFilter('all')}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${categoryFilter === 'all' ? 'bg-[var(--gold-primary)] text-[var(--text-dark)]' : 'border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-light)]'}`}
                >
                  All
                </button>
                {categoryOptions.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategoryFilter(cat.value)}
                    className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${categoryFilter === cat.value ? 'bg-[var(--gold-primary)] text-[var(--text-dark)]' : 'border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-light)]'}`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="mb-4 grid gap-3 lg:grid-cols-[150px_minmax(0,1fr)_auto_auto]">
                <div className="relative">
                  <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                  <select
                    value={catalogSort}
                    onChange={(event) => setCatalogSort(event.target.value)}
                    className="w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] py-2.5 pl-9 pr-8 text-sm text-[var(--text-light)]"
                  >
                    <option value="name_asc">Name A-Z</option>
                    <option value="price_asc">Price Low-High</option>
                    <option value="price_desc">Price High-Low</option>
                    <option value="stock_desc">Most Stock</option>
                  </select>
                </div>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search products"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] py-2.5 pl-9 pr-4 text-sm text-[var(--text-light)]"
                  />
                </div>

                <div className="flex overflow-hidden rounded-xl border border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setCatalogView('grid')}
                    className={`px-3 py-2 ${catalogView === 'grid' ? 'bg-[var(--gold-primary)] text-[var(--text-dark)]' : 'bg-[var(--bg-primary)] text-[var(--text-muted)] hover:text-[var(--text-light)]'}`}
                    title="Grid view"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatalogView('list')}
                    className={`px-3 py-2 ${catalogView === 'list' ? 'bg-[var(--gold-primary)] text-[var(--text-dark)]' : 'bg-[var(--bg-primary)] text-[var(--text-muted)] hover:text-[var(--text-light)]'}`}
                    title="List view"
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>

                <div className="rounded-xl border border-[var(--gold-primary)]/40 bg-[var(--gold-primary)]/15 px-3 py-2 text-xs font-semibold text-[var(--gold-primary)]">
                  {catalog.length} Items
                </div>
              </div>

              {catalog.length === 0 ? (
                <EmptyState icon={Package} label="No sellable products found" description="Try another search term." />
              ) : (
                <div className="max-h-[560px] overflow-y-auto pr-1">
                  <div className={`grid gap-3 ${catalogView === 'list' ? 'grid-cols-1' : 'sm:grid-cols-2 xl:grid-cols-3'}`}>
                  {catalog.map((item) => (
                    <div
                      key={item.product_id}
                      className={`rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)]/70 p-3 ${catalogView === 'list' ? 'flex items-center justify-between gap-3' : ''}`}
                    >
                      <div className={`min-w-0 ${catalogView === 'list' ? 'flex-1' : ''}`}>
                        <div className={`mb-2 ${catalogView === 'list' ? 'hidden' : 'flex h-20 items-center justify-center rounded-xl bg-[var(--surface-dark)]'}`}>
                          {resolveCatalogImage(item) ? (
                            <img src={resolveCatalogImage(item)} alt={item.name} className="h-16 w-16 rounded-lg object-cover" loading="lazy" />
                          ) : (
                            <Package className="h-7 w-7 text-[var(--text-muted)]" />
                          )}
                        </div>
                        <p className="truncate text-sm font-semibold text-[var(--text-light)]">{item.name}</p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">{item.sku || 'No SKU'} - {item.stock} in stock</p>
                        <p className="mt-2 text-sm font-bold text-[var(--gold-primary)]">{formatCurrency(Number(item.price || 0))}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addToCart(item)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--gold-primary)] text-[var(--text-dark)] hover:bg-[var(--gold-secondary)]"
                        title={`Add ${item.name}`}
                        aria-label={`Add ${item.name}`}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-5">
              <h4 className="text-lg font-semibold text-[var(--text-light)]">Order Summary</h4>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Transaction preview and checkout controls.</p>

              <div className="mt-4 max-h-[280px] space-y-2 overflow-y-auto pr-1">
                {cart.length === 0 ? (
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/50 p-4 text-sm text-[var(--text-muted)]">
                    Add products from the left panel.
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.product_id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/70 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--text-light)]">{item.name}</p>
                          <p className="text-xs text-[var(--text-muted)]">{formatCurrency(Number(item.price || 0))} each</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.product_id, 0, item.stock)}
                          className="rounded-md p-1 text-red-300 hover:bg-red-500/10"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product_id, item.quantity - 1, item.stock)}
                            className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-muted)]"
                          >
                            -
                          </button>
                          <span className="min-w-[1.75rem] text-center text-sm font-semibold text-[var(--text-light)]">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product_id, item.quantity + 1, item.stock)}
                            className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-muted)]"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-sm font-semibold text-[var(--text-light)]">{formatCurrency(Number(item.price || 0) * item.quantity)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-4 text-sm">
                <div className="flex justify-between text-[var(--text-muted)]"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                <div className="flex justify-between text-base font-bold text-[var(--text-light)]"><span>Total</span><span className="text-[var(--gold-primary)]">{formatCurrency(total)}</span></div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {[
                  ['cash', 'Cash'],
                  ['gcash', 'GCash'],
                ].map(([method, label]) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold ${paymentMethod === method ? 'bg-[var(--gold-primary)] text-[var(--text-dark)]' : 'border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-light)]'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">Cash and GCash only.</p>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Customer name"
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-light)]"
                />
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  placeholder="Phone"
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-light)]"
                />
              </div>

              {paymentMethod === 'cash' ? (
                <div className="mt-3">
                  <input
                    type="number"
                    min="0"
                    value={cashReceived}
                    onChange={(event) => setCashReceived(event.target.value)}
                    placeholder="Cash received"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-light)]"
                  />
                  <p className="mt-1 text-xs text-[var(--text-muted)]">Change: {formatCurrency(change)}</p>
                </div>
              ) : (
                <div className="mt-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                      Reference Number <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={referenceNumber}
                      onChange={(event) => setReferenceNumber(event.target.value)}
                      placeholder="Enter GCash reference number"
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-light)]"
                    />
                  </div>
                </div>
              )}

              <div className="mt-4">
                <button
                  type="button"
                  onClick={completeSale}
                  disabled={disablePlaceOrder}
                  className="w-full rounded-xl bg-gradient-to-r from-[var(--gold-secondary)] to-[var(--gold-primary)] px-4 py-2 text-sm font-semibold text-[var(--text-dark)] disabled:opacity-60"
                >
                  {submitting ? 'Saving...' : 'Place Order'}
                </button>
                {isCashReceivedEmpty && (
                  <p className="mt-2 text-xs text-amber-300">Cash received is required for cash payments.</p>
                )}
                {isReferenceEmpty && (
                  <p className="mt-2 text-xs text-amber-300">Reference number is required for GCash payments.</p>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-[var(--text-light)]">Recent Orders</h4>
                  <p className="text-xs text-[var(--text-muted)]">Latest POS transactions</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={openHistoryModal}
                    className="rounded-lg border border-[var(--gold-primary)]/40 bg-[var(--gold-primary)]/15 px-3 py-1.5 text-xs font-semibold text-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/25"
                  >
                    View All History
                  </button>
                  <button
                    type="button"
                    onClick={loadRecentSales}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-light)]"
                  >
                    Refresh
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {loadingRecent ? (
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/50 px-4 py-5 text-center text-sm text-[var(--text-muted)]">
                    Loading recent sales...
                  </div>
                ) : recentSales.length === 0 ? (
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/50 px-4 py-5 text-center text-sm text-[var(--text-muted)]">
                    No POS sales recorded yet.
                  </div>
                ) : (
                  recentSales.slice(0, 4).map((entry) => (
                    <div
                      key={entry.sale_id}
                      onClick={() => loadSaleDetails(entry.sale_id)}
                      className="cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/60 p-3 hover:border-[var(--gold-primary)]/50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--text-light)]">{entry.sale_number}</p>
                           <p className="text-xs text-[var(--text-muted)]">{entry.customer_name || 'N/A'} - {new Date(entry.created_at).toLocaleString()}</p>
                        </div>
                        <StatusBadge
                          label={formatStatusLabel(entry.status || 'pending')}
                          variant={getStatusVariant(entry.status)}
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs">
                         <span className="text-[var(--text-muted)]">{entry.item_count} items - {String(entry.payment_method || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                        <span className="font-semibold text-[var(--gold-primary)]">{formatCurrency(Number(entry.total_amount || 0))}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

      {showHistoryModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowHistoryModal(false)}
        >
          <div 
            className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] p-5">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-light)]">Receipt History</h3>
                <p className="text-xs text-[var(--text-muted)]">
                  {historyTotal > 0 ? `${historyTotal} total transaction${historyTotal === 1 ? '' : 's'}` : 'All POS transactions'}
                </p>
              </div>
              <button 
                onClick={() => setShowHistoryModal(false)}
                className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-primary)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {historyLoading ? (
                <div className="py-10 text-center text-[var(--text-muted)]">Loading receipt history...</div>
              ) : historySales.length === 0 ? (
                <div className="py-10 text-center text-[var(--text-muted)]">No POS sales recorded yet.</div>
              ) : (
                <div className="space-y-2">
                  {historySales.map((entry) => (
                    <div
                      key={entry.sale_id}
                      onClick={() => loadSaleDetails(entry.sale_id)}
                      className="cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/60 p-3 hover:border-[var(--gold-primary)]/50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--text-light)]">{entry.sale_number}</p>
                          <p className="text-xs text-[var(--text-muted)]">{entry.customer_name || 'N/A'} - {new Date(entry.created_at).toLocaleString()}</p>
                        </div>
                        <StatusBadge
                          label={formatStatusLabel(entry.status || 'pending')}
                          variant={getStatusVariant(entry.status)}
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-[var(--text-muted)]">{entry.item_count} items - {String(entry.payment_method || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                        <span className="font-semibold text-[var(--gold-primary)]">{formatCurrency(Number(entry.total_amount || 0))}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {historyHasMore && (
              <div className="border-t border-[var(--border)] p-4">
                <button
                  type="button"
                  onClick={() => loadHistorySales()}
                  disabled={historyLoadingMore}
                  className="w-full rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-light)] disabled:opacity-60"
                >
                  {historyLoadingMore ? 'Loading more...' : 'Load More'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedSale && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSelectedSale(null)}
        >
          <div 
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[var(--text-light)]">Receipt</h3>
              <button 
                onClick={() => setSelectedSale(null)}
                className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-primary)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {loadingSaleDetails ? (
              <div className="py-8 text-center text-[var(--text-muted)]">Loading...</div>
            ) : (
              <>
                <div className="mt-4 space-y-2 border-b border-[var(--border)] pb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-muted)]">Sale #</span>
                    <span className="font-semibold text-[var(--text-light)]">{selectedSale.sale_number}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-muted)]">Date</span>
                    <span className="text-[var(--text-light)]">{new Date(selectedSale.created_at).toLocaleString()}</span>
                  </div>
                  {selectedSale.customer_name && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--text-muted)]">Customer</span>
                      <span className="text-[var(--text-light)]">{selectedSale.customer_name}</span>
                    </div>
                  )}
                  {selectedSale.customer_phone && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--text-muted)]">Contact</span>
                      <span className="text-[var(--text-light)]">{selectedSale.customer_phone}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-2">
                  <p className="text-sm font-semibold text-[var(--text-light)]">Items</p>
                  {(selectedSale.items || []).map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <div className="flex-1 text-[var(--text-muted)]">
                        <span className="text-[var(--text-light)]">{item.item_name}</span>
                        <span className="ml-2">x{item.quantity}</span>
                      </div>
                      <span className="text-[var(--text-light)]">{formatCurrency(Number(item.subtotal || 0))}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-muted)]">Subtotal</span>
                    <span className="text-[var(--text-light)]">{formatCurrency(Number(selectedSale.subtotal || 0))}</span>
                  </div>
                  <div className="flex justify-between text-base font-semibold">
                    <span className="text-[var(--text-light)]">Total</span>
                    <span className="text-[var(--gold-primary)]">{formatCurrency(Number(selectedSale.total_amount || 0))}</span>
                  </div>
                </div>

                <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-muted)]">Payment Method</span>
                    <span className="text-[var(--text-light)] capitalize">{String(selectedSale.payment_method || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                  </div>
                  {selectedSale.reference_number && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--text-muted)]">Reference</span>
                      <span className="text-[var(--text-light)]">{selectedSale.reference_number}</span>
                    </div>
                  )}
                </div>

                {isAdmin && String(selectedSale.status || '').toLowerCase() === 'completed' && (
                  <div className="mt-4 flex gap-3">
                    <button
                      type="button"
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20"
                      onClick={() => openVoidReturnModal(selectedSale, 'void')}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Void
                    </button>
                    <button
                      type="button"
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-500/20"
                      onClick={() => openVoidReturnModal(selectedSale, 'return')}
                    >
                      <AlertTriangle className="h-4 w-4" />
                      Return
                    </button>
                  </div>
                )}

                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-light)]"
                    onClick={() => handlePrintSaleReceipt(selectedSale)}
                  >
                    <Printer className="h-4 w-4" />
                    Print
                  </button>
                  <button
                    type="button"
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-light)]"
                    onClick={() => handlePrintSaleReceipt(selectedSale)}
                  >
                    <Download className="h-4 w-4" />
                    Download / PDF
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {voidReturnModal.open && voidReturnModal.sale && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          onClick={closeVoidReturnModal}
        >
          <div 
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[var(--text-light)]">
                {voidReturnModal.mode === 'void' ? 'Void Transaction' : 'Return Items'}
              </h3>
              <button 
                onClick={closeVoidReturnModal}
                className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-primary)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/50 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Receipt #</span>
                <span className="font-semibold text-[var(--text-light)]">{voidReturnModal.sale.sale_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Customer</span>
                <span className="text-[var(--text-light)]">{voidReturnModal.sale.customer_name || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Total</span>
                <span className="font-semibold text-[var(--gold-primary)]">{formatCurrency(Number(voidReturnModal.sale.total_amount || 0))}</span>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-sm font-semibold text-[var(--text-light)]">Items</p>
              <div className="mt-2 space-y-2">
                {(voidReturnModal.sale.items || []).filter((item) => item.product_id).map((item) => (
                  <div key={item.item_id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/50 p-3">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--text-light)]">{item.item_name}</p>
                        <p className="text-xs text-[var(--text-muted)]">Qty: {item.quantity} - {formatCurrency(Number(item.unit_price || 0))} each</p>
                      </div>
                      <span className="text-sm font-semibold text-[var(--text-light)]">{formatCurrency(Number(item.subtotal || 0))}</span>
                    </div>
                    {voidReturnModal.mode === 'return' && (
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setVoidReturnConditions((prev) => ({ ...prev, [item.item_id]: 'resalable' }))}
                          className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold ${voidReturnConditions[item.item_id] === 'resalable' ? 'bg-green-500/20 text-green-300 border border-green-500/40' : 'border border-[var(--border)] text-[var(--text-muted)]'}`}
                        >
                          Perfect / Resalable
                        </button>
                        <button
                          type="button"
                          onClick={() => setVoidReturnConditions((prev) => ({ ...prev, [item.item_id]: 'damaged' }))}
                          className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold ${voidReturnConditions[item.item_id] === 'damaged' ? 'bg-red-500/20 text-red-300 border border-red-500/40' : 'border border-[var(--border)] text-[var(--text-muted)]'}`}
                        >
                          Damaged / Not Resalable
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                Reason <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={3}
                value={voidReturnReason}
                onChange={(event) => setVoidReturnReason(event.target.value)}
                placeholder={voidReturnModal.mode === 'void' ? 'Why is this transaction being voided?' : 'Why is this transaction being returned?'}
                className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-light)]"
              />
            </div>

            <div className="mt-4 rounded-xl border border-[var(--gold-primary)]/30 bg-[var(--gold-primary)]/10 p-3 text-sm">
              <p className="font-semibold text-[var(--gold-primary)]">Expected Inventory Adjustment</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {expectedRestockCount > 0
                  ? `${expectedRestockCount} unit${expectedRestockCount === 1 ? '' : 's'} will be added back to available inventory.`
                  : 'No items will be restocked. All returned items will be recorded as damaged/not resalable.'}
              </p>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={closeVoidReturnModal}
                className="flex-1 rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-light)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleVoidReturn}
                disabled={voidReturnSubmitting}
                className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${voidReturnModal.mode === 'void' ? 'bg-red-500/80 hover:bg-red-500' : 'bg-amber-500/80 hover:bg-amber-500'}`}
              >
                {voidReturnSubmitting ? 'Processing...' : voidReturnModal.mode === 'void' ? 'Confirm Void' : 'Confirm Return'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

