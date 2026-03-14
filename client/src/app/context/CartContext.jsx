import React, { createContext, useContext, useState, useCallback } from 'react'

/**
 * CartContext - Global state management for shopping cart
 * Ref: fromFigma/cart - handles cart operations
 */
const CartContext = createContext()

export function CartProvider({ children }) {
  const [cart, setCart] = useState([])
  const [isOpen, setIsOpen] = useState(false)

  /**
   * addToCart - Add product to shopping cart
   * @param {Object} product - Product to add
   * @param {number} quantity - Quantity to add
   */
  const addToCart = useCallback((product, quantity = 1) => {
    setCart(prevCart => {
      const existing = prevCart.find(item => item.id === product.id)
      if (existing) {
        return prevCart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      }
      return [...prevCart, { ...product, quantity }]
    })
  }, [])

  /**
   * removeFromCart - Remove product from cart
   * @param {string} productId - ID of product to remove
   */
  const removeFromCart = useCallback((productId) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId))
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
