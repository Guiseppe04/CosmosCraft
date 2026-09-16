import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Star,
  CheckCircle2,
  AlertCircle,
  Clock,
  Edit3,
  Eye,
  Camera,
  X,
  Loader2,
  Package,
  Guitar,
  Sparkles,
  MessageSquare
} from 'lucide-react'
import { adminApi } from '../../utils/adminApi'
import { uploadToCloudinary } from '../../utils/cloudinary'

function StarRatingDisplay({ rating, maxStars = 5, size = 'w-4 h-4' }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: maxStars }).map((_, idx) => {
        const starNum = idx + 1
        return (
          <Star
            key={starNum}
            className={`${size} ${
              starNum <= rating
                ? 'fill-[var(--gold-primary)] text-[var(--gold-primary)]'
                : 'text-zinc-600 fill-zinc-800'
            }`}
          />
        )
      })}
    </div>
  )
}

function InteractiveStarPicker({ rating, onChange, maxStars = 5, size = 'w-7 h-7' }) {
  const [hovered, setHovered] = useState(0)

  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: maxStars }).map((_, idx) => {
        const starNum = idx + 1
        const active = hovered ? starNum <= hovered : starNum <= rating
        return (
          <button
            key={starNum}
            type="button"
            onClick={() => onChange(starNum)}
            onMouseEnter={() => setHovered(starNum)}
            onMouseLeave={() => setHovered(0)}
            className="p-1 transition-transform hover:scale-115 focus:outline-none"
          >
            <Star
              className={`${size} transition-colors ${
                active
                  ? 'fill-[var(--gold-primary)] text-[var(--gold-primary)] drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]'
                  : 'text-zinc-600 fill-zinc-800 hover:text-zinc-400'
              }`}
            />
          </button>
        )
      })}
      <span className="ml-2 text-sm font-semibold text-[var(--gold-primary)]">
        {(hovered || rating) > 0 ? `${hovered || rating} / 5` : ''}
      </span>
    </div>
  )
}

