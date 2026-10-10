import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
import { useCart } from '../context/CartContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { 
  ArrowLeft, ShoppingCart, CreditCard, Truck, ShieldCheck,
  Plus, Minus, MessageSquare, Package, Guitar,
  ChevronDown, ChevronUp, MapPin, FileText, Check,
  X, CheckCircle, Trash2, Home, Building, PlusCircle, Maximize2
} from 'lucide-react'
import { ShippingFeeNotice } from '../components/ShippingFeeNotice.jsx'
import { PaymentModal } from '../components/PaymentModal.jsx'
import TermsAndConditionsModal from '../components/TermsAndConditionsModal.jsx'
import { TERMS_VERSIONS, createCheckoutId, saveAgreement } from '../utils/termsAgreement'
import { getCheckoutTermsTypes, TERMS_BY_TYPE } from '../utils/checkoutTerms'
import { resolveSavedLocation } from '../utils/phAddress'
import { AddressForm } from '../components/AddressForm.jsx'
import { API, getAuthHeaders } from '../utils/apiConfig'
import api from '../services/api.js'
import { adminApi } from '../utils/adminApi'
import CustomBuildThumbnail from '../components/customize/CustomBuildThumbnail.jsx'
import CustomBuildPreviewModal from '../components/customize/CustomBuildPreviewModal.jsx'
import CustomBuildDetails from '../components/customize/CustomBuildDetails.jsx'
import { mapDbCartItem } from '../utils/cartItemMapping.js'
import { Country, State } from 'country-state-city'
import { getAllProvinces, getMunicipalitiesByProvince, getBarangaysByMunicipality } from '@aivangogh/ph-address'

const ALL_COUNTRIES = Country.getAllCountries()
const PHILIPPINES = ALL_COUNTRIES.find(c => c.isoCode === 'PH')
const OTHER_COUNTRIES = ALL_COUNTRIES.filter(c => c.isoCode !== 'PH')
const COUNTRIES = PHILIPPINES ? [PHILIPPINES, ...OTHER_COUNTRIES] : ALL_COUNTRIES
const CUSTOM_BUILD_DOWN_PAYMENT_RATE = 0.5

// Stable empty object for the "add new address" modal. Passing a fresh `{}`
// literal on every render would re-trigger AddressForm's reset effect and wipe
// whatever the user already typed (e.g. after a failed save attempt).
const EMPTY_INITIAL_ADDRESS = {}

const normalizeAddressValue = (value) => String(value || '')
  .trim()
  .replace(/\s+/g, ' ')
  .toLowerCase()

const getAddressSignature = (address = {}) => ([
  address.street_line1 ?? address.streetLine1 ?? address.street ?? address.line1,
  address.street_line2 ?? address.streetLine2 ?? address.street2 ?? address.line2,
  address.city,
  address.province ?? address.stateProvince,
  address.postal_code ?? address.postalZipCode ?? address.postalCode,
  address.country,
].map(normalizeAddressValue).join('|'))

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

