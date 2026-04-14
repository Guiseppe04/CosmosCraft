import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Filter, Search, ShoppingCart, Zap, Star, Heart, ChevronDown, ChevronRight, Folder, Tag, X, SlidersHorizontal, Package, Wrench } from 'lucide-react'
import { useCart } from '../context/CartContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useNavigate } from 'react-router'
import { ProductRatingModal } from '../components/ProductRatingModal.jsx'
import { adminApi } from '../utils/adminApi.js'

function buildCategoryTree(categories) {
  const map = new Map()
  const roots = []
  
  categories.forEach(c => {
    map.set(c.category_id, { ...c, children: [] })
  })
  
  categories.forEach(c => {
    const node = map.get(c.category_id)
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id).children.push(node)
    } else {
      roots.push(node)
    }
  })
  
  const sortNodes = (nodes) => {
    nodes.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    nodes.forEach(n => sortNodes(n.children))
  }
  sortNodes(roots)
  
  return roots
}

function findNodeByName(tree, name) {
  for (const node of tree) {
    if (node.name === name) return node
    if (node.children?.length) {
      const found = findNodeByName(node.children, name)
      if (found) return found
    }
  }
  return null
}

function getCategoryWithChildren(tree, categoryName) {
  const node = findNodeByName(tree, categoryName)
  if (!node) return [categoryName]
  
  const names = [node.name]
  node.children?.forEach(child => names.push(child.name))
  return names
}

