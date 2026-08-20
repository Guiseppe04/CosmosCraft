import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowUpDown,
  BarChart3,
  Briefcase,
  Calendar,
  CalendarX,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Edit,
  Filter,
  Hand,
  MoreHorizontal,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Wallet,
  X,
} from 'lucide-react'
import { Topbar } from '../components/admin/Topbar'
import { OrderManagement } from '../components/admin/OrderManagement'
import AppointmentCalendar from '../components/appointments/AppointmentCalendar'
import AppointmentForm from '../components/appointments/AppointmentForm'
import AppointmentList from '../components/appointments/AppointmentList'
import AppointmentModal from '../components/appointments/AppointmentModal'
import UnavailableDatesManager from '../components/appointments/UnavailableDatesManager'
import ProjectTaskTracker from '../components/projects/ProjectTaskTracker'
import { PosWorkspace } from '../components/pos/PosWorkspace'
import { useAuth } from '../context/AuthContext'
import { useDebounce } from '../hooks/useDebounce'
import { useSmartPolling } from '../hooks/useSmartPolling'
import { formatCurrency } from '../utils/formatCurrency'
import { hasRole } from '../utils/roles'
import { staffApi } from '../utils/staffApi'
import { normalizeBuilderPart } from '../pages/admin/utils/partHelpers'
import { getStockTier } from '../utils/stockUtils'
import { InventoryTab } from './admin/tabs/InventoryTab'
import { AdjustPartStockModal } from './admin/components/inventory/StockAdjustmentModals'

function EmptyState({ icon: Icon, label, description }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] py-16 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--gold-primary)]/10">
        <Icon className="h-7 w-7 text-[var(--gold-primary)]" />
      </div>
      <p className="font-semibold text-white">{label}</p>
      {description && <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p>}
    </div>
  )
}

function StatusBadge({ label, variant = 'default' }) {
  const cls = {
    default: 'border-gray-500/30 bg-gray-500/20 text-gray-300',
    success: 'border-green-500/30 bg-green-500/20 text-green-300',
    warning: 'border-amber-500/30 bg-amber-500/20 text-amber-300',
    danger: 'border-red-500/30 bg-red-500/20 text-red-300',
    info: 'border-blue-500/30 bg-blue-500/20 text-blue-300',
    gold: 'border-[var(--gold-primary)]/30 bg-[var(--gold-primary)]/20 text-[var(--gold-primary)]',
  }
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${cls[variant] || cls.default}`}>{label}</span>
}

function normalizeArray(payload, key) {
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.data?.[key])) return payload.data[key]
  return []
}

function statusVariant(status) {
  const value = String(status || '').toLowerCase()
  if (['completed', 'paid'].includes(value)) return 'success'
  if (['pending', 'approved', 'confirmed', 'ready_for_pickup'].includes(value)) return 'gold'
  if (['processing', 'in_progress'].includes(value)) return 'info'
  if (['cancelled', 'failed', 'rejected'].includes(value)) return 'danger'
  return 'default'
}

function formatStatusLabel(status) {
  return String(status || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function resolveInventoryImage(item) {
  if (!item) return null
  if (item.primary_image) return item.primary_image
  if (item.image_url) return item.image_url
  if (item.product_image) return item.product_image
  if (item.preview_url) return item.preview_url
  if (item.image) return item.image
  if (Array.isArray(item.images) && item.images.length > 0) {
    const first = item.images[0]
    if (typeof first === 'string') return first
    if (first?.url) return first.url
  }
  return null
}

const ADJUSTMENT_REASONS = [
  ['restocking', 'Restocking'],
  ['received_shipment', 'Received Shipment'],
  ['sale_adjustment', 'Sales Reconciliation'],
  ['damaged_goods', 'Damaged Goods'],
  ['lost_missing', 'Lost or Missing'],
  ['cycle_count', 'Cycle Count Correction'],
  ['other', 'Other'],
]

function AdjustStockModal({ modal, form, setForm, errors, setErrors, onClose, onSave, saving }) {
  const current = Number(modal.data?.stock || 0)
  const quantity = Number(form.quantity || 0)
  const projected = form.change_type === 'stock_in' ? current + quantity : form.change_type === 'stock_out' ? current - quantity : quantity

  const submit = async (event) => {
    event.preventDefault()
    const next = {}
    if (!form.change_type) next.change_type = 'Select a stock action'
    if (form.quantity === '' || form.quantity === undefined) next.quantity = 'Enter a quantity'
    if (form.change_type === 'stock_out' && quantity > current) next.quantity = `Only ${current} units available`
    if (!form.reason) next.reason = 'Select a reason'
    if (Object.keys(next).length) {
      setErrors(next)
      return
    }
    await onSave()
  }

  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="w-full max-w-lg rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Adjust Stock</h2>
          <p className="text-sm text-[var(--text-muted)]">{modal.data?.name}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">ID: {modal.data?.product_id || modal.data?.part_id}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-xl p-2 text-[var(--text-muted)] hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)]/60 p-4">
          <div><p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Current</p><p className="mt-2 text-3xl font-bold text-white">{current}</p></div>
          <div><p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Projected</p><p className={`mt-2 text-3xl font-bold ${projected < 0 ? 'text-red-300' : 'text-[var(--gold-primary)]'}`}>{projected}</p></div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            ['stock_in', 'Stock In', ArrowUpCircle],
            ['stock_out', 'Stock Out', ArrowDownCircle],
            ['adjustment', 'Set Stock', ArrowUpDown],
          ].map(([value, label, Icon]) => (
            <button key={value} type="button" onClick={() => { setForm((p) => ({ ...p, change_type: value })); setErrors((p) => ({ ...p, change_type: null })) }} className={`rounded-2xl border px-3 py-3 text-sm font-semibold ${form.change_type === value ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)] text-black' : 'border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-muted)]'}`}>
              <div className="flex items-center justify-center gap-2"><Icon className="h-4 w-4" /><span>{label}</span></div>
            </button>
          ))}
        </div>
        {errors.change_type && <p className="text-sm text-red-400">{errors.change_type}</p>}
        <input type="number" min="0" value={form.quantity ?? ''} onChange={(e) => { setForm((p) => ({ ...p, quantity: e.target.value })); setErrors((p) => ({ ...p, quantity: null })) }} placeholder={form.change_type === 'adjustment' ? 'New stock level' : 'Quantity'} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3 text-white focus:border-[var(--gold-primary)] focus:outline-none" />
        {errors.quantity && <p className="text-sm text-red-400">{errors.quantity}</p>}
        <select value={form.reason || ''} onChange={(e) => { setForm((p) => ({ ...p, reason: e.target.value })); setErrors((p) => ({ ...p, reason: null })) }} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3 text-white focus:border-[var(--gold-primary)] focus:outline-none">
          <option value="">Select a reason</option>
          {ADJUSTMENT_REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {errors.reason && <p className="text-sm text-red-400">{errors.reason}</p>}
        <textarea rows={3} value={form.notes || ''} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional notes" className="w-full resize-none rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3 text-white focus:border-[var(--gold-primary)] focus:outline-none" />
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-[var(--text-muted)]">Cancel</button>
          <button type="submit" disabled={saving} className="rounded-xl bg-[var(--gold-primary)] px-4 py-2.5 font-semibold text-black disabled:opacity-60">{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </form>
    </motion.div>
  )
}

