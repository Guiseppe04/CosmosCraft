import { useCart } from '../context/CartContext.jsx'
import { ArrowRight, Check } from 'lucide-react'

/**
 * CheckoutPage - Payment & Checkout
 * Ref: fromFigma/pages/CheckoutPage - Payment processing and order confirmation
 */
export function CheckoutPage() {
  const { getTotalPrice, cart, clearCart } = useCart()
  const totalWithTax = getTotalPrice() * 1.1

  const handleSubmit = (e) => {
    e.preventDefault()
    clearCart()
    alert('Order confirmed! Thank you for your purchase.')
  }

  return (
    <div className="min-h-screen bg-light">
      <div className="page max-w-2xl">
        <h1 className="text-5xl font-bold text-dark mb-12">Checkout</h1>

        <div className="bg-white rounded-2xl p-8 space-y-8">
          {/* Order Items */}
          <div className="border-b border-light-dark pb-8">
            <h2 className="text-2xl font-bold text-dark mb-6">Order Summary</h2>
            {cart.map(item => (
              <div key={item.id} className="flex justify-between mb-4">
                <span className="text-dark">{item.name} x{item.quantity}</span>
                <span className="font-bold text-dark">${(item.price * item.quantity).toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between pt-4 text-xl font-bold text-dark">
              <span>Total</span>
              <span className="text-gold">${totalWithTax.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Payment Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Billing Address */}
            <div>
              <h3 className="text-xl font-bold text-dark mb-4">Billing Address</h3>
              <div className="grid grid-cols-2 gap-4">
                <input placeholder="First Name" type="text" required className="col-span-1" />
                <input placeholder="Last Name" type="text" required className="col-span-1" />
                <input placeholder="Email" type="email" required className="col-span-2" />
                <input placeholder="Address" type="text" required className="col-span-2" />
                <input placeholder="City" type="text" required className="col-span-1" />
                <input placeholder="ZIP Code" type="text" required className="col-span-1" />
              </div>
            </div>

            {/* Payment Info */}
            <div>
              <h3 className="text-xl font-bold text-dark mb-4">Payment Information</h3>
              <div className="space-y-4">
                <input placeholder="Cardholder Name" type="text" required />
                <input placeholder="Card Number" type="text" required />
                <div className="grid grid-cols-2 gap-4">
                  <input placeholder="MM/YY" type="text" required />
                  <input placeholder="CVC" type="text" required />
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="btn btn-primary w-full flex items-center justify-center gap-2 text-lg"
            >
              <Check className="w-5 h-5" />
              Complete Purchase
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