function CategoryTreeItem({ node, level = 0, selectedCategory, onSelect, expandedCategories, onToggle, path = '' }) {
  const key = path ? `${path}-${node.name}` : node.name
  const hasChildren = node.children && node.children.length > 0
  const isExpanded = expandedCategories.has(key)
  const isSelected = selectedCategory === node.name
  
  return (
    <div className="select-none">
      <div 
        className={`flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-all ${
          level === 0 ? 'font-semibold text-white' : 'text-sm text-[var(--text-muted)] ml-4'
        } ${isSelected ? 'bg-[var(--gold-primary)]/10 text-[var(--gold-primary)]' : 'hover:bg-white/5'}`}
        onClick={() => onSelect(node.name)}
      >
        {hasChildren && (
          <button 
            onClick={(e) => { e.stopPropagation(); onToggle(key) }}
            className="p-0.5 hover:bg-white/10 rounded"
          >
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        )}
        {!hasChildren && level > 0 && <span className="w-4" />}
        <Folder className={`w-4 h-4 ${isSelected ? 'text-[var(--gold-primary)]' : level === 0 ? 'text-[var(--gold-primary)]/70' : 'text-white/40'}`} />
        <span className="truncate text-[13px]">{node.name}</span>
      </div>
      
      <AnimatePresence>
        {hasChildren && isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {node.children.map((child, idx) => (
              <CategoryTreeItem 
                key={child.name}
                node={child}
                level={level + 1}
                selectedCategory={selectedCategory}
                onSelect={onSelect}
                expandedCategories={expandedCategories}
                onToggle={onToggle}
                path={key}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function FilterSidebar({ 
  categoryTree, 
  selectedCategory, 
  onCategoryChange, 
  expandedCategories, 
  onToggleExpand,
  selectedBrands, 
  onBrandToggle,
  brands,
  priceRange,
  onPriceRangeChange,
  inStockOnly,
  onInStockChange,
  isOpen,
  onClose,
  isMobile
}) {
  const sidebarContent = (
    <div className="bg-[var(--surface-dark)] border border-white/10 rounded-2xl p-4 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-[var(--gold-primary)]" />
          Filters
        </h3>
        {isMobile && (
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg">
            <X className="w-5 h-5 text-white/60" />
          </button>
        )}
      </div>

      <div className="space-y-6">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">Category</h4>
          <div className="space-y-0.5">
            <div 
              className={`flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-all font-semibold text-white ${
                selectedCategory === 'all' ? 'bg-[var(--gold-primary)]/10 text-[var(--gold-primary)]' : 'hover:bg-white/5'
              }`}
              onClick={() => onCategoryChange('all')}
            >
              <Tag className="w-4 h-4" />
              <span className="text-[13px]">All Products</span>
            </div>
            {categoryTree.map((node, idx) => (
              <CategoryTreeItem 
                key={node.name}
                node={node}
                selectedCategory={selectedCategory}
                onSelect={onCategoryChange}
                expandedCategories={expandedCategories}
                onToggle={onToggleExpand}
                path={String(idx)}
              />
            ))}
          </div>
        </div>

        <div className="border-t border-white/10 pt-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">Brand</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {brands.filter(b => b.value !== 'all').map(brand => (
              <label key={brand.value} className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                  selectedBrands.includes(brand.value) 
                    ? 'bg-[var(--gold-primary)] border-[var(--gold-primary)]' 
                    : 'border-white/30 group-hover:border-white/60'
                }`}>
                  {selectedBrands.includes(brand.value) && (
                    <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <input 
                  type="checkbox"
                  checked={selectedBrands.includes(brand.value)}
                  onChange={() => onBrandToggle(brand.value)}
                  className="hidden"
                />
                <span className="text-sm text-[var(--text-muted)] group-hover:text-white transition-colors">{brand.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="border-t border-white/10 pt-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">Price Range</h4>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Min"
              value={priceRange[0] || ''}
              onChange={(e) => onPriceRangeChange([Number(e.target.value) || 0, priceRange[1]])}
              className="w-full px-3 py-2 bg-[var(--surface-elevated)] border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-[var(--gold-primary)]/50"
            />
            <span className="text-white/40">—</span>
            <input
              type="number"
              placeholder="Max"
              value={priceRange[1] || ''}
              onChange={(e) => onPriceRangeChange([priceRange[0], Number(e.target.value) || 0])}
              className="w-full px-3 py-2 bg-[var(--surface-elevated)] border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-[var(--gold-primary)]/50"
            />
          </div>
        </div>

        <div className="border-t border-white/10 pt-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">Availability</h4>
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
              inStockOnly 
                ? 'bg-[var(--gold-primary)] border-[var(--gold-primary)]' 
                : 'border-white/30 group-hover:border-white/60'
            }`}>
              {inStockOnly && (
                <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <input 
              type="checkbox"
              checked={inStockOnly}
              onChange={() => onInStockChange(!inStockOnly)}
              className="hidden"
            />
            <span className="text-sm text-[var(--text-muted)] group-hover:text-white transition-colors flex items-center gap-2">
              <Package className="w-4 h-4" />
              In Stock Only
            </span>
          </label>
        </div>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40"
              onClick={onClose}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="fixed top-0 left-0 bottom-0 w-80 max-w-[85vw] z-50 p-4"
            >
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    )
  }

  return sidebarContent
}

function ActiveFiltersBar({ 
  selectedCategory, 
  onCategoryClear,
  selectedBrands,
  onBrandClear,
  priceRange,
  onPriceRangeClear,
  inStockOnly,
  onInStockClear,
  categoryTree,
  brandLabels
}) {
  const filters = []
  
  if (selectedCategory !== 'all') {
    filters.push({ type: 'category', label: selectedCategory, onClear: onCategoryClear })
  }
  
  selectedBrands.forEach(brand => {
    filters.push({ type: 'brand', label: brandLabels[brand] || brand, onClear: () => onBrandClear(brand) })
  })
  
  if (priceRange[0] || priceRange[1]) {
    const label = priceRange[0] && priceRange[1] 
      ? `₱${priceRange[0].toLocaleString()} – ₱${priceRange[1].toLocaleString()}`
      : priceRange[0] 
        ? `₱${priceRange[0].toLocaleString()}+`
        : `Up to ₱${priceRange[1].toLocaleString()}`
    filters.push({ type: 'price', label, onClear: onPriceRangeClear })
  }
  
  if (inStockOnly) {
    filters.push({ type: 'stock', label: 'In Stock', onClear: onInStockClear })
  }

  if (filters.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      <span className="text-xs text-white/50 mr-2">Active Filters:</span>
      {filters.map((filter, idx) => (
        <motion.div
          key={`${filter.type}-${idx}`}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--gold-primary)]/10 border border-[var(--gold-primary)]/30 rounded-full text-xs font-medium text-[var(--gold-primary)]"
        >
          {filter.label}
          <button 
            onClick={filter.onClear}
            className="p-0.5 hover:bg-[var(--gold-primary)]/20 rounded-full transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </motion.div>
      ))}
      <button 
        onClick={() => {
          onCategoryClear()
          selectedBrands.forEach(b => onBrandClear(b))
          onPriceRangeClear()
          onInStockClear()
        }}
        className="text-xs text-white/50 hover:text-white underline ml-2"
      >
        Clear all
      </button>
    </div>
  )
}

export function ShopPage() {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedBrands, setSelectedBrands] = useState([])
  const [priceRange, setPriceRange] = useState([0, 0])
  const [inStockOnly, setInStockOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [notification, setNotification] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [categoryTree, setCategoryTree] = useState([])
  const [expandedCategories, setExpandedCategories] = useState(new Set())
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)

  const { cart, addToCart, isItemAtMaxQuantity, getItemAddedState } = useCart()
  const navigate = useNavigate()
  const { isAuthenticated, openLogin } = useAuth()

  const [products, setProducts] = useState([])
  const [brands, setBrands] = useState([])
  const [loading, setLoading] = useState(true)

  const brandLabels = useMemo(() => {
    const labels = {}
    brands.forEach(b => { labels[b.value] = b.label })
    return labels
  }, [brands])

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

        const fetchedCategories = Array.isArray(categoriesRes) ? categoriesRes : (categoriesRes.data || [])
        
        setProducts(fetchedProducts)
        
        const tree = buildCategoryTree(fetchedCategories)
        setCategoryTree(tree)
        
        const expanded = new Set()
        tree.forEach((node, idx) => {
          if (node.children && node.children.length > 0) {
            expanded.add(String(idx))
          }
        })
        setExpandedCategories(expanded)

        const uniqueBrands = [...new Set(fetchedProducts.map(p => p.brand).filter(Boolean))]
        setBrands(uniqueBrands.map(b => ({
          value: b,
          label: b
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
    const categoryNames = selectedCategory === 'all' 
      ? [] 
      : getCategoryWithChildren(categoryTree, selectedCategory)
    const matchesCategory = selectedCategory === 'all' || categoryNames.includes(product.category)
    
    const matchesBrand = selectedBrands.length === 0 || selectedBrands.includes(product.brand)
    
    const matchesPrice = (!priceRange[0] || product.price >= priceRange[0]) && 
                         (!priceRange[1] || product.price <= priceRange[1])
    
    const matchesStock = !inStockOnly || product.stock > 0
    
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (product.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    
    return matchesCategory && matchesBrand && matchesPrice && matchesStock && matchesSearch
  })

  const handleCategoryChange = (category) => {
    setSelectedCategory(category)
  }

  const handleBrandToggle = (brand) => {
    setSelectedBrands(prev => 
      prev.includes(brand) 
        ? prev.filter(b => b !== brand)
        : [...prev, brand]
    )
  }

  const toggleCategoryExpand = (key) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedCategories(newExpanded)
  }

  const hasActiveFilters = selectedCategory !== 'all' || selectedBrands.length > 0 || priceRange[0] > 0 || priceRange[1] > 0 || inStockOnly

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
        
        <section className="relative w-full min-h-[450px] mb-12 rounded-[32px] overflow-hidden border border-white/10 shadow-2xl group bg-[#0a0a0a]">
          <div className="absolute inset-0 z-0">
            <img 
              src="/assets/landing/480473076_1131061492149780_4368555505559771502_n.jpg"
              alt="Premium Guitars"
              className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-[4s] ease-out opacity-80"
            />
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

        <section className="hidden lg:grid grid-cols-[280px_1fr] gap-8 mb-8 pt-6">
          <FilterSidebar 
            categoryTree={categoryTree}
            selectedCategory={selectedCategory}
            onCategoryChange={handleCategoryChange}
            expandedCategories={expandedCategories}
            onToggleExpand={toggleCategoryExpand}
            selectedBrands={selectedBrands}
            onBrandToggle={handleBrandToggle}
            brands={brands}
            priceRange={priceRange}
            onPriceRangeChange={setPriceRange}
            inStockOnly={inStockOnly}
            onInStockChange={setInStockOnly}
          />
          
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="relative w-72">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    type="text"
                    placeholder="Search our catalog..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-2 bg-[var(--surface-dark)] border border-[var(--border)] rounded-full text-xs text-white placeholder-white/30 focus:outline-none focus:border-[var(--gold-primary)]/50 transition-all focus:bg-[var(--surface-elevated)] shadow-sm"
                  />
                </div>
              </div>
              <span className="text-sm text-[var(--text-muted)]">{filteredProducts.length} products</span>
            </div>

            <ActiveFiltersBar 
              selectedCategory={selectedCategory}
              onCategoryClear={() => setSelectedCategory('all')}
              selectedBrands={selectedBrands}
              onBrandClear={(brand) => setSelectedBrands(prev => prev.filter(b => b !== brand))}
              priceRange={priceRange}
              onPriceRangeClear={() => setPriceRange([0, 0])}
              inStockOnly={inStockOnly}
              onInStockClear={() => setInStockOnly(false)}
              categoryTree={categoryTree}
              brandLabels={brandLabels}
            />

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

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
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

                        <div className="mt-auto flex flex-col gap-4 pt-3 border-t border-white/10">
                          <div className="flex items-center justify-between">
                            <p className="text-lg font-bold text-white tracking-tight">
                              ₱{product.price.toLocaleString('en-PH')}
                            </p>
                          </div>

                          <div className="flex flex-col sm:flex-row items-stretch gap-3">
                            {!outOfStock && isAuthenticated && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleBuyNow(product); }}
                                className="flex-1 px-4 py-2.5 rounded-full bg-[var(--gold-primary)] text-black font-bold text-xs tracking-wide hover:brightness-110 transition-all shadow-md"
                              >
                                Buy Now
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleAddToCart(product); }}
                              disabled={buttonState !== 'add'}
                              className={`flex-1 px-4 py-2.5 rounded-full text-xs tracking-wide font-bold transition-all border ${
                                buttonState === 'out_of_stock'
                                  ? 'border-[var(--border)] bg-[var(--surface-dark)] text-[var(--text-muted)] cursor-not-allowed'
                                  : 'bg-[var(--surface-dark)] border-[var(--border)] text-[var(--text-light)] hover:text-[var(--gold-primary)] hover:border-[var(--gold-primary)] shadow-sm'
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
        </section>

        <section className="lg:hidden">
          <div className="flex items-center justify-between mb-6 pt-6">
            <button 
              onClick={() => setMobileFilterOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--surface-dark)] border border-[var(--border)] rounded-full text-xs font-semibold text-white"
            >
              <Filter className="w-4 h-4" />
              Filters
              {hasActiveFilters && (
                <span className="w-2 h-2 bg-[var(--gold-primary)] rounded-full" />
              )}
            </button>
            
            <div className="relative flex-1 ml-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-2 bg-[var(--surface-dark)] border border-[var(--border)] rounded-full text-xs text-white placeholder-white/30 focus:outline-none focus:border-[var(--gold-primary)]/50"
              />
            </div>
          </div>

          <span className="text-sm text-[var(--text-muted)] mb-4 block">{filteredProducts.length} products</span>

          <ActiveFiltersBar 
            selectedCategory={selectedCategory}
            onCategoryClear={() => setSelectedCategory('all')}
            selectedBrands={selectedBrands}
            onBrandClear={(brand) => setSelectedBrands(prev => prev.filter(b => b !== brand))}
            priceRange={priceRange}
            onPriceRangeClear={() => setPriceRange([0, 0])}
            inStockOnly={inStockOnly}
            onInStockClear={() => setInStockOnly(false)}
            categoryTree={categoryTree}
            brandLabels={brandLabels}
          />

          <div className="grid grid-cols-2 gap-4">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product, index) => {
                const buttonState = getAddButtonState(product)
                const outOfStock = isOutOfStock(product.id)
                
                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03, duration: 0.3 }}
                    onClick={() => setSelectedProduct(product)}
                    className={`group bg-[var(--surface-dark)] border border-white/5 rounded-2xl overflow-hidden ${outOfStock ? 'opacity-60' : ''}`}
                  >
                    <div className="aspect-square bg-[var(--surface-elevated)] relative">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                      {outOfStock && (
                        <span className="absolute top-2 left-2 px-2 py-0.5 bg-red-500 text-white text-[9px] uppercase font-bold rounded-full">
                          Out of Stock
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-[10px] text-[var(--text-muted)] truncate">{product.category}</p>
                      <h3 className="text-sm font-bold text-white truncate">{product.name}</h3>
                      <p className="text-sm font-bold text-[var(--gold-primary)] mt-1">
                        ₱{product.price.toLocaleString('en-PH')}
                      </p>
                    </div>
                  </motion.div>
                )
              })
            ) : (
              <div className="col-span-2 flex flex-col items-center justify-center py-12 bg-[var(--surface-dark)] rounded-2xl">
                <Search className="w-10 h-10 text-white/20 mb-3" />
                <p className="text-white font-medium">No products found</p>
              </div>
            )}
          </div>

          <FilterSidebar 
            categoryTree={categoryTree}
            selectedCategory={selectedCategory}
            onCategoryChange={handleCategoryChange}
            expandedCategories={expandedCategories}
            onToggleExpand={toggleCategoryExpand}
            selectedBrands={selectedBrands}
            onBrandToggle={handleBrandToggle}
            brands={brands}
            priceRange={priceRange}
            onPriceRangeChange={setPriceRange}
            inStockOnly={inStockOnly}
            onInStockChange={setInStockOnly}
            isOpen={mobileFilterOpen}
            onClose={() => setMobileFilterOpen(false)}
            isMobile
          />
        </section>
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
