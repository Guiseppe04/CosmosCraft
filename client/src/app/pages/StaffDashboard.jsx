import { useState, useCallback, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  BarChart3, Calendar, CheckCircle, XCircle, AlertCircle,
  Clock, Package, Briefcase, Users, X,
  Eye, TrendingUp, ChevronLeft, ChevronRight, User,
  Activity, ShoppingBag, RefreshCw, ArrowUpRight, Edit,
  ArrowUpCircle, ArrowDownCircle, ArrowUpDown,
  Search, Plus, ChevronUp, ChevronDown, Wallet,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { staffApi } from '../utils/staffApi'
import { formatCurrency } from '../utils/formatCurrency'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { useSmartPolling } from '../hooks/useSmartPolling'
import { useDebounce } from '../hooks/useDebounce'
import ProjectTaskTracker from '../components/projects/ProjectTaskTracker'
import { Topbar } from '../components/admin/Topbar'
import { OrderManagement } from '../components/admin/OrderManagement'

// ── Skeleton Loader ──────────────────────────────────────────────────────────
function SkeletonRow({ cols = 5 }) {
  return (
    <tr className="border-b border-[var(--border)]/30">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-4 px-6">
          <div className="h-4 bg-white/10 animate-pulse rounded" />
        </td>
      ))}
    </tr>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 animate-pulse">
      <div className="h-4 bg-white/10 rounded w-3/4 mb-3" />
      <div className="h-3 bg-white/10 rounded w-1/2 mb-4" />
      <div className="h-2 bg-white/10 rounded mb-1" />
      <div className="h-2 bg-white/10 rounded w-4/5" />
    </div>
  )
}

function EmptyState({ icon: Icon, label, description }) {
  return (
    <div className="text-center py-16 bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl">
      <div className="w-16 h-16 rounded-2xl bg-[var(--gold-primary)]/10 flex items-center justify-center mx-auto mb-4">
        <Icon className="w-8 h-8 text-[var(--gold-primary)]" />
      </div>
      <p className="text-white font-semibold">{label}</p>
      {description && <p className="text-[var(--text-muted)] text-sm mt-1">{description}</p>}
    </div>
  )
}

function StatusBadge({ label, variant = 'default' }) {
  const map = {
    default: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    success: 'bg-green-500/20 text-green-400 border-green-500/30',
    warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    danger: 'bg-red-500/20 text-red-400 border-red-500/30',
    info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    gold: 'bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] border-[var(--gold-primary)]/30',
  }
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${map[variant] || map.default}`}>
      {label}
    </span>
  )
}

function statusVariant(status) {
  const map = {
    completed: 'success', complete: 'success', approved: 'success', active: 'success',
    in_progress: 'info', processing: 'info', ongoing: 'info',
    pending: 'gold', scheduled: 'gold', not_started: 'default',
    cancelled: 'danger', failed: 'danger', rejected: 'danger', no_show: 'warning',
  }
  return map[status?.toLowerCase()] || 'default'
}

const ADJUSTMENT_REASONS = [
  { value: 'restocking', label: 'Restocking', group: 'Inventory', requiresNotes: false },
  { value: 'received_shipment', label: 'Received Shipment', group: 'Inventory', requiresNotes: false },
  { value: 'returned_items', label: 'Returned Items', group: 'Sales', requiresNotes: false },
  { value: 'sale_adjustment', label: 'Sales Reconciliation', group: 'Sales', requiresNotes: false },
  { value: 'damaged_goods', label: 'Damaged/Defective', group: 'Loss', requiresNotes: true },
  { value: 'lost_missing', label: 'Lost/Missing', group: 'Loss', requiresNotes: true },
  { value: 'cycle_count', label: 'Cycle Count Correction', group: 'Adjustment', requiresNotes: true },
  { value: 'transfer_in', label: 'Transfer In', group: 'Transfer', requiresNotes: true },
  { value: 'transfer_out', label: 'Transfer Out', group: 'Transfer', requiresNotes: true },
  { value: 'sample_item', label: 'Sample Item', group: 'Other', requiresNotes: true },
  { value: 'other', label: 'Other', group: 'Other', requiresNotes: true },
]

const ADJUSTMENT_TYPE_LABELS = {
  stock_in: { label: 'Stock In (Add)', color: 'text-green-400', bg: 'bg-green-500/20', icon: ArrowUpCircle },
  stock_out: { label: 'Stock Out (Remove)', color: 'text-red-400', bg: 'bg-red-500/20', icon: ArrowDownCircle },
  adjustment: { label: 'Manual Set', color: 'text-amber-400', bg: 'bg-amber-500/20', icon: ArrowUpDown },
}

function StockVisualizer({ currentStock, newStock, threshold = 10, showDelta = true }) {
  const delta = newStock - currentStock
  const isIncrease = delta > 0
  const isDecrease = delta < 0
  const isWarning = currentStock > 0 && currentStock <= threshold * 2
  const isCritical = currentStock === 0
  
  const currentColor = isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-green-500'
  const currentTextColor = isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-green-400'
  
  const newColor = isIncrease ? 'bg-green-500' : isDecrease ? 'bg-red-500' : currentColor
  const deltaColor = isIncrease ? 'text-green-400' : isDecrease ? 'text-red-400' : 'text-white'
  
  const maxStock = Math.max(currentStock, newStock, threshold * 3, 50)
  const currentPct = Math.min((currentStock / maxStock) * 100, 100)
  const newPct = Math.min((newStock / maxStock) * 100, 100)
  
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Current</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${isCritical ? 'bg-red-500/20 text-red-400' : isWarning ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400'}`}>
            {isCritical ? 'Out of Stock' : isWarning ? 'Low Stock' : 'In Stock'}
          </span>
        </div>
        <div className={`text-3xl font-bold ${currentTextColor}`}>{currentStock}</div>
        <div className={`h-2 rounded-full overflow-hidden ${currentColor}/30`}>
          <motion.div 
            className={`h-full ${currentColor}`}
            initial={{ width: 0 }}
            animate={{ width: `${currentPct}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>
      
      {showDelta && newStock !== currentStock && (
        <motion.div 
          className="space-y-2"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          key={newStock}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">New Stock</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${isIncrease ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {isIncrease ? `+${delta}` : delta}
            </span>
          </div>
          <div className={`text-3xl font-bold ${deltaColor}`}>{newStock}</div>
          <div className="h-2 rounded-full overflow-hidden bg-gray-700">
            <motion.div 
              className={`h-full ${newColor}`}
              initial={{ width: 0 }}
              animate={{ width: `${newPct}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>
        </motion.div>
      )}
    </div>
  )
}

