import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { adminApi } from '../../utils/adminApi'
import {
  CheckCircle, Clock, Loader2, Package, Truck, MapPin,
  AlertCircle, Camera, ChevronDown, ChevronRight, Send
} from 'lucide-react'

const CLAIM_STATUS_CONFIG = {
  pending_customer_selection: { label: 'Awaiting Customer', color: 'amber', icon: Clock },
  pending_admin_confirmation: { label: 'Needs Confirmation', color: 'violet', icon: AlertCircle },
  ready_for_delivery: { label: 'Ready for Delivery', color: 'cyan', icon: Package },
  courier_arranged: { label: 'Courier Arranged', color: 'blue', icon: Truck },
  out_for_delivery: { label: 'Out for Delivery', color: 'blue', icon: Truck },
  ready_for_pickup: { label: 'Ready for Pickup', color: 'cyan', icon: MapPin },
  picked_up: { label: 'Picked Up', color: 'sky', icon: CheckCircle },
  delivered: { label: 'Delivered', color: 'sky', icon: CheckCircle },
  received: { label: 'Received', color: 'emerald', icon: CheckCircle },
  not_required: { label: 'Not Required', color: 'gray', icon: null },
}

const formatCurrency = (val) => {
  const num = Number(val) || 0
  return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
}

const formatStatus = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

