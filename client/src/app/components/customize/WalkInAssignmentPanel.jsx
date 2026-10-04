import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { adminApi } from '../../utils/adminApi.js'
import { exportMaskedPreview } from '../../utils/exportMaskedPreview.js'

export function WalkInAssignmentPanel({ config, summary, pricingBreakdown, lineItems, stickers, price, guitarType, previewRef, capturePreviewImages, loadingPrices, onNewBuild, storageScope = '', onBusyChange, onAssigned }) {
  const { user } = useAuth()
  const canAssign = ['staff', 'admin', 'super_admin'].includes(user?.role)
  const storageKey = `cosmoscraft.walkIn.${user?.user_id || user?.id}.${guitarType}.${storageScope}`
  const [search, setSearch] = useState('')
  const [customers, setCustomers] = useState([])
  const [customer, setCustomer] = useState(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [customerError, setCustomerError] = useState('')
  const [retry, setRetry] = useState(0)
  const [busy, setBusy] = useState(false)
  const [assigned, setAssigned] = useState(false)
  const [message, setMessage] = useState('')
  const pending = useRef(null)
  const inFlight = useRef(false)

  useEffect(() => {
    if (!canAssign) return
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null')
      pending.current = saved?.payload || null
      setCustomer(saved?.customer || null)
      setAssigned(Boolean(saved?.assigned))
    } catch { /* A new request can be created when no pending assignment exists. */ }
  }, [canAssign, storageKey])

  useEffect(() => {
    if (!canAssign) return
    let active = true
    setLoadingCustomers(true)
    setCustomerError('')
    const timer = setTimeout(async () => {
      try {
        const result = await adminApi.getWalkInCustomers({ search, page })
        if (active) {
          setCustomers(result.data?.users || [])
          setHasMore(Boolean(result.data?.hasMore))
        }
      } catch (error) {
        if (active) { setCustomers([]); setCustomerError(error.message) }
      } finally {
        if (active) setLoadingCustomers(false)
      }
    }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [canAssign, search, page, retry])

  if (!canAssign) return null

  const assign = async () => {
    if (!canAssign || !customer || assigned || inFlight.current || loadingPrices) return
    inFlight.current = true
    setBusy(true)
    onBusyChange?.(true)
    setMessage('')
    try {
      if (!pending.current) {
        const previews = capturePreviewImages ? await capturePreviewImages(config, stickers, {scale:1}) : null
        const preview_image = previews?.front || await exportMaskedPreview(previewRef.current, { download: false, scale: 1, background: '#141414' })
        const payload = {
          customer_id: customer.user_id, customization_id: crypto.randomUUID(), quantity: 1,
          design: {
            name: `${summary.body || 'Custom'} build`, guitar_type: guitarType,
            total_price: price, body_wood: summary.bodyWood || null,
            neck_wood: summary.neck || null, fingerboard_wood: summary.fretboard || null,
            bridge_type: summary.bridge || null, pickups: summary.pickups || null,
            color: summary.bodyFinish || null, finish_type: summary.finishType || null,
            config_json: previews ? { ...config, _previewImages: previews } : config, stickers, preview_image, summary, pricingBreakdown,
            lineItems: [
              { id: 'base', category: 'Base', name: 'Starting Price', unitPrice: pricingBreakdown.base || 0, quantity: 1, subtotal: pricingBreakdown.base || 0 },
              ...lineItems.filter(item => item.id !== 'base'),
              ...stickers.filter(sticker => !lineItems.some(item => item.id === sticker.id)).map((sticker, index) => ({
                id: sticker.id, category: 'Stickers', name: `Sticker #${index + 1}`,
                unitPrice: Number.isFinite(Number(sticker.price)) ? Number(sticker.price) : 100, quantity: 1, subtotal: Number.isFinite(Number(sticker.price)) ? Number(sticker.price) : 100,
              })),
            ],
          },
        }
        // Persist before sending: a lost response or refresh retries the same customer and UUID.
        sessionStorage.setItem(storageKey, JSON.stringify({ payload, customer }))
        pending.current = payload
      }
      await adminApi.assignWalkInCustomization(pending.current)
      sessionStorage.setItem(storageKey, JSON.stringify({ payload: pending.current, customer, assigned: true }))
      setAssigned(true)
      setMessage(`Sent to ${customer.first_name} ${customer.last_name} (${customer.email}). The design is ready in their Saved Builds.`)
      onAssigned?.(customer, pending.current.design)
    } catch (error) {
      if (error.status === 400) {
        pending.current = null
        sessionStorage.removeItem(storageKey)
      }
      setMessage(error.message || 'Unable to send this design. Please try again.')
    } finally {
      inFlight.current = false
      setBusy(false)
      onBusyChange?.(false)
    }
  }

  return (
    <div className="border-t border-[var(--border)] p-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-[#d4af37]">Walk-In Customer</h3>
      {!customer && (
        <>
          <input aria-label="Search registered customers" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search customer name or email" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-2 text-sm" />
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-left text-sm" aria-label="Registered walk-in customers" aria-busy={loadingCustomers}>
              <thead className="bg-[var(--surface-elevated)] text-[var(--text-muted)]">
                <tr><th scope="col" className="p-3">Customer</th><th scope="col" className="p-3">Email</th><th scope="col" className="p-3">Action</th></tr>
              </thead>
              <tbody>
                {loadingCustomers ? <tr><td colSpan={3} className="p-5 text-center text-[var(--text-muted)]">Loading customers...</td></tr>
                  : customerError ? <tr><td colSpan={3} className="p-5 text-center"><p role="alert">{customerError}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="mt-2 text-[#d4af37]">Retry</button></td></tr>
                  : customers.length === 0 ? <tr><td colSpan={3} className="p-5 text-center text-[var(--text-muted)]">No eligible customers found.</td></tr>
                  : customers.map(account => (
                    <tr key={account.user_id} className="border-t border-[var(--border)] hover:bg-white/5">
                      <td className="p-3">{account.first_name} {account.last_name}</td>
                      <td className="p-3 break-all">{account.email}</td>
                      <td className="p-3"><button type="button" aria-label={`Select ${account.first_name} ${account.last_name}`} onClick={() => setCustomer(account)} className="rounded-lg border border-[#d4af37]/40 px-3 py-1.5 text-[#d4af37] hover:bg-[#d4af37]/10">Select</button></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <button type="button" disabled={page === 1 || loadingCustomers} onClick={() => setPage(value => value - 1)} className="rounded border border-[var(--border)] px-3 py-2 disabled:opacity-40">Previous</button>
            <span>Page {page}</span>
            <button type="button" disabled={!hasMore || loadingCustomers || Boolean(customerError)} onClick={() => setPage(value => value + 1)} className="rounded border border-[var(--border)] px-3 py-2 disabled:opacity-40">Next</button>
          </div>
        </>
      )}
      {customer && (
        <div className="text-xs text-[var(--text-light)] space-y-1">
          <p className="font-semibold">{customer.first_name} {customer.last_name}</p>
          <p className="break-all text-[var(--text-muted)]">{customer.email}</p>
          {!pending.current && !busy && <button type="button" className="text-[#d4af37]" onClick={() => setCustomer(null)}>Change customer</button>}
        </div>
      )}
      <p className="text-xs text-[var(--text-muted)]">Total: ₱{((pending.current?.design.total_price ?? price) * (pending.current?.quantity || 1)).toLocaleString('en-PH')}</p>
      <button type="button" disabled={!customer || busy || assigned || loadingPrices} onClick={assign} className="w-full rounded-lg bg-[#d4af37] px-3 py-2.5 text-sm font-semibold text-black disabled:opacity-50">
        {busy ? 'Sending…' : assigned ? 'Sent to Customer' : pending.current ? 'Retry Send' : 'Send to Customer'}
      </button>
      {pending.current && !assigned && <p className="text-xs text-[var(--text-muted)]">Retry sends the original design to the selected customer.</p>}
      {message && <p role="status" className="text-xs text-[var(--text-muted)]">{message}</p>}
      {assigned && <button type="button" className="text-xs text-[#d4af37]" onClick={() => {
        sessionStorage.removeItem(storageKey)
        pending.current = null
        setAssigned(false); setCustomer(null); setMessage('')
        onNewBuild()
      }}>Start another walk-in design</button>}
    </div>
  )
}
