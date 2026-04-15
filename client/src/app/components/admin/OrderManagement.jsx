import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  ShoppingBag, Eye, Edit, Search, Filter,
  Package, CreditCard, RefreshCw, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, Clock, AlertCircle, Loader2,
  FileText, Image as ImageIcon, ExternalLink, Save, User,
  History, DollarSign, Trash2, Check, X,
} from 'lucide-react'
import { formatCurrency } from '../../utils/formatCurrency'
import { adminApi } from '../../utils/adminApi'

const ORDER_STATUS_LIFECYCLE = [
  { value: 'pending', label: 'Pending', color: '#f59e0b', bgColor: 'bg-amber-500/20', textColor: 'text-amber-400', borderColor: 'border-amber-500/30' },
  { value: 'processing', label: 'Processing', color: '#60a5fa', bgColor: 'bg-blue-500/20', textColor: 'text-blue-400', borderColor: 'border-blue-500/30' },
  { value: 'shipped', label: 'Shipped', color: '#38bdf8', bgColor: 'bg-sky-500/20', textColor: 'text-sky-400', borderColor: 'border-sky-500/30' },
  { value: 'out_for_delivery', label: 'Out for Delivery', color: '#818cf8', bgColor: 'bg-indigo-500/20', textColor: 'text-indigo-400', borderColor: 'border-indigo-500/30' },
  { value: 'delivered', label: 'Delivered', color: '#22c55e', bgColor: 'bg-green-500/20', textColor: 'text-green-400', borderColor: 'border-green-500/30' },
  { value: 'cancelled', label: 'Cancelled', color: '#f87171', bgColor: 'bg-red-500/20', textColor: 'text-red-400', borderColor: 'border-red-500/30' },
]

const ORDER_STATUS_MAP = Object.fromEntries(ORDER_STATUS_LIFECYCLE.map(s => [s.value, s]))

const PAYMENT_STATUS_LIFECYCLE = [
  { value: 'pending', label: 'Pending', color: '#f59e0b', bgColor: 'bg-amber-500/20', textColor: 'text-amber-400', borderColor: 'border-amber-500/30' },
  { value: 'proof_submitted', label: 'Proof Submitted', color: '#60a5fa', bgColor: 'bg-blue-500/20', textColor: 'text-blue-400', borderColor: 'border-blue-500/30' },
  { value: 'under_review', label: 'Under Review', color: '#8b5cf6', bgColor: 'bg-violet-500/20', textColor: 'text-violet-400', borderColor: 'border-violet-500/30' },
  { value: 'approved', label: 'Approved', color: '#22c55e', bgColor: 'bg-green-500/20', textColor: 'text-green-400', borderColor: 'border-green-500/30' },
  { value: 'rejected', label: 'Rejected', color: '#f87171', bgColor: 'bg-red-500/20', textColor: 'text-red-400', borderColor: 'border-red-500/30' },
  { value: 'failed', label: 'Failed', color: '#ef4444', bgColor: 'bg-red-600/20', textColor: 'text-red-500', borderColor: 'border-red-600/30' },
]

const PAYMENT_STATUS_MAP = Object.fromEntries(PAYMENT_STATUS_LIFECYCLE.map(s => [s.value, s]))

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
  return PAYMENT_STATUS_MAP[status] || PAYMENT_STATUS_LIFECYCLE[1]
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

function OrderDetailsModal({ order, onClose, onUpdatePaymentStatus, onUpdateOrderStatus, onVerifyPayment, user }) {
  const [activeSection, setActiveSection] = useState('details')

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
                    <p className="text-white font-medium">
                      {order.first_name && order.last_name
                        ? `${order.first_name} ${order.last_name}`
                        : order.customer_name || order.user_name || order.name || 'N/A'}
                    </p>
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
                    <p className="text-white text-sm">
                      {order.shipping_line1
                        ? `${order.shipping_line1}${order.shipping_line2 ? ', ' + order.shipping_line2 : ''}, ${order.shipping_city}${order.shipping_province ? ', ' + order.shipping_province : ''} ${order.shipping_postal_code || ''}`
                        : 'N/A'}
                    </p>
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
                  <p className="text-white text-sm">
                    {(() => {
                      const method = order.payment_method || order.payment?.method || 'Unknown'
                      const methodLower = method.toString().toLowerCase()
                      if (methodLower.includes('gcash') || methodLower.includes('g-cash')) return 'GCash'
                      if (methodLower.includes('bank') || methodLower.includes('transfer') || methodLower.includes('bdo') || methodLower.includes('bpi') || methodLower.includes('unionbank')) return 'Bank Transfer'
                      if (methodLower.includes('cod') || methodLower.includes('cash')) return 'Cash on Delivery'
                      return method.charAt(0).toUpperCase() + method.slice(1)
                    })()}
                  </p>
                </div>
                {order.tracking_number && (
                  <div className="bg-[var(--bg-primary)]/50 rounded-lg p-4">
                    <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">Tracking Number</p>
                    <p className="text-white text-sm">{order.tracking_number}</p>
                  </div>
                )}
                {order.rider_details && (
                  <div className="bg-[var(--bg-primary)]/50 rounded-lg p-4">
                    <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">Rider Details</p>
                    <p className="text-white text-sm">{order.rider_details}</p>
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
                  <span className="text-white">{formatCurrency(order.subtotal || (order.total || order.total_amount || 0) - (order.shipping_fee || 0))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Shipping</span>
                  <span className="text-white">{formatCurrency(order.shipping_fee || 0)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-[var(--border)]">
                  <span className="text-white font-semibold">Total</span>
                  <span className="text-[var(--gold-primary)] font-bold">{formatCurrency(order.total || order.total_amount || 0)}</span>
                </div>
              </div>
            </div>
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
  const [selectedStatus, setSelectedStatus] = useState(order.payment_status || 'pending')
  const [referenceNumber, setReferenceNumber] = useState(order.payment?.reference_number || '')
  const [notes, setNotes] = useState('')
  const [showImageModal, setShowImageModal] = useState(false)
  const [imageToView, setImageToView] = useState(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

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
            {PAYMENT_STATUS_LIFECYCLE.map((status) => {
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
                          {formatCurrency(order.total || order.total_amount)}
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
                              onClick={() => setSelectedOrder(order)}
                              className="p-2 hover:bg-[var(--gold-primary)]/10 rounded-lg transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4 text-[var(--text-muted)]" />
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
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}