export default function BuildClaimManager({ projectId, projectData }) {
  const [claim, setClaim] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(true)

  // Admin action states
  const [confirmNotes, setConfirmNotes] = useState('')
  const [confirmPhotos, setConfirmPhotos] = useState('')
  const [pickupLocation, setPickupLocation] = useState('')
  const [pickupInstructions, setPickupInstructions] = useState('')
  const [courierService, setCourierService] = useState('')
  const [courierReference, setCourierReference] = useState('')
  const [deliveryFee, setDeliveryFee] = useState('')
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionFeedback, setActionFeedback] = useState(null)

  const loadClaim = useCallback(async () => {
    if (!projectId) return
    try {
      setLoading(true)
      const res = await adminApi.getBuildClaim(projectId)
      setClaim(res?.data || null)
    } catch (err) {
      setClaim(null)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadClaim()
  }, [loadClaim])

  const showFeedback = (msg, type = 'success') => {
    setActionFeedback({ msg, type })
    setTimeout(() => setActionFeedback(null), 4000)
  }

  // ─── Admin Actions ──────────────────────────────────────────

  const handleConfirmBuild = async () => {
    try {
      setActionLoading(true)
      const body = {}
      if (confirmNotes.trim()) body.notes = confirmNotes.trim()
      if (confirmPhotos.trim()) {
        body.photos = confirmPhotos.split(',').map(u => u.trim()).filter(Boolean)
      }
      if (pickupLocation.trim()) body.pickup_location = pickupLocation.trim()
      if (pickupInstructions.trim()) body.pickup_instructions = pickupInstructions.trim()
      await adminApi.confirmBuildState(projectId, body)
      showFeedback('Build state confirmed')
      await loadClaim()
    } catch (err) {
      showFeedback(err.message, 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleArrangeCourier = async () => {
    try {
      setActionLoading(true)
      const body = {}
      if (courierService.trim()) body.courier_service = courierService.trim()
      if (courierReference.trim()) body.courier_reference = courierReference.trim()
      if (deliveryFee) body.delivery_fee = Number(deliveryFee)
      if (estimatedDeliveryDate) body.estimated_delivery_date = estimatedDeliveryDate
      await adminApi.arrangeBuildClaimCourier(projectId, body)
      showFeedback('Courier arranged')
      await loadClaim()
    } catch (err) {
      showFeedback(err.message, 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleStatusTransition = async (newStatus) => {
    try {
      setActionLoading(true)
      await adminApi.updateBuildClaimStatus(projectId, { status: newStatus })
      showFeedback(`Status updated to ${formatStatus(newStatus)}`)
      await loadClaim()
    } catch (err) {
      showFeedback(err.message, 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleMarkPickedUp = async () => {
    try {
      setActionLoading(true)
      await adminApi.markBuildClaimPickedUp(projectId, {})
      showFeedback('Marked as picked up')
      await loadClaim()
    } catch (err) {
      showFeedback(err.message, 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Don't render if project is not cancelled or no claim
  if (loading) {
    return (
      <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-center gap-3">
        <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
        <span className="text-sm text-amber-300/80">Loading build claim...</span>
      </div>
    )
  }

  if (!claim) return null

  const cfg = CLAIM_STATUS_CONFIG[claim.claim_status] || CLAIM_STATUS_CONFIG.pending_customer_selection
  const StatusIcon = cfg.icon

  return (
    <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-amber-500/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Package className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold text-amber-300">Current Build Claim</span>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold border-${cfg.color}-500/30 text-${cfg.color}-400`}>
            {StatusIcon && <StatusIcon className="w-3 h-3" />}
            {cfg.label}
          </span>
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-amber-400" /> : <ChevronRight className="w-4 h-4 text-amber-400" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4">

              {/* Feedback */}
              {actionFeedback && (
                <div className={`rounded-lg px-4 py-2 text-sm font-medium ${actionFeedback.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'}`}>
                  {actionFeedback.msg}
                </div>
              )}

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Customer</span>
                  <span className="text-white">{claim.customer_first_name} {claim.customer_last_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Progress</span>
                  <span className="text-white font-semibold">{claim.progress_at_cancellation}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Amount Paid</span>
                  <span className="text-[var(--gold-primary)] font-semibold">{formatCurrency(claim.amount_paid)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Method</span>
                  <span className="text-white capitalize">{claim.claim_method === 'courier' ? 'Shop Delivery' : (claim.claim_method === 'pickup' ? 'Workshop Pick Up' : (claim.claim_method || '—'))}</span>
                </div>
              </div>

              {/* Delivery Address */}
              {claim.delivery_address && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-3.5 space-y-1">
                  <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-400" /> Delivery Address
                  </span>
                  <p className="text-xs font-semibold text-white">
                    {claim.delivery_address.recipient_name || `${claim.customer_first_name} ${claim.customer_last_name}`}
                    {(claim.delivery_address.phone || claim.customer_phone) && (
                      <span className="font-normal text-[var(--text-muted)] ml-1">
                        ({claim.delivery_address.phone || claim.customer_phone})
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    {[
                      claim.delivery_address.line1,
                      claim.delivery_address.line2,
                      claim.delivery_address.barangay,
                      claim.delivery_address.city,
                      claim.delivery_address.province,
                      claim.delivery_address.postal_code,
                      claim.delivery_address.country,
                    ].filter(Boolean).join(', ')}
                  </p>
                </div>
              )}

              {/* Build state snapshot */}
              {claim.build_state_snapshot && Array.isArray(claim.build_state_snapshot) && (
                <div className="space-y-1.5">
                  <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Build State at Cancellation</p>
                  {claim.build_state_snapshot.map((stage, idx) => (
                    <div key={stage.milestone_id || idx} className="flex items-center gap-2">
                      {stage.status === 'completed' ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : stage.status === 'in_progress' ? (
                        <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-[var(--border)] shrink-0" />
                      )}
                      <span className={`text-xs ${stage.status === 'completed' ? 'text-emerald-300' : stage.status === 'in_progress' ? 'text-amber-300' : 'text-[var(--text-muted)]'}`}>
                        {stage.title}
                      </span>
                      {stage.total_subtasks > 0 && (
                        <span className="text-xs text-[var(--text-muted)] ml-auto">{stage.completed_subtasks}/{stage.total_subtasks}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Current state photos */}
              {claim.current_state_photos && claim.current_state_photos.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-2">Build Photos</p>
                  <div className="flex gap-2 flex-wrap">
                    {claim.current_state_photos.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt={`State ${i + 1}`} className="w-16 h-16 rounded-lg object-cover border border-[var(--border)] hover:border-amber-500/50 transition-colors" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* ── ADMIN ACTIONS ── */}

              {/* Confirm Build State (status: pending_admin_confirmation) */}
              {claim.claim_status === 'pending_admin_confirmation' && (
                <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 space-y-3">
                  <p className="text-sm font-semibold text-violet-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> Confirm Build State
                  </p>
                  <p className="text-xs text-violet-300/70">
                    Verify the physical state of the guitar matches the build snapshot above. Add any notes or photos before confirming.
                  </p>
                  <textarea
                    value={confirmNotes}
                    onChange={(e) => setConfirmNotes(e.target.value)}
                    placeholder="Admin confirmation notes..."
                    rows={2}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-3 py-2 text-sm text-white placeholder:text-[var(--text-muted)] focus:border-violet-500/50 focus:outline-none resize-none"
                  />
                  <input
                    type="text"
                    value={confirmPhotos}
                    onChange={(e) => setConfirmPhotos(e.target.value)}
                    placeholder="Photo URLs (comma-separated, optional)"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-3 py-2 text-sm text-white placeholder:text-[var(--text-muted)] focus:border-violet-500/50 focus:outline-none"
                  />
                  {claim.claim_method === 'pickup' && (
                    <>
                      <input
                        type="text"
                        value={pickupLocation}
                        onChange={(e) => setPickupLocation(e.target.value)}
                        placeholder="Pickup location (e.g. Shop address)"
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-3 py-2 text-sm text-white placeholder:text-[var(--text-muted)] focus:border-violet-500/50 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={pickupInstructions}
                        onChange={(e) => setPickupInstructions(e.target.value)}
                        placeholder="Pickup instructions (optional)"
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-3 py-2 text-sm text-white placeholder:text-[var(--text-muted)] focus:border-violet-500/50 focus:outline-none"
                      />
                    </>
                  )}
                  <button
                    onClick={handleConfirmBuild}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-600 transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Confirm Build State
                  </button>
                </div>
              )}

              {/* Arrange Courier (status: ready_for_delivery) */}
              {claim.claim_status === 'ready_for_delivery' && claim.claim_method === 'courier' && (
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4 space-y-3">
                  <p className="text-sm font-semibold text-cyan-300 flex items-center gap-2">
                    <Truck className="w-4 h-4" /> Arrange Courier
                  </p>
                  {claim.recipient_name && (
                    <div className="text-xs space-y-1">
                      <div className="flex justify-between"><span className="text-[var(--text-muted)]">Recipient</span><span className="text-white">{claim.recipient_name}</span></div>
                      {claim.recipient_contact && <div className="flex justify-between"><span className="text-[var(--text-muted)]">Contact</span><span className="text-white">{claim.recipient_contact}</span></div>}
                      {claim.delivery_instructions && <div className="flex justify-between"><span className="text-[var(--text-muted)]">Instructions</span><span className="text-white">{claim.delivery_instructions}</span></div>}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={courierService}
                      onChange={(e) => setCourierService(e.target.value)}
                      placeholder="Courier service name"
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-3 py-2 text-sm text-white placeholder:text-[var(--text-muted)] focus:border-cyan-500/50 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={courierReference}
                      onChange={(e) => setCourierReference(e.target.value)}
                      placeholder="Tracking/reference #"
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-3 py-2 text-sm text-white placeholder:text-[var(--text-muted)] focus:border-cyan-500/50 focus:outline-none"
                    />
                    <input
                      type="number"
                      value={deliveryFee}
                      onChange={(e) => setDeliveryFee(e.target.value)}
                      placeholder="Delivery fee"
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-3 py-2 text-sm text-white placeholder:text-[var(--text-muted)] focus:border-cyan-500/50 focus:outline-none"
                    />
                    <input
                      type="date"
                      value={estimatedDeliveryDate}
                      onChange={(e) => setEstimatedDeliveryDate(e.target.value)}
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-3 py-2 text-sm text-white placeholder:text-[var(--text-muted)] focus:border-cyan-500/50 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={handleArrangeCourier}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-600 transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                    Arrange Courier
                  </button>
                </div>
              )}

              {/* Mark Out for Delivery (status: courier_arranged) */}
              {claim.claim_status === 'courier_arranged' && (
                <button
                  onClick={() => handleStatusTransition('out_for_delivery')}
                  disabled={actionLoading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                  Mark as Out for Delivery
                </button>
              )}

              {/* Mark Delivered (status: out_for_delivery) */}
              {claim.claim_status === 'out_for_delivery' && (
                <button
                  onClick={() => handleStatusTransition('delivered')}
                  disabled={actionLoading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Mark as Delivered
                </button>
              )}

              {/* Mark Picked Up (status: ready_for_pickup) */}
              {claim.claim_status === 'ready_for_pickup' && (
                <button
                  onClick={handleMarkPickedUp}
                  disabled={actionLoading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                  Mark as Picked Up
                </button>
              )}

              {/* Completed states */}
              {claim.claim_status === 'received' && (
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm text-emerald-300 font-medium">
                    Customer confirmed receipt{claim.received_at ? ` on ${new Date(claim.received_at).toLocaleDateString()}` : ''}
                  </span>
                </div>
              )}

              {['delivered', 'picked_up'].includes(claim.claim_status) && (
                <div className="rounded-lg bg-sky-500/10 border border-sky-500/30 px-4 py-3 text-xs text-sky-300/80">
                  Waiting for customer to confirm receipt.
                </div>
              )}

              {claim.claim_status === 'pending_customer_selection' && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-xs text-amber-300/80">
                  Waiting for customer to select pickup or courier delivery method.
                </div>
              )}

              {/* Admin confirmation info */}
              {claim.admin_confirmed_at && (
                <div className="text-xs text-[var(--text-muted)] space-y-0.5">
                  <p>Confirmed by: {claim.admin_confirmed_first_name} {claim.admin_confirmed_last_name}</p>
                  <p>Confirmed on: {new Date(claim.admin_confirmed_at).toLocaleString()}</p>
                  {claim.admin_confirmation_notes && <p>Notes: {claim.admin_confirmation_notes}</p>}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