function ProjectEditModal({ form, setForm, errors, onClose, onSave, saving }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="w-full max-w-lg rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Edit Project</h2>
          <p className="text-sm text-[var(--text-muted)]">Update project details for the team.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-xl p-2 text-[var(--text-muted)] hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
      </div>
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Project Name *</label>
          <input
            type="text"
            value={form.name || form.title || ''}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value, title: e.target.value }))}
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3 text-sm text-white focus:border-[var(--gold-primary)] focus:outline-none"
          />
          {errors.name && <p className="mt-2 text-sm text-red-400">{errors.name}</p>}
        </div>
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Description</label>
          <textarea
            rows={4}
            value={form.description || form.notes || ''}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value, notes: e.target.value }))}
            className="w-full resize-none rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3 text-sm text-white focus:border-[var(--gold-primary)] focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Status</label>
            <select
              value={form.status || 'not_started'}
              onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3 text-sm text-white focus:border-[var(--gold-primary)] focus:outline-none"
            >
              <option value="not_started">Not Started</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--text-muted)]">Progress</p>
            <p className="mt-2 text-sm text-white">Calculated automatically from completed project tasks.</p>
          </div>
        </div>
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Estimated Completion</label>
          <input
            type="date"
            value={form.estimated_completion_date || form.end_date || ''}
            onChange={(e) => setForm((prev) => ({ ...prev, estimated_completion_date: e.target.value, end_date: e.target.value }))}
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3 text-sm text-white focus:border-[var(--gold-primary)] focus:outline-none"
          />
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-[var(--text-muted)]">Cancel</button>
          <button type="button" onClick={onSave} disabled={saving} className="rounded-xl bg-[var(--gold-primary)] px-4 py-2.5 font-semibold text-black disabled:opacity-60">{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>
    </motion.div>
  )
}

export function StaffDashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [toast, setToast] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 300)
  const [projects, setProjects] = useState([])
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [parts, setParts] = useState([])
  const [inventory, setInventory] = useState([])
  const [appointments, setAppointments] = useState([])
  const [services, setServices] = useState([])
  const [inventoryStats, setInventoryStats] = useState(null)
  const [inventoryAlerts, setInventoryAlerts] = useState([])
