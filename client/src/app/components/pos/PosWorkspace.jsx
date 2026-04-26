import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { Package, Search, X, Printer, Download, ArrowUpDown, Grid3X3, List } from 'lucide-react'
import { posApi } from '../../utils/posApi'
import { formatCurrency } from '../../utils/formatCurrency'
import { useSmartPolling } from '../../hooks/useSmartPolling'

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
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'N/A'
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function buildPosReceiptHtml(sale) {
  const createdAt = formatDateTime(sale?.created_at)
  const saleNumber = escapeHtml(sale?.sale_number || 'N/A')
  const customerName = escapeHtml(sale?.customer_name || 'Walk-in customer')
  const customerPhone = escapeHtml(sale?.customer_phone || 'N/A')
  const paymentMethod = escapeHtml(String(sale?.payment_method || 'cash').replace(/_/g, ' '))
  const referenceNumber = escapeHtml(sale?.reference_number || 'N/A')
  const notes = escapeHtml(sale?.notes || '')
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
  const items = Array.isArray(sale?.items) ? sale.items : []

  const rows = items.map((item) => {
    const name = escapeHtml(item?.item_name || item?.name || 'Item')
    const qty = Number(item?.quantity || 0)
    const unitPrice = Number(item?.unit_price || item?.price || 0)
    const lineTotal = Number(item?.subtotal || (qty * unitPrice))
    return `
      <tr>
        <td>${name}</td>
        <td class="num">${qty}</td>
        <td class="num">${escapeHtml(formatCurrency(unitPrice))}</td>
        <td class="num">${escapeHtml(formatCurrency(lineTotal))}</td>
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
          :root { color-scheme: light; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 24px;
            background: #f3f4f6;
            color: #111827;
            font-family: Arial, Helvetica, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .sheet {
            max-width: 820px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            padding: 26px;
          }
          .header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 24px;
            margin-bottom: 18px;
          }
          .brand {
            border: 2px solid #111827;
            padding: 10px 14px;
            font-weight: 700;
            letter-spacing: 0.2em;
            text-transform: uppercase;
            font-size: 12px;
            line-height: 1.3;
          }
          .invoice h1 {
            margin: 0;
            font-size: 28px;
            line-height: 1.1;
          }
          .meta-grid {
            margin-top: 10px;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px 24px;
            font-size: 12px;
          }
          .meta-label {
            color: #6b7280;
            display: block;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin-bottom: 2px;
          }
          .parties {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
            margin: 18px 0 14px;
            font-size: 12px;
          }
          .party {
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            padding: 10px 12px;
          }
          .party h4 {
            margin: 0 0 8px;
            font-size: 11px;
            color: #6b7280;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 6px;
          }
          thead th {
            text-align: left;
            font-size: 11px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #6b7280;
            background: #f3f4f6;
            padding: 8px 10px;
          }
          tbody td {
            border-bottom: 1px solid #e5e7eb;
            padding: 10px;
            font-size: 13px;
          }
          .num { text-align: right; }
          .summary {
            margin-top: 14px;
            margin-left: auto;
            width: 280px;
            font-size: 13px;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
          }
          .summary-total {
            font-weight: 700;
            font-size: 15px;
            border-top: 1px solid #d1d5db;
            margin-top: 6px;
            padding-top: 8px;
          }
          .notes {
            margin-top: 18px;
            border-top: 1px solid #e5e7eb;
            padding-top: 12px;
            font-size: 12px;
            color: #4b5563;
          }
          @media print {
            body { background: #fff; padding: 0; }
            .sheet { max-width: none; border: 0; border-radius: 0; padding: 18px 22px; }
          }
        </style>
      </head>
      <body>
        <main class="sheet">
          <section class="header">
            <div class="brand">Cosmos<br/>Craft</div>
            <div class="invoice">
              <h1>Invoice ${saleNumber}</h1>
              <div class="meta-grid">
                <div><span class="meta-label">Issue Date</span>${escapeHtml(createdAt)}</div>
                <div><span class="meta-label">Payment</span>${paymentMethod}</div>
                <div><span class="meta-label">Reference</span>${referenceNumber}</div>
                <div><span class="meta-label">Phone</span>${customerPhone}</div>
              </div>
            </div>
          </section>

          <section class="parties">
            <div class="party">
              <h4>From</h4>
              <div><strong>Cosmos Craft</strong></div>
              <div>POS Counter</div>
              <div>Capstone Workshop</div>
            </div>
            <div class="party">
              <h4>To</h4>
              <div><strong>${customerName}</strong></div>
              <div>${customerPhone}</div>
            </div>
          </section>

          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th class="num">Qty</th>
                <th class="num">Unit Price</th>
                <th class="num">Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="4">No items</td></tr>'}
            </tbody>
          </table>

          <section class="summary">
            <div class="summary-row"><span>Subtotal</span><span>${escapeHtml(formatCurrency(subtotal))}</span></div>
            <div class="summary-row"><span>Tax</span><span>${escapeHtml(formatCurrency(taxAmount))}</span></div>
            <div class="summary-row summary-total"><span>Total</span><span>${escapeHtml(formatCurrency(totalAmount))}</span></div>
            ${isCashPayment && cashReceived != null ? `<div class="summary-row"><span>Cash Received</span><span>${escapeHtml(formatCurrency(cashReceived))}</span></div>` : ''}
            ${isCashPayment && changeAmount != null ? `<div class="summary-row"><span>Change</span><span>${escapeHtml(formatCurrency(changeAmount))}</span></div>` : ''}
          </section>

          <section class="notes">
            <strong>Notes:</strong> ${notes || 'N/A'}
          </section>
        </main>
      </body>
    </html>
  `
}

export function PosWorkspace({
  inventoryItems = [],
  showToast,
  heading = 'Point of Sale',
  description = 'Create and record walk-in sales.',
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [catalogSort, setCatalogSort] = useState('name_asc')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [catalogView, setCatalogView] = useState('grid')
  const [cashReceived, setCashReceived] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [saleNotes, setSaleNotes] = useState('')
  const [cart, setCart] = useState([])
  const [recentSales, setRecentSales] = useState([])
  const [dailySummary, setDailySummary] = useState(null)
  const [loadingRecent, setLoadingRecent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedSale, setSelectedSale] = useState(null)
  const [loadingSaleDetails, setLoadingSaleDetails] = useState(false)

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

  const resetSaleForm = useCallback(() => {
    setCart([])
    setCashReceived('')
    setCustomerName('')
    setCustomerPhone('')
    setReferenceNumber('')
    setSaleNotes('')
    setPaymentMethod('cash')
  }, [])

  const loadRecentSales = useCallback(async () => {
    setLoadingRecent(true)
    try {
      const [salesRes, summaryRes] = await Promise.all([
        posApi.listSales({ limit: 8 }),
        posApi.getDailySummary(),
      ])
      setRecentSales(normalizeSales(salesRes))
      setDailySummary(summaryRes?.data || null)
      return salesRes
    } catch (error) {
      showToast?.(error.message, 'error')
    } finally {
      setLoadingRecent(false)
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

  const lastSaleTimestampRef = useRef(null)
  const prevSalesRef = useRef(null)

  const pollRecentSales = useCallback(async () => {
    const result = await loadRecentSales()
    if (result?.data?.length > 0) {
      const latestSale = result.data[0]
      const latestTimestamp = latestSale.created_at
      
      if (lastSaleTimestampRef.current && new Date(latestTimestamp) > new Date(lastSaleTimestampRef.current)) {
        lastSaleTimestampRef.current = latestTimestamp
        showToast?.(`New sale: ${latestSale.sale_number}`, 'info')
      } else if (!lastSaleTimestampRef.current) {
        lastSaleTimestampRef.current = latestTimestamp
      }
      prevSalesRef.current = result.data
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

    if (paymentMethod === 'cash' && Number(cashReceived || 0) < total) {
      showToast?.('Cash received is below the total', 'error')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        customerName: customerName.trim() || null,
        customerPhone: customerPhone.trim() || null,
        notes: saleNotes.trim() || null,
        subtotal,
        taxAmount: tax,
        totalAmount: total,
        paymentMethod,
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
  }, [cart, cashReceived, customerName, customerPhone, loadRecentSales, paymentMethod, referenceNumber, resetSaleForm, saleNotes, showToast, subtotal, tax, total])

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
                <button
                  type="button"
                  onClick={() => { setCategoryFilter('all'); setSearchQuery('') }}
                  className="text-xs font-semibold text-[var(--gold-primary)] hover:text-[var(--gold-secondary)]"
                >
                  See all
                </button>
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
                        className="rounded-lg bg-[var(--gold-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--text-dark)] hover:bg-[var(--gold-secondary)]"
                      >
                        Add to cart
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

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {[
                  ['cash', 'Cash'],
                  ['gcash', 'QRIS'],
                  ['bank_transfer', 'Debit Card'],
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
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(event) => setReferenceNumber(event.target.value)}
                    placeholder="Reference number"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-light)]"
                  />
                </div>
              )}

              <textarea
                rows={2}
                value={saleNotes}
                onChange={(event) => setSaleNotes(event.target.value)}
                placeholder="Notes"
                className="mt-3 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-light)]"
              />

              <div className="mt-4">
                <button
                  type="button"
                  onClick={completeSale}
                  disabled={submitting || cart.length === 0}
                  className="w-full rounded-xl bg-gradient-to-r from-[var(--gold-secondary)] to-[var(--gold-primary)] px-4 py-2 text-sm font-semibold text-[var(--text-dark)] disabled:opacity-60"
                >
                  {submitting ? 'Saving...' : 'Place Order'}
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-[var(--text-light)]">Recent Orders</h4>
                  <p className="text-xs text-[var(--text-muted)]">Latest POS transactions</p>
                </div>
                <button
                  type="button"
                  onClick={loadRecentSales}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-light)]"
                >
                  Refresh
                </button>
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
                          <p className="text-xs text-[var(--text-muted)]">{entry.customer_name || 'Walk-in customer'} - {new Date(entry.created_at).toLocaleString()}</p>
                        </div>
                        <StatusBadge
                          label={String(entry.status || 'pending').replace(/_/g, ' ')}
                          variant={String(entry.status || '').toLowerCase() === 'completed' ? 'success' : 'warning'}
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-[var(--text-muted)]">{entry.item_count} items - {String(entry.payment_method || '').replace(/_/g, ' ')}</span>
                        <span className="font-semibold text-[var(--gold-primary)]">{formatCurrency(Number(entry.total_amount || 0))}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

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
                    <span className="text-[var(--text-light)] capitalize">{String(selectedSale.payment_method || '').replace(/_/g, ' ')}</span>
                  </div>
                  {selectedSale.reference_number && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--text-muted)]">Reference</span>
                      <span className="text-[var(--text-light)]">{selectedSale.reference_number}</span>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex gap-3">
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
    </div>
  )
}

