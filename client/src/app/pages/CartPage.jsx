import { Link } from 'react-router'
import { useCart } from '../context/CartContext.jsx'
import { Trash2, Plus, Minus, ArrowRight } from 'lucide-react'

/**
 * CartPage - Shopping Cart
 * Ref: fromFigma/cart - Shopping cart display and management
 */
export function CartPage() {
  const { cart, removeFromCart, updateQuantity, getTotalPrice } = useCart()

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-light">
        <div className="page text-center space-y-6">
          <h1 className="text-5xl font-bold text-dark">Your Cart is Empty</h1>
          <p className="text-lg text-dark opacity-70">Start shopping to add items to your cart</p>
          <Link to="/shop" className="btn btn-primary inline-flex items-center gap-2">
            Continue Shopping
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-light">
      <div className="page">
        <h1 className="text-5xl font-bold text-dark mb-12">Shopping Cart</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Items */}
          <div className="lg:col-span-2 space-y-4">
            {cart.map(item => (
              <div key={item.id} className="bg-white rounded-2xl p-6 flex justify-between items-center">
                <div className="flex-grow">
                  <h3 className="text-xl font-bold text-dark">{item.name}</h3>
                  <p className="text-dark opacity-70 mt-1">${item.price}</p>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center gap-4 mx-6">
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="p-1 hover:bg-light rounded transition"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-bold">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="p-1 hover:bg-light rounded transition"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Subtotal */}
                <div className="w-24 text-right">
                  <p className="text-lg font-bold text-gold">${(item.price * item.quantity).toLocaleString()}</p>
                </div>

                {/* Remove */}
                <button
                  onClick={() => removeFromCart(item.id)}
                  className="p-2 ml-4 hover:bg-light rounded transition text-red-500"
                  aria-label="Remove item"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="bg-white rounded-2xl p-8 h-fit space-y-6 sticky top-24">
            <h2 className="text-2xl font-bold text-dark">Order Summary</h2>

            <div className="space-y-3 border-t border-light-dark pt-6">
              <div className="flex justify-between">
                <span className="text-dark opacity-70">Subtotal</span>
                <span className="font-bold text-dark">${getTotalPrice().toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark opacity-70">Shipping</span>
                <span className="font-bold text-dark">$0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark opacity-70">Tax</span>
                <span className="font-bold text-dark">${(getTotalPrice() * 0.1).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="border-t border-light-dark pt-6 flex justify-between items-center">
              <span className="text-xl font-bold text-dark">Total</span>
              <span className="text-3xl font-bold text-gold">${(getTotalPrice() * 1.1).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>

            <Link to="/checkout" className="btn btn-primary w-full">
              Proceed to Checkout
            </Link>

            <Link to="/shop" className="btn btn-outline w-full text-center">
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
