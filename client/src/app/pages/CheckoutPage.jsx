import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
import { useCart } from '../context/CartContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { 
  ArrowLeft, ShoppingCart, CreditCard, Truck, ShieldCheck,
  Plus, Minus, MessageSquare, Package, Guitar,
  ChevronDown, ChevronUp, MapPin, FileText, Check,
  Banknote, Building2, Smartphone, Upload, X, Edit3, CheckCircle
} from 'lucide-react'
import { API } from '../utils/apiConfig'

function SuccessModal({ isOpen, onClose }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="w-full max-w-sm bg-[var(--surface-dark)] border border-[var(--gold-primary)] rounded-xl p-6 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] flex items-center justify-center"
            >
              <CheckCircle className="w-10 h-10 text-[var(--text-dark)]" />
            </motion.div>
            <h3 className="text-xl font-bold text-white mb-2">Order Placed!</h3>
            <p className="text-[var(--text-muted)] mb-6">You successfully placed your order</p>
            <button
              onClick={onClose}
              className="w-full py-3 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-semibold rounded-lg hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all"
            >
              View My Orders
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function CheckoutPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { cart, updateQuantity, getTotalPrice, clearCart } = useCart()
  const { isAuthenticated, user } = useAuth()
  
  const isCustomBuild = location.state?.isCustomBuild || false
  const customBuildItem = location.state?.checkoutItem || null
  
  useEffect(() => {
    console.log('[Checkout] Cart state on mount:', cart)
    const savedCart = localStorage.getItem('cosmos_cart')
    console.log('[Checkout] Cart from localStorage:', savedCart)
  }, [])
  
  const fileInputRef = useRef(null)
  
  const [isProcessing, setIsProcessing] = useState(false)
  const [orderError, setOrderError] = useState(null)
  const [orderNotes, setOrderNotes] = useState('')
  const [shippingMethod, setShippingMethod] = useState('standard')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [addressErrors, setAddressErrors] = useState({})
  const [paymentErrors, setPaymentErrors] = useState({})
  
  const [bankDetails, setBankDetails] = useState({
    bankName: '',
    accountName: '',
    accountNumber: '',
    referenceNumber: '',
    notes: ''
  })
  
  const [gcashReceipt, setGcashReceipt] = useState(null)
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false)
  const [editedAddress, setEditedAddress] = useState({
    street: '',
    city: '',
    province: '',
    postalCode: ''
  })
  
  const [expandedSections, setExpandedSections] = useState({
    items: true,
    address: true,
  })
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showTCModal, setShowTCModal] = useState(false)
  const [tcAccepted, setTcAccepted] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentTerms, setPaymentTerms] = useState('full')

  // Initialize edited address from user profile on mount
  useEffect(() => {
    if (user?.address) {
      setEditedAddress({
        street: user.address.street || '',
        city: user.address.city || '',
        province: user.address.province || '',
        postalCode: user.address.postalCode || ''
      })
    }
  }, [user])

  let customSubtotal = 0;
  let customBuildPrice = 0;
  let customAdditionalPartsTotal = 0;
  let checkoutItems = cart;

  if (isCustomBuild && customBuildItem) {
    customBuildPrice = Number(customBuildItem.price) || 0;
    customAdditionalPartsTotal = (customBuildItem.additionalParts || []).reduce((sum, p) => sum + (Number(p.price) * p.quantity), 0);
    customSubtotal = customBuildPrice + customAdditionalPartsTotal;
    checkoutItems = [
      {
        ...customBuildItem,
        category: 'Custom Build',
        price: customSubtotal,
        quantity: 1,
        image: customBuildItem.config?.bodyStyle === 'lespaul' ? 'https://images.unsplash.com/photo-1550985616-10810253b84d?w=800&q=80' : 
               customBuildItem.config?.bodyStyle === 'tele' ? 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=800&q=80' : 
               'https://images.unsplash.com/photo-1564186763535-ebb21ef5277f?w=800&q=80',
        id: customBuildItem.id || `custom-${Date.now()}`,
      }
    ]
  }

  const subtotal = isCustomBuild ? customSubtotal : getTotalPrice()
  const shippingCost = shippingMethod === 'express' ? 500 : 0
  const tax = subtotal * 0.1
  
  const fullPaymentTotal = subtotal + shippingCost + tax;
  const downPaymentTotal = isCustomBuild ? ((customBuildPrice * 0.5) + customAdditionalPartsTotal) + shippingCost + tax : (fullPaymentTotal / 2);
  
  const total = paymentTerms === 'down' ? downPaymentTotal : fullPaymentTotal;

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setGcashReceipt(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeReceipt = () => {
    setGcashReceipt(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleEditAddress = () => {
    setEditedAddress({
      street: user?.address?.street || '',
      city: user?.address?.city || '',
      province: user?.address?.province || '',
      postalCode: user?.address?.postalCode || ''
    })
    setIsAddressModalOpen(true)
    setAddressErrors({})
  }

  const validateAddress = () => {
    const errors = {}
    
    // Use edited address if modal was opened and edited, otherwise use user's saved address
    const addressToValidate = {
      street: editedAddress.street || user?.address?.street || '',
      city: editedAddress.city || user?.address?.city || '',
      province: editedAddress.province || user?.address?.province || '',
      postalCode: editedAddress.postalCode || user?.address?.postalCode || ''
    }

    if (!addressToValidate.street?.trim()) errors.street = 'Street address is required'
    if (!addressToValidate.city?.trim()) errors.city = 'City is required'
    if (!addressToValidate.province?.trim()) errors.province = 'Province is required'
    if (!addressToValidate.postalCode?.trim()) errors.postalCode = 'Postal code is required'
    
    setAddressErrors(errors)
    return Object.keys(errors).length === 0
  }

  const validatePayment = () => {
    const errors = {}
    if (!paymentMethod) errors.payment = 'Payment method is required'
    if (paymentMethod === 'bank') {
      if (!bankDetails.bankName?.trim()) errors.bankName = 'Bank name is required'
      if (!bankDetails.accountName?.trim()) errors.accountName = 'Account name is required'
      if (!bankDetails.accountNumber?.trim()) errors.accountNumber = 'Account number is required'
    }
    if (paymentMethod === 'gcash' && !gcashReceipt) {
      errors.gcash = 'GCash receipt is required'
    }
    setPaymentErrors(errors)
    return Object.keys(errors).length === 0
  }

  const saveAddress = () => {
    if (validateAddress()) {
      setIsAddressModalOpen(false)
    }
  }

  const handlePlaceOrderClick = () => {
    if (!isAuthenticated) {
      alert('Please log in to place an order.')
      return
    }

    if (!validateAddress()) {
      setExpandedSections(prev => ({ ...prev, address: true }))
      return
    }

    setShowTCModal(true)
  }

  const handleTCAccept = () => {
    setTcAccepted(true)
    setShowTCModal(false)
    setShowPaymentModal(true)
  }

  const handleFinalSubmit = async () => {
    if (!validatePayment()) {
      return
    }

    setIsProcessing(true)
    
    // Determine which address to use
    const finalAddress = {
      street: editedAddress.street || user?.address?.street || '',
      city: editedAddress.city || user?.address?.city || '',
      province: editedAddress.province || user?.address?.province || '',
      postalCode: editedAddress.postalCode || user?.address?.postalCode || ''
    }

    let additionalNotes = orderNotes
    additionalNotes += `\n\nPayment Terms: ${paymentTerms === 'full' ? 'Full Payment' : 'Down Payment'}`
    
    if (paymentMethod === 'bank') {
      additionalNotes += `\nBank Transfer Details:\nBank: ${bankDetails.bankName}\nAccount Name: ${bankDetails.accountName}\nAccount Number: ${bankDetails.accountNumber}\nReference: ${bankDetails.referenceNumber}\n${bankDetails.notes ? 'Notes: ' + bankDetails.notes : ''}`
    }
    
    try {
      setOrderError(null)
      console.log('Placing order with address:', finalAddress)
      const response = await fetch(`${API}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          items: checkoutItems.map(item => ({
            productId: item.id,
            quantity: item.quantity,
            price: item.price,
            notes: item.notes || ''
          })),
          amount: total,
          notes: additionalNotes,
          shippingMethod,
          paymentMethod,
          billingAddress: finalAddress
        })
      })

      const data = await response.json()

      if (response.ok) {
        clearCart()
        setOrderError(null)
        setShowPaymentModal(false)
        setShowSuccessModal(true)
      } else {
        const errorMsg = data.message || 'Order failed. Please try again.'
        setOrderError(errorMsg)
      }
    } catch (error) {
      const errorMsg = error.message || 'Network error. Please check your connection and try again.'
      setOrderError(errorMsg)
    } finally {
      setIsProcessing(false)
    }
  }

  if (!isCustomBuild && cart.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] pt-24">
        <div className="page text-center space-y-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center justify-center w-24 h-24 bg-[var(--surface-dark)] border border-[var(--border)] rounded-full mb-4"
          >
            <ShoppingCart className="w-12 h-12 text-[var(--gold-primary)]" />
          </motion.div>
          <h1 className="text-5xl font-bold text-[var(--text-light)]">Your Cart is Empty</h1>
          <p className="text-lg text-[var(--text-muted)]">Add some guitars to your cart first</p>
          <Link 
            to="/shop" 
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] rounded-xl font-semibold hover:shadow-[0_0_30px_rgba(212,175,55,0.5)] transition-all duration-200"
          >
            Browse Guitars
          </Link>
        </div>
      </div>
    )
  }



  const handleSuccessModalClose = () => {
    setShowSuccessModal(false)
    navigate('/dashboard?tab=purchases')
  }

  return (
    <>
      <div className="min-h-screen bg-[var(--bg-primary)] pt-20 pb-12">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-6"
        >
          <Link 
            to="/cart" 
            className="p-2 rounded-lg border border-[var(--border)] hover:border-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/10 transition-all duration-200"
          >
            <ArrowLeft className="w-5 h-5 text-[var(--text-muted)]" />
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-light)]">Checkout</h1>
        </motion.div>

        {/* Error Alert */}
        {orderError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg"
          >
            <p className="text-red-400 text-sm font-medium">{orderError}</p>
            <p className="text-red-400/70 text-xs mt-1">Check your browser console for more details (F12)</p>
          </motion.div>
        )}

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Left Column - Order Details */}
          <div className="lg:col-span-3 space-y-4">
            {/* Address Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-[var(--surface-dark)] border rounded-xl overflow-hidden transition-colors ${
                Object.keys(addressErrors).length > 0 
                  ? 'border-red-500/50 bg-red-500/5' 
                  : 'border-[var(--border)]'
              }`}
            >
              <button
                onClick={() => toggleSection('address')}
                className="w-full flex items-center justify-between p-4 border-b border-[var(--border)]"
              >
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-[var(--gold-primary)]" />
                  <h2 className="text-lg font-bold text-[var(--text-light)]">Shipping Address</h2>
                  <span className="text-xs text-red-400">*Required</span>
                </div>
                {expandedSections.address ? (
                  <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                )}
              </button>

              {expandedSections.address && (
                <div className="p-4">
                  {Object.keys(addressErrors).length > 0 && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <p className="text-sm text-red-400 font-medium mb-1">Address is incomplete:</p>
                      <ul className="text-xs text-red-400 space-y-1">
                        {Object.entries(addressErrors).map(([field, error]) => (
                          <li key={field}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-[var(--text-light)]">
                        {editedAddress.street || user?.address?.street || 'No address set'}
                      </p>
                      <p className="text-sm text-[var(--text-muted)]">
                        {editedAddress.city || user?.address?.city || ''}
                        {(editedAddress.city || user?.address?.city) && (editedAddress.province || user?.address?.province) ? ', ' : ''}
                        {editedAddress.province || user?.address?.province || ''}
                        {(editedAddress.postalCode || user?.address?.postalCode) ? ' ' : ''}
                        {editedAddress.postalCode || user?.address?.postalCode || ''}
                      </p>
                    </div>
                    <button
                      onClick={handleEditAddress}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/10 rounded-lg transition-all duration-200"
                    >
                      <Edit3 className="w-3 h-3" />
                      Edit
                    </button>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Cart Items */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl overflow-hidden"
            >
              <button
                onClick={() => toggleSection('items')}
                className="w-full flex items-center justify-between p-4 border-b border-[var(--border)]"
              >
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-[var(--gold-primary)]" />
                  <h2 className="text-lg font-bold text-[var(--text-light)]">Order Items ({checkoutItems.length})</h2>
                </div>
                {expandedSections.items ? (
                  <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                )}
              </button>

              {expandedSections.items && (
                <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
                  {checkoutItems.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex gap-3 p-3 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg"
                    >
                      <div className="w-16 h-16 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] flex items-center justify-center overflow-hidden flex-shrink-0">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <Guitar className="w-6 h-6 text-[var(--gold-primary)]" />
                        )}
                      </div>

                      <div className="flex-grow min-w-0">
                        <h3 className="text-sm font-semibold text-[var(--text-light)] truncate">{item.name}</h3>
                        <p className="text-xs text-[var(--text-muted)]">Qty: {item.quantity}</p>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-[var(--gold-primary)]">
                          ₱{(item.price * item.quantity).toLocaleString('en-PH')}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Shipping Options */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl p-4"
            >
              <div className="flex items-center gap-3 mb-3">
                <Truck className="w-5 h-5 text-[var(--gold-primary)]" />
                <h2 className="text-lg font-bold text-[var(--text-light)]">Shipping</h2>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                  shippingMethod === 'standard' 
                    ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10' 
                    : 'border-[var(--border)] hover:border-[var(--gold-primary)]/50'
                }`}>
                  <input 
                    type="radio" 
                    name="shipping" 
                    value="standard"
                    checked={shippingMethod === 'standard'}
                    onChange={() => setShippingMethod('standard')}
                    className="w-4 h-4 text-[var(--gold-primary)]"
                  />
                  <div>
                    <p className="text-sm font-medium text-[var(--text-light)]">Standard</p>
                    <p className="text-xs text-[var(--text-muted)]">5-7 days</p>
                  </div>
                  <span className="ml-auto text-sm font-bold text-[var(--text-light)]">Free</span>
                </label>

                <label className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                  shippingMethod === 'express' 
                    ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10' 
                    : 'border-[var(--border)] hover:border-[var(--gold-primary)]/50'
                }`}>
                  <input 
                    type="radio" 
                    name="shipping" 
                    value="express"
                    checked={shippingMethod === 'express'}
                    onChange={() => setShippingMethod('express')}
                    className="w-4 h-4 text-[var(--gold-primary)]"
                  />
                  <div>
                    <p className="text-sm font-medium text-[var(--text-light)]">Express</p>
                    <p className="text-xs text-[var(--text-muted)]">2-3 days</p>
                  </div>
                  <span className="ml-auto text-sm font-bold text-[var(--gold-primary)]">₱500</span>
                </label>
              </div>
            </motion.div>



            {/* Order Notes */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl p-4"
            >
              <div className="flex items-center gap-3 mb-3">
                <FileText className="w-5 h-5 text-[var(--gold-primary)]" />
                <h2 className="text-lg font-bold text-[var(--text-light)]">Order Notes</h2>
              </div>
              <textarea
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Special instructions..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-light)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--gold-primary)] resize-none text-sm"
              />
            </motion.div>
          </div>

          {/* Right Column - Order Summary */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl p-4 sticky top-20 space-y-4"
            >
              <h2 className="text-xl font-bold text-[var(--text-light)]">Order Summary</h2>

              {/* Price Breakdown */}
              <div className="space-y-2 text-sm border-t border-[var(--border)] pt-4">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Subtotal ({checkoutItems.reduce((a, b) => a + b.quantity, 0)} items)</span>
                  <span className="text-[var(--text-light)]">₱{subtotal.toLocaleString('en-PH')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Shipping</span>
                  <span className="text-[var(--text-light)]">{shippingCost === 0 ? 'Free' : `₱${shippingCost}`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Tax</span>
                  <span className="text-[var(--text-light)]">₱{tax.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-between items-center border-t border-[var(--border)] pt-4">
                <span className="font-bold text-[var(--text-light)]">Total</span>
                <span className="text-2xl font-bold text-[var(--gold-primary)]">
                  ₱{total.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Security Note */}
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <ShieldCheck className="w-4 h-4 text-[var(--gold-primary)]" />
                <span>Secure checkout</span>
              </div>

              {/* Place Order Button */}
              <button
                onClick={handlePlaceOrderClick}
                disabled={isProcessing}
                className="w-full py-3 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-bold rounded-lg hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[var(--text-dark)] border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Continue to Payment
                  </>
                )}
              </button>

              <Link 
                to="/shop" 
                className="block w-full py-2 text-center text-sm text-[var(--text-muted)] hover:text-[var(--gold-primary)] transition-colors"
              >
                Continue Shopping
              </Link>
            </motion.div>
          </div>
        </div>
      </div>

      {/* T&C Modal */}
      {showTCModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl overflow-hidden flex flex-col max-h-[80vh]"
          >
            <div className="p-6 border-b border-[var(--border)]">
              <h3 className="text-xl font-bold text-white">Terms and Conditions</h3>
            </div>
            <div className="p-6 overflow-y-auto flex-1 text-sm text-[var(--text-muted)] space-y-4">
              <p>Welcome to CosmosCraft. By placing an order, you agree to the following terms and conditions:</p>
              <h4 className="font-semibold text-white mt-4">1. Custom Builds</h4>
              <p>All custom builds require a minimum 50% non-refundable down payment to commence production. Full payment must be completed before shipment. Lead times are estimates and may vary due to material availability.</p>
              <h4 className="font-semibold text-white mt-4">2. Returns and Refunds</h4>
              <p>Custom instruments are built to your specific requirements and cannot be returned or refunded unless there is a confirmed manufacturing defect. Standard catalogue items may be returned within 14 days of receipt, subject to a 10% restocking fee.</p>
              <h4 className="font-semibold text-white mt-4">3. Warranties</h4>
              <p>All instruments come with a 2-year limited warranty covering manufacturing defects. Modifications made by unauthorized personnel will void this warranty.</p>
            </div>
            <div className="p-6 border-t border-[var(--border)] flex flex-col gap-4">
              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <input
                  type="checkbox"
                  checked={tcAccepted}
                  onChange={(e) => setTcAccepted(e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--border)] text-[var(--gold-primary)] focus:ring-[var(--gold-primary)] cursor-pointer"
                />
                <span className="text-sm font-semibold text-white">I agree to the Terms and Conditions</span>
              </label>
              <div className="flex justify-end gap-3 pb-1">
                <button
                  onClick={() => setShowTCModal(false)}
                  className="px-6 py-2.5 rounded-lg border border-[var(--border)] text-[var(--text-light)] hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTCAccept}
                  disabled={!tcAccepted}
                  className={`px-6 py-2.5 rounded-lg border transition-all ${
                    tcAccepted 
                    ? 'border-[var(--gold-primary)] bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-semibold hover:shadow-[0_0_15px_rgba(212,175,55,0.4)]'
                    : 'border-[var(--border)] bg-[var(--surface-light)] text-[var(--text-muted)] cursor-not-allowed'
                  }`}
                >
                  Confirm and Proceed
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Payment Options Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl bg-[var(--surface-dark)] border border-[var(--gold-primary)] rounded-xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[var(--gold-primary)]" />
                Payment Options
              </h3>
              <button onClick={() => setShowPaymentModal(false)} className="p-1 hover:bg-[var(--surface-elevated)] rounded">
                <X className="w-5 h-5 text-[var(--text-muted)]" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              {paymentErrors.payment && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {paymentErrors.payment}
                </div>
              )}

              {/* Payment Terms */}
              <div>
                <h4 className="text-sm font-semibold text-white mb-3">Payment Terms</h4>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`flex flex-col p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                    paymentTerms === 'full' 
                      ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10' 
                      : 'border-[var(--border)] hover:border-[var(--gold-primary)]/50'
                  }`}>
                    <div className="flex items-center">
                      <input 
                        type="radio" 
                        name="paymentTerms" 
                        value="full"
                        checked={paymentTerms === 'full'}
                        onChange={() => setPaymentTerms('full')}
                        className="w-4 h-4 text-[var(--gold-primary)] mr-3"
                      />
                      <span className="font-semibold text-white">Full Payment</span>
                    </div>
                    <span className="text-sm text-[var(--text-muted)] mt-1 ml-7">₱{fullPaymentTotal.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</span>
                  </label>

                  <label className={`flex flex-col p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                    paymentTerms === 'down' 
                      ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10' 
                      : 'border-[var(--border)] hover:border-[var(--gold-primary)]/50'
                  }`}>
                    <div className="flex items-center">
                      <input 
                        type="radio" 
                        name="paymentTerms" 
                        value="down"
                        checked={paymentTerms === 'down'}
                        onChange={() => setPaymentTerms('down')}
                        className="w-4 h-4 text-[var(--gold-primary)] mr-3"
                      />
                      <span className="font-semibold text-white">50% Down Payment</span>
                    </div>
                    <span className="text-sm text-[var(--text-muted)] mt-1 ml-7">₱{downPaymentTotal.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</span>
                  </label>
                </div>
              </div>

              {/* Payment Methods */}
              <div>
                <h4 className="text-sm font-semibold text-white mb-3">Select Method</h4>
                <div className="space-y-3">
                  {/* Bank Transfer */}
                  <label className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                    paymentMethod === 'bank' 
                      ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10' 
                      : 'border-[var(--border)] hover:border-[var(--gold-primary)]/50'
                  }`}>
                    <input 
                      type="radio" 
                      name="payment" 
                      value="bank"
                      checked={paymentMethod === 'bank'}
                      onChange={() => { setPaymentMethod('bank'); setPaymentErrors({}) }}
                      className="w-4 h-4 text-[var(--gold-primary)] mr-3"
                    />
                    <Building2 className="w-5 h-5 text-[var(--gold-primary)] mr-2" />
                    <span className="font-medium text-[var(--text-light)]">Bank Transfer</span>
                  </label>
                  
                  {paymentMethod === 'bank' && (
                  <div className="p-3 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg space-y-3 ml-7">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Bank Name *</label>
                        <input
                          type="text"
                          value={bankDetails.bankName}
                          onChange={(e) => setBankDetails(prev => ({ ...prev, bankName: e.target.value }))}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-light)] focus:outline-none focus:ring-1 focus:ring-[var(--gold-primary)]"
                          placeholder="e.g., BDO, BPI"
                        />
                        {paymentErrors.bankName && <p className="text-xs text-red-400 mt-1">{paymentErrors.bankName}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Account Name *</label>
                        <input
                          type="text"
                          value={bankDetails.accountName}
                          onChange={(e) => setBankDetails(prev => ({ ...prev, accountName: e.target.value }))}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-light)] focus:outline-none focus:ring-1 focus:ring-[var(--gold-primary)]"
                          placeholder="Account holder name"
                        />
                        {paymentErrors.accountName && <p className="text-xs text-red-400 mt-1">{paymentErrors.accountName}</p>}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Account Number *</label>
                      <input
                        type="text"
                        value={bankDetails.accountNumber}
                        onChange={(e) => setBankDetails(prev => ({ ...prev, accountNumber: e.target.value }))}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-light)] focus:outline-none focus:ring-1 focus:ring-[var(--gold-primary)]"
                        placeholder="Enter account number"
                      />
                      {paymentErrors.accountNumber && <p className="text-xs text-red-400 mt-1">{paymentErrors.accountNumber}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Reference Number</label>
                      <input
                        type="text"
                        value={bankDetails.referenceNumber}
                        onChange={(e) => setBankDetails(prev => ({ ...prev, referenceNumber: e.target.value }))}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-light)] focus:outline-none focus:ring-1 focus:ring-[var(--gold-primary)]"
                        placeholder="Transaction reference"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Additional Notes</label>
                      <textarea
                        value={bankDetails.notes}
                        onChange={(e) => setBankDetails(prev => ({ ...prev, notes: e.target.value }))}
                        rows={2}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-light)] focus:outline-none focus:ring-1 focus:ring-[var(--gold-primary)] resize-none"
                        placeholder="Any additional details..."
                      />
                    </div>
                  </div>
                  )}

                  {/* GCash */}
                  <label className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                    paymentMethod === 'gcash' 
                      ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10' 
                      : 'border-[var(--border)] hover:border-[var(--gold-primary)]/50'
                  }`}>
                    <input 
                      type="radio" 
                      name="payment" 
                      value="gcash"
                      checked={paymentMethod === 'gcash'}
                      onChange={() => { setPaymentMethod('gcash'); setPaymentErrors({}) }}
                      className="w-4 h-4 text-[var(--gold-primary)] mr-3"
                    />
                    <Smartphone className="w-5 h-5 text-[var(--gold-primary)] mr-2" />
                    <span className="font-medium text-[var(--text-light)]">GCash</span>
                  </label>

                  {paymentMethod === 'gcash' && (
                    <div className="p-3 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg ml-7">
                      {gcashReceipt ? (
                        <div className="relative inline-block">
                          <img src={gcashReceipt} alt="GCash Receipt" className="max-h-32 rounded-lg border border-[var(--border)]" />
                          <button
                            onClick={removeReceipt}
                            className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div 
                          onClick={() => fileInputRef.current?.click()}
                          className="border-2 border-dashed border-[var(--border)] rounded-lg p-4 text-center cursor-pointer hover:border-[var(--gold-primary)] transition-colors"
                        >
                          <Upload className="w-6 h-6 text-[var(--text-muted)] mx-auto mb-2" />
                          <p className="text-sm text-[var(--text-muted)]">Upload GCash receipt</p>
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      {paymentErrors.gcash && <p className="text-xs text-red-400 mt-2">{paymentErrors.gcash}</p>}
                    </div>
                  )}

                  {/* Cash */}
                  <label className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                    paymentMethod === 'cash' 
                      ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10' 
                      : 'border-[var(--border)] hover:border-[var(--gold-primary)]/50'
                  }`}>
                    <input 
                      type="radio" 
                      name="payment" 
                      value="cash"
                      checked={paymentMethod === 'cash'}
                      onChange={() => { setPaymentMethod('cash'); setPaymentErrors({}) }}
                      className="w-4 h-4 text-[var(--gold-primary)] mr-3"
                    />
                    <Banknote className="w-5 h-5 text-[var(--gold-primary)] mr-2" />
                    <span className="font-medium text-[var(--text-light)]">Cash on Delivery</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-[var(--border)]">
              <button
                onClick={handleFinalSubmit}
                disabled={isProcessing}
                className="w-full py-4 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-bold rounded-lg hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-[var(--text-dark)] border-t-transparent rounded-full animate-spin" />
                    Processing Payment...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Confirm Payment & Place Order
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Address Modal */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[var(--text-light)]">Edit Address</h3>
              <button onClick={() => setIsAddressModalOpen(false)} className="p-1 hover:bg-[var(--surface-elevated)] rounded">
                <X className="w-5 h-5 text-[var(--text-muted)]" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Street Address *</label>
                <input
                  type="text"
                  value={editedAddress.street}
                  onChange={(e) => setEditedAddress(prev => ({ ...prev, street: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-light)] focus:outline-none focus:ring-1 focus:ring-[var(--gold-primary)]"
                />
                {addressErrors.street && <p className="text-xs text-red-400 mt-1">{addressErrors.street}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">City *</label>
                  <input
                    type="text"
                    value={editedAddress.city}
                    onChange={(e) => setEditedAddress(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-light)] focus:outline-none focus:ring-1 focus:ring-[var(--gold-primary)]"
                  />
                  {addressErrors.city && <p className="text-xs text-red-400 mt-1">{addressErrors.city}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Postal Code *</label>
                  <input
                    type="text"
                    value={editedAddress.postalCode}
                    onChange={(e) => setEditedAddress(prev => ({ ...prev, postalCode: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-light)] focus:outline-none focus:ring-1 focus:ring-[var(--gold-primary)]"
                  />
                  {addressErrors.postalCode && <p className="text-xs text-red-400 mt-1">{addressErrors.postalCode}</p>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Province *</label>
                <input
                  type="text"
                  value={editedAddress.province}
                  onChange={(e) => setEditedAddress(prev => ({ ...prev, province: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-light)] focus:outline-none focus:ring-1 focus:ring-[var(--gold-primary)]"
                />
                {addressErrors.province && <p className="text-xs text-red-400 mt-1">{addressErrors.province}</p>}
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setIsAddressModalOpen(false)}
                className="flex-1 py-2 border border-[var(--border)] text-[var(--text-light)] rounded-lg hover:border-[var(--gold-primary)]"
              >
                Cancel
              </button>
              <button
                onClick={saveAddress}
                className="flex-1 py-2 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-medium rounded-lg"
              >
                Save
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>

    <SuccessModal isOpen={showSuccessModal} onClose={handleSuccessModalClose} />
    </>
  )
}