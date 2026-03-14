import { useState } from 'react'
import { motion } from 'motion/react'
import { Filter, Search, ShoppingCart, Zap } from 'lucide-react'
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
  const { addToCart } = useCart()
  const navigate = useNavigate()
  const { isAuthenticated, openLogin } = useAuth()

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
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      category: product.category,
      type: 'product',
    })
    setNotification(`${product.name} added to cart!`)
    setTimeout(() => setNotification(null), 3000)
  }

  const performBuyNow = product => {
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      category: product.category,
      type: 'product',
    })
    navigate('/checkout')
  }

  const handleBuyNow = product => {
    if (!isAuthenticated) {
      openLogin(() => performBuyNow(product))
    } else {
      performBuyNow(product)
    }
  }

  return (
    <div className="min-h-screen pt-16 bg-[#f5f5f7]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Guitar Shop</h1>
          <p className="text-sm text-gray-500">Premium guitars and accessories</p>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#d4af37] transition-all shadow-sm"
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
                className="w-full md:hidden flex items-center justify-center gap-2 px-4 py-3 bg-[#d4af37] text-gray-900 rounded-lg font-semibold mb-4"
              >
                <Filter className="w-5 h-5" />
                Filters
              </button>

              <div className={`${showFilters ? 'block' : 'hidden'} md:block space-y-6`}>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Category</h3>
                  <div className="space-y-2">
                    {categories.map(cat => (
                      <button
                        key={cat.value}
                        onClick={() => setSelectedCategory(cat.value)}
                        className={`block w-full text-left px-4 py-2 rounded-lg text-sm transition-all ${
                          selectedCategory === cat.value
                            ? 'bg-[#fff7dd] text-gray-900 border-r-4 border-[#d4af37]'
                            : 'text-gray-600 hover:text-[#d4af37] hover:bg-gray-50'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Price Range</h3>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min="0"
                      max="20000"
                      value={priceRange[1]}
                      onChange={e => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                      className="w-full"
                    />
                    <p className="text-gray-500 text-sm">
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
                className="mb-4 p-4 bg-[#d4af37] text-[#231f20] rounded-lg flex items-center gap-2 shadow-sm"
              >
                <Zap className="w-5 h-5" />
                {notification}
              </motion.div>
            )}

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product, index) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-[#d4af37] hover:shadow-md transition-all"
                  >
                    <div className="aspect-square overflow-hidden">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                      />
                    </div>
                    <div className="p-4">
                      <p className="text-xs text-gray-500 mb-1">{product.category}</p>
                      <h3 className="font-semibold text-gray-900 mb-2">{product.name}</h3>
                      <p className="text-xl font-bold text-[#d4af37] mb-4">
                        ${product.price.toLocaleString()}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAddToCart(product)}
                          className="flex-1 px-3 py-2 bg-[#d4af37] text-[#231f20] rounded-lg text-sm font-semibold hover:bg-[#c39d2f] transition-all"
                        >
                          <ShoppingCart className="w-4 h-4 inline mr-2" />
                          Add
                        </button>
                        <button
                          onClick={() => handleBuyNow(product)}
                          className="flex-1 px-3 py-2 border border-[#d4af37] text-[#d4af37] rounded-lg text-sm font-semibold hover:bg-[#fff7dd] transition-all"
                        >
                          Buy
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full text-center py-12">
                  <p className="text-gray-500">No products found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