const [unavailableDates, setUnavailableDates] = useState([])
   const [availableDates, setAvailableDates] = useState([])

   const [loadingInventory, setLoadingInventory] = useState(false)
  const [loadingAppointments, setLoadingAppointments] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const productsRef = useRef(products)
  const partsRef = useRef(parts)
  const inventoryRef = useRef(inventory)
  const inventoryStatsRef = useRef(inventoryStats)
  const inventoryAlertsRef = useRef(inventoryAlerts)

  useEffect(() => { productsRef.current = products }, [products])
  useEffect(() => { partsRef.current = parts }, [parts])
  useEffect(() => { inventoryRef.current = inventory }, [inventory])
  useEffect(() => { inventoryStatsRef.current = inventoryStats }, [inventoryStats])
  useEffect(() => { inventoryAlertsRef.current = inventoryAlerts }, [inventoryAlerts])

  const [inventorySubTab, setInventorySubTab] = useState('products')
  const [productsInventoryFilter, setProductsInventoryFilter] = useState({ search: '', status: 'all', sort: 'name', page: 1 })
  const [partsInventoryFilter, setPartsInventoryFilter] = useState({ search: '', status: 'all', category: 'all', sort: 'name', page: 1 })
  const [inventoryPage, setInventoryPage] = useState(1)
  const INVENTORY_PAGE_SIZE = 10

  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false)
  const [appointmentFormOpen, setAppointmentFormOpen] = useState(false)
  const [appointmentFormData, setAppointmentFormData] = useState(null)
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null)
  const [unavailableDatesOpen, setUnavailableDatesOpen] = useState(false)
  const [appointmentPagination, setAppointmentPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 })

  const [modal, setModal] = useState({ open: false, type: null, data: null })
  const [form, setForm] = useState({})
  const [formErrors, setFormErrors] = useState({})

  const tabs = [
    ['overview', 'Overview', BarChart3],
    ['projects', 'Projects', Briefcase],
    ['orders', 'Orders', ShoppingBag],
    ['inventory', 'Inventory', Package],
    ['appointments', 'Appointments', Calendar],
    ['pos', 'POS', Wallet],
  ]

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
    window.clearTimeout(showToast.timeoutId)
    showToast.timeoutId = window.setTimeout(() => setToast(null), 2600)
  }, [])

  const loadInventoryBundle = useCallback(async (options = {}) => {
    const { silent = false } = options
    if (!silent) setLoadingInventory(true)
    try {
      const [productsRes, partsRes, inventoryRes, summaryRes, alertsRes] = await Promise.all([
        staffApi.getProducts({ search: debouncedSearch, page: 1, pageSize: 200 }),
        staffApi.getBuilderParts({ search: debouncedSearch, page: 1, pageSize: 500 }),
        staffApi.getInventoryProducts({ search: debouncedSearch }),
        staffApi.getInventorySummary(),
        staffApi.getLowStockAlerts({ limit: 8 }),
      ])
      const nextProducts = normalizeArray(productsRes, 'products')
      const nextParts = normalizeArray(partsRes, 'parts')
      const nextInventory = normalizeArray(inventoryRes, 'products')
      const nextStats = summaryRes.data || null
      const nextAlerts = normalizeArray(alertsRes, 'alerts')

      if (JSON.stringify(productsRef.current) !== JSON.stringify(nextProducts)) {
        productsRef.current = nextProducts
        setProducts(nextProducts)
      }
      if (JSON.stringify(partsRef.current) !== JSON.stringify(nextParts)) {
        partsRef.current = nextParts
        setParts(nextParts)
      }
      if (JSON.stringify(inventoryRef.current) !== JSON.stringify(nextInventory)) {
        inventoryRef.current = nextInventory
        setInventory(nextInventory)
      }
      if (JSON.stringify(inventoryStatsRef.current) !== JSON.stringify(nextStats)) {
        inventoryStatsRef.current = nextStats
        setInventoryStats(nextStats)
      }
      if (JSON.stringify(inventoryAlertsRef.current) !== JSON.stringify(nextAlerts)) {
        inventoryAlertsRef.current = nextAlerts
        setInventoryAlerts(nextAlerts)
      }
    } catch (error) {
      if (!silent) showToast(error.message, 'error')
      throw error
    } finally {
      if (!silent) setLoadingInventory(false)
    }
  }, [debouncedSearch, showToast])

  const fetchProjects = useCallback(async () => {
    try {
      const res = await staffApi.getAllProjects({ search: debouncedSearch })
      setProjects(normalizeArray(res, 'projects'))
    } catch (error) {
      showToast(error.message, 'error')
    }
  }, [debouncedSearch, showToast])

  const fetchOrders = useCallback(async () => {
    try {
      const res = await staffApi.getOrders({ search: debouncedSearch, include_items: true })
      setOrders(normalizeArray(res, 'orders'))
    } catch (error) {
      showToast(error.message, 'error')
    }
  }, [debouncedSearch, showToast])

  const fetchServices = useCallback(async () => {
    try {
      const res = await staffApi.getServices()
      setServices(normalizeArray(res, 'services'))
    } catch (error) {
      showToast(error.message, 'error')
    }
  }, [showToast])

