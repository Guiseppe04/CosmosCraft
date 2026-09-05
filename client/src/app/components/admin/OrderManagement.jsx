import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  ShoppingBag, Eye, Edit, Search, Filter,
  Package, CreditCard, RefreshCw, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, Clock, AlertCircle, Loader2, BriefcaseBusiness,
  FileText, Image as ImageIcon, ExternalLink, Save, User,
  History, DollarSign, Trash2, Check, X, Printer, Calendar,
  ArrowUp, ArrowDown, ArrowUpRight, Truck, MapPin, ArrowRight,
} from 'lucide-react'
import { formatCurrency } from '../../utils/formatCurrency'
import { adminApi } from '../../utils/adminApi'
import { buildInvoiceHtml } from '../../utils/invoiceBuilder.js'
import InstallmentTracking from './InstallmentTracking'
import {
  PAYMENT_STATUS_MAP,
  getAllowedPaymentStatuses,
  getPaymentStatusConfig as getOrderPaymentStatusConfig,
  normalizePaymentStatus,
} from '../../utils/orderPaymentStatus'
import { useDebounce } from '../../hooks/useDebounce'

const ORDER_STATUS_LIFECYCLE = [
  { value: 'pending', label: 'Pending', color: '#f59e0b', bgColor: 'bg-amber-500/20', textColor: 'text-amber-400', borderColor: 'border-amber-500/30' },
  { value: 'processing', label: 'Processing', color: '#60a5fa', bgColor: 'bg-blue-500/20', textColor: 'text-blue-400', borderColor: 'border-blue-500/30' },
  { value: 'shipped', label: 'Shipped', color: '#38bdf8', bgColor: 'bg-sky-500/20', textColor: 'text-sky-400', borderColor: 'border-sky-500/30' },
  { value: 'out_for_delivery', label: 'Out for Delivery', color: '#818cf8', bgColor: 'bg-indigo-500/20', textColor: 'text-indigo-400', borderColor: 'border-indigo-500/30' },
  { value: 'delivered', label: 'Delivered', color: '#22c55e', bgColor: 'bg-green-500/20', textColor: 'text-green-400', borderColor: 'border-green-500/30' },
  { value: 'received', label: 'Received', color: '#34d399', bgColor: 'bg-emerald-500/20', textColor: 'text-emerald-400', borderColor: 'border-emerald-500/30' },
  { value: 'cancelled', label: 'Cancelled', color: '#f87171', bgColor: 'bg-red-500/20', textColor: 'text-red-400', borderColor: 'border-red-500/30' },
]

const ORDER_STATUS_MAP = Object.fromEntries(ORDER_STATUS_LIFECYCLE.map(s => [s.value, s]))

const TIMELINE_STEPS = [
  { status: 'pending', label: 'Order Placed', desc: 'Order created, awaiting payment' },
  { status: 'processing', label: 'Processing', desc: 'Payment received, preparing for shipment' },
  { status: 'shipped', label: 'Shipped', desc: 'Order shipped with tracking number' },
  { status: 'out_for_delivery', label: 'Out for Delivery', desc: 'Out for delivery with rider details' },
  { status: 'delivered', label: 'Delivered', desc: 'Successfully delivered to customer' },
  { status: 'received', label: 'Received', desc: 'Customer confirmed receipt' },
]

const ORDER_STATUS_TRANSITIONS = {
  pending: ['processing'],
  processing: ['shipped'],
  shipped: ['out_for_delivery', 'received'],
  out_for_delivery: ['delivered', 'received'],
  delivered: ['received'],
  received: [],
  cancelled: [],
}

const PAGE_SIZE = 10

function getOrderStatusConfig(status) {
  return ORDER_STATUS_MAP[status] || ORDER_STATUS_LIFECYCLE[0]
}

function extractPaymentMethodFromNotes(notes) {
  const match = String(notes || '').match(/Payment Method:\s*([a-z_]+)/i)
  return match?.[1] ? String(match[1]).toLowerCase() : ''
}

function getOrderPaymentMethodCode(order) {
  const rawMethod = (
    order.payment_method
    || order.payment?.method
    || order.payment?.payment_method
    || extractPaymentMethodFromNotes(order.notes)
    || ''
  )
  const methodLower = String(rawMethod).toLowerCase()

  if (methodLower.includes('gcash') || methodLower.includes('g-cash')) return 'gcash'
  if (
    methodLower.includes('bank')
    || methodLower.includes('transfer')
    || methodLower.includes('bdo')
    || methodLower.includes('bpi')
    || methodLower.includes('unionbank')
  ) return 'bank_transfer'
  if (methodLower.includes('cod') || methodLower.includes('cash')) return 'cash'

  return methodLower || 'unknown'
}

function isCashOnDeliveryOrder(order) {
  return getOrderPaymentMethodCode(order) === 'cash'
}

function getOrderPaymentStatusLabel(order) {
  if (isCashOnDeliveryOrder(order)) {
    const normalized = normalizePaymentStatus(order.payment_status || 'pending')
    if (normalized === 'approved') return 'Paid'
    return 'To be paid on delivery'
  }

  const normalized = normalizePaymentStatus(order.payment_status || 'pending')
  return PAYMENT_STATUS_MAP[normalized]?.label || 'Pending'
}

