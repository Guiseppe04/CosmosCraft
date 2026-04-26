import { motion, AnimatePresence } from 'motion/react'
import { X, ShoppingCart } from 'lucide-react'

export function ProductRatingModal({ product, isOpen, onClose, onBuyNow, onAddToCart, getAddButtonState, isAuthenticated }) {
  // Rating state disabled - will be re-enabled when product delivery tracking is implemented
  // const [rating, setRating] = useState(0)
  // const [hoverRating, setHoverRating] = useState(0)
  // const [hasRated, setHasRated] = useState(false)

  // Rating initialization effect disabled - will be re-enabled when product delivery tracking is implemented
  // useEffect(() => {
  //   if (product) {
  //     const storedRatings = JSON.parse(localStorage.getItem('product_ratings') || '{}')
  //     if (storedRatings[product.id]) {
  //       setRating(storedRatings[product.id])
  //       setHasRated(true)
  //     } else {
  //       setRating(0)
  //       setHasRated(false)
  //     }
  //   }
  // }, [product])

  // Rating handler disabled - will be re-enabled when product delivery tracking is implemented
  // const handleRate = (value) => {
  //   setRating(value)
  //   setHasRated(true)
  //   const storedRatings = JSON.parse(localStorage.getItem('product_ratings') || '{}')
  //   storedRatings[product.id] = value
  //   localStorage.setItem('product_ratings', JSON.stringify(storedRatings))
  //   window.dispatchEvent(new Event('ratingUpdated'))
  // }

  if (!isOpen || !product) return null

  const outOfStock = product.stock === 0
  const buttonState = getAddButtonState(product)

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-4xl bg-[var(--surface-dark)] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white/50 hover:text-white hover:bg-black/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Left: Product Image */}
          <div className="w-full md:w-1/2 bg-gradient-to-br from-[#121212] to-[#0a0a0a] flex items-center justify-center p-8 aspect-square md:aspect-auto border-r border-white/5">
            <img 
              src={product.image} 
              alt={product.name} 
              className="w-full h-full object-contain filter drop-shadow-2xl" 
            />
          </div>

          {/* Right: Product Details & Rating Details */}
          <div className="w-full md:w-1/2 p-8 flex flex-col bg-[var(--surface-dark)]">
            <div className="mb-2 uppercase tracking-widest text-[10px] text-[var(--gold-primary)] font-bold">
              {product.category}
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight line-clamp-2">
              {product.name}
            </h2>
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6 relative">
              <p className="text-2xl font-mono font-bold text-white">
                ₱{product.price.toLocaleString('en-PH')}
              </p>
              
              {product.category && !product.category.toLowerCase().includes('guitar') && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm shadow-inner mt-2 sm:mt-0">
                  <span className="font-semibold text-white/50 uppercase tracking-widest text-[10px]">Stock</span>
                  <span className={`font-bold ${outOfStock ? 'text-red-400' : 'text-[var(--gold-primary)]'}`}>
                    {outOfStock ? 'Out of Stock' : `${product.stock || 0} Available`}
                  </span>
                </div>
              )}
            </div>
            
            {/* Rating Section - Disabled: Show only after product delivery */}
            {/* <div className="mb-8 p-5 bg-white/5 rounded-xl border border-white/5">
              <h4 className="text-xs uppercase tracking-wider font-bold text-[var(--text-muted)] mb-3">
                {hasRated ? 'Your Rating' : 'Rate this Product'}
              </h4>
              <div className="flex items-center gap-2">
                <div className="flex gap-1" onMouseLeave={() => setHoverRating(0)}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      onMouseEnter={() => setHoverRating(star)}
                      onClick={() => handleRate(star)}
                      className={`w-8 h-8 cursor-pointer transition-all duration-200 ${
                        (hoverRating || rating) >= star
                          ? 'fill-[var(--gold-primary)] text-[var(--gold-primary)] scale-110 drop-shadow-[0_0_8px_rgba(212,175,55,0.5)]'
                          : 'text-white/20 hover:text-white/40'
                      }`}
                    />
                  ))}
                </div>
                {hasRated && (
                  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="ml-3 flex items-center gap-1.5 text-xs text-green-400 font-bold bg-green-500/10 px-2.5 py-1 rounded-md">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Rated
                  </motion.div>
                )}
              </div>
            </div> */}

            <div className="flex-1 mb-8">
              <h4 className="text-sm font-semibold text-white mb-2">Description</h4>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                {product.description}
              </p>
            </div>

            {/* Actions */}
            <div className="mt-auto space-y-3 pt-6 border-t border-white/5">
              {!outOfStock && isAuthenticated && (
                 <button
                   onClick={() => { onClose(); onBuyNow(product); }}
                   className="w-full py-3.5 rounded-full bg-white text-black font-bold tracking-wide hover:bg-gray-200 transition-colors shadow-lg"
                 >
                   Buy Now
                 </button>
              )}
              <button
                onClick={() => { if(buttonState !== 'out_of_stock') onAddToCart(product); }}
                disabled={buttonState === 'out_of_stock'}
                className={`w-full py-3.5 rounded-full tracking-wide font-bold transition-all border ${
                  buttonState === 'out_of_stock'
                    ? 'border-white/10 text-white/30 cursor-not-allowed'
                    : buttonState === 'item_added' || buttonState === 'in_cart'
                    ? 'bg-green-500/10 border-green-500/30 text-green-400'
                    : 'border-white/10 text-white hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)]'
                }`}
              >
                {buttonState === 'add' ? 'Add to Cart' : buttonState === 'out_of_stock' ? 'Out of Stock' : 'Added to Cart'}
              </button>
            </div>
            
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
