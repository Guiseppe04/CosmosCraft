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
import TermsAndConditionsModal from '../components/TermsAndConditionsModal.jsx'
import { API } from '../utils/apiConfig'
import { getCustomBuildSummaryTree } from '../utils/customBuildSummary.js'
import { Country, State } from 'country-state-city'
import { getAllProvinces, getMunicipalitiesByProvince, getBarangaysByMunicipality } from '@aivangogh/ph-address'

const ALL_COUNTRIES = Country.getAllCountries()
const PHILIPPINES = ALL_COUNTRIES.find(c => c.isoCode === 'PH')
const OTHER_COUNTRIES = ALL_COUNTRIES.filter(c => c.isoCode !== 'PH')
const COUNTRIES = PHILIPPINES ? [PHILIPPINES, ...OTHER_COUNTRIES] : ALL_COUNTRIES
const CUSTOM_BUILD_DOWN_PAYMENT_RATE = 0.5
const MAX_USER_ADDRESSES = 2
const ORDER_TAX_RATE = 0.1

const getAddressSignature = (address = {}) => ([
  address.address_id,
  address.street_line1,
  address.street_line2,
  address.city,
  address.province,
  address.postal_code,
  address.country,
  address.label,
].map(value => String(value || '').trim().toLowerCase()).join('|'))

const isCustomBuildItem = (item = {}) => {
  const itemType = String(item.type || '').toLowerCase()
  const category = String(item.category || '').toLowerCase()

  return Boolean(
    item.isCustomBuild ||
    item.customization ||
    item.customization_id ||
    itemType === 'customization' ||
    itemType === 'custom_build' ||
    category.includes('custom build')
  )
}

// ==================== REUSABLE COMPONENTS ====================

