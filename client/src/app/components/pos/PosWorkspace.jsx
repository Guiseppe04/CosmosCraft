import { useCallback, useEffect, useMemo, useState } from 'react'
import { Package, Plus, Search, UserRound, Wallet, X } from 'lucide-react'
import { posApi } from '../../utils/posApi'
import { formatCurrency } from '../../utils/formatCurrency'

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
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [openingCash, setOpeningCash] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
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

  const catalog = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return visibleInventory
      .filter((item) => {
        if (!query) return true
        return String(item.name || '').toLowerCase().includes(query) || String(item.sku || '').toLowerCase().includes(query)
      })
      .slice(0, 24)
  }, [searchQuery, visibleInventory])

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0),
    [cart]
  )
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
    } catch (error) {
      showToast?.(error.message, 'error')
    } finally {
      setLoadingRecent(false)
    }
  }, [showToast])

  useEffect(() => {
    loadRecentSales()
  }, [loadRecentSales])

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
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">{heading}</h3>
          <p className="text-sm text-[var(--text-muted)]">{description}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-muted)]">Today</p>
            <p className="mt-2 text-2xl font-bold text-white">{formatCurrency(Number(dailySummary?.total_sales || 0))}</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{Number(dailySummary?.total_transactions || 0)} completed sales</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-muted)]">Drawer</p>
            <p className="mt-2 text-2xl font-bold text-white">{drawerOpen ? 'Open' : 'Closed'}</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {drawerOpen ? `Float ${formatCurrency(Number(openingCash || 0))}` : 'Open the drawer to begin'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Cash drawer</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">This page replaces the old overlay flow and records completed sales to the database.</p>
        </div>
        {!drawerOpen ? (
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <input
              type="number"
              min="0"
              value={openingCash}
              onChange={(event) => setOpeningCash(event.target.value)}
              placeholder="Opening cash"
              className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-2.5 text-white"
            />
            <button
              type="button"
              onClick={() => {
                setDrawerOpen(true)
                showToast?.(`Drawer opened with ${formatCurrency(Number(openingCash || 0))}`)
              }}
              className="rounded-2xl bg-gradient-to-r from-cyan-500 to-sky-500 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Open drawer
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDrawerOpen(false)
              setOpeningCash('')
              resetSaleForm()
              showToast?.('Drawer closed')
            }}
            className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300"
          >
            Close drawer
          </button>
        )}
      </div>

      {!drawerOpen ? (
        <EmptyState icon={Wallet} label="POS drawer is closed" description="Open the drawer to start walk-in sales." />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-6">
              <div className="mb-4 flex items-center gap-3">
                <Search className="h-4 w-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search products by name or SKU"
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-2.5 text-white"
                />
              </div>

              {catalog.length === 0 ? (
                <EmptyState icon={Package} label="No sellable products found" description="Try another search term." />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {catalog.map((item) => (
                    <button
                      key={item.product_id}
                      type="button"
                      onClick={() => addToCart(item)}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)]/60 p-4 text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{item.name}</p>
                          <p className="mt-1 text-sm text-[var(--text-muted)]">{item.sku || 'No SKU'} · {item.stock} in stock</p>
                        </div>
                        <Plus className="h-4 w-4 text-cyan-300" />
                      </div>
                      <p className="mt-4 font-semibold text-cyan-300">{formatCurrency(Number(item.price || 0))}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-6">
              <div className="mb-4 flex items-center gap-3">
                <UserRound className="h-4 w-4 text-[var(--text-muted)]" />
                <h4 className="font-semibold text-white">Customer and payment details</h4>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <input
                  type="text"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Customer name"
                  className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3 text-white"
                />
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  placeholder="Customer phone"
                  className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3 text-white"
                />
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {[
                  ['cash', 'Cash'],
                  ['gcash', 'GCash'],
                  ['bank_transfer', 'Bank Transfer'],
                ].map(([method, label]) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold ${paymentMethod === method ? 'bg-cyan-500 text-black' : 'border border-[var(--border)] text-[var(--text-muted)]'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {paymentMethod === 'cash' ? (
                <div className="mt-4">
                  <input
                    type="number"
                    min="0"
                    value={cashReceived}
                    onChange={(event) => setCashReceived(event.target.value)}
                    placeholder="Cash received"
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3 text-white"
                  />
                  <p className="mt-2 text-sm text-[var(--text-muted)]">Change: {formatCurrency(change)}</p>
                </div>
              ) : (
                <div className="mt-4">
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(event) => setReferenceNumber(event.target.value)}
                    placeholder="Reference number"
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3 text-white"
                  />
                </div>
              )}

              <textarea
                rows={3}
                value={saleNotes}
                onChange={(event) => setSaleNotes(event.target.value)}
                placeholder="Sale notes"
                className="mt-4 w-full resize-none rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3 text-white"
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-6">
              <h4 className="font-semibold text-white">Current cart</h4>
              {cart.length === 0 ? (
                <p className="mt-4 text-sm text-[var(--text-muted)]">Add items from the catalog to begin a sale.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {cart.map((item) => (
                    <div key={item.product_id} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)]/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{item.name}</p>
                          <p className="mt-1 text-sm text-[var(--text-muted)]">{formatCurrency(Number(item.price || 0))} each</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.product_id, 0, item.stock)}
                          className="rounded-xl p-1 text-red-300"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product_id, item.quantity - 1, item.stock)}
                            className="rounded-xl border border-[var(--border)] px-3 py-1 text-sm text-[var(--text-muted)]"
                          >
                            -
                          </button>
                          <span className="min-w-[2rem] text-center font-semibold text-white">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product_id, item.quantity + 1, item.stock)}
                            className="rounded-xl border border-[var(--border)] px-3 py-1 text-sm text-[var(--text-muted)]"
                          >
                            +
                          </button>
                        </div>
                        <span className="font-semibold text-white">{formatCurrency(Number(item.price || 0) * item.quantity)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 space-y-2 border-t border-[var(--border)] pt-4">
                <div className="flex justify-between text-sm text-[var(--text-muted)]"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                <div className="flex justify-between text-sm text-[var(--text-muted)]"><span>Tax</span><span>{formatCurrency(tax)}</span></div>
                <div className="flex justify-between text-lg font-semibold text-white"><span>Total</span><span>{formatCurrency(total)}</span></div>
              </div>

              <button
                type="button"
                onClick={completeSale}
                disabled={submitting || cart.length === 0}
                className="mt-6 w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-sky-500 px-4 py-3 font-semibold text-white disabled:opacity-60"
              >
                {submitting ? 'Saving sale...' : 'Complete sale'}
              </button>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-white">Recent POS activity</h4>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">Latest sales pulled from the database.</p>
                </div>
                <button
                  type="button"
                  onClick={loadRecentSales}
                  className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-muted)] hover:text-white"
                >
                  Refresh
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {loadingRecent ? (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)]/40 px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                    Loading recent sales...
                  </div>
                ) : recentSales.length === 0 ? (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)]/40 px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                    No POS sales recorded yet.
                  </div>
                ) : (
                  recentSales.map((entry) => (
                    <div key={entry.sale_id} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)]/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{entry.sale_number}</p>
                          <p className="mt-1 text-sm text-[var(--text-muted)]">
                            {entry.customer_name || 'Walk-in customer'} · {new Date(entry.created_at).toLocaleString()}
                          </p>
                        </div>
                        <StatusBadge
                          label={String(entry.status || 'pending').replace(/_/g, ' ')}
                          variant={String(entry.status || '').toLowerCase() === 'completed' ? 'success' : 'warning'}
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-sm text-[var(--text-muted)]">{entry.item_count} items · {String(entry.payment_method || '').replace(/_/g, ' ')}</span>
                        <span className="font-semibold text-cyan-300">{formatCurrency(Number(entry.total_amount || 0))}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
