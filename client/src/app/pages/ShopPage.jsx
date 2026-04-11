import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Filter, Search, ShoppingCart, Zap, Check, X, Star, Heart, ChevronDown } from 'lucide-react'
import { mockProducts } from '../data/products.js'
import { useCart } from '../context/CartContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useNavigate } from 'react-router'
import { ProductRatingModal } from '../components/ProductRatingModal.jsx'

export function ShopPage() {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [notification, setNotification] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)
  
  const { cart, addToCart, isItemAtMaxQuantity, getItemAddedState } = useCart()
  const navigate = useNavigate()
  const { isAuthenticated, openLogin } = useAuth()

  const isInCart = (productId) => cart.some(item => item.id === productId)
  const getProductStock = (productId) => mockProducts.find(p => p.id === productId)?.stock || 0
  const isOutOfStock = (productId) => getProductStock(productId) === 0
  const isAtMaxLimit = (productId) => isItemAtMaxQuantity(productId)
  const isItemJustAdded = (productId) => getItemAddedState(productId)

  const categories = [
    { value: 'all', label: 'All Products' },
    { value: 'Electric Guitars', label: 'Electric Guitars' },
    { value: 'Acoustic Guitars', label: 'Acoustic Guitars' },
    { value: 'Bass Guitars', label: 'Bass Guitars' },
    { value: 'Accessories', label: 'Accessories' },
    { value: 'Parts', label: 'Parts' },
  ]

  const filteredProducts = mockProducts.filter(product => {
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) || product.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const handleAddToCart = product => {
    if (isOutOfStock(product.id) || isAtMaxLimit(product.id)) return
    
    const added = addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      category: product.category,
      type: 'product',
      stock: product.stock,
    })
    
    if (added) {
      setNotification(`${product.name} added to cart!`)
      setTimeout(() => setNotification(null), 3000)
    }
  }

  const performBuyNow = product => {
    if (isOutOfStock(product.id)) return
    addToCart({ ...product, type: 'product' })
    navigate('/checkout')
  }

  const handleBuyNow = product => {
    if (isOutOfStock(product.id)) return
    if (!isAuthenticated) openLogin(() => performBuyNow(product))
    else performBuyNow(product)
  }

  const getAddButtonState = (product) => {
    if (isOutOfStock(product.id)) return 'out_of_stock'
    if (isItemJustAdded(product.id)) return 'item_added'
    if (isAtMaxLimit(product.id)) return 'max_limit'
    if (isInCart(product.id)) return 'in_cart'
    return 'add'
  }

  return (
    <div className="min-h-screen pt-20 pb-24 bg-[var(--bg-primary)] font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Modern Hero Banner */}
        <section className="relative w-full h-[380px] mb-12 rounded-2xl overflow-hidden border border-white/5 shadow-2xl group">
          <div className="absolute inset-0 z-0">
            <img 
              src="https://images.unsplash.com/photo-1549887784-8840a455a2ea?q=80&w=2400&auto=format&fit=crop" 
              alt="Premium Guitars"
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-[3s] ease-out opacity-80"
            />
            {/* Minimal Dark Luxury Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/90 to-transparent" />
          </div>

          <div className="relative z-10 h-full flex flex-col justify-center px-8 sm:px-12 md:px-16 max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight mb-5">
                Elevate Your Sound <br />
                <span className="text-[var(--gold-primary)] font-light italic">Up to 50% Off</span>
              </h2>
              <p className="text-[var(--text-muted)] text-base sm:text-lg mb-8 max-w-md font-light leading-relaxed">
                Experience unparalleled craftsmanship with our curated selection of premium instruments, hardware, and essential accessories.
              </p>
              <button 
                type="button" 
                onClick={() => document.getElementById('shop-collection')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-8 py-3.5 bg-white text-black font-semibold text-sm hover:bg-[var(--gold-primary)] transition-colors duration-300 rounded-full shadow-[0_0_20px_rgba(255,255,255,0.1)]"
              >
                Buy Now
              </button>
            </motion.div>
          </div>
        </section>

        {/* Adding Parts to Build Banner */}
        {localStorage.getItem('cosmoscraft_target_build_id') && (
          <div className="mb-10 p-4 bg-[var(--surface-dark)] border border-[var(--gold-primary)]/50 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_0_20px_rgba(212,175,55,0.1)]">
             <div>
                <h3 className="text-[var(--gold-primary)] font-bold text-base mb-0.5 flex items-center gap-2">
                  <Zap className="w-4 h-4 fill-[var(--gold-primary)]" /> Custom Build Active
                </h3>
                <p className="text-xs text-[var(--text-muted)]">Parts and accessories added to cart will automatically append to your active build context.</p>
             </div>
             <button
               type="button"
               onClick={() => {
                 localStorage.removeItem('cosmoscraft_target_build_id');
                 navigate('/dashboard');
               }}
               className="px-5 py-2 whitespace-nowrap bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] rounded-lg font-bold text-sm shadow-[0_4px_10px_rgba(212,175,55,0.3)] hover:shadow-[0_6px_15px_rgba(212,175,55,0.5)] transition-all"
             >
                Done Shopping
             </button>
          </div>
        )}

        {/* Horizontal Filter Bar */}
        <section id="shop-collection" className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-8 pt-6">
          <div className="flex flex-wrap items-center gap-3">
             <div className="px-5 py-2 bg-[var(--surface-dark)] border border-[var(--border)] hover:border-white/20 rounded-full flex items-center justify-between min-w-[150px] text-xs font-semibold text-white transition-colors cursor-pointer shadow-sm">
                <span>Category Form</span>
                <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
             </div>
             <div className="hidden sm:flex px-5 py-2 bg-[var(--surface-dark)] border border-[var(--border)] hover:border-white/20 rounded-full items-center gap-2 text-xs font-semibold text-white/70 hover:text-white transition-colors cursor-pointer">
                Price <ChevronDown className="w-3.5 h-3.5 opacity-50" />
             </div>
             <div className="hidden sm:flex px-5 py-2 bg-[var(--surface-dark)] border border-[var(--border)] hover:border-white/20 rounded-full items-center gap-2 text-xs font-semibold text-white/70 hover:text-white transition-colors cursor-pointer">
                Color <ChevronDown className="w-3.5 h-3.5 opacity-50" />
             </div>
             <div className="hidden lg:flex px-5 py-2 bg-[var(--surface-dark)] border border-[var(--border)] hover:border-white/20 rounded-full items-center gap-2 text-xs font-semibold text-white/70 hover:text-white transition-colors cursor-pointer">
                Brand <ChevronDown className="w-3.5 h-3.5 opacity-50" />
             </div>
             <div className="px-5 py-2 border border-[var(--gold-primary)]/30 text-[var(--gold-primary)] bg-[var(--gold-primary)]/5 rounded-full flex items-center gap-2 text-xs font-bold tracking-wide cursor-pointer hover:bg-[var(--gold-primary)]/10 transition-colors">
                <Filter className="w-3.5 h-3.5" /> All Filters
             </div>
          </div>

          <div className="flex items-center gap-3 w-full xl:w-auto">
             <div className="relative w-full xl:w-72">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
               <input
                 type="text"
                 placeholder="Search our catalog..."
                 value={searchQuery}
                 onChange={e => setSearchQuery(e.target.value)}
                 className="w-full pl-11 pr-4 py-2 bg-[var(--surface-dark)] border border-[var(--border)] rounded-full text-xs text-white placeholder-white/30 focus:outline-none focus:border-[var(--gold-primary)]/50 transition-all focus:bg-[var(--surface-elevated)] shadow-sm"
               />
             </div>
             <div className="px-5 py-2 hidden lg:flex bg-transparent border border-transparent hover:border-white/10 rounded-full items-center gap-2 text-xs font-semibold text-white/90 cursor-pointer">
                Sort by: Featured <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
             </div>
          </div>
        </section>

        {/* Categories Chips */}
        <div className="flex flex-wrap gap-2 mb-10 overflow-x-auto scroolbar-hide pb-2">
           {categories.map(cat => (
              <button
                 key={cat.value}
                 onClick={() => setSelectedCategory(cat.value)}
                 className={`px-5 py-1.5 rounded-full text-[11px] uppercase tracking-[0.05em] font-bold whitespace-nowrap transition-all duration-200 ${
                   selectedCategory === cat.value 
                   ? 'bg-white text-black shadow-md' 
                   : 'bg-transparent text-[var(--text-muted)] hover:text-white border border-[var(--border)] hover:border-white/30'
                 }`}
              >
                 {cat.label}
              </button>
           ))}
        </div>

        {/* Global Notifications */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -20, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: -20, x: '-50%' }}
              className="fixed top-24 left-1/2 z-[100] px-6 py-3 bg-[var(--gold-primary)] text-[#111111] rounded-full flex items-center gap-2 text-sm font-bold shadow-[0_10px_25px_rgba(212,175,55,0.3)]"
            >
              <Zap className="w-4 h-4 fill-black" />
              {notification}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Products Grid Header */}
        <div className="mb-6">
          <h3 className="text-xl font-bold text-white tracking-tight">CosmosCraft Equipment</h3>
        </div>

        {/* Products Grid Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.length > 0 ? (
            filteredProducts.map((product, index) => {
              const buttonState = getAddButtonState(product)
              const outOfStock = isOutOfStock(product.id)
              
              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.5 }}
                  onClick={() => setSelectedProduct(product)}
                  className={`group bg-[var(--surface-dark)] border border-white/5 rounded-[20px] rounded-br-[20px] overflow-hidden hover:border-white/20 transition-all duration-300 flex flex-col hover:shadow-2xl hover:-translate-y-1 cursor-pointer ${outOfStock ? 'opacity-60' : ''}`}
                >
                  <div className="aspect-[4/3] bg-gradient-to-br from-[#121212] to-[#0a0a0a] overflow-hidden relative flex flex-col justify-center items-center border-b border-white/5">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover filter brightness-90 group-hover:scale-110 group-hover:brightness-100 transition-all duration-700 ease-out"
                    />
                    
                    {/* Floating Wishlist Heart */}
                    <div className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center cursor-pointer hover:bg-white inset-auto transition-colors group/heart shadow-xl opacity-0 translate-y-2 group-hover:translate-y-0 group-hover:opacity-100 duration-300">
                       <Heart className="w-4 h-4 text-white group-hover/heart:text-red-500 group-hover/heart:fill-red-500 transition-colors" />
                    </div>

                    {outOfStock && (
                      <div className="absolute top-4 left-4">
                        <span className="px-3 py-1 bg-red-500 text-white text-[10px] uppercase tracking-widest font-black rounded-lg shadow-lg">
                          Sold Out
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-5 flex flex-col flex-1 relative bg-transparent">
                    {/* Rating Stars Mock */}
                    <div className="flex items-center gap-1 mb-3">
                       {[...Array(5)].map((_, i) => (
                          <Star key={i} className="w-3.5 h-3.5 fill-[var(--gold-primary)] text-[var(--gold-primary)]" />
                       ))}
                       <span className="text-[10px] text-[var(--text-muted)] tracking-wider ml-1">(121)</span>
                    </div>

                    <h3 className="font-semibold text-white text-base leading-snug mb-1 group-hover:text-[var(--gold-primary)] transition-colors line-clamp-1">{product.name}</h3>
                    <p className="text-[11px] text-white/40 uppercase tracking-[0.1em] font-medium mb-4">{product.category}</p>

                    <div className="mt-auto flex items-end justify-between pt-4 border-t border-white/5">
                      <div className="flex flex-col">
                        <p className="text-xl font-bold text-white tracking-tight">
                          ₱{product.price.toLocaleString('en-PH')}
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons Row */}
                    <div className="flex flex-col gap-2 mt-5">
                      {!outOfStock && isAuthenticated && (
                         <button
                           onClick={(e) => { e.stopPropagation(); handleBuyNow(product); }}
                           className="w-full py-2.5 rounded-full bg-white text-black font-bold text-xs uppercase tracking-wide hover:bg-gray-200 transition-colors"
                         >
                           Buy Now
                         </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAddToCart(product); }}
                        disabled={buttonState !== 'add'}
                        className={`w-full py-2.5 rounded-full text-xs uppercase tracking-wide font-bold transition-all border ${
                          buttonState === 'out_of_stock'
                            ? 'border-white/10 text-white/30 cursor-not-allowed'
                            : buttonState === 'item_added' || buttonState === 'in_cart'
                            ? 'bg-green-500/10 border-green-500/30 text-green-400'
                            : 'border-white/10 text-white hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)]'
                        }`}
                      >
                        {buttonState === 'add' ? 'Add to Cart' : buttonState === 'out_of_stock' ? 'Unavailable' : 'Added to Cart'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center py-20 bg-[var(--surface-dark)] rounded-2xl border border-white/5">
              <Search className="w-12 h-12 text-white/20 mb-4" />
              <p className="text-white font-medium text-lg mb-1">No products found</p>
              <p className="text-[var(--text-muted)] text-sm">Try adjusting your filters or search term.</p>
            </div>
          )}
        </div>
      </div>

      <ProductRatingModal
        product={selectedProduct}
        isOpen={selectedProduct !== null}
        onClose={() => setSelectedProduct(null)}
        onBuyNow={handleBuyNow}
        onAddToCart={handleAddToCart}
        getAddButtonState={getAddButtonState}
        isAuthenticated={isAuthenticated}
      />
    </div>
  )
}