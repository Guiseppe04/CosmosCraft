import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Filter, Search, ShoppingCart, Zap, Check, X, Star, Heart, ChevronDown } from 'lucide-react'
import { useCart } from '../context/CartContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useNavigate } from 'react-router'
import { ProductRatingModal } from '../components/ProductRatingModal.jsx'
import { adminApi } from '../utils/adminApi.js'

export function ShopPage() {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedBrand, setSelectedBrand] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [notification, setNotification] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)
  
  const { cart, addToCart, isItemAtMaxQuantity, getItemAddedState } = useCart()
  const navigate = useNavigate()
  const { isAuthenticated, openLogin } = useAuth()

  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([{ value: 'all', label: 'All Products' }])
  const [brands, setBrands] = useState([{ value: 'all', label: 'All Brands' }])
  const [loading, setLoading] = useState(true)

  const isInCart = (productId) => cart.some(item => item.id === productId)
  const getProductStock = (productId) => products.find(p => p.id === productId)?.stock || 0
  const isOutOfStock = (productId) => getProductStock(productId) === 0
  const isAtMaxLimit = (productId) => isItemAtMaxQuantity(productId)
  const isItemJustAdded = (productId) => getItemAddedState(productId)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [productsRes, categoriesRes] = await Promise.all([
          adminApi.getProducts({ limit: 1000 }),
          adminApi.getCategories()
        ])

        const fetchedProducts = (productsRes.data || []).map(p => ({
          id: p.product_id || p.id,
          name: p.name,
          price: Number(p.price),
          image: p.primary_image || p.image || '/assets/placeholder.jpg',
          category: p.category_name || p.category || 'Uncategorized',
          brand: p.brand,
          description: p.description,
          stock: p.stock || 0,
          is_active: p.is_active
        })).filter(p => p.is_active !== false)

        // Handle case where categories might be directly an array or inside .data
        const fetchedCategories = Array.isArray(categoriesRes) ? categoriesRes : (categoriesRes.data || [])
        
        setProducts(fetchedProducts)

        const catOptions = fetchedCategories.map(c => ({
          value: c.name,
          label: c.name
        }))
        
        setCategories([{ value: 'all', label: 'All Products' }, ...catOptions])

        const uniqueBrands = ['all', ...new Set(fetchedProducts.map(p => p.brand).filter(Boolean))]
        setBrands(uniqueBrands.map(b => ({
          value: b,
          label: b === 'all' ? 'All Brands' : b
        })))

      } catch (err) {
        console.error("Failed to fetch shop data", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory
    const matchesBrand = selectedBrand === 'all' || product.brand === selectedBrand
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) || (product.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch && matchesBrand
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
    navigate('/checkout', {
      state: {
        isBuyNow: true,
        checkoutItem: {
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.image,
          category: product.category,
          type: 'product',
          stock: product.stock,
          quantity: 1
        }
      }
    })
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
        <section className="relative w-full min-h-[450px] mb-12 rounded-[32px] overflow-hidden border border-white/10 shadow-2xl group bg-[#0a0a0a]">
          <div className="absolute inset-0 z-0">
            <img 
              src="/assets/landing/480473076_1131061492149780_4368555505559771502_n.jpg"
              alt="Premium Guitars"
              className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-[4s] ease-out opacity-80"
            />
            {/* Minimal Dark Luxury Gradient overlay - Thick on left side */}
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          </div>

          <div className="relative z-10 h-full flex flex-col justify-center px-10 sm:px-16 md:px-24 max-w-3xl py-12">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-block px-4 py-1.5 mb-6 rounded-full border border-[var(--gold-primary)]/30 bg-[var(--gold-primary)]/10 backdrop-blur-md">
                <div className="inline text-xs font-bold tracking-widest uppercase text-[var(--gold-primary)]">New Arrivals</div>
              </div>
              
              <div className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-tight tracking-tight mb-5 drop-shadow-2xl" style={{ color: '#ffffff' }}>
                Elevate Your Sound <br />
                <div className="inline text-transparent bg-clip-text bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] font-medium italic drop-shadow-md">
                  Up to 50% Off
                </div>
              </div>
              
              <div className="text-lg sm:text-xl mb-10 max-w-lg font-light leading-relaxed drop-shadow-lg opacity-90" style={{ color: '#f3f4f6' }}>
                Experience unparalleled craftsmanship with our curated selection of premium instruments, hardware, and essential accessories.
              </div>
              
              <button 
                type="button" 
                onClick={() => document.getElementById('shop-collection')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-10 py-4 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black font-bold text-sm tracking-wide uppercase hover:scale-105 transition-all duration-300 rounded-full shadow-[0_0_30px_rgba(212,175,55,0.3)]"
              >
                Shop Collection
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
             <div className="px-5 py-2 bg-[var(--surface-dark)] border border-[var(--border)] hover:border-white/20 rounded-full flex items-center justify-between min-w-[150px] text-xs font-semibold text-white transition-colors cursor-pointer shadow-sm group relative">
                <span>Category</span>
                <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:rotate-180 transition-transform" />
                <div className="hidden group-hover:flex absolute top-full mt-1 left-0 flex-col bg-[var(--surface-dark)] border border-[var(--border)] rounded-lg shadow-lg z-10 min-w-max">
                  {categories.slice(1, 3).map(cat => (
                    <button key={cat.value} onClick={() => setSelectedCategory(cat.value)} className="px-4 py-2 text-left text-xs hover:bg-[var(--gold-primary)]/10 text-[var(--text-muted)] hover:text-white">
                      {cat.label}
                    </button>
                  ))}
                </div>
             </div>
             <div className="hidden sm:flex px-5 py-2 bg-[var(--surface-dark)] border border-[var(--border)] hover:border-white/20 rounded-full items-center gap-2 text-xs font-semibold text-white/70 hover:text-white transition-colors cursor-pointer">
                Price <ChevronDown className="w-3.5 h-3.5 opacity-50" />
             </div>
             <div className="hidden lg:flex px-5 py-2 bg-[var(--surface-dark)] border border-[var(--border)] hover:border-white/20 rounded-full items-center gap-2 text-xs font-semibold text-white transition-colors cursor-pointer shadow-sm group relative">
                {selectedBrand === 'all' ? 'Brand' : selectedBrand} <ChevronDown className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform" />
                <div className="hidden group-hover:flex absolute top-full mt-1 left-0 flex-col bg-[var(--surface-dark)] border border-[var(--border)] rounded-lg shadow-lg z-10 min-w-max max-h-48 overflow-y-auto">
                  {brands.map(brand => (
                    <button key={brand.value} onClick={() => setSelectedBrand(brand.value)} className={`px-4 py-2 text-left text-xs ${selectedBrand === brand.value ? 'bg-[var(--gold-primary)]/20 text-[var(--gold-primary)]' : 'text-[var(--text-muted)] hover:text-white hover:bg-[var(--gold-primary)]/10'}`}>
                      {brand.label}
                    </button>
                  ))}
                </div>
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
                  <div className="aspect-[4/3] bg-[var(--surface-elevated)] overflow-hidden relative flex flex-col justify-center items-center border border-white/5 rounded-[16px] m-2">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover filter brightness-90 group-hover:scale-105 group-hover:brightness-100 transition-all duration-700 ease-out"
                    />
                    
                    {/* Outline Heart Top-Right */}
                    <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-[var(--surface-dark)] flex items-center justify-center cursor-pointer hover:bg-white text-[var(--gold-primary)] transition-colors shadow-sm">
                       <Heart className="w-4 h-4 hover:fill-[var(--gold-primary)] transition-colors" />
                    </div>

                    {outOfStock && (
                      <div className="absolute top-3 left-3">
                        <span className="px-3 py-1 bg-red-500 text-white text-[10px] uppercase tracking-widest font-black rounded-full shadow-md">
                          Out of Stock
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="px-4 pb-4 pt-2 flex flex-col flex-1 relative bg-transparent">
                    <p className="text-[12px] text-[var(--text-muted)] font-medium mb-1 tracking-wide">{product.category}</p>
                    {product.brand && (
                      <p className="text-[11px] text-[var(--gold-primary)] font-semibold mb-1.5 tracking-wide uppercase">
                        {product.brand}
                      </p>
                    )}
                    <h3 className="font-bold text-white text-[15px] leading-snug mb-2 group-hover:text-[var(--gold-primary)] transition-colors line-clamp-1">{product.name}</h3>

                    <div className="flex items-center gap-2 mb-2">
                       <div className="flex gap-0.5">
                          {[...Array(5)].map((_, i) => (
                             <Star key={i} className="w-3.5 h-3.5 fill-[var(--gold-primary)] text-[var(--gold-primary)]" />
                          ))}
                       </div>
                       <span className="text-[12px] text-[var(--text-muted)] font-semibold ml-1">5.0</span>
                    </div>

                    <p className="text-[12px] text-[var(--text-muted)] font-medium mb-4">
                      Stock: <span className="text-white">{product.stock || 0} pieces</span>
                    </p>

                    <div className="mt-auto flex flex-wrap items-center justify-between gap-y-3 pt-1">
                      <p className="text-lg font-bold text-white tracking-tight">
                        ${product.price.toLocaleString('en-PH')}
                      </p>

                      <div className="flex items-center gap-2 ml-auto">
                        {!outOfStock && isAuthenticated && (
                           <button
                             onClick={(e) => { e.stopPropagation(); handleBuyNow(product); }}
                             className="px-4 py-2 rounded-full bg-[var(--gold-primary)] text-black font-bold text-xs tracking-wide hover:brightness-110 transition-all shadow-md"
                           >
                             Buy Now
                           </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAddToCart(product); }}
                          disabled={buttonState !== 'add'}
                          className={`px-4 py-2 rounded-full text-xs tracking-wide font-bold transition-all border ${
                            buttonState === 'out_of_stock'
                              ? 'border-white/5 bg-white/5 text-white/30 cursor-not-allowed'
                              : buttonState === 'item_added' || buttonState === 'in_cart'
                              ? 'bg-[#1e1e1e] border-transparent text-[var(--gold-primary)]'
                              : 'bg-[#1e1e1e] border-transparent text-white hover:text-[var(--gold-primary)] shadow-sm'
                          }`}
                        >
                          {buttonState === 'add' ? 'Add to cart' : buttonState === 'out_of_stock' ? 'Unavailable' : 'Added to cart'}
                        </button>
                      </div>
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