function getPaymentStatusConfig(status, order = null) {
  if (order && isCashOnDeliveryOrder(order)) {
    return {
      ...getOrderPaymentStatusConfig('pending'),
      label: getOrderPaymentStatusLabel(order),
    }
  }

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
  const methodCode = getOrderPaymentMethodCode(order)
  if (methodCode === 'gcash') return 'GCash'
  if (methodCode === 'bank_transfer') return 'Bank Transfer'
  if (methodCode === 'cash') return 'COD'
  if (methodCode === 'unknown') return 'Unknown'
  return String(methodCode).replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
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

function printOrderReceipt(order) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const receiptHtml = buildInvoiceHtml(order)
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
  const discount = Number(order.discount_amount || 0) || 0
  const total = Math.max(subtotal + shipping - discount, 0)
  const customerName = getOrderCustomerName(order)
  const orderAddress = getOrderAddress(order)
  const paymentMethod = getOrderPaymentMethodLabel(order)
  const paymentReference = order.payment?.reference_number || order.payment_reference_number || ''
  const customerPhone = order.contact_phone || order.customer_phone || order.phone || ''
  const createdAt = order.created_at ? new Date(order.created_at) : null
  const receiptDate = createdAt ? createdAt.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'
  const receiptTime = createdAt ? createdAt.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : 'N/A'

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-[var(--gold-primary)]/30 bg-gradient-to-br from-[var(--gold-primary)]/10 via-[var(--bg-primary)]/70 to-[var(--surface-dark)] p-5">
        <div className="mb-5 flex flex-col gap-4 border-b border-[var(--gold-primary)]/20 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gold-primary)]">CosmosCraft</p>
            <h3 className="mt-2 text-2xl font-bold text-white">Shop Invoice</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Invoice #{order.order_number || order.order_id?.slice(0, 8)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => printOrderReceipt(order)}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--gold-primary)] px-4 py-2.5 text-sm font-semibold text-black transition-all hover:shadow-[0_0_20px_rgba(212,175,55,0.3)]"
            >
              <Printer className="h-4 w-4" />
              Print Invoice
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)]/70 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">Customer</p>
            <p className="mt-3 text-lg font-semibold text-white">{customerName}</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{order.email || 'No email provided'}</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{customerPhone || 'No phone provided'}</p>
            {orderAddress !== 'N/A' && (
              <p className="mt-3 text-sm leading-6 text-white">{orderAddress}</p>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)]/70 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">Order</p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[var(--text-muted)]">Date</span>
                <span className="text-right text-white">{receiptDate} {receiptTime}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[var(--text-muted)]">Payment Method</span>
                <span className="text-right text-white">{paymentMethod}</span>
              </div>
              {paymentReference && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[var(--text-muted)]">Reference</span>
                  <span className="text-right text-white">{paymentReference}</span>
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

          {discount > 0 && (
            <div className="border-t border-[var(--border)]/50 px-4 py-4">
              <div className="ml-auto grid w-full max-w-md grid-cols-[minmax(0,1fr)_auto] items-center gap-x-12 text-sm">
                <span className="text-right text-[var(--text-muted)]">Discount</span>
                <span className="text-right font-medium tabular-nums text-white">{formatCurrency(discount)}</span>
              </div>
            </div>
          )}

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

function OrderFulfillmentPanel({ order, onUpdateOrder, onManageProject }) {
  const [fulfillmentData, setFulfillmentData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [adminNotes, setAdminNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  const loadFulfillment = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      let data = null

      if (order.project_id) {
        try {
          const res = await adminApi.getProjectFulfillment(order.project_id)
          data = res?.data || null
        } catch {
          // fall through to search by order_number
        }
      }

      if (!data && (order.order_number || order.order_id)) {
        const res = await adminApi.getFulfillmentRequests({ search: order.order_number || order.order_id })
        data = res?.data?.[0] || null
      }

      setFulfillmentData(data)
      if (data?.admin_notes) {
        setAdminNotes(data.admin_notes)
      }
    } catch (err) {
      console.error('Failed to load fulfillment data:', err)
      setError(err.message || 'Failed to load fulfillment details')
    } finally {
      setLoading(false)
    }
  }, [order.project_id, order.order_number, order.order_id])

  useEffect(() => {
    loadFulfillment()
  }, [loadFulfillment])

  const handleAdvanceStatus = async (targetStatus) => {
    if (!fulfillmentData?.id) return
    try {
      setUpdating(true)
      setError(null)
      setSuccessMessage(null)

      await adminApi.updateFulfillmentStatus(fulfillmentData.id, {
        status: targetStatus,
        admin_notes: adminNotes.trim() || undefined,
      })

      setSuccessMessage(`Fulfillment stage advanced to ${targetStatus.replace(/_/g, ' ')}.`)
      await loadFulfillment()
      onUpdateOrder?.()
    } catch (err) {
      console.error('Failed to update fulfillment status:', err)
      setError(err.message || 'Failed to advance fulfillment stage')
    } finally {
      setUpdating(false)
    }
  }

  const handleSaveNotes = async () => {
    if (!fulfillmentData?.id) return
    try {
      setNotesSaving(true)
      await adminApi.updateFulfillmentStatus(fulfillmentData.id, {
        status: fulfillmentData.status,
        admin_notes: adminNotes.trim() || '',
      })
      setSuccessMessage('Staff notes saved.')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err.message || 'Failed to save staff notes')
    } finally {
      setNotesSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-[var(--text-muted)] space-y-2">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[var(--gold-primary)]" />
        <p className="text-xs">Loading fulfillment details...</p>
      </div>
    )
  }

  const isCompletedBuild =
    Number(order.project_progress || 0) >= 100 ||
    ['fulfillment_pending', 'fulfillment_in_progress', 'fulfilled'].includes(order.customization_status) ||
    fulfillmentData?.status !== 'not_requested'

  const method = fulfillmentData?.fulfillment_method?.includes('delivery') ? 'delivery' : 'pickup'
  const fStatus = fulfillmentData?.status || 'not_requested'
  const addr = fulfillmentData?.delivery_address_snapshot

  // Determine next stage
  let nextStatus = null
  let nextLabel = null

  if (method === 'pickup') {
    if (fStatus === 'requested') {
      nextStatus = 'processing'
      nextLabel = 'Start Processing'
    } else if (fStatus === 'processing') {
      nextStatus = 'ready_for_pickup'
      nextLabel = 'Mark Ready for Pickup'
    } else if (fStatus === 'ready_for_pickup') {
      nextStatus = 'completed'
      nextLabel = 'Confirm Picked Up / Completed'
    }
  } else {
    if (fStatus === 'requested') {
      nextStatus = 'processing'
      nextLabel = 'Start Processing'
    } else if (fStatus === 'processing') {
      nextStatus = 'out_for_delivery'
      nextLabel = 'Mark Out for Delivery'
    } else if (fStatus === 'out_for_delivery') {
      nextStatus = 'completed'
      nextLabel = 'Confirm Delivered / Completed'
    }
  }

  const deliverySteps = [
    { key: 'build', label: 'Build Completed', done: true },
    { key: 'requested', label: 'Requested', done: fStatus !== 'not_requested' },
    { key: 'processing', label: 'Processing', done: ['out_for_delivery', 'completed'].includes(fStatus), active: fStatus === 'processing' },
    { key: 'out_for_delivery', label: 'Out for Delivery', done: fStatus === 'completed', active: fStatus === 'out_for_delivery' },
    { key: 'completed', label: 'Delivered', done: fStatus === 'completed' },
  ]

  const pickupSteps = [
    { key: 'build', label: 'Build Completed', done: true },
    { key: 'requested', label: 'Requested', done: fStatus !== 'not_requested' },
    { key: 'processing', label: 'Processing', done: ['ready_for_pickup', 'completed'].includes(fStatus), active: fStatus === 'processing' },
    { key: 'ready_for_pickup', label: 'Ready for Pickup', done: fStatus === 'completed', active: fStatus === 'ready_for_pickup' },
    { key: 'completed', label: 'Picked Up', done: fStatus === 'completed' },
  ]

  const activeSteps = method === 'delivery' ? deliverySteps : pickupSteps

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-2xl border border-red-500/30 bg-red-500/10 text-xs text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Case 1: Build in progress (<100%) */}
      {!isCompletedBuild && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)]/50 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-400">
              <BriefcaseBusiness className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Custom Build In Progress</h4>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Current progress: {Number(order.project_progress || 0)}%
              </p>
            </div>
          </div>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Fulfillment method selection and fulfillment stages unlock once this custom guitar reaches 100% completion in the project workshop.
          </p>
          {onManageProject && (
            <button
              type="button"
              onClick={() => onManageProject(order)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/20 border border-violet-500/40 text-xs font-bold text-violet-300 hover:bg-violet-500/30 hover:text-white transition-all cursor-pointer"
            >
              <BriefcaseBusiness className="w-4 h-4" />
              View Project Workshop Tasks
            </button>
          )}
        </div>
      )}

      {/* Case 2: Build Complete & Awaiting Customer Selection */}
      {isCompletedBuild && fStatus === 'not_requested' && (
        <div className="rounded-2xl border border-[var(--gold-primary)]/30 bg-[var(--gold-primary)]/5 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[var(--gold-primary)]/20 text-[var(--gold-primary)]">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Custom Build Complete</h4>
              <p className="text-xs text-[var(--gold-primary)] mt-0.5">Awaiting customer fulfillment request</p>
            </div>
          </div>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            The customer has reached 100% build completion and has been prompted to choose between <strong className="text-white">Pickup at Shop</strong> or <strong className="text-white">Shop Delivery</strong>. Once submitted, staff can begin processing the fulfillment.
          </p>
        </div>
      )}

      {/* Case 3: Active Fulfillment Request */}
      {fStatus !== 'not_requested' && fulfillmentData && (
        <div className="space-y-4">
          {/* Method & Status Header Card */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)]/50 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className={`p-2.5 rounded-xl ${
                  method === 'delivery'
                    ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400'
                    : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                }`}>
                  {method === 'delivery' ? <Truck className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider block">
                    Fulfillment Method
                  </span>
                  <h4 className="text-sm font-bold text-white">
                    {method === 'delivery' ? 'Shop Delivery' : 'Pickup at Shop'}
                  </h4>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border ${
                  fStatus === 'completed'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : fStatus === 'requested'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    : 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    fStatus === 'completed' ? 'bg-emerald-400' : fStatus === 'requested' ? 'bg-amber-400' : 'bg-sky-400 animate-pulse'
                  }`} />
                  {fStatus.replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>
            </div>

            {/* Stepper */}
            <div className="pt-2">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {activeSteps.map((step, idx) => (
                  <div
                    key={step.key}
                    className={`p-2 rounded-xl border flex flex-col justify-between text-xs transition-all ${
                      step.done
                        ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                        : step.active
                        ? 'bg-sky-950/30 border-sky-500/40 text-sky-200 ring-1 ring-sky-400/40'
                        : 'bg-white/[0.02] border-white/5 text-white/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-mono opacity-60">0{idx + 1}</span>
                      {step.done ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      ) : step.active ? (
                        <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                      )}
                    </div>
                    <span className="text-[11px] font-bold leading-tight truncate">{step.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Details Card */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)]/50 p-4 space-y-3">
            <h5 className="text-xs uppercase font-bold tracking-wider text-[var(--text-muted)]">
              {method === 'delivery' ? 'Delivery Destination' : 'Workshop Pickup Details'}
            </h5>

            {method === 'delivery' ? (
              addr ? (
                <div className="text-xs text-white/90 space-y-0.5">
                  <p className="font-semibold text-white">{addr.label || 'Customer Delivery Address'}</p>
                  <p>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</p>
                  {addr.barangay && <p>Brgy. {addr.barangay}</p>}
                  <p>{addr.city}, {addr.province} {addr.postal_code || ''}</p>
                  <p className="text-[var(--text-muted)]">{addr.country || 'Philippines'}</p>
                </div>
              ) : (
                <p className="text-xs text-[var(--text-muted)]">
                  Address snapshot not present. Using order shipping address.
                </p>
              )
            ) : (
              <div className="text-xs text-white/90 space-y-1">
                <p className="font-semibold text-white">CosmosCraft Custom Shop Workshop</p>
                <p className="text-[var(--text-muted)]">123 Guitar Artisan Way, Quezon City, Metro Manila</p>
                {fulfillmentData.pickup_scheduled_at && (
                  <p className="text-[var(--gold-primary)] font-semibold mt-1">
                    Scheduled Pickup: {new Date(fulfillmentData.pickup_scheduled_at).toLocaleString('en-PH', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
            )}

            {fulfillmentData.notes && (
              <div className="pt-2 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
                <span className="font-semibold text-white">Customer Request Notes: </span>
                {fulfillmentData.notes}
              </div>
            )}
          </div>

          {/* Staff Notes */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)]/50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase font-bold tracking-wider text-[var(--text-muted)]">
                Internal Staff / Admin Notes
              </label>
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={notesSaving}
                className="text-[11px] font-bold text-[var(--gold-primary)] hover:underline cursor-pointer disabled:opacity-50"
              >
                {notesSaving ? 'Saving...' : 'Save Notes'}
              </button>
            </div>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={2}
              placeholder="Add courier tracking #, rider details, or pickup inspection notes..."
              className="w-full px-3 py-2 bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl text-xs text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--gold-primary)] resize-none"
            />
          </div>

          {/* Next Stage Action */}
          {nextStatus && (
            <div className="pt-2">
              <button
                type="button"
                disabled={updating}
                onClick={() => handleAdvanceStatus(nextStatus)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] px-5 py-3 text-sm font-bold text-black shadow-lg shadow-[var(--gold-primary)]/20 hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer"
              >
                {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {updating ? 'Updating Status...' : nextLabel}
              </button>
            </div>
          )}

          {fStatus === 'completed' && (
            <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-center text-xs font-bold text-emerald-400">
              <CheckCircle className="w-4 h-4 inline mr-1.5" />
              Fulfillment Complete & Order Synchronized
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function OrderDetailsModal({ order, onClose, onUpdatePaymentStatus, onUpdateOrderStatus, onVerifyPayment, onManageProject, user, initialSection = 'details' }) {
  const [activeSection, setActiveSection] = useState(initialSection)
  const isCODOrder = isCashOnDeliveryOrder(order)

  useEffect(() => {
    if (isCODOrder && initialSection === 'payment') {
      setActiveSection('details')
      return
    }
    setActiveSection(initialSection)
  }, [initialSection, isCODOrder, order.order_id])

  const orderStatusConfig = getOrderStatusConfig(order.status || 'pending')
  const paymentConfig = getPaymentStatusConfig(order.payment_status || 'pending', order)

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
          {!isCODOrder && (
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
          )}
          {order.order_type !== 'customization' && (
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
          )}
          {(order.order_type === 'customization' || order.project_id) && (
            <button
              onClick={() => onManageProject?.(order)}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 hover:text-white transition-all inline-flex items-center gap-2 cursor-pointer"
              title="Go to Project Tab & View Project Progress Modal"
            >
              <BriefcaseBusiness className="w-4 h-4" />
              Project Progress
            </button>
          )}
          {(order.order_type === 'customization' || order.project_id) && (
            <button
              onClick={() => setActiveSection('fulfillment')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all inline-flex items-center gap-2 cursor-pointer ${
                activeSection === 'fulfillment'
                  ? 'bg-[var(--gold-primary)] text-black'
                  : 'text-[var(--text-muted)] hover:text-white'
              }`}
            >
              <Truck className="w-4 h-4" />
              Fulfillment
            </button>
          )}
          {order.order_type === 'customization' && (
            <button
              onClick={() => setActiveSection('installment')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeSection === 'installment'
                  ? 'bg-[var(--gold-primary)] text-black'
                  : 'text-[var(--text-muted)] hover:text-white'
              }`}
            >
              <Calendar className="w-4 h-4 inline mr-2" />
              Installment
            </button>
          )}
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

              {order.order_type !== 'customization' && (
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
              )}

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

          {activeSection === 'payment' && !isCODOrder && (
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

          {activeSection === 'installment' && (
            <InstallmentTracking
              orderId={order.order_id}
              order={order}
            />
          )}

          {activeSection === 'fulfillment' && (
            <OrderFulfillmentPanel
              order={order}
              onUpdateOrder={() => {
                if (onUpdateOrderStatus) onUpdateOrderStatus()
              }}
              onManageProject={onManageProject}
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
  const [trackingError, setTrackingError] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const currentStatus = order.status || 'pending'
  const allowedStatuses = ORDER_STATUS_TRANSITIONS[currentStatus] || []
  const requiresTracking = selectedStatus === 'shipped' || selectedStatus === 'out_for_delivery'
  const canSubmit = allowedStatuses.includes(selectedStatus) && (!requiresTracking || trackingInfo.trim())

  useEffect(() => {
    setTrackingInfo('')
    setTrackingError('')
  }, [selectedStatus])

  const handleUpdate = async () => {
    if (requiresTracking && !trackingInfo.trim()) {
      setTrackingError(`${selectedStatus === 'shipped' ? 'Tracking number' : 'Rider details'} is required`)
      return
    }
    setTrackingError('')
    setIsUpdating(true)
    try {
      await onUpdate(order.order_id, selectedStatus, trackingInfo)
    } finally {
      setIsUpdating(false)
      setShowConfirm(false)
    }
  }

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
              const isAllowed = allowedStatuses.includes(status.value)
              return (
                <button
                  key={status.value}
                  type="button"
                  onClick={() => {
                    if (!isAllowed) return
                    setSelectedStatus(status.value)
                  }}
                  disabled={!isAllowed}
                  className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                    isActive
                      ? `${status.bgColor} ${status.textColor} ${status.borderColor}`
                      : isAllowed
                        ? 'bg-[var(--bg-primary)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--gold-primary)]/50'
                        : 'bg-[var(--bg-primary)] border-[var(--border)] text-[var(--text-muted)]/70 font-semibold opacity-60 cursor-not-allowed'
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
              <span className="text-red-400 ml-1">*</span>
            </p>
            <input
              type="text"
              value={trackingInfo}
              onChange={(e) => { setTrackingInfo(e.target.value); setTrackingError('') }}
              placeholder={selectedStatus === 'shipped' ? 'Enter tracking number' : 'Enter rider name & contact'}
              className={`w-full px-4 py-3 bg-[var(--surface-dark)] border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] ${trackingError ? 'border-red-500' : 'border-[var(--border)]'}`}
            />
            {trackingError && (
              <p className="text-red-400 text-xs mt-1">{trackingError}</p>
            )}
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
                disabled={isUpdating || !canSubmit || (requiresTracking && !trackingInfo.trim())}
                className={`flex-1 px-4 py-2 bg-[var(--gold-primary)] rounded-lg text-black text-sm font-medium hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all flex items-center justify-center gap-2 ${
                  (isUpdating || !canSubmit || (requiresTracking && !trackingInfo.trim())) ? 'opacity-50 cursor-not-allowed' : ''
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
            disabled={!canSubmit}
            className={`w-full px-4 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
              canSubmit
                ? 'bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black hover:shadow-[0_0_20px_rgba(212,175,55,0.4)]'
                : 'bg-[var(--surface-dark)] border border-[var(--border)] text-[var(--text-muted)] cursor-not-allowed'
            }`}
          >
            <Save className="w-4 h-4" />
            Update Order Status
          </button>
        )}
        {!allowedStatuses.length && (
          <p className="text-xs text-[var(--text-muted)] mt-3">
                    This order status is final and cannot be moved backward.
          </p>
        )}
      </div>
    </div>
  )
}


export function OrderManagement({ orders, onRefresh, user, pagination, onManageProject, loading = false }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [orderTypeFilter, setOrderTypeFilter] = useState('all')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortField, setSortField] = useState('date')
  const [sortDirection, setSortDirection] = useState('desc')
  const [page, setPage] = useState(1)
  const [isPageLoading, setIsPageLoading] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [selectedSection, setSelectedSection] = useState('details')
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false)
  const [isUpdatingOrder, setIsUpdatingOrder] = useState(false)

  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  const inFlightKeyRef = useRef('')
  const activeRequestIdRef = useRef(0)

  const isDataLoading = Boolean(loading || isPageLoading)
  // Keep the last successful page visible while a new page is loading. Replacing
  // populated rows with skeletons on every poll makes the table look like it is
  // continuously re-downloading.
  const showInitialSkeleton = isDataLoading && orders.length === 0
  const showBackgroundProgress = isDataLoading && orders.length > 0

  const totalPages = Math.max(1, Number(pagination?.totalPages || pagination?.total_pages || pagination?.pages || 1))
  const paginationTotalPagesRef = useRef(totalPages)
  useEffect(() => {
    paginationTotalPagesRef.current = totalPages
  }, [totalPages])

  // Sync page with incoming pagination prop if changed externally
  useEffect(() => {
    if (pagination?.page && pagination.page !== page) {
      setPage(Number(pagination.page))
    }
  }, [pagination?.page])

  const statusCounts = useMemo(() => {
    const counts = { all: pagination?.total || orders.length || 0 }
    orders.forEach(order => {
      const status = order.status || 'pending'
      counts[status] = (counts[status] || 0) + 1
    })
    return counts
  }, [orders, pagination?.total])

  // Summary KPI Metrics
  const summaryMetrics = useMemo(() => {
    let pendingActionCount = 0
    let fulfillmentCount = 0
    let completedCount = 0
    let totalRevenue = 0

    orders.forEach(order => {
      const st = order.status || 'pending'
      const paySt = normalizePaymentStatus(order.payment_status || 'pending')

      if (st === 'pending' || paySt === 'proof_submitted' || paySt === 'under_review') {
        pendingActionCount++
      }
      if (st === 'processing' || st === 'shipped' || st === 'out_for_delivery') {
        fulfillmentCount++
      }
      if (st === 'delivered' || st === 'received') {
        completedCount++
      }
      totalRevenue += getOrderTotal(order)
    })

    return {
      total: pagination?.total || orders.length || 0,
      pending: pendingActionCount,
      fulfillment: fulfillmentCount,
      completed: completedCount,
      revenue: totalRevenue,
    }
  }, [orders, pagination?.total])

  const debouncedSearch = useDebounce(searchQuery, 300)

  // Map UI sort field to API sort params
  const SORT_FIELD_MAP = {
    date: { sort_by: 'created_at' },
    order_number: { sort_by: 'order_number' },
    customer: { sort_by: 'customer_name' },
    total: { sort_by: 'total_amount' },
    status: { sort_by: 'status' },
    payment_status: { sort_by: 'payment_status' },
    order_type: { sort_by: 'order_type' },
    customization: { sort_by: 'customization_name' },
  }

  const buildQuery = useCallback((pageNum = 1) => {
    const params = {
      search: debouncedSearch.trim() ? debouncedSearch.trim() : undefined,
      order_type: orderTypeFilter === 'all' ? undefined : orderTypeFilter,
      status: statusFilter === 'all' ? undefined : statusFilter,
      payment_status: paymentStatusFilter === 'all' ? undefined : paymentStatusFilter,
      payment_method: paymentMethodFilter === 'all' ? undefined : paymentMethodFilter,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      include_items: true,
      page: pageNum,
      page_size: PAGE_SIZE,
      ...(SORT_FIELD_MAP[sortField] || SORT_FIELD_MAP.date),
      sort_dir: sortDirection,
    }
    Object.keys(params).forEach(k => params[k] === undefined && delete params[k])
    return params
  }, [debouncedSearch, orderTypeFilter, statusFilter, paymentStatusFilter, paymentMethodFilter, dateFrom, dateTo, sortField, sortDirection])

  const requestOrdersPage = useCallback(async (targetPage = 1) => {
    const maxPages = Math.max(1, paginationTotalPagesRef.current || 1)
    const safePage = Math.max(1, Math.min(targetPage, maxPages))
    const params = buildQuery(safePage)
    const requestKey = JSON.stringify(params)

    if (inFlightKeyRef.current === requestKey) {
      return
    }

    const requestId = ++activeRequestIdRef.current
    inFlightKeyRef.current = requestKey
    setPage(safePage)
    setIsPageLoading(true)

    try {
      if (onRefreshRef.current) {
        await onRefreshRef.current(params)
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error('[OrderManagement] requestOrdersPage error:', err)
    } finally {
      if (activeRequestIdRef.current === requestId) {
        setIsPageLoading(false)
        inFlightKeyRef.current = ''
      }
    }
  }, [buildQuery])

  // When search or any filter changes, reset to page 1 and fetch
  useEffect(() => {
    setPage(1)
    requestOrdersPage(1)
  }, [debouncedSearch, orderTypeFilter, statusFilter, paymentStatusFilter, paymentMethodFilter, dateFrom, dateTo, sortField, sortDirection, requestOrdersPage])

  const handleUpdatePaymentStatus = async (orderId, newStatus, referenceNumber, notes) => {
    setIsUpdatingPayment(true)
    try {
      await adminApi.updatePaymentStatus(orderId, newStatus, {
        reference_number: referenceNumber,
        notes,
        admin_name: user?.firstName ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}` : user?.email,
        admin_email: user?.email
      })
      onRefresh(buildQuery(page))
      setSelectedOrder(prev => prev ? { ...prev, payment_status: newStatus } : null)
    } catch (error) {
      console.error('Failed to update payment status:', error)
    } finally {
      setIsUpdatingPayment(false)
    }
  }

  const handleUpdateOrderStatus = async (orderId, newStatus, trackingInfo) => {
    setIsUpdatingOrder(true)
    try {
      const order = orders.find(o => o.order_id === orderId)
      const currentStatus = order?.status || 'pending'
      const allowedStatuses = ORDER_STATUS_TRANSITIONS[currentStatus] || []
      if (!allowedStatuses.includes(newStatus)) {
        throw new Error(`Invalid status transition from '${currentStatus}' to '${newStatus}'`)
      }

      const updateData = { status: newStatus }
      if (newStatus === 'shipped' && trackingInfo) {
        updateData.tracking_number = trackingInfo
      }
      if (newStatus === 'out_for_delivery') {
        if (trackingInfo) {
          updateData.rider_name = trackingInfo
        }
      }
      await adminApi.updateOrder(orderId, updateData)
      onRefresh(buildQuery(page))
      setSelectedOrder(prev => prev ? { ...prev, status: newStatus, ...(newStatus === 'shipped' ? { tracking_number: trackingInfo } : {}), ...(newStatus === 'out_for_delivery' ? { rider_name: trackingInfo } : {}) } : null)
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
      onRefresh(buildQuery(page))
      setSelectedOrder(prev => prev ? { ...prev, payment_status: newStatus } : null)
    } catch (error) {
      console.error('Failed to verify payment:', error)
    } finally {
      setIsUpdatingPayment(false)
    }
  }

  const hasActiveFilters = statusFilter !== 'all' || orderTypeFilter !== 'all' || paymentStatusFilter !== 'all' || paymentMethodFilter !== 'all' || !!dateFrom || !!dateTo || !!searchQuery

  const handleClearAllFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
    setOrderTypeFilter('all')
    setPaymentStatusFilter('all')
    setPaymentMethodFilter('all')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  return (
    <motion.div key="order-management" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* KPI Metric Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)]/80 backdrop-blur-sm relative overflow-hidden group hover:border-[var(--gold-primary)]/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Total Orders</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-[var(--gold-primary)]">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-white tracking-tight">{summaryMetrics.total}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Store orders registered</p>
        </div>

        <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)]/80 backdrop-blur-sm relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">Needs Action</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-white tracking-tight">{summaryMetrics.pending}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Pending verification/fulfillment</p>
        </div>

        <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)]/80 backdrop-blur-sm relative overflow-hidden group hover:border-sky-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-sky-400">In Fulfillment</span>
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-white tracking-tight">{summaryMetrics.fulfillment}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Processing or in transit</p>
        </div>

        <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)]/80 backdrop-blur-sm relative overflow-hidden group hover:border-green-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-green-400">Delivered</span>
            <div className="w-8 h-8 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-white tracking-tight">{summaryMetrics.completed}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Completed & received</p>
        </div>
      </div>

      {/* Quick Status Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => { setStatusFilter('all'); setPage(1) }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
            statusFilter === 'all'
              ? 'bg-[var(--gold-primary)] text-black border-[var(--gold-primary)] shadow-md shadow-[var(--gold-primary)]/20'
              : 'bg-[var(--surface-dark)] text-[var(--text-muted)] border-[var(--border)] hover:text-white hover:border-[var(--gold-primary)]/40'
          }`}
        >
          <span>All Statuses</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${statusFilter === 'all' ? 'bg-black/20 text-black' : 'bg-white/10 text-[var(--text-muted)]'}`}>
            {statusCounts.all || 0}
          </span>
        </button>

        {ORDER_STATUS_LIFECYCLE.map(status => {
          const isSelected = statusFilter === status.value
          const count = statusCounts[status.value] || 0

          return (
            <button
              key={status.value}
              type="button"
              onClick={() => { setStatusFilter(status.value); setPage(1) }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                isSelected
                  ? `${status.bgColor} ${status.textColor} ${status.borderColor} ring-1 ring-inset ring-current font-bold`
                  : 'bg-[var(--surface-dark)] text-[var(--text-muted)] border-[var(--border)] hover:text-white hover:border-[var(--border)]/80'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: status.color }} />
              <span>{status.label}</span>
              {count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isSelected ? 'bg-white/20' : 'bg-white/10 text-[var(--text-muted)]'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Advanced Search & Filter Controls Box */}
      <div className="p-4 sm:p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)]/90 backdrop-blur-sm space-y-4 shadow-xl">
        {/* Top Row: Search Bar & Sort Controls */}
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search by order #, customer name, email, tracking, or rider..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
              className="w-full pl-10 pr-10 py-2.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-white text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/50 focus:border-[var(--gold-primary)] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setPage(1) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-2 self-end lg:self-auto">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Sort by:</span>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value)}
              className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/50 focus:border-[var(--gold-primary)] transition-all cursor-pointer"
            >
              <option value="date">Order Date</option>
              <option value="order_number">Order Number</option>
              <option value="customer">Customer Name</option>
              <option value="total">Total Amount</option>
              <option value="status">Order Status</option>
              <option value="payment_status">Payment Status</option>
              <option value="order_type">Order Type</option>
            </select>
            <button
              type="button"
              onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="p-2.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-[var(--text-muted)] hover:text-white hover:border-[var(--gold-primary)]/50 transition-colors"
              title={sortDirection === 'asc' ? 'Sort Ascending' : 'Sort Descending'}
            >
              {sortDirection === 'asc' ? <ArrowUp className="w-4 h-4 text-[var(--gold-primary)]" /> : <ArrowDown className="w-4 h-4 text-[var(--gold-primary)]" />}
            </button>
          </div>
        </div>

        {/* Second Row: Detailed Filter Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-[var(--border)]/50">
          {/* Order Type Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Order Type</label>
            <select
              value={orderTypeFilter}
              onChange={(e) => { setOrderTypeFilter(e.target.value); setPage(1) }}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/50 focus:border-[var(--gold-primary)] transition-all cursor-pointer"
            >
              <option value="all">All Order Types</option>
              <option value="product">Standard Products</option>
              <option value="customization">Custom Guitars</option>
              <option value="service">Service Orders</option>
            </select>
          </div>

          {/* Payment Status Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Payment Status</label>
            <select
              value={paymentStatusFilter}
              onChange={(e) => { setPaymentStatusFilter(e.target.value); setPage(1) }}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/50 focus:border-[var(--gold-primary)] transition-all cursor-pointer"
            >
              <option value="all">All Payment Statuses</option>
              <option value="pending">Pending Payment</option>
              <option value="proof_submitted">Proof Submitted</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved / Paid</option>
              <option value="rejected">Payment Rejected</option>
              <option value="failed">Payment Failed</option>
            </select>
          </div>

          {/* Payment Method Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Payment Method</label>
            <select
              value={paymentMethodFilter}
              onChange={(e) => { setPaymentMethodFilter(e.target.value); setPage(1) }}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/50 focus:border-[var(--gold-primary)] transition-all cursor-pointer"
            >
              <option value="all">All Payment Methods</option>
              <option value="gcash">GCash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cash">Cash on Delivery (COD)</option>
            </select>
          </div>

          {/* Date Range Group */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Date Range</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl px-2.5 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/50 transition-all cursor-pointer"
                title="Date From"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl px-2.5 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/50 transition-all cursor-pointer"
                title="Date To"
              />
            </div>
          </div>
        </div>

        {/* Active Filters Badges */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border)]/40">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mr-1">Active:</span>

            {searchQuery && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--gold-primary)]/10 text-[var(--gold-primary)] border border-[var(--gold-primary)]/30 text-xs font-medium">
                Search: "{searchQuery}"
                <button type="button" onClick={() => { setSearchQuery(''); setPage(1) }} className="hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {statusFilter !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--surface-dark)] text-white border border-[var(--border)] text-xs font-medium">
                Status: {ORDER_STATUS_MAP[statusFilter]?.label || statusFilter}
                <button type="button" onClick={() => { setStatusFilter('all'); setPage(1) }} className="hover:text-red-400">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {orderTypeFilter !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--surface-dark)] text-white border border-[var(--border)] text-xs font-medium capitalize">
                Type: {orderTypeFilter}
                <button type="button" onClick={() => { setOrderTypeFilter('all'); setPage(1) }} className="hover:text-red-400">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {paymentStatusFilter !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--surface-dark)] text-white border border-[var(--border)] text-xs font-medium capitalize">
                Payment: {paymentStatusFilter.replace(/_/g, ' ')}
                <button type="button" onClick={() => { setPaymentStatusFilter('all'); setPage(1) }} className="hover:text-red-400">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {paymentMethodFilter !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--surface-dark)] text-white border border-[var(--border)] text-xs font-medium capitalize">
                Method: {paymentMethodFilter.replace(/_/g, ' ')}
                <button type="button" onClick={() => { setPaymentMethodFilter('all'); setPage(1) }} className="hover:text-red-400">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {(dateFrom || dateTo) && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--surface-dark)] text-white border border-[var(--border)] text-xs font-medium">
                Date: {dateFrom || 'Start'} → {dateTo || 'Present'}
                <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); setPage(1) }} className="hover:text-red-400">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={handleClearAllFilters}
              className="inline-flex items-center gap-1 ml-auto px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-semibold hover:bg-red-500/20 transition-colors"
            >
              <X className="w-3 h-3" /> Reset All
            </button>
          </div>
        )}
      </div>

      {/* Orders Table & Pagination Content */}
      {!isDataLoading && orders.length === 0 ? (
        <div className="bg-[var(--surface-dark)]/80 border border-[var(--border)] rounded-2xl p-12 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--gold-primary)]/10 border border-[var(--gold-primary)]/20 flex items-center justify-center text-[var(--gold-primary)] mb-4">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white">No orders found</h3>
          <p className="text-sm text-[var(--text-muted)] mt-1 max-w-sm text-center">
            {hasActiveFilters
              ? 'No orders match your current search and filter criteria. Try adjusting or resetting filters.'
              : 'There are currently no orders registered in the system.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="mt-4 px-4 py-2 rounded-xl bg-[var(--gold-primary)] text-black text-sm font-semibold hover:shadow-lg hover:shadow-[var(--gold-primary)]/20 transition-all"
            >
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-[var(--surface-dark)]/90 border border-[var(--border)] rounded-2xl overflow-hidden shadow-2xl backdrop-blur-sm relative">
            {/* Top subtle progress bar during background loading */}
            {showBackgroundProgress && (
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-[var(--gold-primary)]/30 overflow-hidden z-20">
                <div className="h-full bg-[var(--gold-primary)] animate-[shimmer_1.5s_infinite_linear] w-1/3" />
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[var(--bg-primary)]/60 border-b border-[var(--border)]">
                  <tr>
                    <th className="py-3.5 px-4 text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Order</th>
                    <th className="py-3.5 px-4 text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Date</th>
                    <th className="py-3.5 px-4 text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Customer</th>
                    <th className="py-3.5 px-4 text-right text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Total Amount</th>
                    <th className="py-3.5 px-4 text-left text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Payment Status</th>
                    <th className="py-3.5 px-4 text-center text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Items</th>
                    <th className="py-3.5 px-4 text-left text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Fulfillment Status</th>
                    <th className="py-3.5 px-4 text-center text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/40">
                  {showInitialSkeleton ? (
                    [...Array(6)].map((_, i) => (
                      <tr key={`orders-skeleton-${i}`} className="animate-pulse border-b border-[var(--border)]/30">
                        <td className="py-4 px-4">
                          <div className="h-4 w-20 bg-white/10 rounded mb-1.5" />
                          <div className="h-3 w-16 bg-white/5 rounded" />
                        </td>
                        <td className="py-4 px-4">
                          <div className="h-4 w-24 bg-white/10 rounded mb-1.5" />
                          <div className="h-3 w-14 bg-white/5 rounded" />
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-white/10 flex-shrink-0" />
                            <div className="space-y-1.5 flex-1">
                              <div className="h-3.5 w-28 bg-white/10 rounded" />
                              <div className="h-3 w-36 bg-white/5 rounded" />
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="h-4 w-20 bg-white/10 rounded ml-auto" />
                        </td>
                        <td className="py-4 px-4">
                          <div className="h-5 w-24 bg-white/10 rounded-full mb-1" />
                          <div className="h-3 w-20 bg-white/5 rounded" />
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="h-5 w-6 bg-white/10 rounded-full mx-auto" />
                        </td>
                        <td className="py-4 px-4">
                          <div className="h-5 w-24 bg-white/10 rounded-full" />
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <div className="w-7 h-7 bg-white/10 rounded-lg" />
                            <div className="w-7 h-7 bg-white/10 rounded-lg" />
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    orders.map((order) => {
                      const orderStatus = order.status || 'pending'
                      const statusConfig = getOrderStatusConfig(orderStatus)
                      const isCustomization = order.order_type === 'customization'
                      const customizationStatus = String(order.customization_status || 'active').replace(/_/g, ' ')
                      const paymentConfig = getPaymentStatusConfig(order.payment_status || 'pending', order)
                      const itemCount = order.items?.length || 0
                      const customerName = getOrderCustomerName(order)
                      const paymentMethod = getOrderPaymentMethodLabel(order)

                      const rowHighlight = {
                        shipped: 'bg-sky-500/5',
                        out_for_delivery: 'bg-indigo-500/5',
                        delivered: 'bg-green-500/5',
                      }
                      const highlightClass = rowHighlight[orderStatus] || ''

                      return (
                        <tr key={order.order_id} className={`hover:bg-white/5 transition-colors ${highlightClass}`}>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <span className="text-white font-mono text-sm font-bold">
                                #{order.order_number || order.order_id?.slice(0, 8)}
                              </span>
                            </div>
                            <div className="mt-1">
                              <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                isCustomization
                                  ? 'bg-violet-500/15 text-violet-300 border border-violet-500/30'
                                  : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                              }`}>
                                {isCustomization ? 'Custom Guitar' : 'Standard Product'}
                              </span>
                            </div>
                          </td>

                          <td className="py-4 px-4 text-[var(--text-muted)] text-sm whitespace-nowrap">
                            {order.created_at ? (
                              <div>
                                <p className="text-white font-medium">{new Date(order.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                <p className="text-[11px] text-[var(--text-muted)]">{new Date(order.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</p>
                              </div>
                            ) : '—'}
                          </td>

                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-[var(--gold-primary)]/10 border border-[var(--gold-primary)]/30 text-[var(--gold-primary)] flex items-center justify-center text-xs font-bold flex-shrink-0">
                                {customerName.charAt(0).toUpperCase() || 'U'}
                              </div>
                              <div className="min-w-0">
                                <p className="text-white text-sm font-semibold truncate">{customerName}</p>
                                <p className="text-[var(--text-muted)] text-xs truncate">{order.email || order.customer_email || 'No email'}</p>
                              </div>
                            </div>
                          </td>

                          <td className="py-4 px-4 text-right font-bold text-[var(--gold-primary)] text-sm whitespace-nowrap">
                            {formatCurrency(getOrderTotal(order))}
                          </td>

                          <td className="py-4 px-4">
                            <div className="space-y-1">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${paymentConfig.bgColor} ${paymentConfig.textColor} ${paymentConfig.borderColor}`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                {paymentConfig.label}
                              </span>
                              <p className="text-[11px] text-[var(--text-muted)]">Method: {paymentMethod}</p>
                            </div>
                          </td>

                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-[var(--bg-primary)] border border-[var(--border)] text-xs font-bold text-white">
                              {itemCount}
                            </span>
                          </td>

                          <td className="py-4 px-4">
                            {isCustomization ? (
                              <div className="space-y-1.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-violet-500/10 text-violet-300 border-violet-500/30 capitalize">
                                  {customizationStatus}
                                </span>
                                <p className="text-xs text-[var(--text-muted)]">
                                  Progress: {Number(order.project_progress || 0)}%
                                </p>
                                {order.project_fulfillment_status && (
                                  <p className="text-xs text-[var(--gold-primary)] font-medium capitalize">
                                    {String(order.project_fulfillment_status).replace(/_/g, ' ')}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusConfig.bgColor} ${statusConfig.textColor} ${statusConfig.borderColor}`}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusConfig.color }} />
                                {statusConfig.label}
                              </span>
                            )}
                          </td>

                          <td className="py-4 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSection('details')
                                  setSelectedOrder(order)
                                }}
                                className="p-2 hover:bg-[var(--gold-primary)]/15 text-[var(--text-muted)] hover:text-[var(--gold-primary)] rounded-xl transition-all border border-transparent hover:border-[var(--gold-primary)]/30"
                                title="View Order Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSection('receipt')
                                  setSelectedOrder(order)
                                }}
                                className="p-2 hover:bg-white/10 text-[var(--text-muted)] hover:text-white rounded-xl transition-all"
                                title="View & Print Invoice"
                              >
                                <Printer className="w-4 h-4" />
                              </button>

                              {(isCustomization || order.project_id) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedSection('fulfillment')
                                    setSelectedOrder(order)
                                  }}
                                  className="p-2 hover:bg-amber-500/15 text-amber-400 hover:text-amber-300 rounded-xl transition-all border border-transparent hover:border-amber-500/30 cursor-pointer"
                                  title="Custom Build Fulfillment: Manage Method & Advance Stage"
                                >
                                  <Truck className="w-4 h-4" />
                                </button>
                              )}

                              {(isCustomization || order.project_id) && (
                                <button
                                  type="button"
                                  onClick={() => onManageProject?.(order)}
                                  className="p-2 hover:bg-violet-500/15 text-violet-400 hover:text-violet-300 rounded-xl transition-all border border-transparent hover:border-violet-500/30 cursor-pointer"
                                  title="Project Shortcut: Go to Project Tab & Show Progress Modal"
                                >
                                  <BriefcaseBusiness className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-2">
            <div className="flex items-center gap-2">
              <p className="text-[var(--text-muted)] text-sm">
                Showing{' '}
                <span className="font-semibold text-white">
                  {(pagination?.total || orders.length) === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
                </span>{' '}
                to{' '}
                <span className="font-semibold text-white">
                  {Math.min(page * PAGE_SIZE, pagination?.total ?? orders.length)}
                </span>{' '}
                of{' '}
                <span className="font-semibold text-white">{pagination?.total ?? orders.length}</span> orders
              </p>
              {showBackgroundProgress && (
                <div className="flex items-center gap-1.5 text-xs text-[var(--gold-primary)] bg-[var(--gold-primary)]/10 px-2.5 py-0.5 rounded-full border border-[var(--gold-primary)]/20">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Refreshing...</span>
                </div>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                {/* Previous Button */}
                <button
                  type="button"
                  onClick={() => requestOrdersPage(Math.max(1, page - 1))}
                  disabled={page <= 1 || isDataLoading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-[var(--surface-dark)] border border-[var(--border)] hover:border-[var(--gold-primary)]/50 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-40 disabled:hover:border-[var(--border)] disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>

                {/* Page Number Buttons */}
                {(() => {
                  const pages = []
                  const maxButtons = 5
                  let start = Math.max(1, page - 2)
                  let end = Math.min(totalPages, start + maxButtons - 1)
                  if (end - start < maxButtons - 1) {
                    start = Math.max(1, end - maxButtons + 1)
                  }

                  if (start > 1) {
                    pages.push(
                      <button
                        key="page-1"
                        type="button"
                        onClick={() => requestOrdersPage(1)}
                        disabled={isDataLoading}
                        className="w-8 h-8 rounded-lg bg-[var(--surface-dark)] border border-[var(--border)] text-xs font-semibold text-white hover:border-[var(--gold-primary)]/50 transition-all disabled:opacity-40"
                      >
                        1
                      </button>
                    )
                    if (start > 2) {
                      pages.push(
                        <span key="dots-start" className="text-[var(--text-muted)] text-xs px-1">...</span>
                      )
                    }
                  }

                  for (let p = start; p <= end; p++) {
                    const isActive = p === page
                    pages.push(
                      <button
                        key={`page-${p}`}
                        type="button"
                        onClick={() => requestOrdersPage(p)}
                        disabled={isActive || isDataLoading}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                          isActive
                            ? 'bg-[var(--gold-primary)] text-black shadow-md shadow-[var(--gold-primary)]/20'
                            : 'bg-[var(--surface-dark)] border border-[var(--border)] text-white hover:border-[var(--gold-primary)]/50 disabled:opacity-50'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  }

                  if (end < totalPages) {
                    if (end < totalPages - 1) {
                      pages.push(
                        <span key="dots-end" className="text-[var(--text-muted)] text-xs px-1">...</span>
                      )
                    }
                    pages.push(
                      <button
                        key={`page-${totalPages}`}
                        type="button"
                        onClick={() => requestOrdersPage(totalPages)}
                        disabled={isDataLoading}
                        className="w-8 h-8 rounded-lg bg-[var(--surface-dark)] border border-[var(--border)] text-xs font-semibold text-white hover:border-[var(--gold-primary)]/50 transition-all disabled:opacity-40"
                      >
                        {totalPages}
                      </button>
                    )
                  }

                  return pages
                })()}

                {/* Next Button */}
                <button
                  type="button"
                  onClick={() => requestOrdersPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages || isDataLoading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-[var(--surface-dark)] border border-[var(--border)] hover:border-[var(--gold-primary)]/50 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-40 disabled:hover:border-[var(--border)] disabled:cursor-not-allowed"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal View */}
      <AnimatePresence>
        {selectedOrder && (
          <OrderDetailsModal
            order={selectedOrder}
            onClose={() => setSelectedOrder(null)}
            onUpdatePaymentStatus={handleUpdatePaymentStatus}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onVerifyPayment={handleVerifyPayment}
            onManageProject={onManageProject}
            user={user}
            initialSection={selectedSection}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
