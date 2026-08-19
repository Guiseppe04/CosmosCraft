import { useState, useEffect, useMemo } from 'react'
import { motion } from 'motion/react'
import {
  RefreshCw, Search, Eye, CheckCircle, XCircle, Clock, Loader2,
  ChevronLeft, ChevronRight, Image as ImageIcon, ExternalLink,
  AlertCircle, Filter, ArrowUp, ArrowDown, X
} from 'lucide-react'
import { formatCurrency } from '../../../utils/formatCurrency'
import { adminApi } from '../../../utils/adminApi'
import { useDebounce } from '../../../hooks/useDebounce'
import { ImageZoomModal } from '../components/shared/ImageZoomModal'
import { EmptyState } from '../components/shared/EmptyState'

const REFUND_STATUS_MAP = {
  pending: { label: 'Pending Review', color: '#f59e0b', bgColor: 'bg-amber-500/20', textColor: 'text-amber-400', borderColor: 'border-amber-500/30' },
  'pending_payment_verification': { label: 'Awaiting Payment Verification', color: '#8b5cf6', bgColor: 'bg-violet-500/20', textColor: 'text-violet-400', borderColor: 'border-violet-500/30' },
  approved: { label: 'Approved', color: '#22c55e', bgColor: 'bg-green-500/20', textColor: 'text-green-400', borderColor: 'border-green-500/30' },
  processing: { label: 'Processing', color: '#38bdf8', bgColor: 'bg-sky-500/20', textColor: 'text-sky-400', borderColor: 'border-sky-500/30' },
  rejected: { label: 'Rejected', color: '#f87171', bgColor: 'bg-red-500/20', textColor: 'text-red-400', borderColor: 'border-red-500/30' },
  refunded: { label: 'Refunded', color: '#22c55e', bgColor: 'bg-green-500/20', textColor: 'text-green-400', borderColor: 'border-green-500/30' },
}

const REASON_LABELS = {
  wrong_item: 'Wrong item',
  defective: 'Defective item',
  damaged: 'Damaged item',
  not_as_described: 'Not as described',
  size_issue: 'Size issue',
  quality_issue: 'Quality issue',
  changed_mind: 'Changed mind',
  duplicate_order: 'Duplicate order',
  late_delivery: 'Late delivery',
  incomplete: 'Incomplete order',
  missing_parts: 'Missing parts',
  other: 'Other',
}

const PAGE_SIZE = 10