function CartItemCard({
  item,
  onUpdateQuantity,
  onRemove,
  isCustomBuild,
  isBuyNow,
  selectionEnabled,
  isSelected,
  onToggleSelect,
}) {
  const customBuildSummaryTree = isCustomBuild ? getCustomBuildSummaryTree(item) : []

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="group rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]/50 p-4 transition-all duration-200 hover:border-[var(--gold-primary)]/30 hover:bg-[var(--surface-elevated)]"
    >
      <div className="flex items-center gap-4">
      {selectionEnabled && (
        <label className="flex-shrink-0 cursor-pointer">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(item.id)}
            className="sr-only"
          />
          <div className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
            isSelected
              ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)] text-[var(--text-dark)]'
              : 'border-[var(--border)] bg-[var(--bg-primary)] text-transparent'
          }`}>
            <Check className="h-3.5 w-3.5" />
          </div>
        </label>
      )}

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
      </div>

      {isCustomBuild && customBuildSummaryTree.length > 0 && (
        <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/60 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--gold-primary)]">
            Build Tree
          </p>
            <div className="mt-3 space-y-3">
              {customBuildSummaryTree.map((branch) => (
                <div key={branch.label} className="pl-4">
                  <p className="text-xs font-semibold text-white">{branch.label}</p>
                  <div className="mt-2 space-y-1.5 pl-4">
                    {branch.children.map((child) => (
                      <p key={`${branch.label}-${child}`} className="text-xs text-[var(--text-muted)]">
                        {child}
                      </p>
                    ))}
                  </div>
                </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}

function AddressSelectionCard({ addresses, selectedAddressId, onSelectAddress, onAddNew, hasError, canAddNew }) {
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
            {canAddNew ? (
              <button
                onClick={onAddNew}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-semibold rounded-lg hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                Add New Address
              </button>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">Maximum of 2 addresses reached.</p>
            )}
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
            
            {canAddNew ? (
              <button
                onClick={onAddNew}
                className="w-full mt-3 flex items-center justify-center gap-2 p-3 border border-dashed border-[var(--border)] rounded-xl text-[var(--text-muted)] hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)] transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Add New Address</span>
              </button>
            ) : (
              <p className="mt-3 text-center text-sm text-[var(--text-muted)]">Maximum of 2 addresses reached.</p>
            )}
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

function OrderSummaryCard({
  subtotal,
  shippingCost,
  taxAmount = 0,
  total,
  fullTotal = total,
  remainingBalance = 0,
  requiresDownPayment = false,
  itemCount,
  onPlaceOrder,
  isProcessing,
  disabled
}) {
  return (
  <div className="bg-[var(--surface-dark)] border border-white/10 rounded-2xl p-6 space-y-5 shadow-lg shadow-black/20">

    {/* Header */}
    <div className="flex items-center gap-3">
      <FileText className="w-5 h-5 text-[var(--gold-primary)]" />
      <h2 className="text-xl font-bold text-[var(--text-light)]">Order Summary</h2>
    </div>

    {/* Breakdown */}
    <div className="space-y-3 border-t border-[var(--border)] pt-4">
      <div className="flex justify-between text-sm">
        <span className="text-[var(--text-muted)]">Subtotal ({itemCount} items)</span>
        <span className="text-[var(--text-light)] font-medium">
          ₱{subtotal.toLocaleString('en-PH')}
        </span>
      </div>

      <div className="flex justify-between text-sm">
        <span className="text-[var(--text-muted)]">Shipping</span>
        <span className={`${shippingCost === 0 ? 'text-green-400' : 'text-[var(--text-light)]'}`}>
          {shippingCost === 0 ? 'Free' : `₱${shippingCost}`}
        </span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-[var(--text-muted)]">Tax (10%)</span>
        <span className="text-[var(--text-light)] font-medium">
          PHP {taxAmount.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
        </span>
      </div>

    </div>

    {/* Full total always shown */}
      <div className="flex justify-between text-sm">
        <span className="text-[var(--text-muted)]">Full Order Total</span>
        <span className="text-[var(--text-light)]">
          ₱{fullTotal.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
        </span>
      </div>

    {/* Warning */}
    {requiresDownPayment && (
      <div className="rounded-xl border border-[var(--gold-primary)]/30 bg-[var(--gold-primary)]/10 p-4 space-y-2">
        <p className="text-sm font-semibold text-[var(--gold-primary)]">
          Custom build terms apply
        </p>
        <p className="text-xs text-[var(--text-muted)]">
          A 50% down payment is required now. The remaining balance is paid before release or delivery.
        </p>
      </div>
    )}

    {/* Total Section */}
    <div className="space-y-2 border-t border-[var(--border)] pt-4">
      <div className="flex justify-between items-center">
        <span className="text-base font-semibold text-[var(--text-light)]">
          {requiresDownPayment ? 'Down Payment Due Now' : 'Total'}
        </span>

        <span className="text-2xl font-bold text-[var(--gold-primary)] tracking-tight">
          ₱{total.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
        </span>
      </div>

      {requiresDownPayment && (
        <div className="flex justify-between text-sm">
          <span className="text-[var(--text-muted)]">Remaining Balance</span>
          <span className="text-[var(--text-light)]">
            ₱{remainingBalance.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
          </span>
        </div>
      )}
    </div>

    {/* Security note */}
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
          {requiresDownPayment ? 'Continue to Down Payment' : 'Continue to Payment'}
        </>
      )}
    </button>
  </div>
)
}

function CheckoutSummaryCard({
  subtotal,
  shippingCost,
  taxAmount = 0,
  total,
  fullTotal = total,
  remainingBalance = 0,
  requiresDownPayment = false,
  itemCount,
  onPlaceOrder,
  isProcessing,
  disabled,
  showTermsAndConditions = false,
  onViewTerms,
  termsAccepted = false
}) {
  const safeSubtotal = Number.isFinite(Number(subtotal)) ? Number(subtotal) : 0
  const safeShippingCost = Number.isFinite(Number(shippingCost)) ? Number(shippingCost) : 0
  const safeTaxAmount = Number.isFinite(Number(taxAmount)) ? Number(taxAmount) : 0
  const safeTotal = Number.isFinite(Number(total)) ? Number(total) : 0
  const safeFullTotal = Number.isFinite(Number(fullTotal)) ? Number(fullTotal) : safeTotal
  const safeRemainingBalance = Number.isFinite(Number(remainingBalance)) ? Number(remainingBalance) : 0
  const safeItemCount = Number.isFinite(Number(itemCount)) ? Number(itemCount) : 0

  return (
    <div className="bg-[var(--surface-dark)] border border-white/10 rounded-2xl p-6 space-y-5 shadow-lg shadow-black/20">
      <div className="flex items-center gap-3">
        <FileText className="w-5 h-5 text-[var(--gold-primary)]" />
        <h2 className="text-xl font-bold text-[var(--text-light)]">Order Summary</h2>
      </div>

      <div className="space-y-3 border-t border-[var(--border)] pt-4">
        <div className="flex justify-between text-sm">
          <span className="text-[var(--text-muted)]">Subtotal ({safeItemCount} items)</span>
          <span className="text-[var(--text-light)] font-medium">PHP {safeSubtotal.toLocaleString('en-PH')}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--text-muted)]">Shipping</span>
          <span className={`${safeShippingCost === 0 ? 'text-green-400' : 'text-[var(--text-light)]'}`}>
            {safeShippingCost === 0 ? 'Free' : `PHP ${safeShippingCost.toLocaleString('en-PH')}`}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--text-muted)]">Tax (10%)</span>
          <span className="text-[var(--text-light)] font-medium">
            PHP {safeTaxAmount.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--text-muted)]">Full Order Total</span>
          <span className="text-[var(--text-light)]">PHP {safeFullTotal.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</span>
        </div>
      </div>

      {requiresDownPayment && (
        <div className="rounded-xl border border-[var(--gold-primary)]/30 bg-[var(--gold-primary)]/10 p-4 space-y-2">
          <p className="text-sm font-semibold text-[var(--gold-primary)]">Custom build terms apply</p>
          <p className="text-xs text-[var(--text-muted)]">
            A 50% down payment is required now. The remaining balance is paid before release or delivery.
          </p>
        </div>
      )}

      <div className="space-y-2 border-t border-[var(--border)] pt-4">
        <div className="flex justify-between items-center">
          <span className="text-base font-semibold text-[var(--text-light)]">
            {requiresDownPayment ? 'Down Payment Due Now' : 'Total'}
          </span>
          <div className="text-right">
            <span className="text-2xl font-bold text-[var(--gold-primary)] tracking-tight">
              PHP {safeTotal.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
        {requiresDownPayment && (
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-muted)]">Remaining Balance</span>
            <span className="text-[var(--text-light)]">PHP {safeRemainingBalance.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <ShieldCheck className="w-4 h-4 text-[var(--gold-primary)]" />
        <span>Secure checkout — your data is protected</span>
      </div>

      {showTermsAndConditions && (
        <div className="rounded-xl border border-[var(--gold-primary)]/30 bg-[var(--gold-primary)]/10 p-4">
          <p className="text-sm text-[var(--text-muted)]">
            I agree to{' '}
            <button
              type="button"
              onClick={onViewTerms}
              className="text-[var(--gold-primary)] hover:underline font-medium"
            >
              Terms and Conditions
            </button>
          </p>
        </div>
      )}

      <button
        onClick={onPlaceOrder}
        disabled={isProcessing || disabled || (showTermsAndConditions && !termsAccepted)}
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
            {requiresDownPayment ? 'Continue to Down Payment' : 'Continue to Payment'}
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

function AddAddressModal({ isOpen, onClose, onSave, isSaving, locationData: propLocationData, setLocationData: propSetLocationData }) {
  const [formData, setFormData] = useState({
    label: 'Home',
    country: 'PH',
    streetLine1: '',
    streetLine2: '',
    province: '',
    city: '',
    barangay: '',
    stateProvince: '',
    postalZipCode: '',
    isDefault: false
  })
  const [errors, setErrors] = useState({})
  const isExternalData = !!propLocationData
  const [internalLocationData, setInternalLocationData] = useState({
    provinces: [],
    cities: [],
    barangays: []
  })
  const locationData = propLocationData || internalLocationData
  const setLocationData = propSetLocationData || setInternalLocationData

  const isPhilippines = formData.country === 'PH'

  useEffect(() => {
    if (isPhilippines) {
      if (isExternalData && propLocationData?.provinces?.length === 0) {
        try {
          const provinces = getAllProvinces()
          propSetLocationData({ provinces, cities: [], barangays: [] })
        } catch (err) {
          console.error('Failed to load provinces:', err)
        }
      } else if (!isExternalData && internalLocationData.provinces.length === 0) {
        try {
          const provinces = getAllProvinces()
          setInternalLocationData({ provinces, cities: [], barangays: [] })
        } catch (err) {
          console.error('Failed to load provinces:', err)
        }
      }
    } else {
      if (isExternalData) {
        propSetLocationData({ provinces: [], cities: [], barangays: [] })
      } else {
        setInternalLocationData({ provinces: [], cities: [], barangays: [] })
      }
      setFormData(prev => ({ ...prev, province: '', city: '', barangay: '', stateProvince: '' }))
    }
  }, [isPhilippines, isExternalData])

  const handleProvinceChange = (provinceCode, provinceName) => {
    setFormData(prev => ({ ...prev, province: provinceCode, city: '', barangay: '', stateProvince: provinceName }))
    if (provinceCode) {
      try {
        const cities = getMunicipalitiesByProvince(provinceCode)
        if (isExternalData) {
          propSetLocationData({ provinces: locationData.provinces, cities, barangays: [] })
        } else {
          setLocationData(prev => ({ ...prev, cities, barangays: [] }))
        }
      } catch (err) {
        console.error('Failed to load cities:', err)
      }
    }
  }

  const handleCityChange = (cityCode, cityName) => {
    setFormData(prev => ({ ...prev, city: cityCode, barangay: '', stateProvince: cityName }))
    if (cityCode) {
      try {
        const barangays = getBarangaysByMunicipality(cityCode)
        if (isExternalData) {
          const currentCities = locationData.cities
          const currentProvinces = locationData.provinces
          propSetLocationData({ provinces: currentProvinces, cities: currentCities, barangays })
        } else {
          setLocationData(prev => ({ ...prev, barangays }))
        }
      } catch (err) {
        console.error('Failed to load barangays:', err)
      }
    }
  }

  const handleBarangayChange = (barangayCode) => {
    setFormData(prev => ({ ...prev, barangay: barangayCode }))
  }

  const validate = () => {
    const newErrors = {}
    if (!formData.streetLine1?.trim()) newErrors.streetLine1 = 'Street address is required'
    if (isPhilippines) {
      if (!formData.province) newErrors.province = 'Province is required'
      if (!formData.city) newErrors.city = 'City is required'
    } else {
      if (!formData.city?.trim()) newErrors.city = 'City is required'
      if (!formData.stateProvince?.trim()) newErrors.stateProvince = 'Province is required'
    }
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
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Address Category</label>
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
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Country *</label>
            <select
              value={formData.country}
              onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-light)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/20 focus:border-[var(--gold-primary)] appearance-none cursor-pointer"
            >
              <option value="" disabled className="bg-[var(--surface-dark)]">Select Country</option>
              {COUNTRIES.map(c => (
                <option key={c.isoCode} value={c.isoCode} className="bg-[var(--surface-dark)]">{c.name}</option>
              ))}
            </select>
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

          {isPhilippines ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Province *</label>
                  <select
                    value={formData.province}
                    onChange={(e) => {
                      const opt = locationData.provinces.find(p => p.psgcCode === e.target.value)
                      handleProvinceChange(e.target.value, opt?.name || '')
                    }}
                    className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-light)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/20 focus:border-[var(--gold-primary)] appearance-none cursor-pointer"
                  >
                    <option value="" className="bg-[var(--surface-dark)]">Select Province</option>
                    {locationData.provinces.map(p => (
                      <option key={p.psgcCode} value={p.psgcCode} className="bg-[var(--surface-dark)]">{p.name}</option>
                    ))}
                  </select>
                  {errors.province && <p className="text-xs text-red-400 mt-1.5">{errors.province}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">City / Municipality *</label>
                  <select
                    value={formData.city}
                    onChange={(e) => {
                      const opt = locationData.cities.find(c => c.psgcCode === e.target.value)
                      handleCityChange(e.target.value, opt?.name || '')
                    }}
                    disabled={!formData.province}
                    className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-light)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/20 focus:border-[var(--gold-primary)] appearance-none cursor-pointer disabled:opacity-50"
                  >
                    <option value="" className="bg-[var(--surface-dark)]">{formData.province ? 'Select City' : 'Select a province first'}</option>
                    {locationData.cities.map(c => (
                      <option key={c.psgcCode} value={c.psgcCode} className="bg-[var(--surface-dark)]">{c.name}</option>
                    ))}
                  </select>
                  {errors.city && <p className="text-xs text-red-400 mt-1.5">{errors.city}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Barangay (Optional)</label>
                <select
                  value={formData.barangay}
                  onChange={(e) => handleBarangayChange(e.target.value)}
                  disabled={!formData.city}
                  className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-light)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/20 focus:border-[var(--gold-primary)] appearance-none cursor-pointer disabled:opacity-50"
                >
                  <option value="" className="bg-[var(--surface-dark)]">{formData.city ? 'Select Barangay' : 'Select a city first'}</option>
                  {locationData.barangays.map(b => (
                    <option key={b.psgcCode} value={b.name} className="bg-[var(--surface-dark)]">{b.name}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">State / Province *</label>
                <input
                  type="text"
                  value={formData.stateProvince}
                  onChange={(e) => handleChange('province', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-light)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/20 focus:border-[var(--gold-primary)]"
                  placeholder="State / Province"
                />
                {errors.stateProvince && <p className="text-xs text-red-400 mt-1.5">{errors.stateProvince}</p>}
              </div>
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
            </div>
          )}

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
  const { cart, removeFromCart, updateQuantity, clearCart } = useCart()
  const { isAuthenticated, user, updateUser } = useAuth()
  
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
  const [addressLocationData, setAddressLocationData] = useState({
    provinces: [],
    cities: [],
    barangays: []
  })
  
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [shouldOpenPaymentAfterTerms, setShouldOpenPaymentAfterTerms] = useState(false)
  const [selectedItemIds, setSelectedItemIds] = useState(null)
  const [selectionError, setSelectionError] = useState(false)
  const [generatedCustomItemId] = useState(() => `custom-${Date.now()}`)

  const userAddresses = user?.addresses || []

  const uniqueAddresses = userAddresses.filter(
    (addr, index, self) => index === self.findIndex(a => getAddressSignature(a) === getAddressSignature(addr))
  )

  useEffect(() => {
    if (uniqueAddresses.length > 0 && !selectedAddressId) {
      const defaultAddr = uniqueAddresses.find(a => a.is_default)
      if (defaultAddr) {
        setSelectedAddressId(defaultAddr.address_id)
      } else {
        setSelectedAddressId(uniqueAddresses[0].address_id)
      }
    }
  }, [uniqueAddresses, selectedAddressId])

  let baseCheckoutItems = cart

  if (isBuyNow && buyNowItem) {
    baseCheckoutItems = [buyNowItem]
  } else if (isCustomBuild && customBuildItem) {
    const customBuildPrice = Number(customBuildItem.price) || 0
    const customAdditionalPartsTotal = (customBuildItem.additionalParts || []).reduce((sum, part) => {
      return sum + ((Number(part.price) || 0) * (Number(part.quantity) || 1))
    }, 0)

    baseCheckoutItems = [{
      ...customBuildItem,
      category: 'Custom Build',
      isCustomBuild: true,
      price: customBuildPrice + customAdditionalPartsTotal,
      quantity: 1,
      image: customBuildItem.config?.bodyStyle === 'lespaul' ? 'https://images.unsplash.com/photo-1550985616-10810253b84d?w=800&q=80' :
             customBuildItem.config?.bodyStyle === 'tele' ? 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=800&q=80' :
             'https://images.unsplash.com/photo-1564186763535-ebb21ef5277f?w=800&q=80',
      id: customBuildItem.id || generatedCustomItemId,
    }]
  }

  const availableItemIds = baseCheckoutItems.map(item => String(item.id))

  useEffect(() => {
    setSelectedItemIds((prev) => {
      if (isCustomBuild || isBuyNow) return availableItemIds
      if (prev === null) return availableItemIds
      return prev.filter(id => availableItemIds.includes(id))
    })
  }, [isCustomBuild, isBuyNow, availableItemIds.join('|')])

  const activeSelectedItemIds = isCustomBuild || isBuyNow
    ? availableItemIds
    : (selectedItemIds ?? availableItemIds)

  const checkoutItems = baseCheckoutItems.filter(item => activeSelectedItemIds.includes(String(item.id)))
  const subtotal = checkoutItems.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.quantity) || 0)), 0)
  const shippingCost = shippingMethod === 'express' ? 500 : 0
  const taxAmount = subtotal * ORDER_TAX_RATE
  
  const fullPaymentTotal = subtotal + shippingCost + taxAmount
  const hasSelectedCustomBuild = checkoutItems.some(item => isCustomBuildItem(item))
  const total = hasSelectedCustomBuild ? fullPaymentTotal * CUSTOM_BUILD_DOWN_PAYMENT_RATE : fullPaymentTotal
  const remainingBalance = Math.max(0, fullPaymentTotal - total)
  const itemCount = checkoutItems.reduce((a, b) => a + b.quantity, 0)
  const totalCartItemCount = baseCheckoutItems.reduce((a, b) => a + b.quantity, 0)
  const hasSelectedItems = checkoutItems.length > 0
  const canAddMoreAddresses = uniqueAddresses.length < MAX_USER_ADDRESSES
  const allSelectableItemsSelected = !isCustomBuild && !isBuyNow && checkoutItems.length === baseCheckoutItems.length

  const handleSelectAddress = (addressId) => {
    setSelectedAddressId(addressId)
    setAddressError(false)
  }

  const handleAddNewAddress = () => {
    if (!canAddMoreAddresses) {
      alert(`You can only save up to ${MAX_USER_ADDRESSES} addresses.`)
      return
    }
    setShowAddAddressModal(true)
  }

  const handleToggleItemSelection = (itemId) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev ?? availableItemIds)
      const normalizedItemId = String(itemId)

      if (next.has(normalizedItemId)) {
        next.delete(normalizedItemId)
      } else {
        next.add(normalizedItemId)
      }

      return Array.from(next)
    })
    setSelectionError(false)
  }

  const handleToggleAllItems = () => {
    setSelectedItemIds(allSelectableItemsSelected ? [] : availableItemIds)
    setSelectionError(false)
  }

  const handleOpenTermsModal = (continueToPayment = false) => {
    setShouldOpenPaymentAfterTerms(continueToPayment)
    setShowTermsModal(true)
  }

  const handleCloseTermsModal = () => {
    setShowTermsModal(false)
    setAcceptedTerms(true)

    if (shouldOpenPaymentAfterTerms) {
      setShouldOpenPaymentAfterTerms(false)
      setShowPaymentModal(true)
      return
    }

    setShouldOpenPaymentAfterTerms(false)
  }

  const handleSaveAddress = async (addressData) => {
    if (uniqueAddresses.length >= MAX_USER_ADDRESSES) {
      alert(`You can only save up to ${MAX_USER_ADDRESSES} addresses.`)
      return
    }

    setIsSavingAddress(true)
    try {
      const countryCode = addressData.country
      const countryName = COUNTRIES.find(c => c.isoCode === countryCode)?.name || countryCode
      
      let city = addressData.city
      let stateProvince = addressData.stateProvince
      
      if (addressData.country === 'PH' && addressData.province) {
        const selectedProvince = addressLocationData.provinces.find(p => p.psgcCode === addressData.province)
        stateProvince = selectedProvince?.name || addressData.stateProvince
        if (addressData.city) {
          const selectedCity = addressLocationData.cities.find(c => c.psgcCode === addressData.city)
          city = selectedCity?.name || addressData.city
        }
      }
      
      const payload = {
        label: addressData.label,
        streetLine1: addressData.streetLine1,
        streetLine2: addressData.streetLine2,
        city: city,
        stateProvince: stateProvince,
        postalZipCode: addressData.postalZipCode,
        country: countryCode,
        isDefault: addressData.isDefault
      }
      
      const response = await fetch(`${API}/api/users/me/addresses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        const data = await response.json()
        const returnedAddresses = Array.isArray(data.data?.user?.addresses) ? data.data.user.addresses : []
        const normalizedReturnedAddresses = returnedAddresses.filter(
          (addr, index, self) => index === self.findIndex(a => getAddressSignature(a) === getAddressSignature(addr))
        )

        if (normalizedReturnedAddresses.length > 0) {
          updateUser({ addresses: normalizedReturnedAddresses })
          const defaultAddress = normalizedReturnedAddresses.find(addr => addr.is_default)
          const latestAddress = normalizedReturnedAddresses[normalizedReturnedAddresses.length - 1]
          setSelectedAddressId(defaultAddress?.address_id || latestAddress?.address_id || null)
        } else {
          const fallbackAddress = {
            address_id: `new-${Date.now()}`,
            street_line1: addressData.streetLine1,
            street_line2: addressData.streetLine2,
            city: city,
            province: stateProvince,
            postal_code: addressData.postalZipCode,
            country: countryName,
            label: addressData.label,
            is_default: addressData.isDefault
          }

          const updatedAddresses = [...uniqueAddresses]
          if (addressData.isDefault) {
            updatedAddresses.forEach(a => { a.is_default = false })
          }
          updatedAddresses.push(fallbackAddress)
          updateUser({ addresses: updatedAddresses })
          setSelectedAddressId(fallbackAddress.address_id)
        }

        setShowAddAddressModal(false)
        setAddressError(false)
      } else {
        const err = await response.json()
        console.error('Address save error:', err)
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
    if (!hasSelectedItems) {
      setSelectionError(true)
      return
    }
    if (!selectedAddressId) {
      setAddressError(true)
      return
    }
    if (hasSelectedCustomBuild && !acceptedTerms) {
      handleOpenTermsModal(true)
      return
    }
    setShowPaymentModal(true)
  }

  const handlePaymentSubmit = async (paymentMethod, receipt, paymentPlan = 'full') => {
    if (!validatePayment(paymentMethod, receipt)) return

    setIsProcessing(true)

    const persistOrderedCustomBuildLinks = (orderedCustomBuilds = []) => {
      if (!Array.isArray(orderedCustomBuilds) || orderedCustomBuilds.length === 0) return

      for (const storageKey of ['cosmoscraft_saved_builds', 'cosmoscraft_saved_bass_builds']) {
        const storedBuilds = JSON.parse(window.localStorage.getItem(storageKey) || '[]')
        if (!Array.isArray(storedBuilds) || storedBuilds.length === 0) continue

        let didChange = false
        const nextStoredBuilds = storedBuilds.map((build) => {
          const matchedBuild = orderedCustomBuilds.find((entry) =>
            entry?.build_id &&
            entry?.customization_id &&
            String(entry.build_id) === String(build.id)
          )

          if (!matchedBuild) return build

          didChange = true
          return {
            ...build,
            dbCustomizationId: matchedBuild.customization_id,
            customization_id: matchedBuild.customization_id,
          }
        })

        if (didChange) {
          window.localStorage.setItem(storageKey, JSON.stringify(nextStoredBuilds))
        }
      }
    }
    
    const selectedAddress = uniqueAddresses.find(a => a.address_id === selectedAddressId)
    
    const finalAddress = {
      street: selectedAddress?.street_line1 || '',
      street2: selectedAddress?.street_line2 || '',
      city: selectedAddress?.city || '',
      province: selectedAddress?.province || '',
      postalCode: selectedAddress?.postal_code || ''
    }

    let additionalNotes = orderNotes?.trim() || ''
    
    try {
      setOrderError(null)
      // Map payment method names to backend values
      const methodMap = {
        'gcash': 'gcash',
        'bank': 'bank_transfer'
      }
      const mappedPaymentMethod = methodMap[paymentMethod] || paymentMethod
      const selectedPaymentTerms = hasSelectedCustomBuild
        ? paymentPlan === 'full' ? 'full' : 'down_payment'
        : 'full'
      const paymentAmount = selectedPaymentTerms === 'full' ? fullPaymentTotal : total
      const paymentAmountLabel = selectedPaymentTerms === 'full' ? 'Full payment submitted' : 'Down payment submitted'
      const outstandingBalance = Math.max(0, fullPaymentTotal - paymentAmount)

      if (hasSelectedCustomBuild) {
        const checkoutTermsNote = [
          'Checkout Terms:',
          '- Terms and Conditions accepted for custom build selection',
          `- Payment plan: ${selectedPaymentTerms === 'full' ? 'Full payment' : `${Math.round(CUSTOM_BUILD_DOWN_PAYMENT_RATE * 100)}% down payment`}`,
          `- Full order total: PHP ${fullPaymentTotal.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`,
          `- ${paymentAmountLabel}: PHP ${paymentAmount.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`,
          `- Remaining balance: PHP ${outstandingBalance.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`
        ].join('\n')

        additionalNotes = [additionalNotes, checkoutTermsNote].filter(Boolean).join('\n\n')
      }

      // 1. Create order
      const response = await fetch(`${API}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: checkoutItems.map(item => {
            const itemCustomSource = item.customization || item
            const itemIsCustomBuild = isCustomBuildItem(item)

            return {
              productId: item.id,
              name: item.name || 'Product',
              quantity: item.quantity,
              price: item.price,
              notes: item.notes || '',
              customization: itemIsCustomBuild ? {
                buildId: item.id,
                customizationId: itemCustomSource.dbCustomizationId || itemCustomSource.customization_id || null,
                name: item.name || 'Custom Build',
                config: itemCustomSource.config || {},
                summary: itemCustomSource.summary || {},
                pricingBreakdown: itemCustomSource.pricingBreakdown || {},
                baseBuildPrice: Number(itemCustomSource.baseBuildPrice ?? customBuildItem?.price ?? item.price) || 0,
                additionalParts: Array.isArray(itemCustomSource.additionalParts) ? itemCustomSource.additionalParts : [],
              } : undefined,
            }
          }),
          notes: additionalNotes,
          shippingMethod,
          paymentMethod: mappedPaymentMethod,
          paymentTerms: selectedPaymentTerms,
          billingAddress: finalAddress
        })
      })

      const data = await response.json()

      console.log('Order response:', response.status, data)

      if (response.ok) {
        const createdOrder = data?.data?.order || {}
        const orderId = createdOrder.order_id
        const orderTotalAmount = Number(createdOrder.total_amount) || fullPaymentTotal
        persistOrderedCustomBuildLinks(createdOrder.ordered_custom_builds)
        const currentPaymentAmount = selectedPaymentTerms === 'full'
          ? orderTotalAmount
          : Number((orderTotalAmount * CUSTOM_BUILD_DOWN_PAYMENT_RATE).toFixed(2))
        let paymentCreated = false

        // 2. Create payment record with proof
        try {
          const paymentResponse = await fetch(`${API}/api/payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              order_id: orderId,
              method: mappedPaymentMethod,
              amount: currentPaymentAmount,
              currency: 'PHP',
              reference_number: `PROOF-${Date.now()}`,
              proof_url: receipt // Include the receipt image
            })
          })

          const paymentData = await paymentResponse.json()
          console.log('Payment response:', paymentResponse.status, paymentData)

          if (!paymentResponse.ok) {
            console.error('Payment creation failed:', paymentData)
            setOrderError('Order created, but payment record could not be created. Please contact support.')
            setIsProcessing(false)
            setShowPaymentModal(false)
            return
          }

          paymentCreated = true
        } catch (paymentError) {
          console.error('Payment creation error:', paymentError)
          setOrderError('Order created, but payment record could not be created. Please contact support.')
          setIsProcessing(false)
          setShowPaymentModal(false)
          return
        }

        // 3. Only show success if both order and payment were created
        if (paymentCreated) {
          if (!isCustomBuild && !isBuyNow) {
            if (checkoutItems.length === cart.length) {
              clearCart()
            } else {
              checkoutItems.forEach(item => removeFromCart(item.id))
            }
          }
          setOrderError(null)
          setShowPaymentModal(false)
          setShowSuccessModal(true)
        }
      } else {
        console.error('Order failed:', response.status, data)
        setOrderError(data.message || data.error || 'Order failed. Please try again.')
        setIsProcessing(false)
        setShowPaymentModal(false)
      }
    } catch (error) {
      console.error('Checkout error:', error)
      setOrderError(error.message || 'Network error. Please check your connection and try again.')
      setIsProcessing(false)
      setShowPaymentModal(false)
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

  const hasNoAddresses = uniqueAddresses.length === 0

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
                    <div>
                      <h2 className="text-xl font-bold text-white">Your Cart</h2>
                      {!isCustomBuild && !isBuyNow && (
                        <p className="text-xs text-[var(--text-muted)]">
                          {itemCount} of {totalCartItemCount} items selected for checkout
                        </p>
                      )}
                    </div>
                    <span className="px-2.5 py-0.5 text-xs font-medium bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] rounded-full">
                      {itemCount} {itemCount === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  {!isCustomBuild && !isBuyNow && (
                    <button
                      type="button"
                      onClick={handleToggleAllItems}
                      className="text-sm font-medium text-[var(--gold-primary)] hover:text-white transition-colors"
                    >
                      {allSelectableItemsSelected ? 'Clear Selection' : 'Select All'}
                    </button>
                  )}
                </div>

                {(selectionError || (!hasSelectedItems && !isCustomBuild && !isBuyNow)) && (
                  <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                    <p className="text-sm font-medium text-red-400">Select at least one item to continue with checkout.</p>
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  {baseCheckoutItems.map((item) => (
                    <CartItemCard
                      key={item.id}
                      item={item}
                      onUpdateQuantity={updateQuantity}
                      onRemove={handleRemove}
                      isCustomBuild={isCustomBuildItem(item)}
                      isBuyNow={isBuyNow}
                      selectionEnabled={!isCustomBuild && !isBuyNow}
                      isSelected={activeSelectedItemIds.includes(String(item.id))}
                      onToggleSelect={handleToggleItemSelection}
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
                  addresses={uniqueAddresses}
                  selectedAddressId={selectedAddressId}
                  onSelectAddress={handleSelectAddress}
                  onAddNew={handleAddNewAddress}
                  hasError={addressError}
                  canAddNew={canAddMoreAddresses}
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
                <CheckoutSummaryCard
                  subtotal={subtotal}
                  shippingCost={shippingCost}
                  taxAmount={taxAmount}
                  
                  total={total}
                  fullTotal={fullPaymentTotal}
                  remainingBalance={remainingBalance}
                  requiresDownPayment={hasSelectedCustomBuild}
                  itemCount={itemCount}
                  onPlaceOrder={handlePlaceOrderClick}
                  isProcessing={isProcessing}
                  disabled={hasNoAddresses || !hasSelectedItems}
                  showTermsAndConditions={hasSelectedCustomBuild}
                  onViewTerms={() => handleOpenTermsModal(false)}
                  termsAccepted={acceptedTerms}
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
        locationData={addressLocationData}
        setLocationData={setAddressLocationData}
      />

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSubmit={handlePaymentSubmit}
        total={total}
        fullTotal={fullPaymentTotal}
        isProcessing={isProcessing}
        requiresCustomTerms={hasSelectedCustomBuild}
        downPaymentRate={CUSTOM_BUILD_DOWN_PAYMENT_RATE}
      />

      <SuccessModal isOpen={showSuccessModal} onClose={handleSuccessModalClose} />

      <TermsAndConditionsModal
        isOpen={showTermsModal}
        onClose={handleCloseTermsModal}
      />
    </>
  )
}
