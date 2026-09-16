import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Star,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  RefreshCw,
  Loader2,
  Trash2,
  MessageSquare,
  Package,
  Guitar,
  Clock,
  Filter,
  Eye,
  X
} from 'lucide-react'
import { adminApi } from '../../../utils/adminApi'

function StarRating({ rating, size = 'w-3.5 h-3.5' }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${size} ${
            star <= rating
              ? 'fill-[var(--gold-primary)] text-[var(--gold-primary)]'
              : 'text-zinc-600 fill-zinc-800'
          }`}
        />
      ))}
    </div>
  )
}

export default function ReviewModerationTab({ showToast = () => {}, user }) {
  const [reviews, setReviews] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 15, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)

  // Filters
  const [typeFilter, setTypeFilter] = useState('all') // 'all' | 'product' | 'customization'
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'pending' | 'approved' | 'rejected'
  const [searchQuery, setSearchQuery] = useState('')

  // Selected for full detail modal
  const [selectedReview, setSelectedReview] = useState(null)
  const [actionLoadingId, setActionLoadingId] = useState(null)

  // Reject / Note Modal
  const [rejectModalTarget, setRejectModalTarget] = useState(null)
  const [adminNotes, setAdminNotes] = useState('')

  const fetchReviews = useCallback(async (page = 1) => {
    try {
      setLoading(true)
      const params = {
        type: typeFilter,
        status: statusFilter,
        page,
        pageSize: pagination.pageSize,
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim()
      }
      const res = await adminApi.getAdminReviews(params)
      setReviews(res.data?.data || [])
      if (res.data?.pagination) {
        setPagination(res.data.pagination)
      }
    } catch (err) {
      console.error('Failed to fetch reviews:', err)
      showToast(err.message || 'Failed to load reviews.')
    } finally {
      setLoading(false)
    }
  }, [typeFilter, statusFilter, searchQuery, pagination.pageSize, showToast])

  useEffect(() => {
    fetchReviews(1)
  }, [typeFilter, statusFilter])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    fetchReviews(1)
  }

  const handleStatusUpdate = async (item, newStatus, notes = null) => {
    setActionLoadingId(item.id)
    try {
      if (item.feedback_type === 'product') {
        await adminApi.updateAdminProductReviewStatus(item.id, {
          status: newStatus,
          admin_notes: notes !== null ? notes : item.admin_notes,
        })
      } else {
        await adminApi.updateAdminCustomizationFeedbackStatus(item.id, {
          status: newStatus,
          admin_notes: notes !== null ? notes : item.admin_notes,
        })
      }
      showToast(`Review status updated to ${newStatus}.`)
      setRejectModalTarget(null)
      setAdminNotes('')
      fetchReviews(pagination.page)
    } catch (err) {
      console.error('Failed to update status:', err)
      showToast(err.message || 'Failed to update review status.')
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleDelete = async (item) => {
    if (!window.confirm('Are you sure you want to remove this review? This action cannot be undone.')) {
      return
    }

    setActionLoadingId(item.id)
    try {
      if (item.feedback_type === 'product') {
        await adminApi.deleteAdminProductReview(item.id)
      } else {
        await adminApi.deleteAdminCustomizationFeedback(item.id)
      }
      showToast('Review removed successfully.')
      fetchReviews(pagination.page)
    } catch (err) {
      console.error('Failed to delete review:', err)
      showToast(err.message || 'Failed to delete review.')
    } finally {
      setActionLoadingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)]">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search by order #, product, or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] text-sm text-white placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--gold-primary)]"
          />
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-[var(--text-muted)]" />
        </form>

        <div className="flex flex-wrap items-center gap-3">
          {/* Type Filter */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-black/40 border border-[var(--border)]">
            {[
              { id: 'all', label: 'All' },
              { id: 'product', label: 'Products' },
              { id: 'customization', label: 'Custom' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTypeFilter(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  typeFilter === t.id
                    ? 'bg-[var(--gold-primary)] text-[var(--text-dark)]'
                    : 'text-[var(--text-muted)] hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-black/40 border border-[var(--border)]">
            {[
              { id: 'all', label: 'All Status' },
              { id: 'approved', label: 'Approved' },
              { id: 'pending', label: 'Pending' },
              { id: 'rejected', label: 'Rejected' },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStatusFilter(s.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === s.id
                    ? 'bg-white/15 text-white'
                    : 'text-[var(--text-muted)] hover:text-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            type="button"
            onClick={() => fetchReviews(pagination.page)}
            disabled={loading}
            className="p-2 rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:text-white hover:bg-white/5 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[var(--gold-primary)]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Reviews List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--gold-primary)] mb-3" />
          <p className="text-sm text-[var(--text-muted)]">Loading ratings & feedback...</p>
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-12 text-center">
          <Star className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-2 opacity-40" />
          <p className="text-base font-bold text-white">No ratings or feedback found</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Customer reviews and customization feedback will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((item) => {
            const isProduct = item.feedback_type === 'product'
            const isApproved = item.status === 'approved'
            const isPending = item.status === 'pending'
            const isRejected = item.status === 'rejected'
            const isLoading = actionLoadingId === item.id

            return (
              <div
                key={`${item.feedback_type}-${item.id}`}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-5 hover:border-[var(--gold-primary)]/30 transition-all space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-[var(--border)] pb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                        isProduct
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                          : 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                      }`}>
                        {isProduct ? <Package className="w-3 h-3" /> : <Guitar className="w-3 h-3" />}
                        {isProduct ? 'Product Review' : 'Custom Build Feedback'}
                      </span>

                      <span className="font-mono text-xs font-semibold text-[var(--gold-primary)]">
                        {item.order_number}
                      </span>
                    </div>

                    <h4 className="font-bold text-white text-base">
                      {item.target_name}
                    </h4>

                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      By <span className="text-zinc-300 font-medium">{item.user_full_name?.trim() || item.user_email}</span> ({item.user_email}) • {new Date(item.created_at).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 sm:self-start">
                    {/* Status Badge */}
                    {isApproved && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approved
                      </span>
                    )}
                    {isPending && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        <Clock className="w-3.5 h-3.5" />
                        Pending Moderation
                      </span>
                    )}
                    {isRejected && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/30">
                        <XCircle className="w-3.5 h-3.5" />
                        Rejected
                      </span>
                    )}
                  </div>
                </div>

                {/* Ratings Content */}
                <div className="space-y-3">
                  {isProduct ? (
                    <div className="flex items-center gap-3">
                      <StarRating rating={item.rating} size="w-4 h-4" />
                      {item.title && (
                        <span className="font-semibold text-white text-sm">
                          "{item.title}"
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs p-3 rounded-xl bg-black/40 border border-white/5">
                      <div>
                        <span className="text-zinc-400 block mb-0.5">Overall</span>
                        <StarRating rating={item.rating} />
                      </div>
                      <div>
                        <span className="text-zinc-400 block mb-0.5">Quality</span>
                        <StarRating rating={item.build_quality_rating} />
                      </div>
                      <div>
                        <span className="text-zinc-400 block mb-0.5">Communication</span>
                        <StarRating rating={item.communication_rating} />
                      </div>
                      <div>
                        <span className="text-zinc-400 block mb-0.5">Accuracy</span>
                        <StarRating rating={item.accuracy_rating} />
                      </div>
                    </div>
                  )}

                  <p className="text-sm text-zinc-200 bg-[var(--bg-primary)] p-3.5 rounded-xl border border-white/5 whitespace-pre-wrap">
                    {item.comment}
                  </p>

                  {/* Photo Attachments */}
                  {Array.isArray(item.images) && item.images.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {item.images.map((img, idx) => (
                        <a key={idx} href={img} target="_blank" rel="noreferrer">
                          <img
                            src={img}
                            alt="Attachment"
                            className="w-14 h-14 object-cover rounded-xl border border-white/10 hover:border-[var(--gold-primary)] transition-colors"
                          />
                        </a>
                      ))}
                    </div>
                  )}

                  {item.admin_notes && (
                    <div className="text-xs text-amber-300/90 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                      <strong>Admin Notes:</strong> {item.admin_notes}
                    </div>
                  )}
                </div>

                {/* Moderation Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
                  <span className="text-xs text-[var(--text-muted)] font-mono">
                    ID: {item.id.slice(0, 8)}...
                  </span>

                  <div className="flex items-center gap-2">
                    {!isApproved && (
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleStatusUpdate(item, 'approved')}
                        className="px-3.5 py-1.5 rounded-xl bg-green-500/15 border border-green-500/40 text-green-400 hover:bg-green-500/25 text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve
                      </button>
                    )}

                    {!isRejected && (
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => {
                          setRejectModalTarget(item)
                          setAdminNotes(item.admin_notes || '')
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-400 hover:bg-amber-500/25 text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject / Flag
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleDelete(item)}
                      className="p-1.5 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete review"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <span className="text-xs text-[var(--text-muted)]">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} reviews)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchReviews(pagination.page - 1)}
                  className="px-3 py-1 rounded-lg border border-[var(--border)] text-xs text-white disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchReviews(pagination.page + 1)}
                  className="px-3 py-1 rounded-lg border border-[var(--border)] text-xs text-white disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reject / Moderation Note Modal */}
      <AnimatePresence>
        {rejectModalTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-md relative shadow-2xl"
            >
              <button
                type="button"
                onClick={() => setRejectModalTarget(null)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <h4 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                Reject or Flag Review
              </h4>
              <p className="text-xs text-[var(--text-muted)] mb-4">
                State the reason or internal moderation notes for rejecting this review.
              </p>

              <textarea
                rows={4}
                placeholder="e.g. Inappropriate language, spam, or contains sensitive personal info..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] text-sm text-white focus:outline-none focus:border-[var(--gold-primary)] resize-none mb-4"
              />

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setRejectModalTarget(null)}
                  className="flex-1 py-2 rounded-xl border border-[var(--border)] text-zinc-300 text-xs font-semibold hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusUpdate(rejectModalTarget, 'rejected', adminNotes)}
                  className="flex-1 py-2 rounded-xl bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30 text-xs font-bold transition-all"
                >
                  Confirm Rejection
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