function QuantityStepper({ value, onChange, maxValue, minValue = 1, disabled = false }) {
  const handleDecrement = () => {
    if (!disabled && value > (minValue || 1)) {
      onChange(value - 1)
    }
  }
  
  const handleIncrement = () => {
    if (!disabled && (!maxValue || value < maxValue)) {
      onChange(value + 1)
    }
  }
  
  const handleInputChange = (e) => {
    const val = parseInt(e.target.value) || 0
    const validVal = Math.max(minValue || 1, Math.min(maxValue || 9999, val))
    onChange(validVal)
  }
  
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleDecrement}
        disabled={disabled || value <= (minValue || 1)}
        className="w-12 h-12 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] text-white text-xl font-bold hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
      >
        −
      </button>
      <input
        type="number"
        value={value}
        onChange={handleInputChange}
        disabled={disabled}
        min={minValue}
        max={maxValue}
        className="flex-1 h-12 px-4 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-white text-center font-mono text-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] disabled:opacity-50"
      />
      <button
        type="button"
        onClick={handleIncrement}
        disabled={disabled || (maxValue && value >= maxValue)}
        className="w-12 h-12 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] text-white text-xl font-bold hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
      >
        +
      </button>
    </div>
  )
}

function ReasonSelector({ value, onChange }) {
  const groupedReasons = useMemo(() => {
    const groups = {}
    ADJUSTMENT_REASONS.forEach(r => {
      if (!groups[r.group]) groups[r.group] = []
      groups[r.group].push(r)
    })
    return groups
  }, [])
  
  const selectedReason = ADJUSTMENT_REASONS.find(r => r.value === value)
  const needsNotes = selectedReason?.requiresNotes
  
  return (
    <div className="space-y-2">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
      >
        <option value="">— Select Reason —</option>
        {Object.entries(groupedReasons).map(([group, reasons]) => (
          <optgroup key={group} label={group}>
            {reasons.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </optgroup>
        ))}
      </select>
      {needsNotes && (
        <p className="text-xs text-amber-400 flex items-center gap-1">
          Notes required for this reason
        </p>
      )}
    </div>
  )
}

function AdjustStockModal({ visibleProducts, modal, form, setForm, formErrors, setFormErrors, closeModal, isSaving, saveStockAdjust, showToast, formatCurrency }) {
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [localNotes, setLocalNotes] = useState('')
  const [isReady, setIsReady] = useState(false)
  
  const preSelectedId = modal.data?.product_id
  const adjustmentType = form.change_type || ''
  const quantity = parseInt(form.quantity) || 0
  
  // Calculate new stock - always call useMemo unconditionally
  const calculatedNewStock = useMemo(() => {
    if (!selectedProduct || !adjustmentType || !quantity) return null
    const current = selectedProduct.stock || 0
    if (adjustmentType === 'stock_in') return current + quantity
    if (adjustmentType === 'stock_out') return current - quantity
    if (adjustmentType === 'adjustment') return quantity
    return current
  }, [selectedProduct, adjustmentType, quantity])

  const canSubmit = selectedProduct && adjustmentType && quantity > 0
  
  const selectedReason = ADJUSTMENT_REASONS.find(r => r.value === form.reason)
  const needsNotes = selectedReason?.requiresNotes
  
  // Initialize on mount or when modal data changes
  useEffect(() => {
    if (!preSelectedId) {
      setIsReady(true)
      return
    }
    
    const found = visibleProducts?.find(p => p.product_id === preSelectedId)
    if (found) {
      setSelectedProduct(found)
      setForm(f => ({ ...f, product_id: preSelectedId, current_stock: found.stock }))
    } else {
      setSelectedProduct({
        product_id: preSelectedId,
        name: modal.data?.name || 'Unknown',
        stock: modal.data?.stock || 0,
        low_stock_threshold: 10,
      })
      setForm(f => ({ ...f, product_id: preSelectedId, current_stock: modal.data?.stock || 0 }))
    }
    setIsReady(true)
  }, [preSelectedId, visibleProducts, modal.data, setForm])
  
  const handleProductSelect = (productId, product) => {
    const selected = product || visibleProducts?.find(p => p.product_id === productId)
    setSelectedProduct(selected)
    setForm(f => ({ 
      ...f, 
      product_id: productId, 
      current_stock: selected?.stock || 0,
      change_type: '',
      quantity: '',
    }))
    setFormErrors(e => ({ ...e, product_id: null }))
  }

  const handleSubmit = async () => {
    const errors = {}
    
    if (!selectedProduct) errors.product_id = 'Please select a product'
    if (!adjustmentType) errors.change_type = 'Please select adjustment type'
    if (!quantity || quantity < 1) errors.quantity = 'Quantity must be greater than 0'
    if (adjustmentType === 'stock_out' && quantity > selectedProduct?.stock) {
      errors.quantity = `Insufficient stock. Available: ${selectedProduct?.stock || 0}`
    }
    if (adjustmentType === 'stock_out' && calculatedNewStock < 0) {
      errors.quantity = 'Stock cannot be negative'
    }
    if (needsNotes && !localNotes.trim()) {
      errors.notes = 'Notes are required for this reason'
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }
    
    setForm(f => ({ ...f, reason: form.reason, notes: localNotes }))
    await saveStockAdjust()
  }
  
  // Show loading state
  if (!isReady) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 text-[var(--gold-primary)] animate-spin" />
        </div>
      </motion.div>
    )
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-white text-xl font-bold">Adjust Stock</h2>
        <button onClick={closeModal} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
          <X className="w-5 h-5 text-[var(--text-muted)]" />
        </button>
      </div>
      
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">Product *</label>
          <input
            type="text"
            value={modal.data?.name || ''}
            disabled
            className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-white text-sm opacity-60"
          />
          <input type="hidden" value={form.product_id || ''} />
        </div>
        
        {selectedProduct && (
          <div className="p-4 bg-[var(--bg-primary)]/50 rounded-xl border border-[var(--border)]">
            <StockVisualizer
              currentStock={selectedProduct.stock || 0}
              newStock={calculatedNewStock}
              threshold={selectedProduct.low_stock_threshold || 10}
            />
          </div>
        )}
        
        <div>
          <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">Adjustment Type *</label>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(ADJUSTMENT_TYPE_LABELS).map(([key, { label, color, bg, icon: Icon }]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setForm(f => ({ ...f, change_type: key }))
                  setFormErrors(e => ({ ...e, change_type: null }))
                }}
                className={`py-3 px-3 rounded-xl text-sm font-medium transition-all border ${
                  adjustmentType === key 
                    ? 'bg-[var(--gold-primary)] text-black border-[var(--gold-primary)]' 
                    : 'bg-[var(--bg-primary)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--gold-primary)]/50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {formErrors.change_type && (
            <p className="mt-1 text-xs text-red-400">{formErrors.change_type}</p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">Quantity *</label>
          <QuantityStepper
            value={quantity}
            onChange={(val) => {
              setForm(f => ({ ...f, quantity: val }))
              setFormErrors(e => ({ ...e, quantity: null }))
            }}
            maxValue={adjustmentType === 'stock_out' ? selectedProduct?.stock : undefined}
            disabled={!selectedProduct || !adjustmentType}
          />
          {formErrors.quantity && (
            <p className="mt-1 text-xs text-red-400">{formErrors.quantity}</p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">Reason *</label>
          <ReasonSelector
            value={form.reason || ''}
            onChange={(val) => {
              setForm(f => ({ ...f, reason: val }))
              setFormErrors(e => ({ ...e, reason: null }))
            }}
          />
          {formErrors.reason && (
            <p className="mt-1 text-xs text-red-400">{formErrors.reason}</p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">
            Notes {needsNotes && <span className="text-red-400">*</span>}
          </label>
          <textarea
            value={localNotes}
            onChange={(e) => {
              setLocalNotes(e.target.value)
              setFormErrors(e => ({ ...e, notes: null }))
            }}
            placeholder={needsNotes ? "Please provide additional details..." : "Add any additional details (optional)"}
            className="w-full h-20 px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
          />
          {formErrors.notes && (
            <p className="mt-1 text-xs text-red-400">{formErrors.notes}</p>
          )}
        </div>
      </div>
      
      <div className="flex gap-3 mt-6 pt-4 border-t border-[var(--border)]">
        <button
          onClick={closeModal}
          disabled={isSaving}
          className="flex-1 py-3 rounded-xl bg-[var(--bg-primary)] text-white font-semibold hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSaving || !canSubmit}
          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black font-semibold hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" /> Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </button>
      </div>
    </motion.div>
  )
}

// ── StaffDashboard ───────────────────────────────────────────────────────────
export function StaffDashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [toast, setToast] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 300)

  // Data
  const [projects, setProjects] = useState([])
  const [orders, setOrders] = useState([])
  const [inventory, setInventory] = useState([])
  const [appointments, setAppointments] = useState([])
  const [inventoryStats, setInventoryStats] = useState(null)

  // Loading states
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [loadingInventory, setLoadingInventory] = useState(false)
  const [loadingAppointments, setLoadingAppointments] = useState(false)

  // Appointment filter state
  const [appointmentFilter, setAppointmentFilter] = useState('all')
  const [isApprovingRejecting, setIsApprovingRejecting] = useState(false)

  // Modal state
  const [modal, setModal] = useState({ open: false, type: null, data: null })
  const [confirm, setConfirm] = useState({ open: false, title: '', description: '', onConfirm: null, isBusy: false, variant: 'warning' })
  const [form, setForm] = useState({})
  const [formErrors, setFormErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)

  // POS Drawer state
  const [posDrawerOpen, setPosDrawerOpen] = useState(false)
  const [posDrawerState, setPosDrawerState] = useState({
    isOpen: false,
    openedAt: null,
    openingCash: 0,
    closedAt: null,
    closingCash: 0,
    status: 'closed',
  })
  const [posCart, setPosCart] = useState([])
  const [posSearchQuery, setPosSearchQuery] = useState('')
  const [posSelectedCategory, setPosSelectedCategory] = useState('all')
  const [posPaymentMethod, setPosPaymentMethod] = useState('cash')
  const [posCashReceived, setPosCashReceived] = useState('')
  const [posShowCloseConfirm, setPosShowCloseConfirm] = useState(false)
  const [posDenominations, setPosDenominations] = useState({
    '1000': 0, '500': 0, '200': 0, '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '1': 0, '0.25': 0, '0.10': 0, '0.05': 0,
  })
  const TAX_RATE = 0.12

  // POS helper functions
  const openPosDrawer = (openingCash) => {
    setPosDrawerState(prev => ({
      ...prev,
      isOpen: true,
      openedAt: new Date().toISOString(),
      openingCash: Number(openingCash),
      status: 'open',
    }))
    setPosDenominations({ '1000': 0, '500': 0, '200': 0, '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '1': 0, '0.25': 0, '0.10': 0, '0.05': 0 })
    setPosCart([])
  }

  const closePosDrawer = () => {
    setPosDrawerState(prev => ({
      ...prev,
      isOpen: false,
      closedAt: new Date().toISOString(),
      closingCash: calculateTotalCash(),
      status: 'closed',
    }))
    setPosShowCloseConfirm(false)
  }

  const calculateTotalCash = () => {
    const bills = { '1000': 1000, '500': 500, '200': 200, '100': 100, '50': 50, '20': 20, '10': 10, '5': 5, '1': 1, '0.25': 0.25, '0.10': 0.10, '0.05': 0.05 }
    let total = posDrawerState.openingCash
    Object.entries(posDenominations).forEach(([denom, qty]) => {
      total += (bills[denom] || 0) * qty
    })
    return total
  }

  const calculateGrandTotal = () => {
    const subtotal = posCart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    const tax = subtotal * TAX_RATE
    return subtotal + tax
  }

  const calculateChange = () => {
    const received = Number(posCashReceived) || 0
    const total = calculateGrandTotal()
    return Math.max(0, received - total)
  }

  const addToPosCart = (product) => {
    const existing = posCart.find(item => item.product_id === product.product_id)
    if (existing) {
      setPosCart(posCart.map(item =>
        item.product_id === product.product_id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      setPosCart([...posCart, { ...product, quantity: 1 }])
    }
  }

  const removeFromPosCart = (productId) => {
    setPosCart(posCart.filter(item => item.product_id !== productId))
  }

  const updatePosCartQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeFromPosCart(productId)
      return
    }
    setPosCart(posCart.map(item =>
      item.product_id === productId ? { ...item, quantity } : item
    ))
  }

  const processPosPayment = async () => {
    const received = Number(posCashReceived)
    const total = calculateGrandTotal()
    
    if (posPaymentMethod === 'cash' && received < total && received > 0) {
      showToast('Insufficient payment', 'error')
      return
    }
    if (posPaymentMethod === 'cash' && received >= total) {
      const denominations = { ...posDenominations }
      let change = calculateChange()
      const changeBreakdown = {}
      const bills = [1000, 500, 200, 100, 50, 20, 10, 5, 1, 0.25, 0.10, 0.05]
      
      bills.forEach(bill => {
        const billStr = String(bill)
        while (change >= bill && denominations[billStr] > 0) {
          change -= bill
          change = Math.round(change * 100) / 100
          changeBreakdown[billStr] = (changeBreakdown[billStr] || 0) + 1
          denominations[billStr]--
        }
      })
    }
    
    try {
      await staffApi.createOrder({
        items: [...posCart],
        paymentMethod: posPaymentMethod,
        totalAmount: calculateGrandTotal(),
        change: posPaymentMethod === 'cash' ? calculateChange() : 0,
        status: 'completed',
      })
      showToast('Payment processed successfully!')
      closePosDrawer()
      fetchOrders()
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  // ── Toast ──────────────────────────────────────────────────────────────
  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  // ── Confirm helpers ────────────────────────────────────────────────────
  const openConfirm = ({ title, description, onConfirm, variant = 'warning' }) =>
    setConfirm({ open: true, title, description, onConfirm, isBusy: false, variant })
  const closeConfirm = () => setConfirm(c => ({ ...c, open: false }))
  const handleConfirmAction = async () => {
    setConfirm(c => ({ ...c, isBusy: true }))
    try { await confirm.onConfirm() }
    finally { setConfirm(c => ({ ...c, open: false, isBusy: false })) }
  }

  // ── Modal helpers ──────────────────────────────────────────────────────
  const openModal = (type, data = null) => { setForm(data ? { ...data } : {}); setModal({ open: true, type, data }) }
  const closeModal = () => setModal({ open: false, type: null, data: null })

  // ── Data fetchers ──────────────────────────────────────────────────────
  const fetchProjects = useCallback(async () => {
    setLoadingProjects(true)
    try {
      const res = await staffApi.getAllProjects()
      setProjects(Array.isArray(res.data) ? res.data : res.data?.projects || [])
    } catch (e) { showToast(e.message, 'error') }
    finally { setLoadingProjects(false) }
  }, [showToast])

  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true)
    try {
      const res = await staffApi.getOrders()
      setOrders(Array.isArray(res.data) ? res.data : res.data?.orders || [])
    } catch (e) { showToast(e.message, 'error') }
    finally { setLoadingOrders(false) }
  }, [showToast])

  const fetchInventory = useCallback(async () => {
    try {
      const statsRes = await staffApi.getInventorySummary()
      setInventoryStats(statsRes.data || {})
      const prodsRes = await staffApi.getInventoryProducts({ search: debouncedSearch })
      setInventory(Array.isArray(prodsRes.data) ? prodsRes.data : prodsRes.data?.products || [])
    } catch (e) { showToast(e.message, 'error') }
    finally { setLoadingInventory(false) }
  }, [debouncedSearch, showToast])

  const fetchAppointments = useCallback(async () => {
    setLoadingAppointments(true)
    try {
      const res = await staffApi.getAppointments()
      setAppointments(Array.isArray(res.data) ? res.data : res.data?.appointments || [])
    } catch (e) { showToast(e.message, 'error') }
    finally { setLoadingAppointments(false) }
  }, [showToast])

  // ── CRUD: Inventory ──────────────────────────────────────────────────────
  const saveStockAdjust = async () => {
    setIsSaving(true)
    try {
      const { product_id, change_type, quantity, reason, notes } = form
      if (!product_id || !change_type || !quantity) {
        showToast('Please fill all required fields', 'error'); return
      }
      const payload = { 
        productId: product_id, 
        quantity: Number(quantity), 
        reason: reason || notes,
        notes: notes 
      }
      if (change_type === 'stock_in') await staffApi.addStock(payload)
      else if (change_type === 'stock_out') await staffApi.deductStock(payload)
      else await staffApi.adjustStock(payload)
      showToast('Stock adjusted!')
      fetchInventory()
      closeModal()
    } catch (e) { showToast(e.message, 'error') }
    finally { setIsSaving(false) }
  }

  // ── Polling: fetch all on load, poll active tab ────────────────────────
  const pollingFn = useCallback(async () => {
    const map = {
      overview: async () => { await fetchProjects(); await fetchAppointments() },
      projects: fetchProjects,
      orders: fetchOrders,
      inventory: fetchInventory,
      appointments: fetchAppointments,
      schedule: fetchAppointments,
    }
    return map[activeTab]?.()
  }, [activeTab, fetchProjects, fetchOrders, fetchInventory, fetchAppointments])

  useSmartPolling(pollingFn, { interval: 5000, maxInterval: 60000, backoffFactor: 1.5, enabled: true })

  const handleRefresh = () => {
    setIsLoading(true)
    pollingFn()?.finally(() => setIsLoading(false))
  }

  // ── Aggregated counts for overview tab ────────────────────────────────
  const totalProjects = projects.length
  const inProgressProjects = projects.filter(p => p.status === 'in_progress').length
  const completedProjects = projects.filter(p => p.status === 'completed').length
  const todayAppts = appointments.filter(a => {
    const d = a.scheduled_at || a.date
    return d && new Date(d).toDateString() === new Date().toDateString()
  }).length

  // ── Pending appointments ──────────────────────────────────────────────────
  const pendingAppointments = appointments.filter(a => a.status === 'pending')

  // ── Approve/Reject appointment handlers ─────────────────────────────
  const handleApproveAppointment = async (appointmentId) => {
    setIsApprovingRejecting(true)
    try {
      await staffApi.updateAppointmentStatus(appointmentId, 'approved')
      showToast('Appointment approved successfully!')
      fetchAppointments()
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setIsApprovingRejecting(false)
    }
  }

  const handleRejectAppointment = async (appointmentId) => {
    setIsApprovingRejecting(true)
    try {
      await staffApi.updateAppointmentStatus(appointmentId, 'cancelled')
      showToast('Appointment rejected')
      fetchAppointments()
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setIsApprovingRejecting(false)
    }
  }

  // ── Tabs ───────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'overview', label: 'My Tasks', icon: BarChart3 },
    { id: 'projects', label: 'Projects', icon: Briefcase },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'inventory', label: 'Inventory', icon: Package },

    { id: 'appointments', label: 'Appointments', icon: Calendar },
    { id: 'schedule', label: 'Schedule', icon: Clock },
  ]

  // ── Input styles ───────────────────────────────────────────────────────
  const inputCls = 'w-full px-4 py-3 bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl text-[var(--text-light)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] text-sm'
  const labelCls = 'block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-2'

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }}
            className={`fixed top-24 right-6 z-[200] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-semibold border ${toast.type === 'error'
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-green-500/10 border-green-500/30 text-green-400'
              }`}
          >
            {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Modal */}
      <ConfirmModal
        open={confirm.open}
        title={confirm.title}
        description={confirm.description}
        variant={confirm.variant}
        isBusy={confirm.isBusy}
        onConfirm={handleConfirmAction}
        onCancel={closeConfirm}
      />

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-screen bg-[var(--surface-dark)] border-r border-[var(--border)] transition-all duration-300 z-40 ${sidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-6 w-6 h-6 bg-[var(--surface-dark)] border border-[var(--border)] rounded-full flex items-center justify-center hover:bg-[var(--gold-primary)] hover:border-[var(--gold-primary)] transition-all"
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4 text-[var(--text-light)]" /> : <ChevronLeft className="w-4 h-4 text-[var(--text-light)]" />}
        </button>

        <div className="h-24 px-4 py-4 border-b border-[var(--border)] flex items-center justify-between relative">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-3">
              <img src="/favicon.png" alt="CosmosCraft" className="w-10 h-10 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[var(--text-light)] font-black text-lg tracking-tight">CosmosCraft</p>
              </div>
            </div>
          )}
          {sidebarCollapsed && (
            <img src="/favicon.png" alt="CosmosCraft" className="w-10 h-10 flex-shrink-0 mx-auto" />
          )}
        </div>

        <nav className="p-4 space-y-1 overflow-y-auto flex-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-medium transition-all duration-200 ${activeTab === tab.id
                  ? 'bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] border-2 border-[var(--gold-primary)] shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-light)] border-2 border-transparent'
                  }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${activeTab === tab.id ? 'text-[var(--text-dark)]' : 'text-[var(--text-muted)]'}`} />
                {!sidebarCollapsed && <span className="truncate">{tab.label}</span>}
              </button>
            )
          })}
        </nav>

      </aside>

      {/* Main Content */}
      <div className={`transition-all duration-300 bg-[var(--bg-primary)] ${sidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
        <Topbar title={tabs.find(t => t.id === activeTab)?.label || 'Dashboard'} userRole="staff" />
        <main className="p-6 pt-6 space-y-6">

          {/* ── OVERVIEW ──────────────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl p-6">
                <p className="text-[var(--gold-primary)] text-sm font-semibold uppercase tracking-widest mb-2">Staff Portal</p>
                <h2 className="text-3xl font-bold text-white">Welcome back, {user?.firstName || user?.first_name || 'Staff'}</h2>
                <p className="text-[var(--text-muted)] mt-1">Here's a summary of your assigned work.</p>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                  {[
                    { label: 'Total Projects', value: totalProjects, color: 'text-white', icon: Briefcase },
                    { label: 'In Progress', value: inProgressProjects, color: 'text-blue-400', icon: Activity },
                    { label: 'Completed', value: completedProjects, color: 'text-green-400', icon: CheckCircle },
                    { label: "Pending Requests", value: pendingAppointments.length, color: 'text-amber-400', icon: Clock },
                  ].map(stat => {
                    const Icon = stat.icon
                    return (
                      <div key={stat.label} className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)]">
                        <Icon className="w-5 h-5 text-[var(--text-muted)] mb-3" />
                        <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                        <p className="text-[var(--text-muted)] text-sm mt-1">{stat.label}</p>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-semibold text-lg">Recent Projects</h3>
                    <button onClick={() => setActiveTab('projects')} className="text-[var(--gold-primary)] text-sm hover:underline">View all</button>
                  </div>
                  {loadingProjects ? (
                    <div className="space-y-3">{[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}</div>
                  ) : projects.length === 0 ? (
                    <EmptyState icon={Briefcase} label="No projects assigned" />
                  ) : (
                    <div className="space-y-3">
                      {projects.slice(0, 4).map(p => (
                        <div key={p.project_id} className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)]">
                          <div className="flex items-start justify-between mb-2">
                            <p className="text-white font-medium">{p.name || p.title}</p>
                            <StatusBadge label={(p.status || 'N/A').replace('_', ' ')} variant={statusVariant(p.status)} />
                          </div>
                          {p.progress !== undefined && (
                            <div>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-[var(--text-muted)]">Progress</span>
                                <span className="text-[var(--gold-primary)]">{p.progress}%</span>
                              </div>
                              <div className="h-1.5 bg-white/10 rounded-full">
                                <div className="h-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] rounded-full" style={{ width: `${p.progress}%` }} />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-semibold text-lg">Today's Appointments</h3>
                    <button onClick={() => setActiveTab('appointments')} className="text-[var(--gold-primary)] text-sm hover:underline">View all</button>
                  </div>
                  {loadingAppointments ? (
                    <div className="space-y-3">{[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}</div>
                  ) : appointments.length === 0 ? (
                    <EmptyState icon={Calendar} label="No appointments today" />
                  ) : (
                    <div className="space-y-3">
                      {appointments.slice(0, 4).map(a => {
                        const d = a.scheduled_at || a.date
                        return (
                          <div key={a.appointment_id} className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)]">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-white font-medium">{a.guitar_details ? `${a.guitar_details.brand} ${a.guitar_details.model}` : (a.title || a.service_name || 'Appointment')}</p>
                                <p className="text-[var(--text-muted)] text-sm">{a.customer_name || a.user_name || 'Customer'}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[var(--gold-primary)] font-semibold text-sm">{d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</p>
                                <StatusBadge label={a.status || 'pending'} variant={statusVariant(a.status)} />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── PROJECTS ──────────────────────────────────────────────── */}
          {activeTab === 'projects' && (
            <motion.div key="projects" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              {loadingProjects ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
                </div>
              ) : projects.length === 0 ? (
                <EmptyState icon={Briefcase} label="No projects available" description="Check back later or contact your admin." />
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {projects.map(p => (
                    <motion.div key={p.project_id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 hover:border-[var(--gold-primary)]/50 transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-white font-semibold">{p.name || p.title || 'Untitled'}</h3>
                          <p className="text-[var(--text-muted)] text-xs">{p.customer_name || p.user_name || '—'}</p>
                        </div>
                        <StatusBadge label={(p.status || 'N/A').replace('_', ' ')} variant={statusVariant(p.status)} />
                      </div>

                      {p.progress !== undefined && (
                        <div className="mb-4">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-[var(--text-muted)]">Progress</span>
                            <span className="text-[var(--gold-primary)]">{p.progress}%</span>
                          </div>
                          <div className="h-2 bg-[var(--bg-primary)] rounded-full">
                            <div className="h-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] rounded-full" style={{ width: `${p.progress}%` }} />
                          </div>
                        </div>
                      )}

                      {p.estimated_completion_date && (
                        <p className="text-[var(--text-muted)] text-xs mb-4">
                          Due: {new Date(p.estimated_completion_date).toLocaleDateString()}
                        </p>
                      )}

                      {/* Stage update controls - Read Only */}
                      <div className="space-y-2 pt-4 border-t border-[var(--border)]">
                        <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider">Current Stage</label>
                        <div className="flex gap-2">
                          <div className="flex-1 py-2 text-xs font-semibold bg-gray-500/10 text-gray-400 border border-gray-500/30 rounded-lg text-center">
                            {p.status === 'in_progress' ? 'In Progress' : p.status === 'completed' ? 'Completed' : 'Not Started'}
                          </div>
                        </div>
                        <div className="w-full py-2 text-xs font-semibold bg-[var(--gold-primary)]/10 text-[var(--gold-primary)] border border-[var(--gold-primary)]/30 rounded-lg text-center">
                          <Activity className="w-3 h-3 inline mr-1" /> View Tasks
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── ORDERS ────────────────────────────────────────────────── */}
          {activeTab === 'orders' && (
            <motion.div key="orders" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <OrderManagement
                orders={orders}
                onRefresh={fetchOrders}
                user={user}
              />
            </motion.div>
          )}

{/* ── INVENTORY ─────────────────────────────────────────────── */}
          {activeTab === 'inventory' && (
            <motion.div key="inventory" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              {loadingInventory ? (
                <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl overflow-hidden">
                  <table className="w-full"><tbody>{[...Array(5)].map((_, i) => <SkeletonRow cols={6} key={i} />)}</tbody></table>
                </div>
              ) : inventory.length === 0 ? (
                <EmptyState icon={Package} label="No inventory data" description="Inventory is managed by admin." />
              ) : (
                <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl overflow-hidden">
                  {/* Filters */}
                  <div className="p-6 border-b border-[var(--border)]">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <h3 className="text-white font-semibold text-lg">Inventory Management</h3>
                        <p className="text-[var(--text-muted)] text-sm">View and manage stock levels.</p>
                      </div>
                      {/* <button
                        onClick={() => openModal('inventory', {})}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black rounded-xl font-semibold text-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all"
                      >
                        <Package className="w-4 h-4" /> Adjust Stock
                      </button> */}
                    </div>
                  </div>
                  
                  {/* Status Filters */}
                  <div className="px-6 py-4 border-b border-[var(--border)]">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex flex-wrap gap-2 flex-1">
                        {[
                          { id: 'all', label: 'All' },
                          { id: 'healthy', label: 'Healthy', cls: 'text-green-400' },
                          { id: 'warning', label: 'Warning', cls: 'text-amber-400' },
                          { id: 'critical', label: 'Critical', cls: 'text-orange-400' },
                          { id: 'out_of_stock', label: 'Out of Stock', cls: 'text-red-400' },
                        ].map((status) => (
                          <button
                            key={status.id}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                              status.id === 'all' 
                                ? 'bg-[var(--gold-primary)] text-black'
                                : status.id === 'healthy'
                                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                  : status.id === 'warning'
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                    : status.id === 'critical'
                                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}
                          >
                            {status.label}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setPosDrawerOpen(true)}
                        className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(14,165,233,0.18)] hover:shadow-[0_12px_35px_rgba(14,165,233,0.25)] transition-all"
                      >
                        <ShoppingBag className="w-4 h-4" />
                        POS
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="border-b border-[var(--border)]/50">
                          <tr>
                            {['Product', 'SKU', 'Stock Level', 'Threshold', 'Status', 'Actions'].map(c => (
                              <th key={c} className="py-4 px-6 text-[var(--text-muted)] text-xs font-bold uppercase tracking-[0.2em]">{c}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {inventory.map((item, i) => {
                            const itemName = item.name
                            const sku = item.sku || '—'
                            const stock = Number(item.stock ?? item.qty ?? 0)
                            const threshold = Number(item.low_stock_threshold ?? 10)
                            const isOutOfStock = stock === 0
                            const isCritical = stock > 0 && stock <= threshold
                            const isWarning = stock > threshold && stock <= threshold * 2
                            const statusLabel = isOutOfStock ? 'Out of Stock' : isCritical ? 'Critical' : isWarning ? 'Warning' : 'Healthy'
                            const statusCls = isOutOfStock
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : isCritical
                                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                : isWarning
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'

                            const maxCapacity = Math.max(stock * 2, threshold * 4, 20)
                            const pct = Math.min((stock / maxCapacity) * 100, 100)

                            return (
                              <tr key={item.product_id || i} className="border-b border-[var(--border)]/30 hover:bg-white/5 transition-colors group">
                                <td className="py-4 px-6">
                                  <div className="flex items-center gap-3">
                                    {item.primary_image ? (
                                      <img src={item.primary_image} alt="" className="w-10 h-10 rounded-lg object-cover bg-[var(--bg-primary)]" />
                                    ) : (
                                      <div className="w-10 h-10 rounded-lg bg-[var(--bg-primary)] flex items-center justify-center">
                                        <Package className="w-5 h-5 text-[var(--text-muted)]" />
                                      </div>
                                    )}
                                    <div>
                                      <p className="text-white font-medium">{itemName}</p>
                                      <p className="text-[var(--text-muted)] text-xs">{item.category_name || 'Uncategorized'}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-4 px-6 text-[var(--text-muted)] font-mono text-sm">{sku}</td>
                                
                                <td className="py-4 px-6 w-48">
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full rounded-full transition-all ${
                                          isOutOfStock ? 'bg-red-500' : 
                                          isCritical ? 'bg-orange-400' : 
                                          isWarning ? 'bg-amber-400' : 'bg-emerald-400'
                                        }`} 
                                        style={{ width: `${pct}%` }} 
                                      />
                                    </div>
                                    <span className={`text-sm font-mono font-bold ${isOutOfStock ? 'text-red-400' : 'text-white'}`}>{stock}</span>
                                  </div>
                                </td>

                                <td className="py-4 px-6 text-[var(--text-muted)] text-sm font-mono">{threshold}</td>
                                
                                <td className="py-4 px-6">
                                  <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs uppercase font-bold tracking-wider ${statusCls}`}>{statusLabel}</span>
                                </td>
                                
                                <td className="py-4 px-6">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => openModal('inventory', { product_id: item.product_id, name: item.name, stock: item.stock })}
                                      className="p-2 hover:bg-[var(--gold-primary)]/10 rounded-lg transition-colors"
                                      title="Adjust Stock"
                                    >
                                      <Edit className="w-4 h-4 text-[var(--text-muted)] hover:text-[var(--gold-primary)]" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                  </div>
                </div>
)}
            </motion.div>
          )}

          {/* ── APPOINTMENTS ──────────────────────────────────────────── */}
          {activeTab === 'appointments' && (
            <motion.div key="appointments" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex flex-wrap gap-2 mb-6">
                <button
                  onClick={() => setAppointmentFilter('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    appointmentFilter === 'all'
                      ? 'bg-[var(--gold-primary)] text-black'
                      : 'bg-[var(--surface-dark)] text-[var(--text-muted)] hover:text-white border border-[var(--border)]'
                  }`}
                >
                  All Appointments
                </button>
                <button
                  onClick={() => setAppointmentFilter('pending')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    appointmentFilter === 'pending'
                      ? 'bg-[var(--gold-primary)] text-black'
                      : 'bg-[var(--surface-dark)] text-[var(--text-muted)] hover:text-white border border-[var(--border)]'
                  }`}
                >
                  Pending Requests
                  {pendingAppointments.length > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-xs ${appointmentFilter === 'pending' ? 'bg-black/20 text-black' : 'bg-[var(--gold-primary)]/20 text-[var(--gold-primary)]'}`}>
                      {pendingAppointments.length}
                    </span>
                  )}
                </button>
              </div>

              {loadingAppointments ? (
                <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl overflow-hidden">
                  <table className="w-full"><tbody>{[...Array(5)].map((_, i) => <SkeletonRow cols={appointmentFilter === 'pending' ? 6 : 5} key={i} />)}</tbody></table>
                </div>
              ) : (appointmentFilter === 'pending' ? pendingAppointments : appointments).length === 0 ? (
                <EmptyState 
                  icon={Calendar} 
                  label={appointmentFilter === 'pending' ? "No pending requests" : "No appointments"} 
                  description={appointmentFilter === 'pending' ? "All appointment requests have been reviewed." : "All appointments will appear here."} 
                />
              ) : (
                <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-[var(--bg-primary)] border-b border-[var(--border)]">
                        <tr>
                          {['Title', 'Customer', 'Date & Time', 'Service', 'Status', ...(appointmentFilter === 'pending' ? ['Actions'] : [])].map(col => (
                            <th key={col} className="text-left py-4 px-6 text-[var(--text-muted)] font-medium text-xs uppercase tracking-wider">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(appointmentFilter === 'pending' ? pendingAppointments : appointments).map(apt => {
                          const d = apt.scheduled_at || apt.date
                          return (
                            <tr key={apt.appointment_id} className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-primary)]/50 transition-colors">
                              <td className="py-4 px-6">
                                <p className="text-white font-medium">{apt.guitar_details ? `${apt.guitar_details.brand} ${apt.guitar_details.model}` : (apt.title || apt.service_name || 'Appointment')}</p>
                                {apt.notes && <p className="text-[var(--text-muted)] text-xs truncate max-w-xs">{apt.notes}</p>}
                              </td>
                              <td className="py-4 px-6">
                                <p className="text-white">{apt.customer_name || apt.user_name || '—'}</p>
                                <p className="text-[var(--text-muted)] text-xs">{apt.customer_email || '—'}</p>
                              </td>
                              <td className="py-4 px-6">
                                <p className="text-white">{d ? new Date(d).toLocaleDateString() : '—'}</p>
                                <p className="text-[var(--text-muted)] text-sm">{d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</p>
                              </td>
                              <td className="py-4 px-6 text-[var(--text-muted)] capitalize">
                                {Array.isArray(apt.services) ? apt.services.map(s => s.replace(/-/g, ' ')).join(', ') : (apt.service_name || 'Consultation')}
                              </td>
                              <td className="py-4 px-6">
                                <StatusBadge label={apt.status || 'pending'} variant={statusVariant(apt.status)} />
                              </td>
                              {appointmentFilter === 'pending' && (
                                <td className="py-4 px-6">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleApproveAppointment(apt.appointment_id)}
                                      disabled={isApprovingRejecting}
                                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30 transition-colors text-xs font-medium disabled:opacity-50"
                                    >
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => openConfirm({
                                        title: 'Reject Appointment',
                                        description: `Are you sure you want to reject "${apt.title || apt.service_name || 'this appointment'}"? This action cannot be undone.`,
                                        variant: 'danger',
                                        onConfirm: () => handleRejectAppointment(apt.appointment_id)
                                      })}
                                      disabled={isApprovingRejecting}
                                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 transition-colors text-xs font-medium disabled:opacity-50"
                                    >
                                      <XCircle className="w-3.5 h-3.5" />
                                      Reject
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ── SCHEDULE ──────────────────────────────────────────────── */}
          {activeTab === 'schedule' && (
            <motion.div key="schedule" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-white font-semibold text-lg">Upcoming Schedule</h3>
                  <p className="text-[var(--text-muted)] text-sm">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
                {loadingAppointments ? (
                  <div className="space-y-3">{[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}</div>
                ) : appointments.length === 0 ? (
                  <EmptyState icon={Clock} label="No scheduled items" description="Your appointments and project deadlines will appear here." />
                ) : (
                  <div className="space-y-4">
                    {appointments.map(apt => {
                      const d = apt.scheduled_at || apt.date
                      const isToday = d && new Date(d).toDateString() === new Date().toDateString()
                      return (
                        <div key={apt.appointment_id} className={`flex items-center gap-5 p-4 rounded-xl border transition-all ${isToday ? 'border-[var(--gold-primary)]/40 bg-[var(--gold-primary)]/5' : 'border-[var(--border)] bg-[var(--bg-primary)]'}`}>
                          <div className={`text-center rounded-xl p-3 min-w-[56px] ${isToday ? 'bg-[var(--gold-primary)] text-black' : 'bg-[var(--bg-primary)] border border-[var(--border)] text-white'}`}>
                            <p className="text-xs font-semibold">{d ? new Date(d).toLocaleDateString('en-US', { month: 'short' }) : '—'}</p>
                            <p className="text-xl font-bold leading-none">{d ? new Date(d).getDate() : '—'}</p>
                          </div>
                          <div className="flex-1">
                            <p className="text-white font-semibold">{apt.title || apt.service_name || 'Appointment'}</p>
                            <p className="text-[var(--text-muted)] text-sm">{apt.customer_name || apt.user_name || 'Customer'} • {d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</p>
                          </div>
                          <StatusBadge label={apt.status || 'pending'} variant={statusVariant(apt.status)} />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Project deadlines */}
              {projects.filter(p => p.estimated_completion_date).length > 0 && (
                <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
                  <h3 className="text-white font-semibold text-lg mb-4">Project Deadlines</h3>
                  <div className="space-y-3">
                    {projects.filter(p => p.estimated_completion_date).slice(0, 5).map(p => {
                      const deadline = new Date(p.estimated_completion_date)
                      const isPast = deadline < new Date()
                      const isSoon = !isPast && (deadline - new Date()) < 7 * 24 * 60 * 60 * 1000
                      return (
                        <div key={p.project_id} className="flex items-center gap-4 p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)]">
                          <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isPast ? 'bg-red-400' : isSoon ? 'bg-amber-400' : 'bg-green-400'}`} />
                          <div className="flex-1">
                            <p className="text-white text-sm font-medium">{p.name || p.title}</p>
                            <p className="text-[var(--text-muted)] text-xs">{deadline.toLocaleDateString()}</p>
                          </div>
                          <StatusBadge
                            label={isPast ? 'Overdue' : isSoon ? 'Due Soon' : 'On Track'}
                            variant={isPast ? 'danger' : isSoon ? 'warning' : 'success'}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </main>

        {/* POS Drawer Modal */}
        <AnimatePresence>
          {posDrawerOpen && (
            <motion.div
              key="pos-drawer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm"
              onClick={(e) => { if (e.target === e.currentTarget) setPosDrawerOpen(false) }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl w-full max-w-[95vw] h-[90vh] overflow-hidden flex flex-col"
              >
                <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--bg-primary)]/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-sky-600 flex items-center justify-center">
                      <ShoppingBag className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-white font-bold text-lg">POS Cash Drawer</h2>
                      <p className="text-xs text-[var(--text-muted)]">
                        {posDrawerState.isOpen 
                          ? `Opened at ${new Date(posDrawerState.openedAt).toLocaleTimeString()}`
                          : 'Drawer is closed'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {posDrawerState.isOpen && (
                      <button onClick={() => setPosShowCloseConfirm(true)} className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm text-red-400 hover:bg-red-500/10 transition-colors">
                        Close Drawer
                      </button>
                    )}
                    <button onClick={() => setPosDrawerOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                      <X className="w-5 h-5 text-[var(--text-muted)]" />
                    </button>
                  </div>
                </div>

                {!posDrawerState.isOpen ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500/20 to-sky-600/20 flex items-center justify-center mb-6">
                      <Wallet className="w-12 h-12 text-cyan-400" />
                    </div>
                    <h3 className="text-white text-xl font-bold mb-2">Open the Cash Drawer</h3>
                    <p className="text-[var(--text-muted)] text-center mb-6 max-w-md">
                      Set the opening cash amount to start POS transactions. This will be used as the starting float for the day.
                    </p>
                    <div className="w-full max-w-sm space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">Opening Cash Amount</label>
                        <input
                          type="number"
                          id="openingCash"
                          placeholder="0.00"
                          className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-white text-lg font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>
                      <button
                        onClick={(e) => {
                          const amount = Number(e.target.closest('button')?.previousSibling?.querySelector('input')?.value) || 0
                          openPosDrawer(amount)
                        }}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-600 text-white font-bold hover:shadow-[0_8px_25px_rgba(6,182,212,0.35)] transition-all"
                      >
                        Open Drawer
                      </button>
                    </div>
                  </div>
) : (
                    <div className="flex-1 flex overflow-hidden">
                      <div className="w-1/2 border-r border-[var(--border)] flex flex-col">
                        <div className="p-3 border-b border-[var(--border)]">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                            <input
                              type="text"
                              placeholder="Search products..."
                              value={posSearchQuery}
                              onChange={(e) => setPosSearchQuery(e.target.value)}
                              className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                          </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                          {inventory
                            .filter(p => p.stock > 0)
                            .filter(p => !posSearchQuery || p.name?.toLowerCase().includes(posSearchQuery.toLowerCase()) || p.sku?.toLowerCase().includes(posSearchQuery.toLowerCase()))
                            .slice(0, 20)
                            .map(product => (
                              <button
                                key={product.product_id}
                                onClick={() => addToPosCart(product)}
                                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors text-left group"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-white font-medium truncate">{product.name}</p>
                                  <p className="text-xs text-[var(--text-muted)]">{product.sku}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-cyan-400 font-mono">{formatCurrency(product.price)}</span>
                                  <span className="text-xs text-[var(--text-muted)]">×{product.stock}</span>
                                  <Plus className="w-4 h-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </button>
                            ))}
                        </div>
                      </div>

                      <div className="w-1/2 flex flex-col">
                        <div className="flex-1 overflow-y-auto border-b border-[var(--border)]">
                          {posCart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
                              <ShoppingBag className="w-10 h-10 mb-2 opacity-30" />
                              <p className="text-sm">Add items to cart</p>
                            </div>
                          ) : (
                            <div className="p-2 space-y-1">
                              {posCart.map(item => (
                                <div key={item.product_id} className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-primary)]/50">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-white font-medium truncate text-sm">{item.name}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => {
                                      const newQty = item.quantity - 1
                                      if (newQty <= 0) removeFromPosCart(item.product_id)
                                      else updatePosCartQuantity(item.product_id, newQty)
                                    }} className="p-1 hover:bg-white/10 rounded">
                                      <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                                    </button>
                                    <span className="text-white font-mono w-6 text-center">{item.quantity}</span>
                                    <button onClick={() => updatePosCartQuantity(item.product_id, item.quantity + 1)} className="p-1 hover:bg-white/10 rounded">
                                      <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
                                    </button>
                                    <span className="text-cyan-400 font-mono w-20 text-right">{formatCurrency(item.price * item.quantity)}</span>
                                    <button onClick={() => removeFromPosCart(item.product_id)} className="p-1 hover:bg-red-500/20 rounded">
                                      <X className="w-4 h-4 text-red-400" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="p-3 border-b border-[var(--border)] space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-[var(--text-muted)]">Subtotal</span>
                            <span className="text-white font-mono">{formatCurrency(posCart.reduce((sum, item) => sum + (item.price * item.quantity), 0))}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-[var(--text-muted)]">Tax (12%)</span>
                            <span className="text-white font-mono">{formatCurrency(posCart.reduce((sum, item) => sum + (item.price * item.quantity), 0) * TAX_RATE)}</span>
                          </div>
                          <div className="flex justify-between text-lg font-bold pt-2 border-t border-[var(--border)]">
                            <span className="text-white">Total</span>
                            <span className="text-cyan-400">{formatCurrency(calculateGrandTotal())}</span>
                          </div>
                        </div>

                        <div className="p-3 space-y-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => setPosPaymentMethod('cash')}
                              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${posPaymentMethod === 'cash' ? 'bg-cyan-500 text-black' : 'bg-[var(--bg-primary)] text-[var(--text-muted)] hover:text-white'}`}
                            >
                              Cash
                            </button>
                            <button
                              onClick={() => setPosPaymentMethod('card')}
                              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${posPaymentMethod === 'card' ? 'bg-cyan-500 text-black' : 'bg-[var(--bg-primary)] text-[var(--text-muted)] hover:text-white'}`}
                            >
                              Card
                            </button>
                            <button
                              onClick={() => setPosPaymentMethod('gcash')}
                              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${posPaymentMethod === 'gcash' ? 'bg-cyan-500 text-black' : 'bg-[var(--bg-primary)] text-[var(--text-muted)] hover:text-white'}`}
                            >
                              GCash
                            </button>
                          </div>
                          
                          {posPaymentMethod === 'cash' && (
                            <>
                              <div>
                                <label className="block text-xs text-[var(--text-muted)] mb-1">Cash Received</label>
                                <input
                                  type="number"
                                  value={posCashReceived}
                                  onChange={(e) => setPosCashReceived(e.target.value)}
                                  placeholder="0.00"
                                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-white font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                />
                              </div>
                              {posCashReceived && (
                                <div className="flex justify-between text-sm py-2 border-t border-[var(--border)]">
                                  <span className="text-[var(--text-muted)]">Change</span>
                                  <span className="text-green-400 font-mono">{formatCurrency(calculateChange())}</span>
                                </div>
                              )}
                            </>
                          )}
                          
                          <button
                            onClick={processPosPayment}
                            disabled={posCart.length === 0 || calculateGrandTotal() === 0}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-600 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_8px_25px_rgba(6,182,212,0.35)] transition-all"
                          >
                            {posPaymentMethod === 'cash' ? `Receive ${formatCurrency(Number(posCashReceived) || 0)}` : 'Process Payment'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Inventory Adjust Modal */}
          {modal.open && modal.type === 'inventory' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm"
              onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <AdjustStockModal
                  visibleProducts={inventory}
                  modal={modal}
                  form={form}
                  setForm={setForm}
                  formErrors={formErrors}
                  setFormErrors={setFormErrors}
                  closeModal={closeModal}
                  isSaving={isSaving}
                  saveStockAdjust={saveStockAdjust}
                  showToast={showToast}
                  formatCurrency={formatCurrency}
                />
              </motion.div>
            </motion.div>
          )}
        </div>
      </div>
    )
  }

export default StaffDashboard
