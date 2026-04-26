import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle } from 'lucide-react'
import api from '../services/api.js'
import { useAuth } from './AuthContext.jsx'

/**
 * CartContext - Global state management for shopping cart
 * Ref: fromFigma/cart - handles cart operations
 */
const CartContext = createContext()

function safeParseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback
  } catch (error) {
    console.warn('[CartContext] Invalid JSON in localStorage, resetting value:', error)
    return fallback
  }
}

export function CartProvider({ children }) {
  const { isAuthenticated, isLoadingUser } = useAuth()
  const [globalToast, setGlobalToast] = useState(null)

  const [cart, setCart] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [itemAddedStates, setItemAddedStates] = useState({})

  const fetchDbCart = useCallback(async () => {
    try {
      const dbCartParams = await api.cart.getCart()
      if (dbCartParams?.data?.items) {
        const mappedCart = dbCartParams.data.items.map(item => ({
          id: item.product?.product_id,
          cart_item_id: item.cart_item_id,
          name: item.product?.name,
          price: item.unit_price,
          image: item.product?.image || item.product?.primary_image || '/assets/placeholder.jpg',
          stock: item.product?.stock,
          quantity: item.quantity,
          type: 'product'
        }))
        setCart(mappedCart)
      } else {
        setCart([])
      }
    } catch (err) {
      console.error(err)
    }
  }, [])

  useEffect(() => {
    if (isLoadingUser) return

    if (isAuthenticated) {
      const syncCart = async () => {
        const guestCart = safeParseJson(localStorage.getItem('cosmos_cart'), [])
        if (guestCart.length > 0) {
          for (const item of guestCart) {
            try {
              await api.cart.addItem({ product_id: item.id, quantity: item.quantity })
            } catch (e) {
              console.error('Failed to merge guest cart item', item, e)
            }
          }
          localStorage.removeItem('cosmos_cart')
        }
        await fetchDbCart()
      }
      syncCart()
    } else {
      const saved = localStorage.getItem('cosmos_cart')
      setCart(safeParseJson(saved, []))
    }
  }, [isAuthenticated, isLoadingUser, fetchDbCart])

  useEffect(() => {
    if (!isLoadingUser && !isAuthenticated) {
      try {
        localStorage.setItem('cosmos_cart', JSON.stringify(cart))
      } catch (e) {
        console.warn('[CartContext] Failed to save cart to localStorage:', e)
      }
    }
  }, [cart, isAuthenticated, isLoadingUser])

  const addToCart = useCallback((product, quantity = 1) => {
    const targetBuildId = localStorage.getItem('cosmoscraft_target_build_id')
    let added = false
    let shouldSync = false

    if (targetBuildId) {
      for (const storageKey of ['cosmoscraft_saved_builds', 'cosmoscraft_saved_bass_builds']) {
        const builds = safeParseJson(localStorage.getItem(storageKey), [])
        const buildIndex = builds.findIndex(b => b.id === targetBuildId)
        if (buildIndex !== -1) {
          if (!builds[buildIndex].additionalParts) builds[buildIndex].additionalParts = []

          const existingPartIndex = builds[buildIndex].additionalParts.findIndex(p => p.id === product.id)
          if (existingPartIndex !== -1) {
            builds[buildIndex].additionalParts[existingPartIndex].quantity += quantity
          } else {
            builds[buildIndex].additionalParts.push({ ...product, quantity })
          }
          localStorage.setItem(storageKey, JSON.stringify(builds))
          localStorage.removeItem('cosmoscraft_target_build_id')
          added = true
          break
        }
      }
    } else {
      setCart(prevCart => {
        const existing = prevCart.find(item => item.id === product.id)
        if (existing) {
          const newQuantity = existing.quantity + quantity
          if (newQuantity > 10) return prevCart
          added = true
          shouldSync = true
          return prevCart.map(item => item.id === product.id ? { ...item, quantity: newQuantity } : item)
        }
        added = true
        shouldSync = true
        return [...prevCart, { ...product, quantity }]
      })

      if (isAuthenticated && shouldSync) {
        api.cart.addItem({ product_id: product.id, quantity })
          .then(() => fetchDbCart())
          .catch(console.error)
      }
    }

    if (added) {
      setItemAddedStates(prev => ({ ...prev, [product.id]: true }))
      setGlobalToast(`Added ${quantity > 1 ? quantity + ' ' : ''}${product.name || 'item'} to cart!`)
      setTimeout(() => {
        setItemAddedStates(prev => ({ ...prev, [product.id]: false }))
      }, 1500)
      setTimeout(() => setGlobalToast(null), 3000)
    }

    return added
  }, [isAuthenticated, fetchDbCart])

  const isItemAtMaxQuantity = useCallback((productId) => {
    const item = cart.find(i => i.id === productId)
    return item ? item.quantity >= 10 : false
  }, [cart])

  const getItemAddedState = useCallback((productId) => {
    return itemAddedStates[productId] || false
  }, [itemAddedStates])

  const removeFromCart = useCallback((productId) => {
    const item = cart.find(i => i.id === productId)
    setCart(prevCart => prevCart.filter(item => item.id !== productId))
    setItemAddedStates(prev => {
      const newState = { ...prev }
      delete newState[productId]
      return newState
    })

    if (isAuthenticated && item && item.cart_item_id) {
      api.cart.removeItem(item.cart_item_id).catch(console.error)
    }
  }, [cart, isAuthenticated])

  const updateQuantity = useCallback((productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId)
      return
    }
    const item = cart.find(i => i.id === productId)
    
    setCart(prevCart =>
      prevCart.map(i =>
        i.id === productId ? { ...i, quantity } : i
      )
    )

    if (isAuthenticated && item && item.cart_item_id) {
      api.cart.updateItem(item.cart_item_id, { quantity }).catch(console.error)
    }
  }, [cart, removeFromCart, isAuthenticated])

  const clearCart = useCallback(() => {
    setCart([])
    if (isAuthenticated) {
      api.cart.clearCart().catch(console.error)
    }
  }, [isAuthenticated])

  const getTotalPrice = useCallback(() => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0)
  }, [cart])

  const getCartCount = useCallback(() => {
    return cart.reduce((count, item) => count + item.quantity, 0)
  }, [cart])

  const value = {
    cart,
    isOpen,
    setIsOpen,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getTotalPrice,
    getCartCount,
    isItemAtMaxQuantity,
    getItemAddedState,
  }

  return (
    <CartContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {globalToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-24 left-1/2 z-[100] bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] px-6 py-3 rounded-xl font-bold shadow-[0_0_20px_rgba(212,175,55,0.4)] flex items-center gap-2 pointer-events-none"
          >
            <CheckCircle className="w-5 h-5" />
            {globalToast}
          </motion.div>
        )}
      </AnimatePresence>
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within CartProvider')
  }
  return context
}
