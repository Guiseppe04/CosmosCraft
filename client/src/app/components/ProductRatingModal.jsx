import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  X,
  Star,
  CheckCircle2,
  Calendar,
  MessageSquare,
  ImageIcon,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { StarRating } from './common/StarRating.jsx'
import { feedbackService } from '../services/feedbackService'

export function ProductRatingModal({
  product,
  isOpen,
  onClose,
  onBuyNow,
  onAddToCart,
  getAddButtonState,
  isAuthenticated,
  defaultTab = 'details',
}) {
  const [activeTab, setActiveTab] = useState(defaultTab) // 'details' | 'reviews'
  const [reviewsData, setReviewsData] = useState({ reviews: [], summary: null })
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewsError, setReviewsError] = useState(null)
  const [selectedImage, setSelectedImage] = useState(null)
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    if (isOpen && product) {
      setActiveTab(defaultTab || 'details')
      setQuantity(1)
      loadProductReviews(product.id)
    } else {
      setReviewsData({ reviews: [], summary: null })
      setReviewsError(null)
      setSelectedImage(null)
      setQuantity(1)
    }
  }, [isOpen, product?.id, defaultTab])

  const loadProductReviews = async (productId) => {
    if (!productId) return
    try {
      setReviewsLoading(true)
      setReviewsError(null)
      const res = await feedbackService.getPublicProductReviews(productId)
      setReviewsData(res?.data || { reviews: [], summary: null })
    } catch (err) {
      console.error('Failed to load product reviews:', err)
      setReviewsError('Failed to load customer reviews. Please try again.')
    } finally {
      setReviewsLoading(false)
    }
  }

  if (!isOpen || !product) return null

  const outOfStock = product.stock === 0
  const buttonState = getAddButtonState ? getAddButtonState(product) : 'add'
  const reviewsCount = reviewsData.summary?.totalReviews ?? product.review_count ?? 0
  const averageRating = reviewsData.summary?.averageRating ?? product.average_rating ?? 0
  const distribution = reviewsData.summary?.distribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-4xl max-h-[92vh] bg-[var(--surface-dark)] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 text-white/70 hover:text-white hover:bg-black/90 transition-colors border border-white/10"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Left: Product Image & Quick Summary */}
          <div className="w-full md:w-5/12 bg-gradient-to-br from-[#121212] to-[#0a0a0a] flex flex-col items-center justify-center p-6 border-r border-white/5 relative">
            <div className="w-full aspect-square max-h-[300px] md:max-h-none flex items-center justify-center overflow-hidden rounded-xl bg-white/[0.02] p-4">
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-contain filter drop-shadow-2xl"
              />
            </div>

            <div className="w-full mt-4 flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>{product.brand || 'CosmosCraft'}</span>
              <span className="text-white/60">{product.category}</span>
            </div>
          </div>

          {/* Right: Tabs (Details / Customer Reviews) */}
          <div className="w-full md:w-7/12 flex flex-col bg-[var(--surface-dark)] max-h-[85vh] md:max-h-[88vh]">
            {/* Header & Tabs */}
            <div className="p-6 pb-3 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="uppercase tracking-widest text-[10px] text-[var(--gold-primary)] font-bold">
                  {product.category}
                </span>
                {product.brand && (
                  <>
                    <span className="text-white/30">•</span>
                    <span className="uppercase tracking-widest text-[10px] text-white/60 font-semibold">
                      {product.brand}
                    </span>
                  </>
                )}
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight line-clamp-1">
                {product.name}
              </h2>

              <div className="flex items-center gap-3 mt-2">
                <p className="text-xl sm:text-2xl font-mono font-bold text-white hidden sm:block">
                  ₱{Number(product.price).toLocaleString('en-PH')}
                </p>

                {reviewsCount > 0 ? (
                  <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                    <StarRating rating={averageRating} size="w-3.5 h-3.5" showScore />
                    <span className="text-[11px] text-[var(--text-muted)]">
                      ({reviewsCount})
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-[var(--text-muted)] italic">
                    No reviews yet
                  </span>
                )}
              </div>

              {/* Navigation Tabs */}
              <div className="flex gap-2 mt-4 border-b border-white/5">
                <button
                  type="button"
                  onClick={() => setActiveTab('details')}
                  className={`pb-2 text-xs font-bold uppercase tracking-wider transition-colors relative ${
                    activeTab === 'details'
                      ? 'text-[var(--gold-primary)]'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  Overview
                  {activeTab === 'details' && (
                    <motion.div
                      layoutId="activeTabUnderline"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--gold-primary)]"
                    />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('reviews')}
                  className={`pb-2 text-xs font-bold uppercase tracking-wider transition-colors relative flex items-center gap-1.5 ${
                    activeTab === 'reviews'
                      ? 'text-[var(--gold-primary)]'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  Customer Reviews
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10 text-white font-mono">
                    {reviewsCount}
                  </span>
                  {activeTab === 'reviews' && (
                    <motion.div
                      layoutId="activeTabUnderline"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--gold-primary)]"
                    />
                  )}
                </button>
              </div>
            </div>

            {/* Scrollable Content Body */}
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              {activeTab === 'details' ? (
                /* TAB 1: PRODUCT DETAILS */
                <div className="space-y-6">
                  {/* Stock Status */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/50 uppercase tracking-widest font-semibold">
                      Availability:
                    </span>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        outOfStock
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-green-500/10 text-green-400 border border-green-500/30'
                      }`}
                    >
                      {outOfStock ? 'Out of Stock' : `${product.stock || 0} units available`}
                    </span>
                  </div>

                  {/* Description */}
                  <div>
                    <h4 className="text-xs uppercase tracking-wider font-bold text-white/60 mb-2">
                      Description
                    </h4>
                    <p className="text-sm text-[var(--text-muted)] leading-relaxed whitespace-pre-line">
                      {product.description || 'No description available for this item.'}
                    </p>
                  </div>

                  {/* Quick Reviews Preview if any exist */}
                  {reviewsCount > 0 && reviewsData.reviews.length > 0 && (
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
                          Latest Customer Feedback
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveTab('reviews')}
                          className="text-xs text-[var(--gold-primary)] hover:underline"
                        >
                          View all ({reviewsCount})
                        </button>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] italic line-clamp-2">
                        "{reviewsData.reviews[0]?.comment}"
                      </p>
                      <span className="text-[11px] text-white/40 mt-1 block">
                        — {reviewsData.reviews[0]?.customer_name || 'Verified Buyer'}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                /* TAB 2: CUSTOMER REVIEWS */
                <div className="space-y-6">
                  {reviewsLoading ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-6 h-6 text-[var(--gold-primary)] animate-spin" />
                      <p className="text-xs text-[var(--text-muted)]">Loading reviews...</p>
                    </div>
                  ) : reviewsError ? (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                      <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
                      <p className="text-xs text-red-300 mb-3">{reviewsError}</p>
                      <button
                        type="button"
                        onClick={() => loadProductReviews(product.id)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 text-red-200 hover:bg-red-500/30"
                      >
                        Retry
                      </button>
                    </div>
                  ) : reviewsCount === 0 || reviewsData.reviews.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
                      <MessageSquare className="w-10 h-10 text-white/20 mb-3" />
                      <h4 className="text-sm font-bold text-white mb-1">No reviews yet</h4>
                      <p className="text-xs text-[var(--text-muted)] max-w-sm">
                        This product hasn't received verified customer ratings yet. Reviews appear after verified purchasers confirm fulfillment.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Rating Summary Breakdown */}
                      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col sm:flex-row items-center gap-6">
                        <div className="text-center sm:text-left flex-shrink-0">
                          <div className="text-4xl font-extrabold text-white font-mono">
                            {Number(averageRating).toFixed(1)}
                          </div>
                          <StarRating rating={averageRating} size="w-4 h-4" />
                          <div className="text-[11px] text-[var(--text-muted)] mt-1">
                            Based on {reviewsCount} {reviewsCount === 1 ? 'review' : 'reviews'}
                          </div>
                        </div>

                        {/* Star Distribution Bars */}
                        <div className="flex-1 w-full space-y-1.5 border-t sm:border-t-0 sm:border-l border-white/5 pt-3 sm:pt-0 sm:pl-6">
                          {[5, 4, 3, 2, 1].map((star) => {
                            const count = distribution[star] || 0
                            const percentage = reviewsCount > 0 ? (count / reviewsCount) * 100 : 0
                            return (
                              <div key={star} className="flex items-center gap-2 text-xs">
                                <span className="w-4 text-right text-white/60 font-mono text-[11px]">{star}★</span>
                                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-[var(--gold-secondary)] to-[var(--gold-primary)] rounded-full transition-all duration-500"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                                <span className="w-6 text-[11px] text-[var(--text-muted)] text-right font-mono">
                                  {count}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Reviews List */}
                      <div className="space-y-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-white/70">
                          Customer Comments ({reviewsData.reviews.length})
                        </h4>

                        {reviewsData.reviews.map((rev) => {
                          const dateStr = rev.created_at
                            ? new Date(rev.created_at).toLocaleDateString('en-PH', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })
                            : ''

                          const imagesList = Array.isArray(rev.images)
                            ? rev.images
                            : typeof rev.images === 'string'
                            ? JSON.parse(rev.images || '[]')
                            : []

                          return (
                            <div
                              key={rev.review_id}
                              className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors"
                            >
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-[var(--gold-primary)] flex-shrink-0">
                                    {rev.user_avatar ? (
                                      <img
                                        src={rev.user_avatar}
                                        alt={rev.customer_name}
                                        className="w-full h-full object-cover rounded-full"
                                      />
                                    ) : (
                                      rev.customer_name?.charAt(0)?.toUpperCase() || 'C'
                                    )}
                                  </div>
                                  <div>
                                    <span className="text-xs font-semibold text-white block">
                                      {rev.customer_name || 'Verified Customer'}
                                    </span>
                                    <span className="text-[10px] text-green-400 flex items-center gap-0.5">
                                      <CheckCircle2 className="w-2.5 h-2.5 inline" /> Verified Buyer
                                    </span>
                                  </div>
                                </div>

                                <div className="flex flex-col items-end">
                                  <StarRating rating={rev.rating} size="w-3 h-3" />
                                  <span className="text-[10px] text-white/40 mt-0.5">{dateStr}</span>
                                </div>
                              </div>

                              {rev.title && (
                                <h5 className="text-xs font-bold text-white mb-1">
                                  {rev.title}
                                </h5>
                              )}

                              <p className="text-xs text-[var(--text-muted)] leading-relaxed whitespace-pre-line">
                                {rev.comment}
                              </p>

                              {/* Review Photos if any */}
                              {imagesList.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-white/5">
                                  {imagesList.map((imgUrl, imgIdx) => (
                                    <button
                                      key={imgIdx}
                                      type="button"
                                      onClick={() => setSelectedImage(imgUrl)}
                                      className="relative w-12 h-12 rounded-lg overflow-hidden border border-white/10 hover:border-[var(--gold-primary)] transition-all group"
                                    >
                                      <img
                                        src={imgUrl}
                                        alt="Review attachment"
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                      />
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Actions Bar Footer */}
            <div className="p-3 sm:px-5 sm:py-4 border-t border-white/10 bg-[var(--surface-dark)] flex flex-col gap-3 flex-shrink-0">
              <div className="flex items-center justify-between gap-3">
                {!outOfStock ? (
                  <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-full px-1.5 py-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                      disabled={quantity <= 1}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-xs font-bold text-white tabular-nums">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity(prev => Math.min(product.stock || 1, prev + 1))}
                      disabled={quantity >= (product.stock || 1)}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <div />
                )}

                <p className="text-lg sm:text-xl font-mono font-bold text-white tracking-tight">
                  ₱{(Number(product.price) * quantity).toLocaleString('en-PH')}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {!outOfStock && isAuthenticated && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      onBuyNow?.(product, quantity)
                    }}
                    className="flex-1 min-w-0 py-2.5 px-3 rounded-full bg-[var(--gold-primary)] text-black font-bold text-xs whitespace-nowrap hover:brightness-110 transition-all shadow-md"
                  >
                    Buy Now
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (buttonState !== 'out_of_stock') {
                      onAddToCart?.(product, quantity)
                      setQuantity(1)
                    }
                  }}
                  disabled={buttonState === 'out_of_stock'}
                  className={`flex-1 min-w-0 py-2.5 px-3 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                    buttonState === 'out_of_stock'
                      ? 'border-white/10 text-white/30 bg-transparent cursor-not-allowed'
                      : 'border-white/20 text-white hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)] bg-[var(--surface-elevated)]'
                  }`}
                >
                  {buttonState === 'out_of_stock' ? 'Out of Stock' : 'Add to Cart'}
                </button>
              </div>
            </div>
          </div>

          {/* Lightbox for review image enlargement */}
          {selectedImage && (
            <div
              className="fixed inset-0 z-[120] bg-black/90 flex items-center justify-center p-4 cursor-pointer"
              onClick={() => setSelectedImage(null)}
            >
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="absolute top-4 right-4 text-white hover:text-gray-300 p-2"
              >
                <X className="w-6 h-6" />
              </button>
              <img
                src={selectedImage}
                alt="Review enlarged view"
                className="max-w-full max-h-[90vh] object-contain rounded-xl border border-white/10 shadow-2xl"
              />
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default ProductRatingModal