const parseArrayValue = (value) => {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
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
  const [isBuildPreviewOpen, setIsBuildPreviewOpen] = useState(false)
  const customBuildData = isCustomBuild ? (item.customization || item) : {}
  const quantity = Math.max(1, Number(item.quantity) || 1)
  const unitPrice = Number(item.price) || 0
  const itemTotal = unitPrice * quantity
  const additionalPartsCost = (customBuildData.additionalParts || []).reduce((sum, part) => sum + ((Number(part.price) || 0) * (Number(part.quantity) || 1)), 0)
  const rawBasePrice = customBuildData.pricingBreakdown?.base ?? customBuildData.lineItems?.find(line => line.id === 'base')?.subtotal
  const basePrice = Number(rawBasePrice)
  const hasBasePrice = rawBasePrice != null && Number.isFinite(basePrice) && basePrice >= 0 && basePrice <= unitPrice - additionalPartsCost
  const customizationCost = unitPrice - additionalPartsCost - (hasBasePrice ? basePrice : 0)
  const stock = Number(item.stock)
  const hasStockValue = Number.isFinite(stock) && stock >= 0
  const variantLabel = [item.model, item.variantName, item.sku]
    .find(value => typeof value === 'string' && value.trim()) || item.category || 'Product'
  const formatPrice = (price) => `₱${price.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className={`rounded-xl border p-3 transition-colors ${
      isSelected ? 'border-[var(--gold-primary)]/50 bg-[var(--gold-primary)]/5' : 'border-[var(--border)] bg-[var(--surface-elevated)]/40'
    }`}>
      <div className="flex min-w-0 items-start gap-3">
        {selectionEnabled && (
          <input
            type="checkbox"
            checked={Boolean(isSelected)}
            onChange={() => onToggleSelect(item.id)}
            aria-label={`Include ${item.name} in this order`}
            className="mt-1 h-4 w-4 shrink-0 accent-[var(--gold-primary)]"
          />
        )}
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-primary)]">
          {isCustomBuild ? (
            <button
              type="button"
              onClick={() => setIsBuildPreviewOpen(true)}
              aria-label={`View ${item.name || 'custom build'} front and rear preview`}
              className="group relative flex h-full w-full items-center justify-center overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--gold-primary)]"
            >
              <CustomBuildThumbnail item={item} />
              <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100">
                <Maximize2 className="h-4 w-4" />
              </span>
            </button>
          ) : item.image ? (
            <img
              src={item.image}
              alt={item.name || 'Product'}
              className="h-full w-full object-cover"
              onError={(event) => { event.currentTarget.src = '/assets/placeholder.jpg' }}
            />
          ) : (
            <div className="flex h-full items-center justify-center"><Guitar className="h-6 w-6 text-[var(--gold-primary)]" /></div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold text-[var(--text-light)]">{item.name || 'Product'}</p>
              <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{variantLabel}</p>
            </div>
            {onRemove && !isBuyNow && !isCustomBuild && (
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                aria-label={`Remove ${item.name || 'product'}`}
                className="-mr-1 -mt-1 shrink-0 rounded-md p-1.5 text-[var(--text-muted)] transition-colors hover:bg-red-500/10 hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
            <div>
              {quantity > 1 ? (
                <>
                  <p className="text-xs text-[var(--text-muted)]">{formatPrice(unitPrice)} × {quantity}</p>
                  <p className="text-base font-bold text-[var(--text-light)]">{formatPrice(itemTotal)}</p>
                </>
              ) : (
                <>
                  <p className="text-base font-bold text-[var(--text-light)]">{formatPrice(unitPrice)}</p>
                  <p className="text-xs text-[var(--text-muted)]">Qty: 1</p>
                </>
              )}
            </div>

            {!isCustomBuild && (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-2 py-1">
                <button
                  type="button"
                  onClick={() => onUpdateQuantity(item.id, Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                  aria-label={`Decrease ${item.name || 'product'} quantity`}
                  className="p-1 text-[var(--text-muted)] transition-colors hover:text-[var(--gold-primary)] disabled:opacity-30"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="min-w-5 text-center text-xs font-semibold text-[var(--text-light)]">{quantity}</span>
                <button
                  type="button"
                  onClick={() => onUpdateQuantity(item.id, quantity + 1)}
                  disabled={hasStockValue && quantity >= stock}
                  aria-label={`Increase ${item.name || 'product'} quantity`}
                  className="p-1 text-[var(--text-muted)] transition-colors hover:text-[var(--gold-primary)] disabled:opacity-30"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {isCustomBuild && (
        <div className="mt-3 space-y-3 border-t border-[var(--border)] pt-3">
          <dl className="space-y-1 text-xs">
            {hasBasePrice ? <>
              <div className="flex justify-between gap-3"><dt className="text-[var(--text-muted)]">Base price</dt><dd className="tabular-nums">{formatPrice(basePrice)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-[var(--text-muted)]">Customization</dt><dd className="tabular-nums">{formatPrice(customizationCost)}</dd></div>
            </> : <div className="flex justify-between gap-3"><dt className="text-[var(--text-muted)]">Build price</dt><dd className="tabular-nums">{formatPrice(unitPrice - additionalPartsCost)}</dd></div>}
            {additionalPartsCost > 0 && <div className="flex justify-between gap-3"><dt className="text-[var(--text-muted)]">Existing add-ons</dt><dd className="tabular-nums">{formatPrice(additionalPartsCost)}</dd></div>}
            <div className="flex justify-between gap-3 font-semibold"><dt>Build total × {quantity}</dt><dd className="tabular-nums text-[var(--gold-primary)]">{formatPrice(itemTotal)}</dd></div>
          </dl>
          <CustomBuildDetails item={item} />
        </div>
      )}
      {isBuildPreviewOpen && isCustomBuild && <CustomBuildPreviewModal item={item} onClose={() => setIsBuildPreviewOpen(false)} />}

    </div>
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
      addr.barangay,
      addr.city,
      addr.province,
      addr.postal_code
    ].filter(Boolean)
    return parts.join(', ')
  }

  const defaultAddress = addresses?.find(a => a.is_default)
  const displayAddresses = addresses?.length > 0 ? [...addresses].sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0)) : []

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
          <span className="text-xs" style={{ color: '#f87171' }}>Required</span>
        </div>
      </div>

      <div className="p-4">
        {hasError && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400 font-medium">Select a complete shipping address with a street, city, province or state, and postal code.</p>
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
        <span className="text-[var(--text-muted)]">Shipping fee</span>
        <span className={`${shippingCost === 0 ? 'text-green-400' : 'text-[var(--text-light)]'}`}>
          {shippingCost === 0 ? 'Paid separately' : `₱${shippingCost}`}
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
  items,
  selectionEnabled,
  selectedItemIds,
  onToggleSelect,
  onUpdateQuantity,
  onRemove,
  onToggleAllItems,
  allItemsSelected,
  subtotal,
  shippingCost,
  taxAmount = 0,
  total,
  remainingBalance = 0,
  requiresDownPayment = false,
  itemCount,
  onPlaceOrder,
  isProcessing,
  disabled,
  monthlyPayment = 0,
  estimatedCompletion,
}) {
  const safeSubtotal = Number.isFinite(Number(subtotal)) ? Number(subtotal) : 0
  const safeShippingCost = Number.isFinite(Number(shippingCost)) ? Number(shippingCost) : 0
  const safeTotal = Number.isFinite(Number(total)) ? Number(total) : 0
  const safeRemainingBalance = Number.isFinite(Number(remainingBalance)) ? Number(remainingBalance) : 0
  const safeMonthlyPayment = Number.isFinite(Number(monthlyPayment)) ? Number(monthlyPayment) : 0
  const safeItemCount = Number.isFinite(Number(itemCount)) ? Number(itemCount) : 0
  const isCheckoutDisabled = Boolean(disabled)

  return (
    <div className="bg-[var(--surface-dark)] border border-white/10 rounded-2xl p-6 space-y-5 shadow-lg shadow-black/20">
      <div className="flex items-center gap-3">
        <FileText className="w-5 h-5 text-[var(--gold-primary)]" />
        <h2 className="text-xl font-bold text-[var(--text-light)]">Order Summary</h2>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
          <p className="text-sm font-semibold text-[var(--text-light)]">Products</p>
          {selectionEnabled && (
            <div className="flex items-center gap-3 text-xs">
              <button type="button" onClick={onToggleAllItems} className="font-medium text-[var(--gold-primary)] hover:text-[var(--text-light)]">
                {allItemsSelected ? 'Clear Selection' : 'Select All'}
              </button>
            </div>
          )}
        </div>
        <div className="max-h-[45vh] space-y-3 overflow-y-auto overscroll-contain pr-1 sm:max-h-[50vh]">
        {items.map((item) => (
          <CartItemCard
            key={item.id}
            item={item}
            onUpdateQuantity={onUpdateQuantity}
            onRemove={onRemove}
            isCustomBuild={isCustomBuildItem(item)}
            isBuyNow={!selectionEnabled && !isCustomBuildItem(item)}
            selectionEnabled={selectionEnabled}
            isSelected={selectedItemIds.includes(String(item.id))}
            onToggleSelect={onToggleSelect}
          />
        ))}
        </div>
      </div>

      <div className="space-y-3 border-t border-[var(--border)] pt-4">
        <div className="flex justify-between text-sm">
          <span className="text-[var(--text-muted)]">Subtotal ({safeItemCount} items)</span>
          <span className="text-[var(--text-light)] font-medium">PHP {safeSubtotal.toLocaleString('en-PH')}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--text-muted)]">Shipping</span>
          <span className={`${safeShippingCost === 0 ? 'text-green-400' : 'text-[var(--text-light)]'}`}>
            {safeShippingCost === 0 ? 'Paid separately' : `PHP ${safeShippingCost.toLocaleString('en-PH')}`}
          </span>
        </div>
        {Number(taxAmount) > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-muted)]">Tax</span>
            <span className="text-[var(--text-light)]">PHP {Number(taxAmount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        )}
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
        {requiresDownPayment && <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold"><span>Total Amount</span><span className="tabular-nums">PHP {(safeTotal + safeRemainingBalance).toLocaleString('en-PH', { maximumFractionDigits: 2 })}</span></div>}
        <div className="flex flex-wrap justify-between items-center gap-2">
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

        {requiresDownPayment && safeMonthlyPayment > 0 && (
          <div className="space-y-2 border-t border-[var(--border)] pt-4">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-muted)]">Estimated Monthly Payment</span>
              <span className="text-[var(--text-light)] font-medium">
                PHP {safeMonthlyPayment.toLocaleString('en-PH', { maximumFractionDigits: 2 })}/month for 6 months
              </span>
            </div>
            {estimatedCompletion && (
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-muted)]">Estimated Completion</span>
                <span className="text-[var(--text-light)] font-medium">
                  {estimatedCompletion}
                </span>
              </div>
            )}
            {/* <p className="text-xs text-[var(--text-muted)] italic">
              Monthly payment is estimated based on a 6-month installment plan with applicable interest. Actual terms may vary.
            </p> */}
          </div>
        )}
      </div>

      <button
        onClick={onPlaceOrder}
        disabled={isProcessing || isCheckoutDisabled}
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

function SuccessModal({ isOpen, onClose, onGoToMyPurchase }) {
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
            <p className="text-[var(--text-muted)] mb-8">Your order was placed successfully. Redirecting to My Purchases in a few seconds…</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={onGoToMyPurchase}
                className="w-full py-3.5 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-semibold rounded-xl hover:shadow-[0_0_25px_rgba(212,175,55,0.5)] transition-all"
              >
                Go to My Purchase
              </button>
              <button
                onClick={onClose}
                className="w-full py-3.5 border border-[var(--border)] text-white font-semibold rounded-xl hover:bg-white/5 transition-all"
              >
                Continue Shopping
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function AddAddressModal({ isOpen, onClose, onSave, isSaving, error }) {
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
          <h3 className="text-xl font-bold text-[var(--text-light)]">Add Shipping Address</h3>
          <button onClick={onClose} className="p-2 hover:bg-[var(--surface-elevated)] rounded-lg transition-colors">
            <X className="w-5 h-5 text-[var(--text-muted)]" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg border border-red-500/30 bg-red-500/10">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <AddressForm
          initialAddress={EMPTY_INITIAL_ADDRESS}
          onSubmit={onSave}
          onCancel={onClose}
          submitLabel="Save Address"
          isSubmitting={isSaving}
        />
      </motion.div>
    </motion.div>
  )
}

// ==================== MAIN CHECKOUT PAGE ====================

export function CheckoutPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const returnToDashboardCart = location.state?.returnToDashboardCart
    || new URLSearchParams(location.search).get('from') === 'dashboard-cart'
  const {
    cart,
    removeFromCart,
    updateQuantity,
    refreshCart,
    waitForCartUpdates,
    selectedItemIds,
    setSelectedItemIds,
    toggleItemSelection,
    toggleSelectAllItems,
    getSelectedItemIds,
  } = useCart()
  const { isAuthenticated, user, updateUser } = useAuth()
  
  const isCustomBuild = location.state?.isCustomBuild || false
  const isBuyNow = location.state?.isBuyNow || false
  const customBuildItem = location.state?.checkoutItem || null
  const customBuildId = customBuildItem?.dbCustomizationId || customBuildItem?.customization_id || null
  const [savedCheckoutBuild, setSavedCheckoutBuild] = useState(null)
  useEffect(() => {
    setSavedCheckoutBuild(null)
    if (!isCustomBuild || !isAuthenticated || !customBuildId) return
    let live = true
    adminApi.getMyCustomizations().then((result) => {
      const saved = (Array.isArray(result.data) ? result.data : []).find(build => build.customization_id === customBuildId)
      if (live && saved) setSavedCheckoutBuild(saved)
    }).catch(error => console.warn('Could not refresh saved checkout preview:', error.message))
    return () => { live = false }
  }, [isCustomBuild, isAuthenticated, customBuildId])
  const buyNowItem = isBuyNow ? location.state?.checkoutItem : null
  
  const [isProcessing, setIsProcessing] = useState(false)
  const [orderError, setOrderError] = useState(null)
  const [orderNotes, setOrderNotes] = useState('')
  const shippingMethod = 'standard'
  const [selectedAddressId, setSelectedAddressId] = useState(null)
  const [addressError, setAddressError] = useState(false)
  const [showAddAddressModal, setShowAddAddressModal] = useState(false)
  const [isSavingAddress, setIsSavingAddress] = useState(false)
  const [saveAddressError, setSaveAddressError] = useState('')
  const [addressLocationData, setAddressLocationData] = useState({
    provinces: [],
    cities: [],
    barangays: []
  })
  
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [termsAcceptance, setTermsAcceptance] = useState({ scope: '' })
  const [selectionError, setSelectionError] = useState(false)
  const [preparedCartItems, setPreparedCartItems] = useState([])
  const [preparedTaxRate, setPreparedTaxRate] = useState(0)
  const [isPreparingCart, setIsPreparingCart] = useState(false)
  const [generatedCustomItemId] = useState(() => `custom-${Date.now()}`)
  const [buyNowQuantity, setBuyNowQuantity] = useState(() => Math.max(1, Number(buyNowItem?.quantity) || 1))

  useEffect(() => {
    if (isBuyNow && buyNowItem) {
      setBuyNowQuantity(Math.max(1, Number(buyNowItem.quantity) || 1))
    }
  }, [isBuyNow, buyNowItem?.id, buyNowItem?.quantity])

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

  useEffect(() => {
    const isStandaloneCheckout = isCustomBuild || isBuyNow
    const requestedProductIds = (location.state?.cartProductIds || []).map(String)
    let requestedCartItemIds = (location.state?.cartItemIds || []).map(String)
    if (!isStandaloneCheckout && requestedCartItemIds.length === 0 && requestedProductIds.length > 0) {
      requestedCartItemIds = cart
        .filter(item => requestedProductIds.includes(String(item.id)))
        .map(item => item.cart_item_id)
        .filter(Boolean)
        .map(String)
      if (requestedCartItemIds.length !== requestedProductIds.length) return
    }

    if (!isStandaloneCheckout && requestedCartItemIds.length === 0) {
      setPreparedCartItems([])
      setIsPreparingCart(false)
      setOrderError('Please select at least one item to proceed to checkout.')
      return
    }

    let isCurrentRequest = true
    setIsPreparingCart(true)
    setOrderError(null)
    api.cart.prepareCheckout({
      cart_item_ids: requestedCartItemIds,
      shipping_method: shippingMethod,
    }).then((response) => {
      if (!isCurrentRequest) return
      const result = response?.data || {}
      setPreparedTaxRate(Number(result.checkout_data?.tax_rate) || 0)
      if (isStandaloneCheckout) {
        setPreparedCartItems([])
        setIsPreparingCart(false)
        return
      }
      const cartItems = Array.isArray(result.cart?.items) ? result.cart.items : []
      const preparedIds = new Set(cartItems.map(item => String(item.cart_item_id)))
      if (requestedCartItemIds.some(id => !preparedIds.has(id))) {
        throw new Error('One or more selected cart items are no longer available.')
      }
      setPreparedCartItems(cartItems.map(mapDbCartItem))
      setIsPreparingCart(false)
    }).catch((error) => {
      if (!isCurrentRequest) return
      setPreparedCartItems([])
      setOrderError(error.message || 'Unable to validate your selected cart items.')
      setIsPreparingCart(false)
    })

    return () => { isCurrentRequest = false }
  }, [cart, isCustomBuild, isBuyNow, location.state, shippingMethod])

  let baseCheckoutItems = preparedCartItems

  if (isBuyNow && buyNowItem) {
    baseCheckoutItems = [{ ...buyNowItem, quantity: buyNowQuantity }]
  } else if (isCustomBuild && customBuildItem) {
    const customBuildPrice = Number(customBuildItem.price) || 0
    const customAdditionalPartsTotal = (customBuildItem.additionalParts || []).reduce((sum, part) => {
      return sum + ((Number(part.price) || 0) * (Number(part.quantity) || 1))
    }, 0)

    baseCheckoutItems = [{
      ...customBuildItem,
      config: customBuildItem.config || savedCheckoutBuild?.config_json || {},
      stickers: customBuildItem.stickers || parseArrayValue(savedCheckoutBuild?.stickers),
      preview_image: customBuildItem.preview_image || savedCheckoutBuild?.preview_image || null,
      category: 'Custom Build',
      isCustomBuild: true,
      price: customBuildPrice + customAdditionalPartsTotal,
      quantity: 1,
      id: customBuildItem.id || generatedCustomItemId,
    }]
  }

  const availableItemIds = baseCheckoutItems.map(item => String(item.id))

  useEffect(() => {
    if (isCustomBuild || isBuyNow) {
      return
    }

    if (selectedItemIds === null) {
      setSelectedItemIds(null)
    }
  }, [isCustomBuild, isBuyNow, selectedItemIds])

  const activeSelectedItemIds = isCustomBuild || isBuyNow
    ? availableItemIds
    : getSelectedItemIds()

  const checkoutItems = baseCheckoutItems.filter(item => activeSelectedItemIds.includes(String(item.id)))
  const subtotal = checkoutItems.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.quantity) || 0)), 0)
  const shippingCost = 0
  const taxAmount = Math.round((subtotal * preparedTaxRate + Number.EPSILON) * 100) / 100
  
  const fullPaymentTotal = subtotal + shippingCost + taxAmount
  const hasSelectedCustomBuild = checkoutItems.some(item => isCustomBuildItem(item))
  const termsTypes = getCheckoutTermsTypes(checkoutItems.some(item => !isCustomBuildItem(item)), hasSelectedCustomBuild)
  const termsScope = JSON.stringify([termsTypes, checkoutItems.map(item => [item.id, item.quantity, item.price]), selectedAddressId, shippingMethod])
  const acceptedTerms = Boolean(termsAcceptance.scope === termsScope && termsAcceptance.checkoutId)
  useEffect(() => {
    setTermsAcceptance((previous) => previous.scope === termsScope ? previous : { scope: termsScope })
    setShowPaymentModal(false)
    setShowTermsModal(false)
  }, [termsScope])
  const total = hasSelectedCustomBuild ? fullPaymentTotal * CUSTOM_BUILD_DOWN_PAYMENT_RATE : fullPaymentTotal
  const remainingBalance = Math.max(0, fullPaymentTotal - total)
  const monthlyPayment = hasSelectedCustomBuild
    ? Math.round((fullPaymentTotal * (1 - CUSTOM_BUILD_DOWN_PAYMENT_RATE) * (1 + 0.03) / 6) * 100) / 100
    : 0
  const estimatedCompletion = hasSelectedCustomBuild ? 'Approximately 6–8 months' : null
  const itemCount = checkoutItems.reduce((a, b) => a + b.quantity, 0)
  const totalCartItemCount = baseCheckoutItems.reduce((a, b) => a + b.quantity, 0)
  const hasSelectedItems = checkoutItems.length > 0
  const canAddMoreAddresses = true
  const allSelectableItemsSelected = !isCustomBuild && !isBuyNow && checkoutItems.length === baseCheckoutItems.length

  const handleSelectAddress = (addressId) => {
    setSelectedAddressId(addressId)
    setAddressError(false)
  }

  const handleAddNewAddress = () => {
    setShowAddAddressModal(true)
    setSaveAddressError('')
  }

  const handleToggleItemSelection = (itemId) => {
    toggleItemSelection(itemId)
    setSelectionError(false)
  }

  const handleToggleAllItems = () => {
    toggleSelectAllItems()
    setSelectionError(false)
  }

  const handleCheckoutQuantityUpdate = (itemId, quantity) => {
    if (isBuyNow) {
      const normalizedQuantity = Math.max(1, Math.trunc(Number(quantity) || 1))
      const stock = Number(buyNowItem?.stock)
      setBuyNowQuantity(Number.isFinite(stock) && stock > 0
        ? Math.min(normalizedQuantity, Math.trunc(stock))
        : normalizedQuantity)
      return
    }
    updateQuantity(itemId, quantity)
  }

  const checkoutTermsRequest = useRef(null)
  const currentTermsScope = useRef(termsScope)
  currentTermsScope.current = termsScope
  const handleCloseTermsModal = () => setShowTermsModal(false)
  const handleAgreeTerms = async () => {
    const scope = termsScope
    if (checkoutTermsRequest.current?.scope !== scope) {
      checkoutTermsRequest.current = { scope, id: createCheckoutId() }
    }
    const checkoutId = checkoutTermsRequest.current.id
    await saveAgreement('checkout', { agreed: true, checkoutId, types: termsTypes,
      versions: Object.fromEntries(termsTypes.map(type => [type, TERMS_VERSIONS[type]])) })
    if (currentTermsScope.current !== scope) {
      setOrderError('Your checkout changed. Please review it again.')
      throw new Error('Your checkout changed. Please review it again.')
    }
    setTermsAcceptance({ scope, checkoutId })
    setShowTermsModal(false)
    setShowPaymentModal(true)
  }

  const handleSaveAddress = async (addressData) => {
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
        regionCode: addressData.regionCode,
        label: addressData.label,
        streetLine1: addressData.streetLine1,
        streetLine2: addressData.streetLine2,
        city: city,
        stateProvince: stateProvince,
        barangay: addressData.barangay || '',
        postalZipCode: addressData.postalZipCode,
        country: countryCode,
        isDefault: addressData.isDefault
      }

      const duplicateAddress = uniqueAddresses.find(
        (address) => getAddressSignature(address) === getAddressSignature(payload)
      )

      if (duplicateAddress) {
        setSelectedAddressId(duplicateAddress.address_id)
        setShowAddAddressModal(false)
        setAddressError(false)
        return
      }
      
      const response = await fetch(`${API}/api/users/me/addresses`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
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
            barangay: addressData.barangay || '',
            postal_code: addressData.postalZipCode,
            country: countryCode,
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
        setSaveAddressError('')
      } else {
        const err = await response.json()
        console.error('Address save error:', err)
        const fieldErrors = Array.isArray(err.errors) && err.errors.length > 0
          ? err.errors.map(e => e.message).filter(Boolean).join(' ')
          : ''
        setSaveAddressError(fieldErrors || err.message || 'Failed to save address. Please check the details and try again.')
      }
    } catch (error) {
      console.error('Error saving address:', error)
      setSaveAddressError(error.message || 'Failed to save address. Please try again.')
    } finally {
      setIsSavingAddress(false)
    }
  }

  const validatePayment = (paymentMethod, receipt) => {
    if (!paymentMethod) return false
    if (paymentMethod === 'gcash' || paymentMethod === 'bank') {
      return !!receipt
    }
    return !!receipt
  }

  const openingTerms = useRef(false)
  const handlePlaceOrderClick = async () => {
    if (openingTerms.current || showTermsModal || showPaymentModal || isProcessing) return
    openingTerms.current = true
    try {
      if (!await waitForCartUpdates()) {
        setOrderError('Cart quantity could not be saved. Please review your cart and try again.')
        return
      }
      if (!isAuthenticated) {
        setOrderError('Please log in to place an order.')
        return
      }
      if (!hasSelectedItems) {
        setSelectionError(true)
        return
      }
      const selectedAddress = uniqueAddresses.find(address => address.address_id === selectedAddressId)
      const requiredAddressFields = [
        selectedAddress?.street_line1 ?? selectedAddress?.street ?? selectedAddress?.line1,
        selectedAddress?.city,
        selectedAddress?.postal_code ?? selectedAddress?.postalZipCode ?? selectedAddress?.postalCode,
        selectedAddress?.country ?? selectedAddress?.country_code,
      ]
      const location = resolveSavedLocation(selectedAddress || {})
      const provinceMissing = location.province && !String(selectedAddress?.province ?? selectedAddress?.stateProvince ?? '').trim()
      if (provinceMissing || !selectedAddressId || requiredAddressFields.some(value => !String(value || '').trim())) {
        setAddressError(true)
        return
      }
      if (!['standard', 'express'].includes(shippingMethod)) {
        setOrderError('Please select a valid shipping method.')
        return
      }
      const outOfStockItem = checkoutItems.find((item) => {
        if (isCustomBuildItem(item)) return false
        if (item.stock === null || item.stock === undefined || item.stock === '') return false
        const stock = Number(item.stock)
        return Number.isFinite(stock) && stock >= 0 && Number(item.quantity || 0) > stock
      })
      if (outOfStockItem) {
        const availableStock = Number(outOfStockItem.stock ?? 0)
        setOrderError(`Not enough stock for ${outOfStockItem.name}. Available stock: ${availableStock}.`)
        return
      }
      setShowTermsModal(true)
    } finally { openingTerms.current = false }
  }

  const paymentSubmitting = useRef(false)
  const handlePaymentSubmit = async (paymentMethod, receipt, paymentPlan = 'full') => {
    if (paymentSubmitting.current) return
    if (!acceptedTerms) {
      setOrderError('Please accept the current Terms and Conditions before payment.')
      setShowPaymentModal(false)
      return
    }
    if (!validatePayment(paymentMethod, receipt)) return

    paymentSubmitting.current = true
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
      province: resolveSavedLocation(selectedAddress || {}).province ? selectedAddress?.province || selectedAddress?.stateProvince || '' : null,
      barangay: selectedAddress?.barangay || '',
      postalCode: selectedAddress?.postal_code || '',
      country: selectedAddress?.country || 'PH'
    }

    let additionalNotes = orderNotes?.trim() || ''
    
    try {
      setOrderError(null)
      // Map payment method names to backend values
      const methodMap = {
        'gcash': 'gcash',
        'bank': 'bank_transfer',
      }
      const mappedPaymentMethod = methodMap[paymentMethod] || paymentMethod
      const selectedPaymentTerms = hasSelectedCustomBuild
        ? paymentPlan === 'full' ? 'full' : 'down_payment'
        : 'full'
      const paymentAmount = selectedPaymentTerms === 'full' ? fullPaymentTotal : total
      const paymentAmountLabel = selectedPaymentTerms === 'full' ? 'Full payment amount' : 'Down payment amount'
      const outstandingBalance = Math.max(0, fullPaymentTotal - paymentAmount)

      if (hasSelectedCustomBuild) {
        const checkoutTermsNote = [
          'Checkout Terms:',
          `- Terms and Conditions accepted: ${termsTypes.map(type => TERMS_BY_TYPE[type].label).join('; ')}`,
          `- Payment plan: ${selectedPaymentTerms === 'full' ? 'Full payment' : `${Math.round(CUSTOM_BUILD_DOWN_PAYMENT_RATE * 100)}% down payment`}`,
          `- Full order total: PHP ${fullPaymentTotal.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`,
          `- ${paymentAmountLabel}: PHP ${paymentAmount.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`,
          `- Remaining balance: PHP ${outstandingBalance.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`
        ].join('\n')

        additionalNotes = [additionalNotes, checkoutTermsNote].filter(Boolean).join('\n\n')
      }

      // 1. Create order
      const orderItems = checkoutItems.map(item => {
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
            stickers: Array.isArray(itemCustomSource.stickers) ? itemCustomSource.stickers : [],
            preview_image: itemCustomSource.preview_image || null,
            summary: itemCustomSource.summary || {},
            pricingBreakdown: itemCustomSource.pricingBreakdown || {},
            baseBuildPrice: Number(itemCustomSource.baseBuildPrice ?? customBuildItem?.price ?? item.price) || 0,
            additionalParts: Array.isArray(itemCustomSource.additionalParts) ? itemCustomSource.additionalParts : [],
          } : undefined,

        }
      })
      const orderPayload = {
        ...(!isCustomBuild && !isBuyNow
          ? { cartItemIds: checkoutItems.map(item => item.cart_item_id) }
          : { items: orderItems }),
        notes: additionalNotes,
        shippingMethod,
        paymentMethod: mappedPaymentMethod,
        termsAccepted: acceptedTerms,
        checkoutAcknowledgmentId: termsAcceptance.checkoutId,
        shippingAddressId: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedAddressId) ? selectedAddressId : undefined,
        billingAddress: {
          street: finalAddress.street,
          street2: finalAddress.street2,
          city: finalAddress.city,
          barangay: finalAddress.barangay,
          stateProvince: finalAddress.province,
          postalCode: finalAddress.postalCode,
          country: finalAddress.country,
        },
        paymentPlan: hasSelectedCustomBuild
          ? (paymentPlan === 'full' ? 'full_payment' : 'installment')
          : 'full_payment',
        initialPaymentPercentage: hasSelectedCustomBuild && paymentPlan !== 'full'
          ? CUSTOM_BUILD_DOWN_PAYMENT_RATE
          : undefined,
        installmentTenureMonths: hasSelectedCustomBuild && paymentPlan !== 'full'
          ? 6
          : undefined,
      }
      const response = await fetch(`${API}/api/orders`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(orderPayload)
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
        // 2. Create payment record with proof
        try {
          const paymentResponse = await fetch(`${API}/api/payments`, {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
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
        } catch (paymentError) {
          console.error('Payment creation error:', paymentError)
          setOrderError('Order created, but payment record could not be created. Please contact support.')
          setIsProcessing(false)
          setShowPaymentModal(false)
          return
        }

        if (!isCustomBuild && !isBuyNow) {
          await Promise.allSettled(
            checkoutItems
              .map(item => item.cart_item_id)
              .filter(Boolean)
              .map(cartItemId => api.cart.removeItem(cartItemId))
          )
          await refreshCart()
        }
        setOrderError(null)
        setShowPaymentModal(false)
        setShowSuccessModal(true)
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
      paymentSubmitting.current = false
    }
  }

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false)
    navigate('/shop')
  }

  const handleGoToMyPurchase = () => {
    setShowSuccessModal(false)
    navigate('/dashboard', { state: { section: 'purchases' } })
  }

  // Auto-redirect to My Purchases after order success
  useEffect(() => {
    if (!showSuccessModal) return
    const timer = setTimeout(() => {
      navigate('/dashboard', { state: { section: 'purchases' } })
    }, 3000)
    return () => clearTimeout(timer)
  }, [showSuccessModal, navigate])

  if (!isCustomBuild && !isBuyNow && cart.length === 0 && !isProcessing && !showSuccessModal) {
    return <EmptyCart />
  }

  const handleRemove = (id) => removeFromCart(id)

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
              to={returnToDashboardCart ? '/dashboard' : '/cart'}
              state={returnToDashboardCart ? { section: 'cart' } : undefined}
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
          {!isCustomBuild && !isBuyNow && !isPreparingCart && !hasSelectedItems && !orderError && (
            <p role="alert" className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
              Please select at least one item to proceed to checkout.
            </p>
          )}

          <div className="grid min-w-0 gap-6 lg:grid-cols-12 lg:gap-8">
            <div className="min-w-0 space-y-6 lg:col-span-7">
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
                transition={{ delay: 0.15 }}
              >
                <OrderNotesCard value={orderNotes} onChange={setOrderNotes} />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <ShippingFeeNotice title="Shipping Fee Notice:" />
              </motion.div>

            </div>

            {/* Right Column - Order Summary */}
            <div className="min-w-0 lg:col-span-5">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="sticky top-24"
              >
                <CheckoutSummaryCard
                  items={baseCheckoutItems}
                  selectionEnabled={!isCustomBuild && !isBuyNow}
                  selectedItemIds={activeSelectedItemIds}
                  onToggleSelect={handleToggleItemSelection}
                  onUpdateQuantity={handleCheckoutQuantityUpdate}
                  onRemove={handleRemove}
                  onToggleAllItems={handleToggleAllItems}
                  allItemsSelected={allSelectableItemsSelected}
                  subtotal={subtotal}
                  shippingCost={shippingCost}
                  taxAmount={taxAmount}
                  total={total}
                  remainingBalance={remainingBalance}
                  requiresDownPayment={hasSelectedCustomBuild}
                  itemCount={itemCount}
                  onPlaceOrder={handlePlaceOrderClick}
                  isProcessing={isProcessing}
                  disabled={hasNoAddresses || !hasSelectedItems || isPreparingCart}
                  monthlyPayment={monthlyPayment}
                  estimatedCompletion={estimatedCompletion}
                />
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Address Modal */}
      <AddAddressModal
        isOpen={showAddAddressModal}
        onClose={() => {
          setShowAddAddressModal(false)
          setSaveAddressError('')
        }}
        onSave={handleSaveAddress}
        isSaving={isSavingAddress}
        error={saveAddressError}
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
        items={checkoutItems}
        isProcessing={isProcessing}
        requiresCustomTerms={hasSelectedCustomBuild}
        downPaymentRate={CUSTOM_BUILD_DOWN_PAYMENT_RATE}
      />

      <SuccessModal isOpen={showSuccessModal} onClose={handleSuccessModalClose} onGoToMyPurchase={handleGoToMyPurchase} />

      <TermsAndConditionsModal
        isOpen={showTermsModal}
        onClose={handleCloseTermsModal}
        types={termsTypes}
        onAgree={handleAgreeTerms}
      />
    </>
  )
}
