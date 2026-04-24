import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { Package, Search, X, Printer, Download, ArrowUpDown, Grid3X3, List } from 'lucide-react'
import { posApi } from '../../utils/posApi'
import { formatCurrency } from '../../utils/formatCurrency'
import { useSmartPolling } from '../../hooks/useSmartPolling'

function EmptyState({ icon: Icon, label, description }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] py-16 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10">
        <Icon className="h-7 w-7 text-cyan-300" />
      </div>
      <p className="font-semibold text-white">{label}</p>
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
  const tax = subtotal * 0.12
  const total = subtotal + tax
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

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">{heading}</h3>
            <p className="text-sm text-[var(--text-muted)]">{description}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:w-auto">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/60 px-4 py-2.5">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">Today</p>
              <p className="text-sm font-semibold text-white">{formatCurrency(Number(dailySummary?.total_sales || 0))}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/60 px-4 py-2.5">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">Sales</p>
              <p className="text-sm font-semibold text-white">{Number(dailySummary?.total_transactions || 0)} today</p>
            </div>
          </div>
        </div>
      </div>

        <div className="grid gap-6 xl:grid-cols-[1.35fr,0.95fr]">
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Total Products</p>
                <p className="mt-2 text-2xl font-bold text-white">{visibleInventory.length}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Categories</p>
                <p className="mt-2 text-2xl font-bold text-white">{categoryOptions.length}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Transactions</p>
                <p className="mt-2 text-2xl font-bold text-white">{Number(dailySummary?.total_transactions || 0)}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Cart Items</p>
                <p className="mt-2 text-2xl font-bold text-white">{cart.reduce((acc, item) => acc + Number(item.quantity || 0), 0)}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-5">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-lg font-semibold text-white">All Products</h4>
                <button
                  type="button"
                  onClick={() => { setCategoryFilter('all'); setSearchQuery('') }}
                  className="text-xs font-semibold text-cyan-300 hover:text-cyan-200"
                >
                  See all
                </button>
              </div>

              <div className="mb-4 flex flex-wrap items-center gap-2 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setCategoryFilter('all')}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${categoryFilter === 'all' ? 'bg-cyan-500 text-black' : 'border border-[var(--border)] text-[var(--text-muted)] hover:text-white'}`}
                >
                  All
                </button>
                {categoryOptions.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategoryFilter(cat.value)}
                    className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${categoryFilter === cat.value ? 'bg-cyan-500 text-black' : 'border border-[var(--border)] text-[var(--text-muted)] hover:text-white'}`}
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
                    className="w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] py-2.5 pl-9 pr-8 text-sm text-white"
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
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] py-2.5 pl-9 pr-4 text-sm text-white"
                  />
                </div>

                <div className="flex overflow-hidden rounded-xl border border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setCatalogView('grid')}
                    className={`px-3 py-2 ${catalogView === 'grid' ? 'bg-cyan-500 text-black' : 'bg-[var(--bg-primary)] text-[var(--text-muted)] hover:text-white'}`}
                    title="Grid view"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatalogView('list')}
                    className={`px-3 py-2 ${catalogView === 'list' ? 'bg-cyan-500 text-black' : 'bg-[var(--bg-primary)] text-[var(--text-muted)] hover:text-white'}`}
                    title="List view"
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>

                <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300">
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
                        <p className="truncate text-sm font-semibold text-white">{item.name}</p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">{item.sku || 'No SKU'} - {item.stock} in stock</p>
                        <p className="mt-2 text-sm font-bold text-cyan-300">{formatCurrency(Number(item.price || 0))}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addToCart(item)}
                        className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-cyan-400"
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
              <h4 className="text-lg font-semibold text-white">Order Summary</h4>
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
                          <p className="truncate text-sm font-semibold text-white">{item.name}</p>
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
                          <span className="min-w-[1.75rem] text-center text-sm font-semibold text-white">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product_id, item.quantity + 1, item.stock)}
                            className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-muted)]"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-sm font-semibold text-white">{formatCurrency(Number(item.price || 0) * item.quantity)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-4 text-sm">
                <div className="flex justify-between text-[var(--text-muted)]"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                <div className="flex justify-between text-[var(--text-muted)]"><span>Tax 12%</span><span>{formatCurrency(tax)}</span></div>
                <div className="flex justify-between text-base font-bold text-white"><span>Total</span><span className="text-cyan-300">{formatCurrency(total)}</span></div>
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
                    className={`rounded-lg px-3 py-2 text-xs font-semibold ${paymentMethod === method ? 'bg-cyan-500 text-black' : 'border border-[var(--border)] text-[var(--text-muted)] hover:text-white'}`}
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
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-white"
                />
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  placeholder="Phone"
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-white"
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
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-white"
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
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-white"
                  />
                </div>
              )}

              <textarea
                rows={2}
                value={saleNotes}
                onChange={(event) => setSaleNotes(event.target.value)}
                placeholder="Notes"
                className="mt-3 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-white"
              />

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text-muted)] hover:text-white"
                  onClick={() => window.print()}
                >
                  <Printer className="h-4 w-4" />
                  Print
                </button>
                <button
                  type="button"
                  onClick={completeSale}
                  disabled={submitting || cart.length === 0}
                  className="rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {submitting ? 'Saving...' : 'Place Order'}
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-white">Recent Orders</h4>
                  <p className="text-xs text-[var(--text-muted)]">Latest POS transactions</p>
                </div>
                <button
                  type="button"
                  onClick={loadRecentSales}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-white"
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
                      className="cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/60 p-3 hover:border-cyan-500/50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{entry.sale_number}</p>
                          <p className="text-xs text-[var(--text-muted)]">{entry.customer_name || 'Walk-in customer'} - {new Date(entry.created_at).toLocaleString()}</p>
                        </div>
                        <StatusBadge
                          label={String(entry.status || 'pending').replace(/_/g, ' ')}
                          variant={String(entry.status || '').toLowerCase() === 'completed' ? 'success' : 'warning'}
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-[var(--text-muted)]">{entry.item_count} items - {String(entry.payment_method || '').replace(/_/g, ' ')}</span>
                        <span className="font-semibold text-cyan-300">{formatCurrency(Number(entry.total_amount || 0))}</span>
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
              <h3 className="text-lg font-semibold text-white">Receipt</h3>
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
                    <span className="font-semibold text-white">{selectedSale.sale_number}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-muted)]">Date</span>
                    <span className="text-white">{new Date(selectedSale.created_at).toLocaleString()}</span>
                  </div>
                  {selectedSale.customer_name && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--text-muted)]">Customer</span>
                      <span className="text-white">{selectedSale.customer_name}</span>
                    </div>
                  )}
                  {selectedSale.customer_phone && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--text-muted)]">Contact</span>
                      <span className="text-white">{selectedSale.customer_phone}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-2">
                  <p className="text-sm font-semibold text-white">Items</p>
                  {(selectedSale.items || []).map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <div className="flex-1 text-[var(--text-muted)]">
                        <span className="text-white">{item.item_name}</span>
                        <span className="ml-2">x{item.quantity}</span>
                      </div>
                      <span className="text-white">{formatCurrency(Number(item.subtotal || 0))}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-muted)]">Subtotal</span>
                    <span className="text-white">{formatCurrency(Number(selectedSale.subtotal || 0))}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-muted)]">Tax</span>
                    <span className="text-white">{formatCurrency(Number(selectedSale.tax_amount || 0))}</span>
                  </div>
                  <div className="flex justify-between text-base font-semibold">
                    <span className="text-white">Total</span>
                    <span className="text-cyan-300">{formatCurrency(Number(selectedSale.total_amount || 0))}</span>
                  </div>
                </div>

                <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-muted)]">Payment Method</span>
                    <span className="text-white capitalize">{String(selectedSale.payment_method || '').replace(/_/g, ' ')}</span>
                  </div>
                  {selectedSale.reference_number && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--text-muted)]">Reference</span>
                      <span className="text-white">{selectedSale.reference_number}</span>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-muted)] hover:text-white"
                    onClick={() => window.print()}
                  >
                    <Printer className="h-4 w-4" />
                    Print
                  </button>
                  <button
                    type="button"
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-muted)] hover:text-white"
                    onClick={() => {
                      const content = document.getElementById('receipt-content')
                      if (content) {
                        const printWindow = window.open('', '_blank')
                        printWindow.document.write(content.innerHTML)
                        printWindow.document.close()
                        printWindow.print()
                      }
                    }}
                  >
                    <Download className="h-4 w-4" />
                    Download
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