const fetchUnavailableDates = useCallback(async () => {
     try {
       const res = await staffApi.getUnavailableDates()
       setUnavailableDates(res.data?.unavailable_dates || [])
     } catch (error) {
       showToast(error.message, 'error')
     }
   }, [showToast])

   const fetchAvailableDates = useCallback(async () => {
     try {
       const today = new Date()
       const dateFrom = today.toISOString().slice(0, 10)
       const dateTo = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
       const res = await staffApi.getAvailableDates(dateFrom, dateTo)
       setAvailableDates(res.data?.available_dates || [])
     } catch (error) {
       console.error('Failed to fetch available dates:', error)
     }
   }, [])

   const fetchAppointments = useCallback(async () => {
    setLoadingAppointments(true)
    try {
      const res = await staffApi.getAppointments({
        search: debouncedSearch,
        limit: appointmentPagination.limit,
        offset: (appointmentPagination.page - 1) * appointmentPagination.limit,
      })
      const rows = normalizeArray(res, 'appointments')
      const total = res.data?.pagination?.total || rows.length
      const pages = res.data?.pagination?.pages || Math.max(Math.ceil(total / appointmentPagination.limit), 1)
      setAppointments(rows)
      setAppointmentPagination((p) => ({ ...p, total, pages }))
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setLoadingAppointments(false)
    }
  }, [appointmentPagination.limit, appointmentPagination.page, debouncedSearch, showToast])

  useEffect(() => {
    if (activeTab === 'overview') { fetchProjects(); fetchOrders(); fetchAppointments(); loadInventoryBundle() }
    if (activeTab === 'projects') fetchProjects()
    if (activeTab === 'orders') fetchOrders()
    if (activeTab === 'inventory' || activeTab === 'pos') loadInventoryBundle()
    if (activeTab === 'appointments') { fetchAppointments(); fetchServices(); fetchUnavailableDates() }
    if (activeTab === 'schedule') { fetchAppointments(); fetchProjects() }
  }, [activeTab, fetchAppointments, fetchOrders, fetchProjects, fetchServices, fetchUnavailableDates, loadInventoryBundle])

  useSmartPolling(useCallback(async () => {
    if (activeTab === 'overview') { await Promise.all([fetchAppointments(), loadInventoryBundle()]); return }
    if (activeTab === 'inventory' || activeTab === 'pos') { await loadInventoryBundle(); return }
    if (activeTab === 'appointments' || activeTab === 'schedule') { await Promise.all([fetchAppointments(), fetchUnavailableDates()]) }
  }, [activeTab, fetchAppointments, fetchUnavailableDates, loadInventoryBundle]), { interval: 10000, maxInterval: 60000, backoffFactor: 1.5, enabled: true })

  const visibleInventory = useMemo(() => {
    const lookup = Object.fromEntries(products.map((item) => [item.product_id, item]))
    return (inventory.length ? inventory : products).map((item) => ({ ...(lookup[item.product_id] || {}), ...item, stock: Number(item.stock || 0), low_stock_threshold: Number(item.low_stock_threshold || 10), price: Number(item.price || lookup[item.product_id]?.price || 0) }))
  }, [inventory, products])

  const visibleParts = useMemo(() => (parts || []).map((part) => normalizeBuilderPart(part)), [parts])

  const inventoryIsProducts = inventorySubTab === 'products'
  const inventoryCurrentFilter = inventoryIsProducts ? productsInventoryFilter : partsInventoryFilter
  const inventoryPartCategoryOptions = useMemo(() => {
    const presentCategories = new Set((visibleParts || []).map((part) => part.inventory_category).filter(Boolean))
    return [
      { value: 'body', label: 'Body' },
      { value: 'neck', label: 'Neck' },
      { value: 'pickups', label: 'Pickups' },
      { value: 'hardware', label: 'Hardware' },
      { value: 'electronics', label: 'Electronics' },
      { value: 'accessories', label: 'Accessories' },
    ].filter(({ value }) => presentCategories.has(value))
  }, [visibleParts])

  const filteredProductsInventory = useMemo(() => {
    const prods = visibleInventory.map(p => ({ ...p, type: 'product', stock: p.stock, name: p.name, sku: p.sku, low_stock_threshold: p.low_stock_threshold, part_id: p.product_id }))
    let result = [...prods]
    const searchTerm = String(productsInventoryFilter.search || '').trim().toLowerCase()
    if (searchTerm) {
      result = result.filter((item) =>
        String(item.name || '').toLowerCase().includes(searchTerm) ||
        String(item.sku || '').toLowerCase().includes(searchTerm)
      )
    }
    const statusFilter = productsInventoryFilter.status
    if (statusFilter !== 'all') {
      result = result.filter(item => {
        const stock = Number(item.stock ?? 0)
        const threshold = Number(item.low_stock_threshold ?? 10)
        const tier = getStockTier(stock, threshold, item.max_stock)
        if (statusFilter === 'out_of_stock') return tier === 'out_of_stock'
        if (statusFilter === 'critical') return tier === 'critical'
        if (statusFilter === 'warning') return tier === 'warning'
        if (statusFilter === 'healthy') return tier === 'healthy'
        return true
      })
    }
    result.sort((a, b) => {
      if (productsInventoryFilter.sort === 'name') return (a.name || '').localeCompare(b.name || '')
      if (productsInventoryFilter.sort === 'sku') return (a.sku || '').localeCompare(b.sku || '')
      if (productsInventoryFilter.sort === 'stock_low') return Number(a.stock || 0) - Number(b.stock || 0)
      if (productsInventoryFilter.sort === 'stock_high') return Number(b.stock || 0) - Number(a.stock || 0)
      return 0
    })
    return result
  }, [visibleInventory, productsInventoryFilter])

  const paginatedProductsInventory = useMemo(() => {
    const start = (inventoryPage - 1) * INVENTORY_PAGE_SIZE
    return filteredProductsInventory.slice(start, start + INVENTORY_PAGE_SIZE)
  }, [filteredProductsInventory, inventoryPage])

  const filteredPartsInventory = useMemo(() => {
    const pts = visibleParts.map((p) => ({
      ...p,
      type: 'part',
      stock: Number(p.stock ?? p.quantity ?? 0),
      name: p.name,
      sku: p.type_mapping,
      low_stock_threshold: 10,
    }))
    let result = [...pts]
    const searchTerm = String(partsInventoryFilter.search || '').trim().toLowerCase()
    if (searchTerm) {
      result = result.filter((item) =>
        String(item.name || '').toLowerCase().includes(searchTerm) ||
        String(item.sku || '').toLowerCase().includes(searchTerm) ||
        String(item.inventory_category || '').toLowerCase().includes(searchTerm)
      )
    }
    const categoryFilter = partsInventoryFilter.category || 'all'
    if (categoryFilter !== 'all') {
      result = result.filter((item) => item.inventory_category === categoryFilter)
    }
    const statusFilter = partsInventoryFilter.status
    if (statusFilter !== 'all') {
      result = result.filter(item => {
        const stock = Number(item.stock ?? 0)
        const threshold = 10
        const tier = getStockTier(stock, threshold, 0)
        if (statusFilter === 'out_of_stock') return tier === 'out_of_stock'
        if (statusFilter === 'critical') return tier === 'critical'
        if (statusFilter === 'warning') return tier === 'warning'
        if (statusFilter === 'healthy') return tier === 'healthy'
        return true
      })
    }
    result.sort((a, b) => {
      const categoryCompare = (a.inventory_category || '').localeCompare(b.inventory_category || '')
      if (categoryCompare !== 0) return categoryCompare
      if (partsInventoryFilter.sort === 'name') return (a.name || '').localeCompare(b.name || '')
      if (partsInventoryFilter.sort === 'sku') return (a.sku || '').localeCompare(b.sku || '')
      if (partsInventoryFilter.sort === 'stock_low') return Number(a.stock || 0) - Number(b.stock || 0)
      if (partsInventoryFilter.sort === 'stock_high') return Number(b.stock || 0) - Number(a.stock || 0)
      return 0
    })
    return result
  }, [visibleParts, partsInventoryFilter])

  const paginatedPartsInventory = useMemo(() => {
    const start = (inventoryPage - 1) * INVENTORY_PAGE_SIZE
    return filteredPartsInventory.slice(start, start + INVENTORY_PAGE_SIZE)
  }, [filteredPartsInventory, inventoryPage])

  const inventoryCurrentRows = inventoryIsProducts ? filteredProductsInventory : filteredPartsInventory
  const inventoryTotalPages = Math.max(1, Math.ceil(inventoryCurrentRows.length / INVENTORY_PAGE_SIZE))
  const inventoryCurrentPageRows = inventoryIsProducts ? paginatedProductsInventory : paginatedPartsInventory
  const inventoryGroupedPartPageRows = useMemo(() => {
    if (inventoryIsProducts) return []
    let previousCategory = null
    return inventoryCurrentPageRows.flatMap((item) => {
      const category = item.inventory_category || 'accessories'
      const rows = []
      if (category !== previousCategory) {
        rows.push({ type: 'group', category })
        previousCategory = category
      }
      rows.push({ type: 'item', item })
      return rows
    })
  }, [inventoryCurrentPageRows, inventoryIsProducts])
  const pendingAppointments = appointments.filter((item) => ['pending', 'approved', 'confirmed', 'ready_for_pickup'].includes(String(item.status || '').toLowerCase()))
  const todayAppointments = appointments.filter((item) => item.scheduled_at && new Date(item.scheduled_at).toDateString() === new Date().toDateString())

  const refreshCurrentTab = useCallback(async () => {
    setRefreshing(true)
    try {
      if (activeTab === 'overview') await Promise.all([fetchProjects(), fetchOrders(), fetchAppointments(), loadInventoryBundle()])
      if (activeTab === 'projects') await fetchProjects()
      if (activeTab === 'orders') await fetchOrders()
      if (activeTab === 'inventory' || activeTab === 'pos') await loadInventoryBundle()
      if (activeTab === 'appointments') await Promise.all([fetchAppointments(), fetchServices(), fetchUnavailableDates()])
      if (activeTab === 'schedule') await Promise.all([fetchAppointments(), fetchProjects()])
    } finally {
      setRefreshing(false)
    }
  }, [activeTab, fetchAppointments, fetchOrders, fetchProjects, fetchServices, fetchUnavailableDates, loadInventoryBundle])

  const saveStockAdjust = useCallback(async () => {
    setIsSaving(true)
    try {
      const productId = form.product_id || modal.data?.product_id
      const partId = form.part_id || modal.data?.part_id
      const quantity = Number(form.quantity || 0)
      const current = Number(modal.data?.stock || 0)
      const notes = [form.reason, form.notes].filter(Boolean).join(' - ')
      
      if (partId) {
        if (form.change_type === 'stock_in') await staffApi.updateBuilderPart(partId, { stock: current + quantity })
        else if (form.change_type === 'stock_out') await staffApi.updateBuilderPart(partId, { stock: Math.max(0, current - quantity) })
        else await staffApi.updateBuilderPart(partId, { stock: quantity })
      } else if (productId) {
        if (form.change_type === 'stock_in') await staffApi.addStock({ product_id: productId, quantity, notes })
        else if (form.change_type === 'stock_out') await staffApi.deductStock({ product_id: productId, quantity, notes })
        else await staffApi.adjustStock({ product_id: productId, quantity: quantity - current, notes })
      } else {
        throw new Error('No product or part ID specified')
      }
      setModal({ open: false, type: null, data: null })
      setForm({})
      await loadInventoryBundle()
      showToast('Inventory updated')
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }, [form, loadInventoryBundle, modal.data, showToast])

  const updatePartStock = useCallback(async (part, delta) => {
    try {
      await staffApi.updateBuilderPart(part.part_id, { ...part, stock: Math.max(0, Number(part.stock || 0) + delta) })
      await loadInventoryBundle()
      showToast('Builder part stock updated')
    } catch (error) {
      showToast(error.message, 'error')
    }
  }, [loadInventoryBundle, showToast])

  const updateAppointmentStatus = useCallback(async (id, status, reason) => {
    try { await staffApi.updateAppointmentStatus(id, status, reason); showToast('Appointment status updated'); await fetchAppointments() } catch (error) { showToast(error.message, 'error') }
  }, [fetchAppointments, showToast])
  const rescheduleAppointment = useCallback(async (id, scheduledAt, reason) => {
    try { await staffApi.rescheduleAppointment(id, scheduledAt, reason); showToast('Appointment rescheduled'); await fetchAppointments() } catch (error) { showToast(error.message, 'error') }
  }, [fetchAppointments, showToast])
  const cancelAppointment = useCallback(async (id, reason) => {
    try { await staffApi.cancelAppointment(id, reason); showToast('Appointment cancelled'); await fetchAppointments() } catch (error) { showToast(error.message, 'error') }
  }, [fetchAppointments, showToast])
  const updateAppointmentPaymentStatus = useCallback(async (id, paymentStatus) => {
    try { await staffApi.updateAppointmentPaymentStatus(id, paymentStatus); showToast('Payment status updated'); await fetchAppointments() } catch (error) { showToast(error.message, 'error') }
  }, [fetchAppointments, showToast])
  const submitAppointment = useCallback(async (payload) => {
    try {
      if (appointmentFormData?.appointment_id) await staffApi.updateAppointment(appointmentFormData.appointment_id, payload)
      else await staffApi.createAppointment(payload)
      showToast(appointmentFormData?.appointment_id ? 'Appointment updated' : 'Appointment created')
      await fetchAppointments()
    } catch (error) {
      showToast(error.message, 'error')
      throw error
    }
  }, [appointmentFormData, fetchAppointments, showToast])

  const closeStaffModal = useCallback(() => {
    setModal({ open: false, type: null, data: null })
    setForm({})
    setFormErrors({})
  }, [])

  const saveProject = useCallback(async () => {
    const nextErrors = {}
    if (!String(form.name || form.title || '').trim()) nextErrors.name = 'Project name is required'
    if (Object.keys(nextErrors).length) {
      setFormErrors(nextErrors)
      return
    }

    setIsSaving(true)
    try {
      await staffApi.updateProject(modal.data.project_id, {
        name: String(form.name || form.title || '').trim(),
        title: String(form.title || form.name || '').trim(),
        description: form.description || form.notes || '',
        notes: form.notes || form.description || '',
        status: form.status || 'not_started',
        estimated_completion_date: form.estimated_completion_date || null,
      })
      showToast('Project updated')
      await fetchProjects()
      closeStaffModal()
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }, [closeStaffModal, fetchProjects, form, modal.data, showToast])

  const isSuperAdmin = hasRole(user?.role, 'admin')

  const openModal = (type, data = null) => {
    if (type === 'inventory') {
      setForm({ product_id: data?.product_id, quantity: '', change_type: '', reason: '', notes: '' })
      setFormErrors({})
      setModal({ open: true, type: 'inventory', data: { product_id: data?.product_id, name: data?.name, stock: data?.stock } })
    } else if (type === 'part_inventory') {
      setForm({ part_id: data?.part_id, quantity: '', change_type: '', reason: '', notes: '' })
      setFormErrors({})
      setModal({ open: true, type: 'part_inventory', data })
    }
  }

  const savePartStockAdjust = useCallback(async (overrideForm = {}) => {
    setIsSaving(true)
    try {
      const { part_id, change_type, quantity } = { ...form, ...overrideForm }
      if (!part_id || !change_type || !quantity) {
        showToast('Please fill all required fields', 'error'); return
      }
      const existingPart = visibleParts.find((part) => part.part_id === part_id)
      const currentStock = Number(existingPart?.stock ?? existingPart?.quantity ?? form.current_stock ?? 0) || 0
      const qty = Number(quantity)
      let nextStock = currentStock
      if (change_type === 'stock_in') nextStock = currentStock + qty
      else if (change_type === 'stock_out') nextStock = currentStock - qty
      else nextStock = qty
      if (nextStock < 0) {
        showToast('Stock cannot be negative', 'error')
        return
      }
      await staffApi.updateBuilderPart(part_id, { stock: nextStock })
      showToast('Guitar part stock adjusted!')
      await loadInventoryBundle()
      closeStaffModal()
    } catch (e) { showToast(e.message, 'error') }
    finally { setIsSaving(false) }
  }, [form, loadInventoryBundle, showToast, visibleParts])

  const pageTitle = tabs.find(([id]) => id === activeTab)?.[1] || 'Staff Dashboard'

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -24 }} className={`fixed right-6 top-24 z-[200] flex items-center gap-3 rounded-2xl border px-5 py-3 text-sm font-semibold ${toast.type === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-green-500/30 bg-green-500/10 text-green-300'}`}>
            {toast.type === 'error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex min-h-screen">
        <aside className={`${sidebarCollapsed ? 'w-24' : 'w-72'} border-r border-[var(--border)] bg-[var(--surface-dark)] transition-all`}>
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-5">
            {!sidebarCollapsed && <div><p className="text-xs uppercase tracking-[0.28em] text-[var(--text-muted)]">CosmosCraft</p><h2 className="mt-2 text-xl font-bold text-white">Staff Hub</h2></div>}
            <button type="button" onClick={() => setSidebarCollapsed((p) => !p)} className="rounded-xl border border-[var(--border)] p-2 text-[var(--text-muted)]">{sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</button>
          </div>
          <nav className="space-y-2 p-4">
            {tabs.map(([id, label, Icon]) => <button key={id} type="button" onClick={() => setActiveTab(id)} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left ${activeTab === id ? 'bg-[var(--gold-primary)] text-black' : 'text-[var(--text-muted)] hover:bg-white/5 hover:text-white'}`}><Icon className="h-5 w-5" />{!sidebarCollapsed && <span className="font-medium">{label}</span>}</button>)}
          </nav>
        </aside>
        <div className="flex min-h-screen flex-1 flex-col">
          <Topbar title={pageTitle} userRole={user?.role || 'staff'} />
          <main className="flex-1 p-6">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

            </div>
            {activeTab === 'overview' && <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-6"><p className="text-sm text-[var(--text-muted)]">Open projects</p><p className="mt-3 text-3xl font-bold text-white">{projects.filter((p) => p.status !== 'completed').length}</p></div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-6"><p className="text-sm text-[var(--text-muted)]">Pending appointments</p><p className="mt-3 text-3xl font-bold text-white">{pendingAppointments.length}</p></div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-6"><p className="text-sm text-[var(--text-muted)]">Today&apos;s schedule</p><p className="mt-3 text-3xl font-bold text-white">{todayAppointments.length}</p></div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-6"><p className="text-sm text-[var(--text-muted)]">Low stock alerts</p><p className="mt-3 text-3xl font-bold text-white">{inventoryAlerts.length}</p></div>
              </div>
               <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
                 <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-6">
                   <div className="mb-5 flex items-center justify-between"><h3 className="text-lg font-semibold text-white">Upcoming appointments</h3><button type="button" onClick={() => setActiveTab('appointments')} className="text-sm font-medium text-[var(--gold-primary)]">View all</button></div>
                   {appointments.length === 0 ? <EmptyState icon={Calendar} label="No appointments queued" description="New bookings will appear here." /> : <div className="space-y-3">{appointments.slice(0, 5).map((item) => <button key={item.appointment_id} type="button" onClick={() => { setSelectedAppointment(item); setAppointmentModalOpen(true) }} className="flex w-full items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)]/60 p-4 text-left"><div><p className="font-semibold text-white">{item.customer_name || item.user_name || ''}</p><p className="mt-1 text-sm text-[var(--text-muted)]">{item.service_name || (Array.isArray(item.services) ? item.services.join(', ') : 'Service appointment')}</p></div><StatusBadge label={formatStatusLabel(item.status || 'pending')} variant={statusVariant(item.status)} /></button>)}</div>}
                 </div>
                 <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-6"><h3 className="text-lg font-semibold text-white">Unread stock alerts</h3><div className="mt-4 space-y-3">{inventoryAlerts.length === 0 ? <p className="text-sm text-[var(--text-muted)]">No low-stock alerts right now.</p> : inventoryAlerts.slice(0, 5).map((alert) => <div key={alert.alert_id} className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4"><p className="font-semibold text-white">{alert.name}</p><p className="mt-1 text-sm text-[var(--text-muted)]">{alert.current_stock} left, threshold {alert.threshold}</p></div>)}</div></div>
               </div>
               <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-6">
                 <h3 className="text-lg font-semibold text-white">Upcoming schedule</h3>
                 <div className="mt-4 grid gap-6 lg:grid-cols-2">
                   <div>
                     <h4 className="text-sm font-semibold text-[var(--text-muted)] mb-3">Appointments</h4>
                     {appointments.length === 0 ? <p className="text-sm text-[var(--text-muted)]">No upcoming appointments.</p> : <div className="space-y-3">{appointments.slice(0, 5).map((item) => <div key={item.appointment_id} className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)]/60 p-4"><div><p className="font-semibold text-white">{item.customer_name || item.user_name || 'Service customer'}</p><p className="mt-1 text-sm text-[var(--text-muted)]">{item.scheduled_at ? new Date(item.scheduled_at).toLocaleString() : 'TBD'}</p></div><StatusBadge label={item.status || 'pending'} variant={statusVariant(item.status)} /></div>)}</div>}
                   </div>
                   <div>
                     <h4 className="text-sm font-semibold text-[var(--text-muted)] mb-3">Project deadlines</h4>
                     {projects.filter((item) => item.estimated_completion_date).length === 0 ? <p className="text-sm text-[var(--text-muted)]">No project deadlines available.</p> : <div className="space-y-3">{projects.filter((item) => item.estimated_completion_date).slice(0, 5).map((item) => <div key={item.project_id} className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)]/60 p-4"><div><p className="font-semibold text-white">{item.name || item.title}</p><p className="mt-1 text-sm text-[var(--text-muted)]">Due {new Date(item.estimated_completion_date).toLocaleDateString()}</p></div><StatusBadge label={item.status || 'pending'} variant={statusVariant(item.status)} /></div>)}</div>}
                   </div>
                 </div>
               </div>
             </div>}
            {activeTab === 'projects' && (
              <motion.div key="projects" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-6">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <h2 className="text-white text-xl font-semibold">Projects</h2>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">
                        Open a project to review progress, milestones, and subtasks for the build.
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3">
                        <p className="text-[var(--text-muted)] text-sm">Total</p>
                        <p className="text-white text-lg font-semibold">{projects.length}</p>
                      </div>
                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3">
                        <p className="text-[var(--text-muted)] text-sm">In Progress</p>
                        <p className="text-white text-lg font-semibold">{projects.filter((project) => project.status === 'in_progress').length}</p>
                      </div>
                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3">
                        <p className="text-[var(--text-muted)] text-sm">Completed</p>
                        <p className="text-white text-lg font-semibold">{projects.filter((project) => project.status === 'completed').length}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {projects.length === 0 ? (
                  <EmptyState icon={Briefcase} label="No projects assigned" description="Project work will appear here when it is assigned to staff." />
                ) : (
                  <div className="grid gap-6 xl:grid-cols-2">
                    {projects.map((project) => {
                      const status = String(project.status || 'not_started').toLowerCase()
                      const progress = Number.isFinite(Number(project.progress)) ? Math.max(0, Math.min(100, Number(project.progress))) : 0
                      const statusClass = {
                        not_started: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
                        in_progress: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
                        completed: 'bg-green-500/10 text-green-300 border-green-500/30',
                      }[status] || 'bg-slate-500/10 text-slate-300 border-slate-500/30'

                      return (
                        <div key={project.project_id} className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.12)]">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-[var(--gold-primary)] text-xs font-semibold uppercase tracking-[0.25em]">
                                {project.order_number || 'Project'}
                              </p>
                              <h3 className="mt-2 truncate text-xl font-semibold text-white">
                                {project.name || project.title || 'Untitled Project'}
                              </h3>
                               <p className="mt-2 text-sm text-[var(--text-muted)]">
                                 Customer: <span className="text-white">{project.client_name || project.customer_name || 'Unassigned'}</span>
                               </p>
                               <p className="mt-2 text-sm text-[var(--text-muted)]">
                                 Claimed By: <span className="text-white">{project.claimed_first_name ? `${project.claimed_first_name} ${project.claimed_last_name}` : 'Unassigned'}</span>
                               </p>
                             </div>
                            <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusClass}`}>
                              {formatStatusLabel(status)}
                            </span>
                          </div>

                          <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-sm text-[var(--text-muted)]">Progress</span>
                              <span className="text-sm font-semibold text-white">{progress}%</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-dark)]">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)]"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>

                          <div className="mt-5 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
                              <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Estimated completion</p>
                              <p className="mt-2 font-medium text-white">
                                {project.estimated_completion_date ? new Date(project.estimated_completion_date).toLocaleDateString() : 'Not set'}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
                              <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Notes</p>
                              <p className="mt-2 line-clamp-2 text-sm text-white">
                                {project.description || project.notes || 'No project notes yet.'}
                              </p>
                            </div>
                          </div>

                          <div className="mt-5 flex flex-wrap gap-3">
                            {!project.claimed_by ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await staffApi.claimProject(project.project_id);
                                    showToast('Project claimed successfully');
                                    await fetchProjects();
                                  } catch (error) {
                                    showToast(error.message, 'error');
                                  }
                                }}
                                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] px-4 py-2.5 text-sm font-semibold text-black transition-all hover:shadow-[0_0_20px_rgba(212,175,55,0.35)]"
                              >
                                <Hand className="w-4 h-4" />
                                Claim Task
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setModal({ open: true, type: 'project_tasks', data: project })}
                                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] px-4 py-2.5 text-sm font-semibold text-black transition-all hover:shadow-[0_0_20px_rgba(212,175,55,0.35)]"
                              >
                                <CheckCircle className="w-4 h-4" />
                                {project.claimed_by === user?.id ? 'My Tasks' : 'View Tasks'}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setForm({
                                  ...project,
                                  name: project.name || project.title || '',
                                  title: project.title || project.name || '',
                                  description: project.description || project.notes || '',
                                  notes: project.notes || project.description || '',
                                  estimated_completion_date: project.estimated_completion_date ? String(project.estimated_completion_date).slice(0, 10) : '',
                                })
                                setFormErrors({})
                                setModal({ open: true, type: 'project', data: project })
                              }}
                              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)]"
                            >
                              <Edit className="w-4 h-4" />
                              Edit
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </motion.div>
            )}
            {activeTab === 'orders' && <OrderManagement orders={orders} onRefresh={fetchOrders} user={user} />}
            {activeTab === 'inventory' && <InventoryTab
              inventoryIsProducts={inventoryIsProducts}
              inventorySubTab={inventorySubTab}
              setInventorySubTab={setInventorySubTab}
              inventoryCurrentFilter={inventoryCurrentFilter}
              inventoryPartCategoryOptions={inventoryPartCategoryOptions}
              inventoryCurrentPageRows={inventoryCurrentPageRows}
              inventoryGroupedPartPageRows={inventoryGroupedPartPageRows}
              inventoryCurrentRows={inventoryCurrentRows}
              inventoryTotalPages={inventoryTotalPages}
              inventoryPage={inventoryPage}
              setInventoryPage={setInventoryPage}
              inventoryPageSize={INVENTORY_PAGE_SIZE}
              setProductsInventoryFilter={setProductsInventoryFilter}
              setPartsInventoryFilter={setPartsInventoryFilter}
              resolveInventoryImage={resolveInventoryImage}
              openModal={openModal}
              isSuperAdmin={isSuperAdmin}
            />}
            {activeTab === 'appointments' && <div className="space-y-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><h3 className="text-lg font-semibold text-white">Appointment desk</h3><p className="text-sm text-[var(--text-muted)]">Staff uses the same appointment action model as admin now.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setUnavailableDatesOpen(true)} className="inline-flex items-center gap-2 rounded-2xl bg-[var(--surface-dark)] px-4 py-2.5 text-sm font-semibold text-white"><CalendarX className="h-4 w-4" />Mark unavailable</button><button type="button" onClick={() => { setAppointmentFormData(null); setSelectedCalendarDate(null); setAppointmentFormOpen(true) }} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] px-4 py-2.5 text-sm font-semibold text-black"><Plus className="h-4 w-4" />New appointment</button></div></div><AppointmentCalendar appointments={appointments} unavailableDates={unavailableDates.map((entry) => entry?.date || entry).filter(Boolean)} isAdminMode onAppointmentClick={(item) => { setSelectedAppointment(item); setAppointmentModalOpen(true) }} onCreateAppointment={(_, date) => { setSelectedCalendarDate(date); setAppointmentFormData(null); setAppointmentFormOpen(true) }} /><div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-6"><AppointmentList appointments={appointments} loading={loadingAppointments} onRefresh={fetchAppointments} onViewDetails={(item) => { setSelectedAppointment(item); setAppointmentModalOpen(true) }} onEdit={(item) => { setAppointmentFormData(item); setAppointmentFormOpen(true) }} onCreateNew={() => { setAppointmentFormData(null); setAppointmentFormOpen(true) }} pagination={appointmentPagination} onPageChange={(page) => setAppointmentPagination((p) => ({ ...p, page }))} selectedDate={selectedCalendarDate} /></div></div>}
            {activeTab === 'pos' && (
              <PosWorkspace
                inventoryItems={visibleInventory}
                showToast={showToast}

              />
            )}
           </main>
        </div>
      </div>
      <AnimatePresence>
        {modal.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) closeStaffModal() }}
          >
             {modal.type === 'inventory' && (
               <AdjustStockModal
                 modal={modal}
                 form={form}
                 setForm={setForm}
                 errors={formErrors}
                 setErrors={setFormErrors}
                 onClose={closeStaffModal}
                 onSave={saveStockAdjust}
                 saving={isSaving}
               />
             )}
             {modal.type === 'part_inventory' && (
               <AdjustPartStockModal
                 modal={modal}
                 form={form}
                 setForm={setForm}
                 formErrors={formErrors}
                 setFormErrors={setFormErrors}
                 closeModal={closeStaffModal}
                 isSaving={isSaving}
                 savePartStockAdjust={savePartStockAdjust}
               />
             )}
            {modal.type === 'project' && (
              <ProjectEditModal
                form={form}
                setForm={setForm}
                errors={formErrors}
                onClose={closeStaffModal}
                onSave={saveProject}
                saving={isSaving}
              />
            )}
            {modal.type === 'project_tasks' && modal.data && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="h-[90vh] w-full max-w-6xl overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-6 shadow-2xl"
              >
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">Project Tasks</h2>
                    <p className="text-sm text-[var(--text-muted)]">{modal.data.name || modal.data.title || 'Project'}</p>
                  </div>
                  <button type="button" onClick={closeStaffModal} className="rounded-xl p-2 text-[var(--text-muted)] hover:bg-white/10 hover:text-white">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <ProjectTaskTracker
                  projectId={modal.data.project_id}
                  projectName={modal.data.name || modal.data.title}
                  isAdmin={false}
                  projectData={modal.data}
                />
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <AppointmentModal isOpen={appointmentModalOpen} onClose={() => { setAppointmentModalOpen(false); setSelectedAppointment(null) }} appointment={selectedAppointment} onStatusChange={updateAppointmentStatus} onReschedule={rescheduleAppointment} onCancel={cancelAppointment} onPaymentStatusUpdate={updateAppointmentPaymentStatus} loading={loadingAppointments} />
      <AppointmentForm isOpen={appointmentFormOpen} onClose={() => { setAppointmentFormOpen(false); setAppointmentFormData(null); setSelectedCalendarDate(null) }} onSubmit={submitAppointment} initialData={appointmentFormData} services={services} users={[]} loading={loadingAppointments} selectedDate={selectedCalendarDate} />
      <UnavailableDatesManager isOpen={unavailableDatesOpen} onClose={() => setUnavailableDatesOpen(false)} unavailableDates={unavailableDates} onAddUnavailable={async (date, reason) => { try { await staffApi.addUnavailableDate({ date, reason }); showToast('Date marked unavailable'); await fetchUnavailableDates() } catch (error) { showToast(error.message, 'error') } }} onRemoveUnavailable={async (id) => { try { await staffApi.removeUnavailableDate(id); showToast('Date reopened'); await fetchUnavailableDates() } catch (error) { showToast(error.message, 'error') } }} loading={loadingAppointments} />
    </div>
  )
}

export default StaffDashboard
