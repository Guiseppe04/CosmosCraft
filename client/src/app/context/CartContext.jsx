import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

/**
 * CartContext - Global state management for shopping cart
 * Ref: fromFigma/cart - handles cart operations
 */
const CartContext = createContext()

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('cosmos_cart')
      return saved ? JSON.parse(saved) : []
    } catch (e) {
      console.warn('[CartContext] Failed to load cart from localStorage:', e)
      return []
    }
  })
  const [isOpen, setIsOpen] = useState(false)
  const [itemAddedStates, setItemAddedStates] = useState({})

  useEffect(() => {
    try {
      localStorage.setItem('cosmos_cart', JSON.stringify(cart))
      console.log('[CartContext] Cart updated:', cart)
    } catch (e) {
      console.warn('[CartContext] Failed to save cart to localStorage:', e)
    }
  }, [cart])

  /**
   * addToCart - Add product to shopping cart
   * @param {Object} product - Product to add
   * @param {number} quantity - Quantity to add
   * @returns {boolean} - True if added, false if max limit reached
   */
  const addToCart = useCallback((product, quantity = 1) => {
    const targetBuildId = localStorage.getItem('cosmoscraft_target_build_id')
    let added = false

    if (targetBuildId) {
      // Target a specific custom build to add parts to
      for (const storageKey of ['cosmoscraft_saved_builds', 'cosmoscraft_saved_bass_builds']) {
        const builds = JSON.parse(localStorage.getItem(storageKey) || '[]')
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
          localStorage.removeItem('cosmoscraft_target_build_id') // Prevent routing leakage
          added = true
          break
        }
      }
    } else {
      // Normal Cart Add
      setCart(prevCart => {
        const existing = prevCart.find(item => item.id === product.id)
        if (existing) {
          const newQuantity = existing.quantity + quantity
          if (newQuantity > 10) return prevCart
          added = true
          return prevCart.map(item => item.id === product.id ? { ...item, quantity: newQuantity } : item)
        }
        added = true
        return [...prevCart, { ...product, quantity }]
      })
    }
    
    if (added) {
      setItemAddedStates(prev => ({ ...prev, [product.id]: true }))
      setTimeout(() => {
        setItemAddedStates(prev => ({ ...prev, [product.id]: false }))
      }, 1500)
    }
    
    return added
  }, [])

  /**
   * isItemAtMaxQuantity - Check if item has reached max quantity
   * @param {string} productId - ID of product
   * @returns {boolean}
   */
  const isItemAtMaxQuantity = useCallback((productId) => {
    const item = cart.find(i => i.id === productId)
    return item ? item.quantity >= 10 : false
  }, [cart])

  /**
   * getItemAddedState - Check if item was just added
   * @param {string} productId - ID of product
   * @returns {boolean}
   */
  const getItemAddedState = useCallback((productId) => {
    return itemAddedStates[productId] || false
  }, [itemAddedStates])

  /**
   * removeFromCart - Remove product from cart
   * @param {string} productId - ID of product to remove
   */
  const removeFromCart = useCallback((productId) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId))
    setItemAddedStates(prev => {
      const newState = { ...prev }
      delete newState[productId]
      return newState
    })
  }, [])

  /**
   * updateQuantity - Update product quantity in cart
   * @param {string} productId - ID of product
   * @param {number} quantity - New quantity
   */
  const updateQuantity = useCallback((productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId)
      return
    }
    setCart(prevCart =>
      prevCart.map(item =>
        item.id === productId ? { ...item, quantity } : item
      )
    )
  }, [removeFromCart])

  /**
   * clearCart - Clear all items from cart
   */
  const clearCart = useCallback(() => {
    setCart([])
  }, [])

  /**
   * getTotalPrice - Calculate total cart price
   */
  const getTotalPrice = useCallback(() => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0)
  }, [cart])

  /**
   * getCartCount - Get total items in cart
   */
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
    </CartContext.Provider>
  )
}

/**
 * useCart - Hook to access cart context
 */
export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within CartProvider')
  }
  return context
}
