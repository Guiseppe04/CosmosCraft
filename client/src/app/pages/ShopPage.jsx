import { useState } from 'react'
import { motion } from 'motion/react'
import { Filter, Search, ShoppingCart, Zap, Check, X } from 'lucide-react'
import { mockProducts } from '../data/products.js'
import { useCart } from '../context/CartContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useNavigate } from 'react-router'

export function ShopPage() {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [priceRange, setPriceRange] = useState([0, 20000])
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [notification, setNotification] = useState(null)
  const { cart, addToCart, isItemAtMaxQuantity, getItemAddedState } = useCart()
  const navigate = useNavigate()
  const { isAuthenticated, openLogin } = useAuth()

  const isInCart = (productId) => {
    return cart.some(item => item.id === productId)
  }

  const getProductStock = (productId) => {
    const product = mockProducts.find(p => p.id === productId)
    return product?.stock || 0
  }

  const isOutOfStock = (productId) => {
    return getProductStock(productId) === 0
  }

  const isAtMaxLimit = (productId) => {
    return isItemAtMaxQuantity(productId)
  }

  const isItemJustAdded = (productId) => {
    return getItemAddedState(productId)
  }

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
    const matchesPrice = product.price >= priceRange[0] && product.price <= priceRange[1]
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesPrice && matchesSearch
  })

  const handleAddToCart = product => {
    if (isOutOfStock(product.id)) return
    if (isAtMaxLimit(product.id)) return
    
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
    
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      category: product.category,
      type: 'product',
      stock: product.stock,
    })
    navigate('/checkout')
  }

  const handleBuyNow = product => {
    if (isOutOfStock(product.id)) return
    
    if (!isAuthenticated) {
      openLogin(() => performBuyNow(product))
    } else {
      performBuyNow(product)
    }
  }

  const getAddButtonState = (product) => {
    if (isOutOfStock(product.id)) return 'out_of_stock'
    if (isItemJustAdded(product.id)) return 'item_added'
    if (isAtMaxLimit(product.id)) return 'max_limit'
    if (isInCart(product.id)) return 'in_cart'
    return 'add'
  }

  return (
    <div className="min-h-screen pt-16 bg-[var(--bg-primary)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-1">Guitar Shop</h1>
          <p className="text-sm text-white/50">Premium guitars and accessories</p>
        </div>

        {/* Adding Parts to Build Banner */}
        {localStorage.getItem('cosmoscraft_target_build_id') && (
          <div className="mb-8 p-4 bg-[var(--surface-dark)] border border-[var(--gold-primary)] rounded-xl flex items-center justify-between shadow-[0_0_15px_rgba(212,175,55,0.2)]">
             <div>
                <h3 className="text-[var(--gold-primary)] font-bold text-lg mb-1 flex items-center gap-2">
                  <Zap className="w-5 h-5" /> Adding Parts to Custom Build
                </h3>
                <p className="text-sm text-[var(--text-muted)]">Select accessories or parts to add. They will be linked directly to your custom guitar.</p>
             </div>
             <button
               type="button"
               onClick={() => {
                 localStorage.removeItem('cosmoscraft_target_build_id');
                 navigate('/dashboard');
               }}
               className="px-6 py-2.5 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] rounded-lg font-bold shadow-[0_0_10px_rgba(212,175,55,0.3)] hover:shadow-[0_0_20px_rgba(212,175,55,0.5)] transition-all"
             >
                Done Adding
             </button>
          </div>
        )}

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-theme-surface-deep border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#d4af37] transition-all shadow-sm"
            />
          </div>
        </div>

        {/* Filters & Products */}
        <div className="grid md:grid-cols-4 gap-8">
          {/* Filters Sidebar */}
          <div className="md:col-span-1">
            <div className="sticky top-24">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="w-full md:hidden flex items-center justify-center gap-2 px-4 py-3 bg-[#d4af37] text-[#111111] rounded-lg font-semibold mb-4"
              >
                <Filter className="w-5 h-5" />
                Filters
              </button>

              <div className={`${showFilters ? 'block' : 'hidden'} md:block space-y-6`}>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Category</h3>
                  <div className="space-y-2">
                    {categories.map(cat => (
                      <button
                        key={cat.value}
                        onClick={() => setSelectedCategory(cat.value)}
                        className={`block w-full text-left px-4 py-2 rounded-lg text-sm transition-all ${
                          selectedCategory === cat.value
                            ? 'bg-[#d4af37]/10 text-[#d4af37] border-r-4 border-[#d4af37]'
                            : 'text-white/50 hover:text-[#d4af37] hover:bg-white/5'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Price Range</h3>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min="0"
                      max="20000"
                      value={priceRange[1]}
                      onChange={e => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                      className="w-full accent-[#d4af37]"
                    />
                    <p className="text-white/50 text-sm">
                      ${priceRange[0].toLocaleString()} - ${priceRange[1].toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Products Grid */}
          <div className="md:col-span-3">
            {notification && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mb-4 p-4 bg-[#d4af37] text-[#111111] rounded-lg flex items-center gap-2 shadow-sm"
              >
                <Zap className="w-5 h-5" />
                {notification}
              </motion.div>
            )}

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product, index) => {
                  const inCart = isInCart(product.id)
                  const buttonState = getAddButtonState(product)
                  const outOfStock = isOutOfStock(product.id)
                  
                  return (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`bg-theme-surface-deep border border-white/10 rounded-2xl overflow-hidden hover:border-[#d4af37] hover:shadow-[0_0_20px_rgba(212,175,55,0.15)] transition-all ${outOfStock ? 'opacity-75' : ''}`}
                    >
                      <div className="aspect-square overflow-hidden relative">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                        />
                        {outOfStock && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <span className="px-4 py-2 bg-red-500/80 text-white font-semibold rounded-lg">
                              Out of Stock
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs text-white/40">{product.category}</p>
                          {!outOfStock && product.stock !== undefined && (
                            <span className="text-xs text-white/40">
                              Stock: {product.stock}
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-white mb-2">{product.name}</h3>
                        <p className="text-xl font-bold text-[#d4af37] mb-4">
                          ${product.price.toLocaleString()}
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAddToCart(product)}
                            disabled={buttonState !== 'add'}
                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                              buttonState === 'out_of_stock'
                                ? 'bg-gray-500/20 text-gray-400 border border-gray-500/30 cursor-not-allowed'
                                : buttonState === 'max_limit'
                                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30 cursor-not-allowed'
                                : buttonState === 'item_added'
                                ? 'bg-green-600/20 text-green-400 border border-green-600/30'
                                : buttonState === 'in_cart'
                                ? 'bg-green-600/20 text-green-400 border border-green-600/30'
                                : 'bg-[#d4af37] text-[#111111] hover:bg-[#c39d2f]'
                            }`}
                          >
                            {buttonState === 'out_of_stock' && (
                              <>
                                <X className="w-4 h-4" />
                                Out of Stock
                              </>
                            )}
                            {buttonState === 'max_limit' && (
                              <>
                                <X className="w-4 h-4" />
                                Max limit
                              </>
                            )}
                            {buttonState === 'item_added' && (
                              <>
                                <Check className="w-4 h-4" />
                                Added
                              </>
                            )}
                            {buttonState === 'in_cart' && (
                              <>
                                <Check className="w-4 h-4" />
                                Added
                              </>
                            )}
                            {buttonState === 'add' && (
                              <>
                                <ShoppingCart className="w-4 h-4" />
                                Add
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleBuyNow(product)}
                            disabled={outOfStock}
                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                              outOfStock
                                ? 'border border-gray-500/30 text-gray-400 cursor-not-allowed'
                                : 'border border-[#d4af37] text-[#d4af37] hover:bg-[#d4af37]/10'
                            }`}
                          >
                            {outOfStock ? 'Unavailable' : 'Buy'}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )
                })
              ) : (
                <div className="col-span-full text-center py-12">
                  <p className="text-white/40">No products found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}