export default function RatingsFeedbackTab({ showToast = () => {} }) {
  const [productItems, setProductItems] = useState([])
  const [customizationItems, setCustomizationItems] = useState([])
  const [loading, setLoading] = useState(true)

  // Active section filter inside Ratings & Feedback if user wants to focus
  const [viewFilter, setViewFilter] = useState('all') // 'all' | 'products' | 'customizations'

  // Modal States
  const [activeModal, setActiveModal] = useState(null) // 'rate-product' | 'edit-product' | 'leave-custom' | 'edit-custom' | 'view-review' | 'view-feedback'
  const [selectedTarget, setSelectedTarget] = useState(null)

  // Form States
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [productForm, setProductForm] = useState({
    rating: 5,
    title: '',
    comment: '',
    images: [],
  })
  const [customForm, setCustomForm] = useState({
    overall_rating: 5,
    build_quality_rating: 5,
    communication_rating: 5,
    accuracy_rating: 5,
    comment: '',
    images: [],
  })
  const [uploadingImage, setUploadingImage] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [prodRes, custRes] = await Promise.all([
        adminApi.getProductReviewEligibility().catch(() => ({ data: { items: [] } })),
        adminApi.getCustomizationFeedbackEligibility().catch(() => ({ data: { items: [] } })),
      ])
      setProductItems(prodRes.data?.items || [])
      setCustomizationItems(custRes.data?.items || [])
    } catch (err) {
      console.error('Failed to load ratings eligibility:', err)
      showToast('Failed to load feedback eligibility.')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Open Rate / Edit Product Modal
  const openProductReviewModal = (item, isEdit = false) => {
    setSelectedTarget(item)
    if (isEdit && item.review) {
      setProductForm({
        rating: item.review.rating || 5,
        title: item.review.title || '',
        comment: item.review.comment || '',
        images: Array.isArray(item.review.images) ? item.review.images : [],
      })
      setActiveModal('edit-product')
    } else {
      setProductForm({
        rating: 5,
        title: '',
        comment: '',
        images: [],
      })
      setActiveModal('rate-product')
    }
  }

  // Open Customization Feedback Modal
  const openCustomFeedbackModal = (item, isEdit = false) => {
    setSelectedTarget(item)
    if (isEdit && item.feedback) {
      setCustomForm({
        overall_rating: item.feedback.overall_rating || 5,
        build_quality_rating: item.feedback.build_quality_rating || 5,
        communication_rating: item.feedback.communication_rating || 5,
        accuracy_rating: item.feedback.accuracy_rating || 5,
        comment: item.feedback.comment || '',
        images: Array.isArray(item.feedback.images) ? item.feedback.images : [],
      })
      setActiveModal('edit-custom')
    } else {
      setCustomForm({
        overall_rating: 5,
        build_quality_rating: 5,
        communication_rating: 5,
        accuracy_rating: 5,
        comment: '',
        images: [],
      })
      setActiveModal('leave-custom')
    }
  }

  // Handle Photo Upload
  const handleImageUpload = async (e, type) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    setUploadingImage(true)
    try {
      const uploadedUrls = []
      for (const file of files.slice(0, 3)) {
        const url = await uploadToCloudinary(file, { folder: 'cosmoscraft_reviews' })
        uploadedUrls.push(url)
      }

      if (type === 'product') {
        setProductForm(prev => ({
          ...prev,
          images: [...prev.images, ...uploadedUrls].slice(0, 5),
        }))
      } else {
        setCustomForm(prev => ({
          ...prev,
          images: [...prev.images, ...uploadedUrls].slice(0, 5),
        }))
      }
      showToast('Photo uploaded successfully!')
    } catch (err) {
      console.error('Image upload failed:', err)
      showToast('Failed to upload image. Please try again.')
    } finally {
      setUploadingImage(false)
      e.target.value = ''
    }
  }

  // Submit Product Review
  const handleSubmitProductReview = async (e) => {
    e.preventDefault()
    if (!productForm.comment.trim()) {
      showToast('Please provide a review comment.')
      return
    }

    setIsSubmitting(true)
    try {
      if (activeModal === 'edit-product') {
        await adminApi.updateProductReview(selectedTarget.review.review_id, {
          rating: productForm.rating,
          title: productForm.title.trim(),
          comment: productForm.comment.trim(),
          images: productForm.images,
        })
        showToast('Review updated successfully!')
      } else {
        await adminApi.createProductReview({
          order_id: selectedTarget.order_id,
          order_item_id: selectedTarget.order_item_id,
          rating: productForm.rating,
          title: productForm.title.trim(),
          comment: productForm.comment.trim(),
          images: productForm.images,
        })
        showToast('Thank you! Your review was submitted successfully.')
      }
      setActiveModal(null)
      fetchData()
    } catch (err) {
      console.error('Failed to submit product review:', err)
      showToast(err.message || 'Failed to submit review.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Submit Customization Feedback
  const handleSubmitCustomFeedback = async (e) => {
    e.preventDefault()
    if (!customForm.comment.trim()) {
      showToast('Please provide your feedback comments.')
      return
    }

    setIsSubmitting(true)
    try {
      if (activeModal === 'edit-custom') {
        await adminApi.updateCustomizationFeedback(selectedTarget.feedback.feedback_id, {
          overall_rating: customForm.overall_rating,
          build_quality_rating: customForm.build_quality_rating,
          communication_rating: customForm.communication_rating,
          accuracy_rating: customForm.accuracy_rating,
          comment: customForm.comment.trim(),
          images: customForm.images,
        })
        showToast('Customization feedback updated!')
      } else {
        await adminApi.createCustomizationFeedback({
          order_id: selectedTarget.order_id,
          overall_rating: customForm.overall_rating,
          build_quality_rating: customForm.build_quality_rating,
          communication_rating: customForm.communication_rating,
          accuracy_rating: customForm.accuracy_rating,
          comment: customForm.comment.trim(),
          images: customForm.images,
        })
        showToast('Thank you! Your customization feedback was submitted successfully.')
      }
      setActiveModal(null)
      fetchData()
    } catch (err) {
      console.error('Failed to submit customization feedback:', err)
      showToast(err.message || 'Failed to submit feedback.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const removeProductImage = (idx) => {
    setProductForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== idx),
    }))
  }

  const removeCustomImage = (idx) => {
    setCustomForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== idx),
    }))
  }

  return (
    <div className="space-y-8">
      {/* Header & Sub-filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-[var(--gold-primary)]" />
            Ratings & Feedback
          </h3>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Share your experience with purchased products and completed custom builds.
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-black/40 border border-[var(--border)] rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setViewFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewFilter === 'all'
                ? 'bg-[var(--gold-primary)] text-[var(--text-dark)] shadow-[0_0_10px_rgba(212,175,55,0.3)]'
                : 'text-[var(--text-muted)] hover:text-white'
            }`}
          >
            All Feedback ({productItems.length + customizationItems.length})
          </button>
          <button
            type="button"
            onClick={() => setViewFilter('products')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewFilter === 'products'
                ? 'bg-[var(--gold-primary)] text-[var(--text-dark)] shadow-[0_0_10px_rgba(212,175,55,0.3)]'
                : 'text-[var(--text-muted)] hover:text-white'
            }`}
          >
            Products ({productItems.length})
          </button>
          <button
            type="button"
            onClick={() => setViewFilter('customizations')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewFilter === 'customizations'
                ? 'bg-[var(--gold-primary)] text-[var(--text-dark)] shadow-[0_0_10px_rgba(212,175,55,0.3)]'
                : 'text-[var(--text-muted)] hover:text-white'
            }`}
          >
            Customizations ({customizationItems.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--gold-primary)] mb-3" />
          <p className="text-sm text-[var(--text-muted)]">Loading feedback eligibility...</p>
        </div>
      ) : (
        <div className="space-y-12">
          {/* ========================================================================= */}
          {/* 1. PRODUCT REVIEWS SECTION */}
          {/* ========================================================================= */}
          {(viewFilter === 'all' || viewFilter === 'products') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-[var(--gold-primary)]" />
                  <h4 className="text-lg font-bold text-white">Product Reviews</h4>
                </div>
                <span className="text-xs text-[var(--text-muted)] font-medium">
                  {productItems.filter(i => i.eligibility_status === 'eligible').length} to rate
                </span>
              </div>

              {productItems.length === 0 ? (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-8 text-center">
                  <Package className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-semibold text-white">No products found</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Products you purchase will appear here once they are fulfilled.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {productItems.map((item) => {
                    const isEligible = item.eligibility_status === 'eligible'
                    const isReviewed = item.eligibility_status === 'reviewed'
                    const isIneligible = item.eligibility_status === 'ineligible'

                    return (
                      <div
                        key={item.order_item_id}
                        className={`rounded-2xl border p-5 transition-all flex flex-col justify-between ${
                          isEligible
                            ? 'bg-[var(--bg-primary)] border-[var(--gold-primary)]/40 hover:border-[var(--gold-primary)] shadow-sm'
                            : isReviewed
                            ? 'bg-[var(--bg-primary)] border-white/10'
                            : 'bg-black/30 border-white/5 opacity-80'
                        }`}
                      >
                        <div>
                          {/* Card Header with Status Badge */}
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-3 min-w-0">
                              {item.product_image ? (
                                <img
                                  src={item.product_image}
                                  alt={item.product_name}
                                  className="w-12 h-12 rounded-xl object-contain bg-black/40 border border-white/10 shrink-0"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-xl bg-[var(--surface-light)] border border-white/10 flex items-center justify-center shrink-0">
                                  <Package className="w-6 h-6 text-[var(--text-muted)]" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <h5 className="font-bold text-white text-sm truncate" title={item.product_name}>
                                  {item.product_name}
                                </h5>
                                <p className="text-xs font-mono text-[var(--gold-primary)] mt-0.5">
                                  {item.order_number}
                                </p>
                              </div>
                            </div>

                            {/* Eligibility Badge */}
                            <div>
                              {isReviewed ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/30 whitespace-nowrap">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Reviewed
                                </span>
                              ) : isEligible ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--gold-primary)]/10 text-[var(--gold-primary)] border border-[var(--gold-primary)]/30 whitespace-nowrap animate-pulse">
                                  <Sparkles className="w-3.5 h-3.5" />
                                  Ready to Rate
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700 whitespace-nowrap">
                                  <Clock className="w-3.5 h-3.5" />
                                  Not yet eligible
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Purchase Info */}
                          <div className="text-xs text-[var(--text-muted)] mb-3 space-y-0.5">
                            <p>Purchased: {item.purchased_date ? new Date(item.purchased_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}</p>
                            {item.fulfilled_date && (
                              <p>Received: {new Date(item.fulfilled_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                            )}
                          </div>

                          {/* Reviewed Content Snippet */}
                          {isReviewed && item.review && (
                            <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-2 mb-4">
                              <div className="flex items-center justify-between">
                                <StarRatingDisplay rating={item.review.rating} />
                                <span className="text-[11px] text-[var(--text-muted)]">
                                  {new Date(item.review.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              {item.review.title && (
                                <p className="text-xs font-semibold text-white">{item.review.title}</p>
                              )}
                              <p className="text-xs text-zinc-300 italic line-clamp-2">
                                "{item.review.comment}"
                              </p>
                              {Array.isArray(item.review.images) && item.review.images.length > 0 && (
                                <div className="flex gap-2 pt-1">
                                  {item.review.images.slice(0, 3).map((img, idx) => (
                                    <img
                                      key={idx}
                                      src={img}
                                      alt="review"
                                      className="w-10 h-10 object-cover rounded-lg border border-white/10"
                                    />
                                  ))}
                                  {item.review.images.length > 3 && (
                                    <div className="w-10 h-10 rounded-lg bg-black/60 border border-white/10 flex items-center justify-center text-[10px] text-zinc-400">
                                      +{item.review.images.length - 3}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Ineligible Explanation */}
                          {isIneligible && (
                            <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-400 flex items-start gap-2 mb-4">
                              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                              <span>{item.ineligible_reason || 'Item must be received before leaving a review.'}</span>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-3 border-t border-white/5 flex items-center justify-end gap-2.5">
                          {isEligible && (
                            <button
                              type="button"
                              onClick={() => openProductReviewModal(item, false)}
                              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-bold text-xs hover:shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all flex items-center gap-1.5"
                            >
                              <Star className="w-3.5 h-3.5 fill-current" />
                              Rate Product
                            </button>
                          )}

                          {isReviewed && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedTarget(item)
                                  setActiveModal('view-review')
                                }}
                                className="px-3.5 py-1.5 rounded-xl border border-[var(--border)] text-zinc-300 hover:text-white hover:bg-white/5 text-xs font-semibold transition-colors flex items-center gap-1.5"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                View Review
                              </button>
                              <button
                                type="button"
                                onClick={() => openProductReviewModal(item, true)}
                                className="px-3.5 py-1.5 rounded-xl border border-[var(--gold-primary)]/40 text-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/10 text-xs font-semibold transition-colors flex items-center gap-1.5"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                Edit Review
                              </button>
                            </>
                          )}

                          {isIneligible && (
                            <span className="text-[11px] text-zinc-500 italic">
                              Rating unlocked upon delivery
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* 2. CUSTOMIZATION FEEDBACK SECTION */}
          {/* ========================================================================= */}
          {(viewFilter === 'all' || viewFilter === 'customizations') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <div className="flex items-center gap-2">
                  <Guitar className="w-5 h-5 text-[var(--gold-primary)]" />
                  <h4 className="text-lg font-bold text-white">Customization Feedback</h4>
                </div>
                <span className="text-xs text-[var(--text-muted)] font-medium">
                  {customizationItems.filter(i => i.eligibility_status === 'eligible').length} builds to review
                </span>
              </div>

              {customizationItems.length === 0 ? (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-8 text-center">
                  <Guitar className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-semibold text-white">No custom builds found</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Your custom guitar orders will appear here once they are completed and fulfilled.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customizationItems.map((item) => {
                    const isEligible = item.eligibility_status === 'eligible'
                    const isReviewed = item.eligibility_status === 'reviewed'
                    const isIneligible = item.eligibility_status === 'ineligible'

                    return (
                      <div
                        key={item.order_id}
                        className={`rounded-2xl border p-5 transition-all flex flex-col justify-between ${
                          isEligible
                            ? 'bg-[var(--bg-primary)] border-[var(--gold-primary)]/40 hover:border-[var(--gold-primary)] shadow-sm'
                            : isReviewed
                            ? 'bg-[var(--bg-primary)] border-white/10'
                            : 'bg-black/30 border-white/5 opacity-80'
                        }`}
                      >
                        <div>
                          {/* Header with Title & Order Number */}
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="min-w-0">
                              <h5 className="font-bold text-white text-base truncate">
                                {item.title || 'Custom Guitar Build'}
                              </h5>
                              <p className="text-xs font-mono text-[var(--gold-primary)] mt-0.5">
                                {item.order_number}
                              </p>
                            </div>

                            {/* Eligibility Badge */}
                            <div>
                              {isReviewed ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/30 whitespace-nowrap">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Feedback Submitted
                                </span>
                              ) : isEligible ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--gold-primary)]/10 text-[var(--gold-primary)] border border-[var(--gold-primary)]/30 whitespace-nowrap animate-pulse">
                                  <Sparkles className="w-3.5 h-3.5" />
                                  Eligible for Feedback
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700 whitespace-nowrap">
                                  <Clock className="w-3.5 h-3.5" />
                                  Not yet eligible
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Fulfillment Info */}
                          <div className="text-xs text-[var(--text-muted)] mb-3">
                            <p>
                              {item.fulfilled_date
                                ? `Fulfilled: ${new Date(item.fulfilled_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                                : `Ordered: ${new Date(item.order_created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}
                            </p>
                          </div>

                          {/* Reviewed Detailed Dimensions */}
                          {isReviewed && item.feedback && (
                            <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-3 mb-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-zinc-400">Overall Experience</span>
                                  <StarRatingDisplay rating={item.feedback.overall_rating} size="w-3.5 h-3.5" />
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-zinc-400">Build Quality</span>
                                  <StarRatingDisplay rating={item.feedback.build_quality_rating} size="w-3.5 h-3.5" />
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-zinc-400">Communication</span>
                                  <StarRatingDisplay rating={item.feedback.communication_rating} size="w-3.5 h-3.5" />
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-zinc-400">Customization Accuracy</span>
                                  <StarRatingDisplay rating={item.feedback.accuracy_rating} size="w-3.5 h-3.5" />
                                </div>
                              </div>

                              <p className="text-xs text-zinc-300 italic pt-1 border-t border-white/5 line-clamp-2">
                                "{item.feedback.comment}"
                              </p>

                              {Array.isArray(item.feedback.images) && item.feedback.images.length > 0 && (
                                <div className="flex gap-2 pt-1">
                                  {item.feedback.images.slice(0, 3).map((img, idx) => (
                                    <img
                                      key={idx}
                                      src={img}
                                      alt="feedback build"
                                      className="w-10 h-10 object-cover rounded-lg border border-white/10"
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Ineligible Explanation */}
                          {isIneligible && (
                            <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-400 flex items-start gap-2 mb-4">
                              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                              <span>{item.ineligible_reason || 'Your customization must be completed and fulfilled before you can leave feedback.'}</span>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-3 border-t border-white/5 flex items-center justify-end gap-2.5">
                          {isEligible && (
                            <button
                              type="button"
                              onClick={() => openCustomFeedbackModal(item, false)}
                              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-bold text-xs hover:shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all flex items-center gap-1.5"
                            >
                              <MessageSquare className="w-3.5 h-3.5 fill-current" />
                              Leave Feedback
                            </button>
                          )}

                          {isReviewed && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedTarget(item)
                                  setActiveModal('view-feedback')
                                }}
                                className="px-3.5 py-1.5 rounded-xl border border-[var(--border)] text-zinc-300 hover:text-white hover:bg-white/5 text-xs font-semibold transition-colors flex items-center gap-1.5"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                View Feedback
                              </button>
                              <button
                                type="button"
                                onClick={() => openCustomFeedbackModal(item, true)}
                                className="px-3.5 py-1.5 rounded-xl border border-[var(--gold-primary)]/40 text-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/10 text-xs font-semibold transition-colors flex items-center gap-1.5"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                Edit Feedback
                              </button>
                            </>
                          )}

                          {isIneligible && (
                            <span className="text-[11px] text-zinc-500 italic">
                              Feedback unlocks upon build completion
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RATE / EDIT PRODUCT REVIEW */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {(activeModal === 'rate-product' || activeModal === 'edit-product') && selectedTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-lg relative shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <h4 className="text-xl font-bold text-white mb-1">
                {activeModal === 'edit-product' ? 'Edit Product Review' : 'Rate Product'}
              </h4>
              <p className="text-xs text-[var(--text-muted)] mb-5">
                {selectedTarget.product_name} • <span className="font-mono text-[var(--gold-primary)]">{selectedTarget.order_number}</span>
              </p>

              <form onSubmit={handleSubmitProductReview} className="space-y-5">
                {/* Star Rating Picker */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-2">
                    Overall Rating <span className="text-red-400">*</span>
                  </label>
                  <InteractiveStarPicker
                    rating={productForm.rating}
                    onChange={(r) => setProductForm(prev => ({ ...prev, rating: r }))}
                  />
                </div>

                {/* Review Title */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Review Headline (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Exceptional sound and pristine finish!"
                    value={productForm.title}
                    onChange={(e) => setProductForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] text-sm text-white focus:outline-none focus:border-[var(--gold-primary)]"
                  />
                </div>

                {/* Review Comment */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Your Review <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="What did you like about this product? Tone, craftsmanship, accessories?"
                    value={productForm.comment}
                    onChange={(e) => setProductForm(prev => ({ ...prev, comment: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] text-sm text-white resize-none focus:outline-none focus:border-[var(--gold-primary)]"
                  />
                </div>

                {/* Photo Upload */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-2">
                    Attach Photos (optional)
                  </label>
                  <div className="flex flex-wrap gap-2 items-center">
                    {productForm.images.map((img, i) => (
                      <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/20 group">
                        <img src={img} alt="review attachment" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeProductImage(i)}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-red-400 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}

                    {productForm.images.length < 5 && (
                      <label className="w-16 h-16 rounded-xl border-2 border-dashed border-[var(--border)] hover:border-[var(--gold-primary)] cursor-pointer flex flex-col items-center justify-center text-[var(--text-muted)] hover:text-white transition-colors">
                        {uploadingImage ? (
                          <Loader2 className="w-4 h-4 animate-spin text-[var(--gold-primary)]" />
                        ) : (
                          <>
                            <Camera className="w-4 h-4 mb-0.5" />
                            <span className="text-[9px]">Add</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          disabled={uploadingImage}
                          onChange={(e) => handleImageUpload(e, 'product')}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-4 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-sm font-semibold text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || uploadingImage}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-bold text-sm hover:shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {activeModal === 'edit-product' ? 'Update Review' : 'Submit Review'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL: LEAVE / EDIT CUSTOMIZATION FEEDBACK */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {(activeModal === 'leave-custom' || activeModal === 'edit-custom') && selectedTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-lg relative shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <h4 className="text-xl font-bold text-white mb-1">
                {activeModal === 'edit-custom' ? 'Edit Customization Feedback' : 'Leave Customization Feedback'}
              </h4>
              <p className="text-xs text-[var(--text-muted)] mb-5">
                {selectedTarget.title || 'Custom Guitar Build'} • <span className="font-mono text-[var(--gold-primary)]">{selectedTarget.order_number}</span>
              </p>

              <form onSubmit={handleSubmitCustomFeedback} className="space-y-5">
                {/* 4 Multi-criteria Rating Dimensions */}
                <div className="space-y-3.5 p-4 rounded-xl bg-black/40 border border-white/5">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Overall Experience <span className="text-red-400">*</span>
                    </label>
                    <InteractiveStarPicker
                      rating={customForm.overall_rating}
                      onChange={(r) => setCustomForm(prev => ({ ...prev, overall_rating: r }))}
                      size="w-5 h-5"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Build Quality & Craftsmanship <span className="text-red-400">*</span>
                    </label>
                    <InteractiveStarPicker
                      rating={customForm.build_quality_rating}
                      onChange={(r) => setCustomForm(prev => ({ ...prev, build_quality_rating: r }))}
                      size="w-5 h-5"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Luthier Communication <span className="text-red-400">*</span>
                    </label>
                    <InteractiveStarPicker
                      rating={customForm.communication_rating}
                      onChange={(r) => setCustomForm(prev => ({ ...prev, communication_rating: r }))}
                      size="w-5 h-5"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Customization Accuracy to Specification <span className="text-red-400">*</span>
                    </label>
                    <InteractiveStarPicker
                      rating={customForm.accuracy_rating}
                      onChange={(r) => setCustomForm(prev => ({ ...prev, accuracy_rating: r }))}
                      size="w-5 h-5"
                    />
                  </div>
                </div>

                {/* Feedback Comment */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Your Feedback <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="How does your custom guitar feel, look, and perform? How was your experience working with our builders?"
                    value={customForm.comment}
                    onChange={(e) => setCustomForm(prev => ({ ...prev, comment: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] text-sm text-white resize-none focus:outline-none focus:border-[var(--gold-primary)]"
                  />
                </div>

                {/* Photo Upload */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-2">
                    Show off your custom build (optional)
                  </label>
                  <div className="flex flex-wrap gap-2 items-center">
                    {customForm.images.map((img, i) => (
                      <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/20 group">
                        <img src={img} alt="custom build attachment" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeCustomImage(i)}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-red-400 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}

                    {customForm.images.length < 5 && (
                      <label className="w-16 h-16 rounded-xl border-2 border-dashed border-[var(--border)] hover:border-[var(--gold-primary)] cursor-pointer flex flex-col items-center justify-center text-[var(--text-muted)] hover:text-white transition-colors">
                        {uploadingImage ? (
                          <Loader2 className="w-4 h-4 animate-spin text-[var(--gold-primary)]" />
                        ) : (
                          <>
                            <Camera className="w-4 h-4 mb-0.5" />
                            <span className="text-[9px]">Add</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          disabled={uploadingImage}
                          onChange={(e) => handleImageUpload(e, 'custom')}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-4 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-sm font-semibold text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || uploadingImage}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-bold text-sm hover:shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {activeModal === 'edit-custom' ? 'Update Feedback' : 'Submit Feedback'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL: VIEW REVIEW / FEEDBACK DETAILS */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {(activeModal === 'view-review' || activeModal === 'view-feedback') && selectedTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-lg relative shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <h4 className="text-xl font-bold text-white mb-1">
                {activeModal === 'view-review' ? 'Product Review Details' : 'Customization Feedback'}
              </h4>
              <p className="text-xs text-[var(--text-muted)] mb-5">
                {selectedTarget.product_name || selectedTarget.title} • <span className="font-mono text-[var(--gold-primary)]">{selectedTarget.order_number}</span>
              </p>

              {activeModal === 'view-review' && selectedTarget.review && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-black/40 border border-white/5">
                    <div>
                      <span className="text-xs text-zinc-400 block mb-1">Rating</span>
                      <StarRatingDisplay rating={selectedTarget.review.rating} size="w-5 h-5" />
                    </div>
                    <span className="text-xs text-zinc-500">
                      Submitted: {new Date(selectedTarget.review.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {selectedTarget.review.title && (
                    <div>
                      <span className="text-xs font-semibold text-zinc-400 block mb-1">Headline</span>
                      <p className="text-sm font-semibold text-white">{selectedTarget.review.title}</p>
                    </div>
                  )}

                  <div>
                    <span className="text-xs font-semibold text-zinc-400 block mb-1">Comment</span>
                    <p className="text-sm text-zinc-200 bg-[var(--bg-primary)] p-4 rounded-xl border border-white/5 whitespace-pre-wrap">
                      {selectedTarget.review.comment}
                    </p>
                  </div>

                  {Array.isArray(selectedTarget.review.images) && selectedTarget.review.images.length > 0 && (
                    <div>
                      <span className="text-xs font-semibold text-zinc-400 block mb-2">Photos</span>
                      <div className="flex flex-wrap gap-2.5">
                        {selectedTarget.review.images.map((img, i) => (
                          <a key={i} href={img} target="_blank" rel="noreferrer" className="group">
                            <img
                              src={img}
                              alt="Review attachment"
                              className="w-20 h-20 object-cover rounded-xl border border-white/10 group-hover:border-[var(--gold-primary)] transition-colors"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeModal === 'view-feedback' && selectedTarget.feedback && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-4 rounded-xl bg-black/40 border border-white/5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-zinc-400">Overall Experience</span>
                      <StarRatingDisplay rating={selectedTarget.feedback.overall_rating} size="w-3.5 h-3.5" />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-zinc-400">Build Quality</span>
                      <StarRatingDisplay rating={selectedTarget.feedback.build_quality_rating} size="w-3.5 h-3.5" />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-zinc-400">Communication</span>
                      <StarRatingDisplay rating={selectedTarget.feedback.communication_rating} size="w-3.5 h-3.5" />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-zinc-400">Customization Accuracy</span>
                      <StarRatingDisplay rating={selectedTarget.feedback.accuracy_rating} size="w-3.5 h-3.5" />
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-zinc-400 block mb-1">Feedback Comment</span>
                    <p className="text-sm text-zinc-200 bg-[var(--bg-primary)] p-4 rounded-xl border border-white/5 whitespace-pre-wrap">
                      {selectedTarget.feedback.comment}
                    </p>
                  </div>

                  {Array.isArray(selectedTarget.feedback.images) && selectedTarget.feedback.images.length > 0 && (
                    <div>
                      <span className="text-xs font-semibold text-zinc-400 block mb-2">Build Photos</span>
                      <div className="flex flex-wrap gap-2.5">
                        {selectedTarget.feedback.images.map((img, i) => (
                          <a key={i} href={img} target="_blank" rel="noreferrer" className="group">
                            <img
                              src={img}
                              alt="Build feedback attachment"
                              className="w-20 h-20 object-cover rounded-xl border border-white/10 group-hover:border-[var(--gold-primary)] transition-colors"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-[var(--border)] flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-5 py-2 rounded-xl bg-zinc-800 text-white hover:bg-zinc-700 text-xs font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
