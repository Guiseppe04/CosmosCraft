import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
import { useCart } from '../context/CartContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { 
  ArrowLeft, ShoppingCart, CreditCard, Truck, ShieldCheck,
  Plus, Minus, MessageSquare, Package, Guitar,
  ChevronDown, ChevronUp, MapPin, FileText, Check,
  X, CheckCircle, Trash2, Home, Building, PlusCircle
} from 'lucide-react'
import { PaymentModal } from '../components/PaymentModal.jsx'
import { API } from '../utils/apiConfig'

// ==================== REUSABLE COMPONENTS ====================

function CartItemCard({ item, onUpdateQuantity, onRemove, isCustomBuild, isBuyNow }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="group flex items-center gap-4 p-4 bg-[var(--surface-elevated)]/50 border border-[var(--border)] rounded-xl hover:border-[var(--gold-primary)]/30 hover:bg-[var(--surface-elevated)] transition-all duration-200"
    >
      <div className="w-20 h-20 rounded-lg bg-[var(--bg-primary)] border border-white/5 flex items-center justify-center overflow-hidden flex-shrink-0">
        {item.image ? (
          <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <Guitar className="w-8 h-8 text-[var(--gold-primary)]" />
        )}
      </div>

      <div className="flex-1 min-w-0 flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-[var(--text-light)] truncate">{item.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-[var(--text-muted)] tracking-wide uppercase">{item.category}</p>
            {isCustomBuild && (
              <span className="px-2 py-0.5 text-xs font-medium bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] rounded-full">
                Custom Build
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          {!isCustomBuild && !isBuyNow ? (
            <div className="flex items-center gap-2 bg-[var(--bg-primary)] border border-white/10 rounded-full px-3 py-1.5">
              <button
                onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
                className="text-[var(--text-muted)] hover:text-white p-0.5 transition-colors"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-sm font-semibold w-5 text-center text-white">{item.quantity}</span>
              <button
                onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                className="text-[var(--text-muted)] hover:text-[var(--gold-primary)] p-0.5 transition-colors"
                disabled={item.quantity >= item.stock}
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="px-3 py-1.5 bg-[var(--bg-primary)]/50 rounded-full">
              <span className="text-sm text-[var(--text-muted)]">Qty: 1</span>
            </div>
          )}

          <div className="w-24 text-right">
            <p className="font-bold text-white text-sm tracking-tight">
              ₱{(item.price * item.quantity).toLocaleString('en-PH')}
            </p>
          </div>

          {!isCustomBuild && !isBuyNow && (
            <button
              onClick={() => onRemove(item.id, item.quantity)}
              className="p-2 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function AddressSelectionCard({ addresses, selectedAddressId, onSelectAddress, onAddNew, hasError }) {
  const getLabelIcon = (label) => {
    const labelLower = (label || '').toLowerCase()
    if (labelLower === 'work' || labelLower === 'office') return Building
    return Home
  }

  const formatAddress = (addr) => {
    const parts = [
      addr.street_line1,
      addr.street_line2,
      addr.city,
      addr.province,
      addr.postal_code
    ].filter(Boolean)
    return parts.join(', ')
  }

  const defaultAddress = addresses?.find(a => a.is_default)
  const displayAddresses = addresses?.length > 0 ? addresses : []

  return (
    <div className={`bg-[var(--surface-dark)] border rounded-xl overflow-hidden transition-colors ${
      hasError 
        ? 'border-red-500/50 bg-red-500/5' 
        : 'border-[var(--border)]'
    }`}>
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <MapPin className="w-5 h-5 text-[var(--gold-primary)]" />
          <h2 className="text-lg font-bold text-[var(--text-light)]">Shipping Address</h2>
          <span className="text-xs text-red-400">Required</span>
        </div>
      </div>

      <div className="p-4">
        {hasError && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400 font-medium">Please select a shipping address to continue</p>
          </div>
        )}

        {displayAddresses.length === 0 ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--surface-elevated)] flex items-center justify-center">
              <MapPin className="w-8 h-8 text-[var(--text-muted)]" />
            </div>
            <p className="text-[var(--text-muted)] mb-4">No address found. Please add one to continue.</p>
            <button
              onClick={onAddNew}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-semibold rounded-lg hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              Add New Address
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-[var(--text-muted)] mb-3">Select a shipping address:</p>
            {displayAddresses.map((address) => {
              const LabelIcon = getLabelIcon(address.label)
              return (
                <label
                  key={address.address_id}
                  className={`relative flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                    selectedAddressId === address.address_id 
                      ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10' 
                      : 'border-[var(--border)] hover:border-[var(--gold-primary)]/50'
                  }`}
                >
                  <input 
                    type="radio" 
                    name="selectedAddress" 
                    value={address.address_id}
                    checked={selectedAddressId === address.address_id}
                    onChange={() => onSelectAddress(address.address_id)}
                    className="sr-only"
                  />
                  <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    selectedAddressId === address.address_id 
                      ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]' 
                      : 'border-[var(--border)]'
                  }`}>
                    {selectedAddressId === address.address_id && (
                      <div className="w-2 h-2 rounded-full bg-[var(--text-dark)]" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <LabelIcon className="w-4 h-4 text-[var(--gold-primary)]" />
                      <span className="font-semibold text-white">{address.label || 'Address'}</span>
                      {address.is_default && (
                        <span className="px-2 py-0.5 text-xs bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] rounded-full">Default</span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--text-muted)]">{formatAddress(address)}</p>
                  </div>
                </label>
              )
            })}
            
            <button
              onClick={onAddNew}
              className="w-full mt-3 flex items-center justify-center gap-2 p-3 border border-dashed border-[var(--border)] rounded-xl text-[var(--text-muted)] hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)] transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Add New Address</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ShippingSelector({ selected, onChange }) {
  const options = [
    { value: 'standard', label: 'Standard', days: '5-7 days', price: 'Free', priceValue: 0 },
    { value: 'express', label: 'Express', days: '2-3 days', price: '₱500', priceValue: 500 },
  ]

  return (
    <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-center gap-3 mb-4">
        <Truck className="w-5 h-5 text-[var(--gold-primary)]" />
        <h2 className="text-lg font-bold text-[var(--text-light)]">Shipping Method</h2>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {options.map((option) => (
          <label
            key={option.value}
            className={`relative flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
              selected === option.value 
                ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10' 
                : 'border-[var(--border)] hover:border-[var(--gold-primary)]/50'
            }`}
          >
            <input 
              type="radio" 
              name="shipping" 
              value={option.value}
              checked={selected === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
              selected === option.value 
                ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]' 
                : 'border-[var(--border)]'
            }`}>
              {selected === option.value && (
                <div className="w-2 h-2 rounded-full bg-[var(--text-dark)]" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[var(--text-light)]">{option.label}</p>
              <p className="text-xs text-[var(--text-muted)]">{option.days}</p>
            </div>
            <span className={`text-sm font-bold ${
              option.priceValue === 0 ? 'text-green-400' : 'text-[var(--gold-primary)]'
            }`}>
              {option.price}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}

function OrderNotesCard({ value, onChange }) {
  return (
    <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <FileText className="w-5 h-5 text-[var(--gold-primary)]" />
        <h2 className="text-lg font-bold text-[var(--text-light)]">Order Notes</h2>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Special instructions for your order..."
        rows={3}
        className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-light)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/20 focus:border-[var(--gold-primary)] resize-none text-sm"
      />
    </div>
  )
}

function OrderSummaryCard({ subtotal, shippingCost, tax, total, itemCount, onPlaceOrder, isProcessing, disabled }) {
  return (
    <div className="bg-[var(--surface-dark)] border border-white/10 rounded-2xl p-6 space-y-5 shadow-lg shadow-black/20">
      <div className="flex items-center gap-3">
        <FileText className="w-5 h-5 text-[var(--gold-primary)]" />
        <h2 className="text-xl font-bold text-[var(--text-light)]">Order Summary</h2>
      </div>

      <div className="space-y-3 border-t border-[var(--border)] pt-4">
        <div className="flex justify-between text-sm">
          <span className="text-[var(--text-muted)]">Subtotal ({itemCount} items)</span>
          <span className="text-[var(--text-light)] font-medium">₱{subtotal.toLocaleString('en-PH')}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--text-muted)]">Shipping</span>
          <span className={`${shippingCost === 0 ? 'text-green-400' : 'text-[var(--text-light)]'}`}>
            {shippingCost === 0 ? 'Free' : `₱${shippingCost}`}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--text-muted)]">Tax (10%)</span>
          <span className="text-[var(--text-light)]">₱{tax.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</span>
        </div>
      </div>

      <div className="flex justify-between items-center border-t border-[var(--border)] pt-4">
        <span className="text-base font-semibold text-[var(--text-light)]">Total</span>
        <div className="text-right">
          <span className="text-2xl font-bold text-[var(--gold-primary)] tracking-tight">
            ₱{total.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <ShieldCheck className="w-4 h-4 text-[var(--gold-primary)]" />
        <span>Secure checkout — your data is protected</span>
      </div>

      <button
        onClick={onPlaceOrder}
        disabled={isProcessing || disabled}
        className="w-full py-4 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-bold rounded-lg hover:shadow-[0_0_25px_rgba(212,175,55,0.5)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isProcessing ? (
          <>
            <div className="w-5 h-5 border-2 border-[var(--text-dark)] border-t-transparent rounded-full animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="w-5 h-5" />
            Continue to Payment
          </>
        )}
      </button>
    </div>
  )
}

function EmptyCart() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pt-24">
      <div className="page text-center space-y-6 py-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center justify-center w-28 h-28 bg-[var(--surface-dark)] border border-[var(--border)] rounded-full mb-4"
        >
          <ShoppingCart className="w-14 h-14 text-[var(--gold-primary)]" />
        </motion.div>
        <h1 className="text-4xl md:text-5xl font-bold text-[var(--text-light)]">Your Cart is Empty</h1>
        <p className="text-lg text-[var(--text-muted)] max-w-md mx-auto">Looks like you haven't added any guitars to your cart yet.</p>
        <button 
          onClick={() => navigate('/shop')}
          className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] rounded-xl font-semibold hover:shadow-[0_0_30px_rgba(212,175,55,0.5)] transition-all duration-200"
        >
          <Guitar className="w-5 h-5" />
          Browse Guitars
        </button>
      </div>
    </div>
  )
}