function formatReason(reason) {
  if (!reason) return ''
  return REASON_LABELS[reason] || reason
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function RefundRequestsTab({ showToast }) {
  const [refundRequests, setRefundRequests] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, page_size: 10, total: 0, total_pages: 1 })
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [imageZoom, setImageZoom] = useState(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const debouncedSearch = useDebounce(searchQuery, 300)

  const fetchRefundRequests = async () => {
    setLoading(true)
    try {
      const params = {
        page,
        page_size: PAGE_SIZE,
        sort_by: 'created_at',
        sort_dir: 'desc',
      }
      if (statusFilter !== 'all') params.status = statusFilter
      if (debouncedSearch) params.search = debouncedSearch

      const res = await adminApi.getRefundRequests(params)
      const requests = Array.isArray(res.data?.refund_requests) ? res.data.refund_requests : Array.isArray(res.data) ? res.data : []
      setRefundRequests(requests)
      const total = res.data?.total || 0
      const pageSize = res.data?.limit || PAGE_SIZE
      setPagination({ page, page_size: pageSize, total, total_pages: Math.max(1, Math.ceil(total / pageSize)) })
    } catch (err) {
      showToast?.(`Failed to load refund requests: ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRefundRequests()
  }, [page, statusFilter, debouncedSearch])

  const handleViewDetails = async (requestId) => {
    try {
      const res = await adminApi.getRefundRequest(requestId)
      setSelectedRequest(res.data)
      setAdminNotes(res.data?.admin_notes || '')
    } catch (err) {
      showToast?.(`Failed to load refund request details: ${err.message}`, 'error')
    }
  }

  const handleUpdateStatus = async (newStatus) => {
    if (!selectedRequest?.refund_request_id) return
    setUpdatingStatus(true)
    try {
      // Project-scoped refunds (custom build) use the project refund endpoint with
      // the approved → processing → refunded chain. Order-scoped refunds keep the
      // existing order endpoint so the delivered-item flow is unchanged.
      if (selectedRequest.project_id) {
        await adminApi.updateProjectRefundStatus(selectedRequest.refund_request_id, newStatus, { adminNotes: adminNotes || undefined })
      } else {
        await adminApi.updateRefundStatus(selectedRequest.refund_request_id, newStatus, { adminNotes: adminNotes || undefined })
      }
      showToast?.(`Refund request ${newStatus} successfully.`)
      setSelectedRequest(null)
      setAdminNotes('')
      fetchRefundRequests()
    } catch (err) {
      showToast?.(`Failed to update refund status: ${err.message}`, 'error')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const getRefundTotal = (items = [], amount_requested) => {
    const itemTotal = items.reduce((sum, item) => sum + Number(item.refund_amount || 0), 0)
    if (itemTotal > 0) return itemTotal
    return Number(amount_requested || 0)
  }

  const statusCounts = useMemo(() => {
    const counts = { all: refundRequests.length }
    refundRequests.forEach(r => {
      counts[r.status] = (counts[r.status] || 0) + 1
    })
    return counts
  }, [refundRequests])

  return (
    <motion.div key="refund-requests" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-5 sm:p-8">
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Refund Requests</h2>
            <p className="text-sm text-[var(--text-muted)]">Manage customer refund requests</p>
          </div>
          <button onClick={fetchRefundRequests} disabled={loading} className="p-2 border border-[var(--border)] rounded-lg hover:border-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/10 transition-all self-start">
            <RefreshCw className={`w-4 h-4 text-[var(--text-muted)] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search by order number, customer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-2xl text-[var(--text-light)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[var(--text-muted)]" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="processing">Processing</option>
              <option value="rejected">Rejected</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-[var(--gold-primary)] animate-spin" />
          </div>
        ) : refundRequests.length === 0 ? (
          <EmptyState
            icon={RefreshCw}
            title="No refund requests found"
            description="Refund requests will appear here when customers submit them."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-3 px-4 text-[var(--text-muted)] font-medium text-xs tracking-wider uppercase">Request</th>
                  <th className="text-left py-3 px-4 text-[var(--text-muted)] font-medium text-xs tracking-wider uppercase">Order</th>
                  <th className="text-left py-3 px-4 text-[var(--text-muted)] font-medium text-xs tracking-wider uppercase">Customer</th>
                  <th className="text-left py-3 px-4 text-[var(--text-muted)] font-medium text-xs tracking-wider uppercase">Reason</th>
                  <th className="text-right py-3 px-4 text-[var(--text-muted)] font-medium text-xs tracking-wider uppercase">Amount</th>
                  <th className="text-center py-3 px-4 text-[var(--text-muted)] font-medium text-xs tracking-wider uppercase">Status</th>
                  <th className="text-right py-3 px-4 text-[var(--text-muted)] font-medium text-xs tracking-wider uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {refundRequests.map((req) => {
                  const statusConfig = REFUND_STATUS_MAP[req.status] || REFUND_STATUS_MAP.pending
                  const refundTotal = getRefundTotal(req.items, req.amount_requested)
                  const displayReason = formatReason(req.reason)
                  return (
                    <tr key={req.refund_request_id} className="border-b border-[var(--border)]/50 hover:bg-white/[0.03] transition-colors duration-150">
                      <td className="py-3 px-4 text-white font-medium">{req.request_number || req.refund_request_id?.slice(0, 8)}</td>
                      <td className="py-3 px-4 text-white">{req.order_number}</td>
                      <td className="py-3 px-4 text-white">{req.first_name} {req.last_name}</td>
                      <td className="py-3 px-4">
                        {displayReason ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-500/15 text-orange-400 border border-orange-500/20">
                            {displayReason}
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)] text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-[var(--gold-primary)] font-semibold">{formatCurrency(refundTotal)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusConfig.bgColor} ${statusConfig.textColor} ${statusConfig.borderColor}`}>
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleViewDetails(req.refund_request_id)}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4 text-[var(--text-muted)]" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {pagination.total_pages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-[var(--text-muted)]">
              Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, pagination.total)} of {pagination.total} requests
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-2 border border-[var(--border)] rounded-lg hover:border-[var(--gold-primary)] disabled:opacity-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-white" />
              </button>
              <span className="text-sm text-white">{page} / {pagination.total_pages}</span>
              <button
                onClick={() => setPage(p => Math.min(pagination.total_pages, p + 1))}
                disabled={page >= pagination.total_pages}
                className="p-2 border border-[var(--border)] rounded-lg hover:border-[var(--gold-primary)] disabled:opacity-50 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Refund Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl p-6 w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-[var(--border)]">
              <div>
                <h2 className="text-xl font-bold text-white">Refund Request #{selectedRequest.request_number || selectedRequest.refund_request_id?.slice(0, 8)}</h2>
                <p className="text-sm text-[var(--text-muted)] mt-1">Order #{selectedRequest.order_number} • {selectedRequest.first_name} {selectedRequest.last_name}</p>
              </div>
              <button onClick={() => { setSelectedRequest(null); setAdminNotes('') }} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[var(--bg-primary)]/50 rounded-xl p-4">
                  <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">Status</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${(REFUND_STATUS_MAP[selectedRequest.status] || REFUND_STATUS_MAP.pending).bgColor} ${(REFUND_STATUS_MAP[selectedRequest.status] || REFUND_STATUS_MAP.pending).textColor} ${(REFUND_STATUS_MAP[selectedRequest.status] || REFUND_STATUS_MAP.pending).borderColor}`}>
                    {(REFUND_STATUS_MAP[selectedRequest.status] || REFUND_STATUS_MAP.pending).label}
                  </span>
                </div>
                <div className="bg-[var(--bg-primary)]/50 rounded-xl p-4">
                  <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">Requested</p>
                  <p className="text-white text-sm">{new Date(selectedRequest.created_at).toLocaleString()}</p>
                </div>
              </div>

              <div className="bg-[var(--bg-primary)]/50 rounded-xl p-4">
                <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">Reason</p>
                <p className="text-white text-sm">{formatReason(selectedRequest.reason) || selectedRequest.reason}</p>
                {selectedRequest.customer_notes && (
                  <>
                    <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2 mt-4">Customer Notes</p>
                    <p className="text-white text-sm">{selectedRequest.customer_notes}</p>
                  </>
                )}
              </div>

              <div>
                <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-3">Refund Items</p>
                <div className="bg-[var(--bg-primary)]/50 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="text-left py-2 px-4 text-[var(--text-muted)] font-medium">Product</th>
                        <th className="text-center py-2 px-4 text-[var(--text-muted)] font-medium">Qty</th>
                        <th className="text-right py-2 px-4 text-[var(--text-muted)] font-medium">Unit Price</th>
                        <th className="text-right py-2 px-4 text-[var(--text-muted)] font-medium">Refund</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedRequest.items || []).map((item, idx) => (
                        <tr key={idx} className="border-b border-[var(--border)]/50">
                          <td className="py-2 px-4 text-white">{item.product_name}</td>
                          <td className="py-2 px-4 text-center text-white">{item.quantity}</td>
                          <td className="py-2 px-4 text-right text-white">{formatCurrency(item.unit_price)}</td>
                          <td className="py-2 px-4 text-right text-[var(--gold-primary)] font-semibold">{formatCurrency(item.refund_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-4 py-3 border-t border-[var(--border)] flex justify-between items-center">
                    <span className="text-sm text-[var(--text-muted)]">Total Refund</span>
                    <span className="text-lg font-bold text-[var(--gold-primary)]">{formatCurrency(getRefundTotal(selectedRequest.items, selectedRequest.amount_requested))}</span>
                  </div>
                </div>
              </div>

              {selectedRequest.images && selectedRequest.images.length > 0 && (
                <div>
                  <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-3">Proof Photos</p>
                  <div className="flex flex-wrap gap-3">
                    {selectedRequest.images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setImageZoom(img.image_url)}
                        className="w-20 h-20 rounded-lg overflow-hidden border border-[var(--border)] hover:border-[var(--gold-primary)] transition-colors"
                      >
                        <img src={img.image_url} alt={`Proof ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedRequest.status === 'pending' && (
                <div>
                  <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">Admin Notes</p>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add internal notes (optional)..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] text-sm text-white placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--gold-primary)] resize-none"
                  />
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => handleUpdateStatus('approved')}
                      disabled={updatingStatus}
                      className="flex-1 py-2.5 rounded-xl bg-green-500 text-white font-bold text-sm hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {updatingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Approve
                    </button>
                    <button
                      onClick={() => handleUpdateStatus('rejected')}
                      disabled={updatingStatus}
                      className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {updatingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      Reject
                    </button>
                  </div>
                </div>
              )}

              {selectedRequest.status === 'pending_payment_verification' && (
                <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
                  <p className="text-sm text-violet-300/90 leading-relaxed">
                    <Clock className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
                    Refund is pending payment verification. Verify or reject the associated payment first.
                  </p>
                </div>
              )}

              {selectedRequest.status === 'approved' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleUpdateStatus('processing')}
                    disabled={updatingStatus}
                    className="flex-1 py-2.5 rounded-xl bg-sky-500 text-white font-bold text-sm hover:bg-sky-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {updatingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                    Mark Processing
                  </button>
                </div>
              )}

              {selectedRequest.status === 'processing' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleUpdateStatus('refunded')}
                    disabled={updatingStatus}
                    className="flex-1 py-2.5 rounded-xl bg-[var(--gold-primary)] text-[var(--text-dark)] font-bold text-sm hover:shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {updatingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Mark as Refunded
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {imageZoom && (
        <ImageZoomModal src={imageZoom} alt="Refund proof" onClose={() => setImageZoom(null)} />
      )}
    </motion.div>
  )
}