function SuccessModal({ isOpen, onClose }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="w-full max-w-sm bg-[var(--surface-dark)] border border-[var(--gold-primary)] rounded-2xl p-8 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="w-20 h-20 mx-auto mb-5 rounded-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] flex items-center justify-center shadow-lg"
            >
              <CheckCircle className="w-10 h-10 text-[var(--text-dark)]" />
            </motion.div>
            <h3 className="text-2xl font-bold text-white mb-2">Order Placed!</h3>
            <p className="text-[var(--text-muted)] mb-8">You successfully placed your order.</p>
            <button
              onClick={onClose}
              className="w-full py-3.5 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-semibold rounded-xl hover:shadow-[0_0_25px_rgba(212,175,55,0.5)] transition-all"
            >
              View My Orders
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function AddAddressModal({ isOpen, onClose, onSave, isSaving }) {
  const [formData, setFormData] = useState({
    streetLine1: '',
    streetLine2: '',
    city: '',
    stateProvince: '',
    postalZipCode: '',
    label: 'Home',
    country: 'Philippines',
    isDefault: false
  })
  const [errors, setErrors] = useState({})

  const validate = () => {
    const newErrors = {}
    if (!formData.streetLine1?.trim()) newErrors.streetLine1 = 'Street address is required'
    if (!formData.city?.trim()) newErrors.city = 'City is required'
    if (!formData.stateProvince?.trim()) newErrors.stateProvince = 'Province is required'
    if (!formData.postalZipCode?.trim()) newErrors.postalZipCode = 'Postal code is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (validate()) {
      onSave(formData)
    }
  }

  const handleChange = (field, value) => {
    const fieldMap = {
      'street': 'streetLine1',
      'barangay': 'streetLine2',
      'city': 'city',
      'province': 'stateProvince',
      'postalCode': 'postalZipCode'
    }
    const actualField = fieldMap[field] || field
    setFormData(prev => ({ ...prev, [actualField]: value }))
    if (errors[actualField]) {
      setErrors(prev => ({ ...prev, [actualField]: null }))
    }
  }

  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="w-full max-w-md bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-[var(--text-light)]">Add New Address</h3>
          <button onClick={onClose} className="p-2 hover:bg-[var(--surface-elevated)] rounded-lg transition-colors">
            <X className="w-5 h-5 text-[var(--text-muted)]" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Address Label</label>
            <div className="flex gap-2">
              {['Home', 'Work', 'Other'].map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, label }))}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${
                    formData.label === label
                      ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10 text-white'
                      : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--gold-primary)]/50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Street Address *</label>
            <input
              type="text"
              value={formData.streetLine1}
              onChange={(e) => handleChange('street', e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-light)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/20 focus:border-[var(--gold-primary)]"
              placeholder="House number, street name"
            />
            {errors.streetLine1 && <p className="text-xs text-red-400 mt-1.5">{errors.streetLine1}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Barangay / Additional (Optional)</label>
            <input
              type="text"
              value={formData.streetLine2}
              onChange={(e) => handleChange('barangay', e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-light)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/20 focus:border-[var(--gold-primary)]"
              placeholder="Barangay, subdivision, etc."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">City *</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => handleChange('city', e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-light)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/20 focus:border-[var(--gold-primary)]"
                placeholder="City"
              />
              {errors.city && <p className="text-xs text-red-400 mt-1.5">{errors.city}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Postal Code *</label>
              <input
                type="text"
                value={formData.postalZipCode}
                onChange={(e) => handleChange('postalCode', e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-light)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/20 focus:border-[var(--gold-primary)]"
                placeholder="1234"
              />
              {errors.postalZipCode && <p className="text-xs text-red-400 mt-1.5">{errors.postalZipCode}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Province *</label>
            <input
              type="text"
              value={formData.stateProvince}
              onChange={(e) => handleChange('province', e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-light)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/20 focus:border-[var(--gold-primary)]"
              placeholder="Province"
            />
            {errors.stateProvince && <p className="text-xs text-red-400 mt-1.5">{errors.stateProvince}</p>}
          </div>

          <label className="flex items-center gap-3 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={formData.isDefault}
              onChange={(e) => setFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
              className="w-5 h-5 rounded border-[var(--border)] text-[var(--gold-primary)] focus:ring-[var(--gold-primary)] cursor-pointer"
            />
            <span className="text-sm font-medium text-white">Set as default address</span>
          </label>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-[var(--border)] text-[var(--text-light)] font-medium rounded-xl hover:border-[var(--gold-primary)] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="flex-1 py-3 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-medium rounded-xl hover:shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-[var(--text-dark)] border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              'Save Address'
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ==================== MAIN CHECKOUT PAGE ====================

export function CheckoutPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { cart, updateQuantity, getTotalPrice, clearCart } = useCart()
  const { isAuthenticated, user, fetchUser, updateUser } = useAuth()
  
  const isCustomBuild = location.state?.isCustomBuild || false
  const isBuyNow = location.state?.isBuyNow || false
  const customBuildItem = location.state?.checkoutItem || null
  const buyNowItem = isBuyNow ? location.state?.checkoutItem : null
  
  const [isProcessing, setIsProcessing] = useState(false)
  const [orderError, setOrderError] = useState(null)
  const [orderNotes, setOrderNotes] = useState('')
  const [shippingMethod, setShippingMethod] = useState('standard')
  const [selectedAddressId, setSelectedAddressId] = useState(null)
  const [addressError, setAddressError] = useState(false)
  const [showAddAddressModal, setShowAddAddressModal] = useState(false)
  const [isSavingAddress, setIsSavingAddress] = useState(false)
  
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  const userAddresses = user?.addresses || []

  useEffect(() => {
    if (userAddresses.length > 0 && !selectedAddressId) {
      const defaultAddr = userAddresses.find(a => a.is_default)
      if (defaultAddr) {
        setSelectedAddressId(defaultAddr.address_id)
      } else {
        setSelectedAddressId(userAddresses[0].address_id)
      }
    }
  }, [userAddresses, selectedAddressId])

  let customSubtotal = 0
  let customBuildPrice = 0
  let customAdditionalPartsTotal = 0
  let checkoutItems = cart

  if (isBuyNow && buyNowItem) {
    checkoutItems = [buyNowItem]
    customSubtotal = Number(buyNowItem.price) || 0
  } else if (isCustomBuild && customBuildItem) {
    customBuildPrice = Number(customBuildItem.price) || 0
    customAdditionalPartsTotal = (customBuildItem.additionalParts || []).reduce((sum, p) => sum + (Number(p.price) * p.quantity), 0)
    customSubtotal = customBuildPrice + customAdditionalPartsTotal
    checkoutItems = [{
      ...customBuildItem,
      category: 'Custom Build',
      price: customSubtotal,
      quantity: 1,
      image: customBuildItem.config?.bodyStyle === 'lespaul' ? 'https://images.unsplash.com/photo-1550985616-10810253b84d?w=800&q=80' : 
             customBuildItem.config?.bodyStyle === 'tele' ? 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=800&q=80' : 
             'https://images.unsplash.com/photo-1564186763535-ebb21ef5277f?w=800&q=80',
      id: customBuildItem.id || `custom-${Date.now()}`,
    }]
  }

  const subtotal = isCustomBuild || isBuyNow ? customSubtotal : getTotalPrice()
  const shippingCost = shippingMethod === 'express' ? 500 : 0
  const tax = subtotal * 0.1
  
  const fullPaymentTotal = subtotal + shippingCost + tax
  const total = fullPaymentTotal
  const itemCount = checkoutItems.reduce((a, b) => a + b.quantity, 0)

  const handleSelectAddress = (addressId) => {
    setSelectedAddressId(addressId)
    setAddressError(false)
  }

  const handleAddNewAddress = () => {
    setShowAddAddressModal(true)
  }

  const handleSaveAddress = async (addressData) => {
    setIsSavingAddress(true)
    try {
      const response = await fetch(`${API}/api/users/addresses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(addressData)
      })

      if (response.ok) {
        const data = await response.json()
        
        const newAddress = {
          address_id: data.data?.user?.addresses?.[0]?.address_id || `new-${Date.now()}`,
          street_line1: addressData.streetLine1,
          street_line2: addressData.streetLine2,
          city: addressData.city,
          province: addressData.province,
          postal_code: addressData.postalCode,
          country: addressData.country,
          label: addressData.label,
          is_default: addressData.isDefault
        }
        
        const updatedAddresses = [...userAddresses]
        if (addressData.isDefault) {
          updatedAddresses.forEach(a => a.is_default = false)
        }
        updatedAddresses.push(newAddress)
        
        updateUser({ addresses: updatedAddresses })
        setSelectedAddressId(newAddress.address_id)
        setShowAddAddressModal(false)
        setAddressError(false)
      } else {
        const err = await response.json()
        alert(err.message || 'Failed to save address')
      }
    } catch (error) {
      console.error('Error saving address:', error)
      alert('Failed to save address. Please try again.')
    } finally {
      setIsSavingAddress(false)
    }
  }

  const validatePayment = (paymentMethod, receipt) => {
    if (!paymentMethod) return false
    if (paymentMethod === 'gcash' || paymentMethod === 'bank') {
      return !!receipt
    }
    return true
  }

  const handlePlaceOrderClick = () => {
    if (!isAuthenticated) {
      alert('Please log in to place an order.')
      return
    }
    if (!selectedAddressId) {
      setAddressError(true)
      return
    }
    setShowPaymentModal(true)
  }

  const handlePaymentSubmit = async (paymentMethod, receipt) => {
    if (!validatePayment(paymentMethod, receipt)) return

    setIsProcessing(true)
    
    const selectedAddress = userAddresses.find(a => a.address_id === selectedAddressId)
    
    const finalAddress = {
      street: selectedAddress?.street_line1 || '',
      street2: selectedAddress?.street_line2 || '',
      city: selectedAddress?.city || '',
      province: selectedAddress?.province || '',
      postalCode: selectedAddress?.postal_code || ''
    }

    let additionalNotes = orderNotes
    
    try {
      setOrderError(null)
      const response = await fetch(`${API}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          paymentTerms: 'full',
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
        setOrderError(data.message || 'Order failed. Please try again.')
      }
    } catch (error) {
      setOrderError(error.message || 'Network error. Please check your connection and try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  if (!isCustomBuild && !isBuyNow && cart.length === 0) {
    return <EmptyCart />
  }

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false)
    navigate('/dashboard?tab=purchases')
  }

  const handleRemove = (id, qty) => updateQuantity(id, -qty)

  const hasNoAddresses = userAddresses.length === 0

  return (
    <>
      <div className="min-h-screen bg-[var(--bg-primary)] pt-16 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4 mb-8"
          >
            <Link 
              to="/cart" 
              className="p-2.5 rounded-xl border border-[var(--border)] hover:border-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/10 transition-all duration-200"
            >
              <ArrowLeft className="w-5 h-5 text-[var(--text-muted)]" />
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-light)]">Checkout</h1>
              <p className="text-sm text-[var(--text-muted)]">Complete your order</p>
            </div>
          </motion.div>

          {orderError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl"
            >
              <p className="text-red-400 text-sm font-medium">{orderError}</p>
            </motion.div>
          )}

          <div className="grid lg:grid-cols-12 gap-6 lg:gap-8">
            {/* Left Column - Cart & Details */}
            <div className="lg:col-span-7 space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6"
              >
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[var(--gold-primary)]/10 flex items-center justify-center">
                      <ShoppingCart className="w-5 h-5 text-[var(--gold-primary)]" />
                    </div>
                    <h2 className="text-xl font-bold text-white">Your Cart</h2>
                    <span className="px-2.5 py-0.5 text-xs font-medium bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] rounded-full">
                      {itemCount} {itemCount === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  {checkoutItems.map((item, index) => (
                    <CartItemCard
                      key={item.id}
                      item={item}
                      onUpdateQuantity={updateQuantity}
                      onRemove={handleRemove}
                      isCustomBuild={isCustomBuild}
                      isBuyNow={isBuyNow}
                    />
                  ))}
                </div>

                <div className="mt-6 pt-5 border-t border-[var(--border)] flex items-center justify-between">
                  <Link to="/shop" className="text-sm font-medium text-[var(--text-muted)] hover:text-white transition-colors flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Continue Shopping
                  </Link>
                  {!isCustomBuild && !isBuyNow && (
                    <button 
                      onClick={() => { clearCart(); navigate('/shop'); }}
                      className="px-5 py-2.5 bg-red-500/10 text-red-500 font-semibold rounded-lg hover:bg-red-500 hover:text-white transition-all"
                    >
                      Clear Cart
                    </button>
                  )}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <AddressSelectionCard 
                  addresses={userAddresses}
                  selectedAddressId={selectedAddressId}
                  onSelectAddress={handleSelectAddress}
                  onAddNew={handleAddNewAddress}
                  hasError={addressError}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <ShippingSelector
                  selected={shippingMethod}
                  onChange={setShippingMethod}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <OrderNotesCard
                  value={orderNotes}
                  onChange={setOrderNotes}
                />
              </motion.div>
            </div>

            {/* Right Column - Order Summary */}
            <div className="lg:col-span-5">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="sticky top-24"
              >
                <OrderSummaryCard
                  subtotal={subtotal}
                  shippingCost={shippingCost}
                  tax={tax}
                  total={total}
                  itemCount={itemCount}
                  onPlaceOrder={handlePlaceOrderClick}
                  isProcessing={isProcessing}
                  disabled={hasNoAddresses}
                />
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Address Modal */}
      <AddAddressModal
        isOpen={showAddAddressModal}
        onClose={() => setShowAddAddressModal(false)}
        onSave={handleSaveAddress}
        isSaving={isSavingAddress}
      />

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSubmit={handlePaymentSubmit}
        total={total}
        isProcessing={isProcessing}
        isCustomBuild={isCustomBuild}
      />

      <SuccessModal isOpen={showSuccessModal} onClose={handleSuccessModalClose} />
    </>
  )
}