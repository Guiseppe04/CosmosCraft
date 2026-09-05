import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Activity,
  AlertCircle,
  BarChart3,
  Briefcase,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Package,
  Plus,
  RefreshCw,
  ShoppingBag,
  Wallet,
  X,
  Truck,
} from 'lucide-react'
import { Topbar } from '../components/admin/Topbar'
import { useAuth } from '../context/AuthContext'
import { useDebounce } from '../hooks/useDebounce'
import { useSmartPolling } from '../hooks/useSmartPolling'
import { formatCurrency } from '../utils/formatCurrency'
import { hasRole } from '../utils/roles'
import { adminApi } from '../utils/adminApi'
import { staffApi } from '../utils/staffApi'
import { getStockTier } from '../utils/stockUtils'
import { buildCategoryTree } from './admin/utils/categoryTree'
import {
  normalizeBuilderPart,
  deriveInventoryPartCategory,
  normalizeInventoryPartCategory,
} from './admin/utils/partHelpers'
import {
  INVENTORY_PART_CATEGORY_LABELS,
  PROJECT_RULES,
  validate,
} from './admin/constants/adminOptions'
import { DashboardTab } from './admin/tabs/DashboardTab'
import { ProjectsTab } from './admin/tabs/ProjectsTab'
import { OrdersTab } from './admin/tabs/OrdersTab'
import { InventoryTab } from './admin/tabs/InventoryTab'
import { AppointmentsTab } from './admin/tabs/AppointmentsTab'
import { PosWorkspace } from '../components/pos/PosWorkspace'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { ProjectTasksModal } from './admin/components/modals/ProjectTasksModal'
import { ProjectModal } from './admin/components/modals/ProjectModal'
import { AdjustStockModal, AdjustPartStockModal } from './admin/components/inventory/StockAdjustmentModals'
import AppointmentModal from '../components/appointments/AppointmentModal'
import AppointmentForm from '../components/appointments/AppointmentForm'
import UnavailableDatesManager from '../components/appointments/UnavailableDatesManager'

function normalizeArray(payload, key) {
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.data?.[key])) return payload.data[key]
  if (Array.isArray(payload?.[key])) return payload[key]
  return []
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

const inputCls =
  'w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-2xl px-4 py-3 text-sm text-[var(--text-light)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] transition-all'
const labelCls = 'block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2'

export function StaffDashboard() {
  const { user } = useAuth()
  const isSuperAdmin = hasRole(user?.role, 'admin')

  const [activeTab, setActiveTab] = useState('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState(null)

  // ── Toast System ──────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState([])
  const toastTimersRef = useRef(new Map())

  const showToast = useCallback((msg, type = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setToasts((prev) => [...prev, { id, msg, type }])

    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
      toastTimersRef.current.delete(id)
    }, 3500)

    toastTimersRef.current.set(id, timer)
  }, [])

  const dismissToast = useCallback((id) => {
    const timer = toastTimersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      toastTimersRef.current.delete(id)
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  useEffect(() => () => {
    toastTimersRef.current.forEach((timer) => clearTimeout(timer))
    toastTimersRef.current.clear()
  }, [])

  // ── Search & Filter State ────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 300)

  // ── Data Entities ─────────────────────────────────────────────────────────
  const [projects, setProjects] = useState([])
  const [projectsPagination, setProjectsPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 })
  const [archivedProjects, setArchivedProjects] = useState([])
  const [archivedProjectsPagination, setArchivedProjectsPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 })
  const [projectArchiveTab, setProjectArchiveTab] = useState('active')

  const [orders, setOrders] = useState([])
  const [ordersPagination, setOrdersPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 })
  const [ordersLoading, setOrdersLoading] = useState(false)
  const ordersRef = useRef(orders)
  const ordersPaginationRef = useRef(ordersPagination)
  const inFlightOrderRequestsRef = useRef(new Map())
  const activeOrderRequestKeyRef = useRef(null)
  const lastOrderQueryRef = useRef({})

  const [products, setProducts] = useState([])
  const [parts, setParts] = useState([])
  const [categories, setCategories] = useState([])
  const [inventory, setInventory] = useState([])
  const [inventoryStats, setInventoryStats] = useState(null)
  const [salesReport, setSalesReport] = useState(null)

  const [appointments, setAppointments] = useState([])
  const [appointmentPagination, setAppointmentPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 })
  const [appointmentLoading, setAppointmentLoading] = useState(false)
  const [unavailableDates, setUnavailableDates] = useState([])
  const [availableDates, setAvailableDates] = useState([])

  const [services, setServices] = useState([])
  const [users, setUsers] = useState([])

  // ── Modals & Form State ──────────────────────────────────────────────────
  const [modal, setModal] = useState({ open: false, type: null, data: null })
  const [form, setForm] = useState({})
  const [formErrors, setFormErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)

  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [appointmentFormOpen, setAppointmentFormOpen] = useState(false)
  const [appointmentFormData, setAppointmentFormData] = useState(null)
  const [unavailableDatesOpen, setUnavailableDatesOpen] = useState(false)
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null)

  const [confirm, setConfirm] = useState({
    open: false,
    title: '',
    description: '',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    onConfirm: null,
    isBusy: false,
    variant: 'danger',
  })

  // ── Inventory Filters ────────────────────────────────────────────────────
  const [inventorySubTab, setInventorySubTab] = useState('products')
  const [productsInventoryFilter, setProductsInventoryFilter] = useState({ search: '', status: 'all', category: '', sort: 'name_asc', page: 1 })
  const [partsInventoryFilter, setPartsInventoryFilter] = useState({ search: '', status: 'all', category: 'all', sort: 'name_asc', page: 1 })
  const [inventoryPage, setInventoryPage] = useState(1)
  const INVENTORY_PAGE_SIZE = 10

  // ── Projects Filters ─────────────────────────────────────────────────────
  const [projectStatusFilter, setProjectStatusFilter] = useState('all')
  const [projectAssignedFilter, setProjectAssignedFilter] = useState('all')
  const [projectGuitarTypeFilter, setProjectGuitarTypeFilter] = useState('all')
  const [projectDateFrom, setProjectDateFrom] = useState('')
  const [projectDateTo, setProjectDateTo] = useState('')
  const [projectDueDateFrom, setProjectDueDateFrom] = useState('')
  const [projectDueDateTo, setProjectDueDateTo] = useState('')
  const [projectCompletionFilter, setProjectCompletionFilter] = useState('all')
  const [projectSort, setProjectSort] = useState('updated')
  const [projectPage, setProjectPage] = useState(1)
  const PROJECTS_PAGE_SIZE = 10

  // ── Category Tree ────────────────────────────────────────────────────────
  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories])

  // ── Tabs Navigation List ─────────────────────────────────────────────────
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'projects', label: 'Projects', icon: Briefcase },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'appointments', label: 'Appointments', icon: Calendar },
    { id: 'pos', label: 'POS', icon: Wallet },
  ]

  // ── API Fetchers ─────────────────────────────────────────────────────────
  useEffect(() => {
    ordersRef.current = orders
  }, [orders])

  useEffect(() => {
    ordersPaginationRef.current = ordersPagination
  }, [ordersPagination])

  const fetchProducts = useCallback(async () => {
    try {
      const res = await staffApi.getProducts({ page: 1, pageSize: 500 })
      setProducts(normalizeArray(res, 'products'))
    } catch (e) {
      showToast(e.message, 'error')
    }
  }, [showToast])

  const fetchParts = useCallback(async () => {
    try {
      const res = await staffApi.getBuilderParts({ page: 1, pageSize: 500 })
      setParts(normalizeArray(res, 'parts'))
    } catch (e) {
      showToast(e.message, 'error')
    }
  }, [showToast])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await adminApi.getCategories()
      setCategories(normalizeArray(res, 'categories'))
    } catch (e) {
      // transient fail-safe
    }
  }, [])

  const fetchUsers = useCallback(async () => {
    try {
      const res = await adminApi.getUsers({ limit: 100 })
      setUsers(normalizeArray(res, 'users'))
    } catch {
      // ignore
    }
  }, [])

  const fetchInventory = useCallback(async (options = {}) => {
    const { silent = false } = options
    try {
      const [prodsRes, statsRes, partsRes] = await Promise.all([
        staffApi.getInventoryProducts(),
        staffApi.getInventorySummary(),
        staffApi.getBuilderParts({ page: 1, pageSize: 500 }),
      ])
      const rawProds = Array.isArray(prodsRes.data) ? prodsRes.data : prodsRes.data?.products || []
      const productImageMap = new Map(
        (products || []).map((p) => [
          p.product_id,
          p.primary_image || p.image_url || p.product_image || null,
        ])
      )
      const mergedProds = rawProds.map((item) => ({
        ...item,
        primary_image: item.primary_image || item.image_url || item.product_image || productImageMap.get(item.product_id) || null,
      }))
      setInventory(mergedProds)
      setInventoryStats(statsRes.data || null)
      setParts(normalizeArray(partsRes, 'parts'))
    } catch (e) {
      if (!silent) showToast(e.message, 'error')
    }
  }, [products, showToast])

  const fetchSalesReport = useCallback(async () => {
    try {
      const res = await adminApi.getSalesReport()
      setSalesReport(res.data || null)
    } catch {
      // fallback
    }
  }, [])

  const fetchOrders = useCallback((queryParams = {}) => {
    const isDefaultCall = Object.keys(queryParams).length === 0
    const baseQuery = isDefaultCall ? lastOrderQueryRef.current : queryParams
    const resolvedSearch = baseQuery.search !== undefined
      ? baseQuery.search
      : (debouncedSearch || undefined)
    const params = {
      include_items: true,
      page_size: ordersPaginationRef.current.pageSize || ordersPaginationRef.current.limit || 10,
      ...baseQuery,
      search: resolvedSearch || undefined,
    }

    if (params.page == null) {
      params.page = ordersPaginationRef.current.page || 1
    }
    Object.keys(params).forEach(k => params[k] === undefined && delete params[k])

    const requestKey = JSON.stringify(params)
    lastOrderQueryRef.current = { ...params }
    activeOrderRequestKeyRef.current = requestKey

    const existingRequest = inFlightOrderRequestsRef.current.get(requestKey)
    if (existingRequest) {
      setOrdersLoading(true)
      return existingRequest.promise
    }

    setOrdersLoading(true)
    const requestPromise = Promise.resolve()
      .then(() => staffApi.getOrders(params))
      .then((res) => {
        if (activeOrderRequestKeyRef.current !== requestKey) {
          return res
        }

        const rows = normalizeArray(res, 'orders')
        if (JSON.stringify(ordersRef.current) !== JSON.stringify(rows)) {
          ordersRef.current = rows
          setOrders(rows)
        }

        const pag = res.pagination || res.data?.pagination
        if (pag) {
          setOrdersPagination((prev) => {
            const nextPagination = {
              ...prev,
              page: Number(pag.page) || prev.page,
              limit: Number(pag.pageSize || pag.page_size) || prev.limit || 10,
              total: Number.isFinite(Number(pag.total)) ? Number(pag.total) : rows.length,
              pages: Number(pag.totalPages || pag.total_pages || pag.pages) || 1,
              totalPages: Number(pag.totalPages || pag.total_pages || pag.pages) || 1,
            }
            return (
              prev.page === nextPagination.page &&
              prev.limit === nextPagination.limit &&
              prev.total === nextPagination.total &&
              prev.pages === nextPagination.pages &&
              prev.totalPages === nextPagination.totalPages
            ) ? prev : nextPagination
          })
        }
        return res
      })
      .catch((e) => {
        if (activeOrderRequestKeyRef.current === requestKey) {
          showToast(e.message, 'error')
        }
        throw e
      })
      .finally(() => {
        const request = inFlightOrderRequestsRef.current.get(requestKey)
        if (request?.promise === requestPromise) {
          inFlightOrderRequestsRef.current.delete(requestKey)
        }
        if (activeOrderRequestKeyRef.current === requestKey) {
          setOrdersLoading(false)
        }
      })

    inFlightOrderRequestsRef.current.set(requestKey, { promise: requestPromise })
    return requestPromise
  }, [debouncedSearch, showToast])

  const fetchProjects = useCallback(async () => {
    try {
      const res = await staffApi.getAllProjects({
        search: debouncedSearch,
        include_tasks: true,
      })
      const rows = normalizeArray(res, 'projects')
      setProjects(rows)
      setProjectsPagination((prev) => ({
        ...prev,
        total: rows.length,
        totalPages: Math.max(1, Math.ceil(rows.length / PROJECTS_PAGE_SIZE)),
      }))
    } catch (e) {
      showToast(e.message, 'error')
    }
  }, [debouncedSearch, showToast])

  const fetchArchivedProjects = useCallback(async () => {
    try {
      const res = await adminApi.getArchivedProjects({
        search: debouncedSearch,
        include_tasks: true,
      })
      const rows = normalizeArray(res, 'projects')
      setArchivedProjects(rows)
      setArchivedProjectsPagination((prev) => ({
        ...prev,
        total: rows.length,
        totalPages: Math.max(1, Math.ceil(rows.length / PROJECTS_PAGE_SIZE)),
      }))
    } catch {
      // ignore
    }
  }, [debouncedSearch])

  const fetchAppointments = useCallback(async (options = {}) => {
    const { silent = false } = options
    if (!silent) setAppointmentLoading(true)
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
      setAppointmentPagination((prev) => ({ ...prev, total, pages }))
    } catch (e) {
      if (!silent) showToast(e.message, 'error')
    } finally {
      if (!silent) setAppointmentLoading(false)
    }
  }, [appointmentPagination.limit, appointmentPagination.page, debouncedSearch, showToast])

  const fetchServices = useCallback(async () => {
    try {
      const res = await staffApi.getServices()
      setServices(normalizeArray(res, 'services'))
    } catch (e) {
      showToast(e.message, 'error')
    }
  }, [showToast])

  const fetchUnavailableDates = useCallback(async () => {
    try {
      const res = await staffApi.getUnavailableDates()
      setUnavailableDates(res.data?.unavailable_dates || [])
    } catch (e) {
      showToast(e.message, 'error')
    }
  }, [showToast])

  const fetchAvailableDates = useCallback(async () => {
    try {
      const today = new Date()
      const dateFrom = today.toISOString().slice(0, 10)
      const dateTo = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const res = await staffApi.getAvailableDates(dateFrom, dateTo)
      setAvailableDates(res.data?.available_dates || [])
    } catch {
      // ignore
    }
  }, [])

  // ── Initial Load & Tab Switching ─────────────────────────────────────────
  useEffect(() => {
    fetchProducts()
    fetchParts()
    fetchCategories()
    fetchUsers()
    fetchServices()
    fetchUnavailableDates()
    fetchAvailableDates()
  }, [fetchAvailableDates, fetchCategories, fetchParts, fetchProducts, fetchServices, fetchUnavailableDates, fetchUsers])

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchOrders()
      fetchProjects()
      fetchAppointments({ silent: true })
      fetchSalesReport()
      fetchInventory({ silent: true })
    }
    if (activeTab === 'projects') {
      fetchProjects()
      fetchArchivedProjects()
    }
    if (activeTab === 'orders') fetchOrders()
    if (activeTab === 'inventory' || activeTab === 'pos') fetchInventory()
    if (activeTab === 'appointments') {
      fetchAppointments()
      fetchUnavailableDates()
      fetchAvailableDates()
    }
  }, [activeTab, fetchAppointments, fetchArchivedProjects, fetchAvailableDates, fetchInventory, fetchOrders, fetchProjects, fetchSalesReport, fetchUnavailableDates])

  // ── Smart Polling ────────────────────────────────────────────────────────
  const pollingFn = useCallback(async () => {
    const map = {
      dashboard: async () => {
        await Promise.all([fetchOrders(), fetchProjects(), fetchAppointments({ silent: true }), fetchSalesReport(), fetchInventory({ silent: true })])
      },
      projects: fetchProjects,
      orders: fetchOrders,
      inventory: () => fetchInventory({ silent: true }),
      pos: () => fetchInventory({ silent: true }),
      appointments: () => Promise.all([fetchAppointments({ silent: true }), fetchUnavailableDates()]),
    }
    return map[activeTab]?.()
  }, [activeTab, fetchAppointments, fetchInventory, fetchOrders, fetchProjects, fetchSalesReport, fetchUnavailableDates])

  useSmartPolling(pollingFn, { interval: 8000, maxInterval: 60000, backoffFactor: 1.5, enabled: true })

  const handleRefresh = useCallback(() => {
    setIsLoading(true)
    setLastRefreshed(Date.now())
    pollingFn()?.finally(() => setIsLoading(false))
  }, [pollingFn])

  // ── Derived Data Views ───────────────────────────────────────────────────
  const visibleProducts = products || []
  const visibleParts = useMemo(() => (parts || []).map((part) => normalizeBuilderPart(part)), [parts])

  const visibleInventory = useMemo(() => {
    const lookup = Object.fromEntries(products.map((item) => [item.product_id, item]))
    return (inventory.length ? inventory : products).map((item) => ({
      ...(lookup[item.product_id] || {}),
      ...item,
      stock: Number(item.stock || 0),
      low_stock_threshold: Number(item.low_stock_threshold || 10),
      price: Number(item.price || lookup[item.product_id]?.price || 0),
    }))
  }, [inventory, products])

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
    const prods = visibleInventory.map((p) => ({
      ...p,
      type: 'product',
      stock: Number(p.stock ?? 0),
      name: p.name,
      sku: p.sku,
      low_stock_threshold: Number(p.low_stock_threshold ?? 10),
      part_id: p.product_id,
    }))
    let result = [...prods]
    const searchTerm = String(productsInventoryFilter.search || '').trim().toLowerCase()
    if (searchTerm) {
      result = result.filter(
        (item) =>
          String(item.name || '').toLowerCase().includes(searchTerm) ||
          String(item.sku || '').toLowerCase().includes(searchTerm) ||
          String(item.category_name || '').toLowerCase().includes(searchTerm)
      )
    }

    const categoryFilter = productsInventoryFilter.category
    if (categoryFilter) {
      const matchIds = new Set([categoryFilter])
      const parent = categoryTree.find((cat) => cat.category_id === categoryFilter)
      if (parent?.children) {
        parent.children.forEach((child) => matchIds.add(child.category_id))
      }
      result = result.filter((item) => matchIds.has(item.category_id))
    }

    const statusFilter = productsInventoryFilter.status
    if (statusFilter !== 'all') {
      result = result.filter((item) => {
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
      if (productsInventoryFilter.sort === 'name_asc') return (a.name || '').localeCompare(b.name || '')
      if (productsInventoryFilter.sort === 'name_desc') return (b.name || '').localeCompare(a.name || '')
      if (productsInventoryFilter.sort === 'category_asc') return (a.category_name || '').localeCompare(b.category_name || '')
      if (productsInventoryFilter.sort === 'category_desc') return (b.category_name || '').localeCompare(a.category_name || '')
      if (productsInventoryFilter.sort === 'date_modified_asc') return new Date(a.updated_at || a.created_at || 0) - new Date(b.updated_at || b.created_at || 0)
      if (productsInventoryFilter.sort === 'date_modified_desc') return new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)
      if (productsInventoryFilter.sort === 'sku_asc') return (a.sku || '').localeCompare(b.sku || '')
      if (productsInventoryFilter.sort === 'sku_desc') return (b.sku || '').localeCompare(a.sku || '')
      if (productsInventoryFilter.sort === 'stock_asc') return Number(a.stock || 0) - Number(b.stock || 0)
      if (productsInventoryFilter.sort === 'stock_desc') return Number(b.stock || 0) - Number(a.stock || 0)
      return 0
    })
    return result
  }, [categoryTree, productsInventoryFilter, visibleInventory])

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
      result = result.filter(
        (item) =>
          String(item.name || '').toLowerCase().includes(searchTerm) ||
          String(item.sku || '').toLowerCase().includes(searchTerm) ||
          String(INVENTORY_PART_CATEGORY_LABELS[item.inventory_category] || item.inventory_category || '').toLowerCase().includes(searchTerm)
      )
    }

    const categoryFilter = partsInventoryFilter.category || 'all'
    if (categoryFilter !== 'all') {
      result = result.filter((item) => item.inventory_category === categoryFilter)
    }

    const statusFilter = partsInventoryFilter.status
    if (statusFilter !== 'all') {
      result = result.filter((item) => {
        const stock = Number(item.stock ?? 0)
        const threshold = 10
        const tier = getStockTier(stock, threshold, item.max_stock)
        if (statusFilter === 'out_of_stock') return tier === 'out_of_stock'
        if (statusFilter === 'critical') return tier === 'critical'
        if (statusFilter === 'warning') return tier === 'warning'
        if (statusFilter === 'healthy') return tier === 'healthy'
        return true
      })
    }

    result.sort((a, b) => {
      const categoryCompare = (INVENTORY_PART_CATEGORY_LABELS[a.inventory_category] || '').localeCompare(
        INVENTORY_PART_CATEGORY_LABELS[b.inventory_category] || ''
      )
      if (categoryCompare !== 0) return categoryCompare
      if (partsInventoryFilter.sort === 'name_asc') return (a.name || '').localeCompare(b.name || '')
      if (partsInventoryFilter.sort === 'name_desc') return (b.name || '').localeCompare(a.name || '')
      if (partsInventoryFilter.sort === 'sku_asc') return (a.sku || '').localeCompare(b.sku || '')
      if (partsInventoryFilter.sort === 'sku_desc') return (b.sku || '').localeCompare(a.sku || '')
      if (partsInventoryFilter.sort === 'stock_asc') return Number(a.stock || 0) - Number(b.stock || 0)
      if (partsInventoryFilter.sort === 'stock_desc') return Number(b.stock || 0) - Number(a.stock || 0)
      return 0
    })
    return result
  }, [partsInventoryFilter, visibleParts])

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

  // ── Inventory Health Calculation ─────────────────────────────────────────
  const inventoryHealthData = useMemo(() => {
    const productItems = visibleProducts.map((p) => ({
      stock: Number(p.stock ?? 0),
      threshold: Number(p.low_stock_threshold ?? 10),
      maxStock: Number(p.max_stock ?? 0),
    }))
    const partItems = visibleParts.map((p) => ({
      stock: Number(p.stock ?? p.quantity ?? 0),
      threshold: 10,
      maxStock: 0,
    }))
    const items = [...productItems, ...partItems]
    if (items.length === 0) return { value: '0%', status: 'Healthy', statusClass: 'text-emerald-400', iconBg: 'bg-emerald-500/15' }
    let critical = false
    let warning = false
    let healthyCount = 0
    items.forEach(({ stock, threshold, maxStock }) => {
      const tier = getStockTier(stock, threshold, maxStock)
      if (tier === 'out_of_stock' || tier === 'critical') critical = true
      else if (tier === 'warning') warning = true
      else healthyCount += 1
    })
    const status = critical ? 'Critical' : warning ? 'Warning' : 'Healthy'
    const statusClass = critical ? 'text-red-400' : warning ? 'text-amber-400' : 'text-emerald-400'
    const iconBg = critical ? 'bg-red-500/15' : warning ? 'bg-amber-500/15' : 'bg-emerald-500/15'
    return { value: `${Math.round((healthyCount / items.length) * 100)}%`, status, statusClass, iconBg }
  }, [visibleParts, visibleProducts])

  const enhancedOrderStats = useMemo(() => {
    const counts = { pending: 0, processing: 0, completed: 0, cancelled: 0 }
    orders.forEach((o) => {
      const s = String(o.status || '').toLowerCase()
      if (['pending', 'awaiting_payment'].includes(s)) counts.pending += 1
      else if (['processing', 'in_progress'].includes(s)) counts.processing += 1
      else if (['completed', 'delivered'].includes(s)) counts.completed += 1
      else if (['cancelled', 'rejected'].includes(s)) counts.cancelled += 1
    })
    return counts
  }, [orders])

  // ── Filtered Projects ────────────────────────────────────────────────────
  const filterProjectList = useCallback((list) => {
    let result = [...list]
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      result = result.filter(
        (p) =>
          String(p.name || p.title || '').toLowerCase().includes(q) ||
          String(p.order_number || '').toLowerCase().includes(q) ||
          String(p.customer_name || p.client_name || '').toLowerCase().includes(q)
      )
    }
    if (projectStatusFilter !== 'all') {
      result = result.filter((p) => String(p.status || 'not_started').toLowerCase() === projectStatusFilter)
    }
    if (projectAssignedFilter !== 'all') {
      result = result.filter((p) => p.claimed_by === projectAssignedFilter || p.user_id === projectAssignedFilter)
    }
    if (projectGuitarTypeFilter !== 'all') {
      result = result.filter((p) => String(p.guitar_type || '').toLowerCase() === projectGuitarTypeFilter.toLowerCase())
    }
    if (projectDateFrom) {
      result = result.filter((p) => p.created_at && new Date(p.created_at) >= new Date(projectDateFrom))
    }
    if (projectDateTo) {
      result = result.filter((p) => p.created_at && new Date(p.created_at) <= new Date(projectDateTo + 'T23:59:59'))
    }
    if (projectDueDateFrom) {
      result = result.filter((p) => p.estimated_completion_date && new Date(p.estimated_completion_date) >= new Date(projectDueDateFrom))
    }
    if (projectDueDateTo) {
      result = result.filter((p) => p.estimated_completion_date && new Date(p.estimated_completion_date) <= new Date(projectDueDateTo + 'T23:59:59'))
    }
    if (projectCompletionFilter !== 'all') {
      const targetPct = Number(projectCompletionFilter)
      result = result.filter((p) => Number(p.progress || 0) >= targetPct)
    }

    result.sort((a, b) => {
      if (projectSort === 'updated') return new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)
      if (projectSort === 'created') return new Date(b.created_at || 0) - new Date(a.created_at || 0)
      if (projectSort === 'name') return (a.name || a.title || '').localeCompare(b.name || b.title || '')
      if (projectSort === 'customer') return (a.customer_name || '').localeCompare(b.customer_name || '')
      if (projectSort === 'progress') return Number(b.progress || 0) - Number(a.progress || 0)
      if (projectSort === 'due') return new Date(a.estimated_completion_date || 0) - new Date(b.estimated_completion_date || 0)
      if (projectSort === 'status') return (a.status || '').localeCompare(b.status || '')
      return 0
    })

    return result
  }, [
    debouncedSearch,
    projectAssignedFilter,
    projectCompletionFilter,
    projectDateFrom,
    projectDateTo,
    projectDueDateFrom,
    projectDueDateTo,
    projectGuitarTypeFilter,
    projectSort,
    projectStatusFilter,
  ])

  const visibleProjects = useMemo(() => filterProjectList(projects), [filterProjectList, projects])
  const visibleArchivedProjects = useMemo(() => filterProjectList(archivedProjects), [filterProjectList, archivedProjects])

  // ── Modal Actions & Handlers ─────────────────────────────────────────────
  const openModal = (type, data = null) => {
    let initialForm = data ? { ...data } : {}
    if (type === 'inventory' && data?.product_id) {
      initialForm.product_id = data.product_id
      initialForm.current_stock = data.stock
    }
    if (type === 'part_inventory' && data?.part_id) {
      initialForm.part_id = data.part_id
      initialForm.current_stock = data.stock ?? data.quantity
    }
    setForm(initialForm)
    setFormErrors({})
    setModal({ open: true, type, data })
  }

  const handleManageCustomizationProject = async (order) => {
    setActiveTab('projects')
    let project = null
    const projectId = order?.project_id || order?.project?.project_id || (typeof order === 'string' ? order : null)

    if (projectId) {
      try {
        const response = await staffApi.getProject(projectId)
        project = response?.data || response
      } catch (error) {
        console.error('Failed to get project by projectId:', error)
      }
    }

    if (!project && (order?.order_id || order?.order_number)) {
      try {
        const searchVal = order.order_number || order.order_id
        const response = await staffApi.getAllProjects({ search: searchVal, page: 1, page_size: 10 })
        const list = response?.data?.projects || response?.projects || response?.data || []
        project = list.find((p) => String(p.order_id) === String(order.order_id) || String(p.order_number) === String(order.order_number)) || list[0]
      } catch (error) {
        console.error('Failed to find project by order info:', error)
      }
    }

    if (project?.project_id) {
      openModal('project_tasks', project)
    } else if (order) {
      showToast('This customization order does not have an associated project yet.', 'error')
    }
  }

  const closeModal = () => {
    setModal({ open: false, type: null, data: null })
    setForm({})
    setFormErrors({})
  }

  const openConfirm = (opts) => {
    setConfirm({
      open: true,
      title: opts.title || 'Are you sure?',
      description: opts.description || '',
      confirmLabel: opts.confirmLabel || 'Confirm',
      cancelLabel: opts.cancelLabel || 'Cancel',
      variant: opts.variant || 'danger',
      isBusy: false,
      onConfirm: opts.onConfirm || null,
    })
  }

  const closeConfirm = () => {
    setConfirm((prev) => ({ ...prev, open: false, isBusy: false, onConfirm: null }))
  }

  const handleConfirmAction = async () => {
    if (!confirm.onConfirm) return
    setConfirm((prev) => ({ ...prev, isBusy: true }))
    try {
      await confirm.onConfirm()
      closeConfirm()
    } catch (e) {
      showToast(e.message || 'Action failed', 'error')
      setConfirm((prev) => ({ ...prev, isBusy: false }))
    }
  }

  const validateAndSave = (rules, saveFn) => async () => {
    const errors = validate(rules, form)
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }
    await saveFn()
  }

  // ── Stock Adjustments ────────────────────────────────────────────────────
  const saveStockAdjust = async (overrideForm = {}) => {
    setIsSaving(true)
    try {
      const { product_id, change_type, quantity } = { ...form, ...overrideForm }
      if (!product_id || !change_type || !quantity) {
        showToast('Please fill all required fields', 'error')
        return
      }
      const existingProduct = visibleProducts.find((p) => p.product_id === product_id)
      const currentStock = Number(existingProduct?.stock ?? form.current_stock ?? 0) || 0
      const qty = Number(quantity)
      const payload = {
        productId: product_id,
        quantity: change_type === 'adjustment' ? qty - currentStock : qty,
      }
      if (change_type === 'stock_in') await staffApi.addStock({ product_id, quantity: qty })
      else if (change_type === 'stock_out') await staffApi.deductStock({ product_id, quantity: qty })
      else await staffApi.adjustStock({ product_id, quantity: qty - currentStock })
      showToast('Stock adjusted successfully!')
      fetchInventory()
      closeModal()
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const savePartStockAdjust = async (overrideForm = {}) => {
    setIsSaving(true)
    try {
      const { part_id, change_type, quantity } = { ...form, ...overrideForm }
      if (!part_id || !change_type || !quantity) {
        showToast('Please fill all required fields', 'error')
        return
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
      fetchInventory()
      closeModal()
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // ── Project CRUD ─────────────────────────────────────────────────────────
  const saveProject = async () => {
    setIsSaving(true)
    try {
      if (modal.data?.project_id) {
        await staffApi.updateProject(modal.data.project_id, form)
        showToast('Project updated!')
      } else {
        await adminApi.createProject(form)
        showToast('Project created!')
      }
      fetchProjects()
      closeModal()
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const deleteProject = (id, name) => {
    openConfirm({
      title: 'Archive Project',
      description: `Are you sure you want to archive "${name}"? It can be restored from the Archived tab.`,
      confirmLabel: 'Confirm Archive',
      variant: 'warning',
      onConfirm: async () => {
        await adminApi.deleteProject(id)
        showToast('Project archived')
        fetchProjects()
        fetchArchivedProjects()
      },
    })
  }

  const restoreProject = async (id, name) => {
    openConfirm({
      title: 'Restore Project',
      description: `Restore "${name}" back to active projects?`,
      confirmLabel: 'Restore',
      variant: 'info',
      onConfirm: async () => {
        await adminApi.restoreProject(id)
        showToast('Project restored successfully')
        fetchProjects()
        fetchArchivedProjects()
      },
    })
  }

  // ── Appointment Handlers ─────────────────────────────────────────────────
  const updateAppointmentStatus = useCallback(async (id, status, reason) => {
    try {
      await staffApi.updateAppointmentStatus(id, status, reason)
      showToast('Appointment status updated')
      await fetchAppointments()
    } catch (error) {
      showToast(error.message, 'error')
    }
  }, [fetchAppointments, showToast])

  const rescheduleAppointment = useCallback(async (id, scheduledAt, reason) => {
    try {
      await staffApi.rescheduleAppointment(id, scheduledAt, reason)
      showToast('Appointment rescheduled')
      await fetchAppointments()
    } catch (error) {
      showToast(error.message, 'error')
    }
  }, [fetchAppointments, showToast])

  const cancelAppointment = useCallback(async (id, reason) => {
    try {
      await staffApi.cancelAppointment(id, reason)
      showToast('Appointment cancelled')
      await fetchAppointments()
    } catch (error) {
      showToast(error.message, 'error')
    }
  }, [fetchAppointments, showToast])

  const updateAppointmentPaymentStatus = useCallback(async (id, paymentStatus) => {
    try {
      await staffApi.updateAppointmentPaymentStatus(id, paymentStatus)
      showToast('Payment status updated')
      await fetchAppointments()
    } catch (error) {
      showToast(error.message, 'error')
    }
  }, [fetchAppointments, showToast])

  const submitAppointment = useCallback(async (payload) => {
    try {
      if (appointmentFormData?.appointment_id) {
        await staffApi.updateAppointment(appointmentFormData.appointment_id, payload)
        showToast('Appointment updated')
      } else {
        await staffApi.createAppointment(payload)
        showToast('Appointment created')
      }
      await fetchAppointments()
      setAppointmentFormOpen(false)
      setAppointmentFormData(null)
      setSelectedCalendarDate(null)
    } catch (error) {
      showToast(error.message, 'error')
      throw error
    }
  }, [appointmentFormData, fetchAppointments, showToast])

  const pageTitle = tabs.find((t) => t.id === activeTab)?.label || 'Staff Dashboard'

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* ── Toast Stack ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toasts.length > 0 && (
          <div className="fixed bottom-6 right-6 z-[250] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
            {toasts.map((t) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border text-sm font-semibold shadow-2xl backdrop-blur-md ${
                  t.type === 'error'
                    ? 'bg-red-950/90 border-red-500/30 text-red-200'
                    : 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {t.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  )}
                  <span>{t.msg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(t.id)}
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* ── Confirm Modal ──────────────────────────────────────────────────── */}
      <ConfirmModal
        open={confirm.open}
        title={confirm.title}
        description={confirm.description}
        confirmLabel={confirm.confirmLabel}
        cancelLabel={confirm.cancelLabel}
        variant={confirm.variant}
        isBusy={confirm.isBusy}
        onConfirm={handleConfirmAction}
        onCancel={closeConfirm}
      />

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside
        className={`fixed left-0 top-0 h-screen bg-[var(--surface-dark)] border-r border-[var(--border)] transition-all duration-300 z-40 flex flex-col ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="h-24 px-4 py-4 border-b border-[var(--border)] flex items-center justify-between relative">
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="absolute -right-3 top-6 w-6 h-6 bg-[var(--surface-dark)] border border-[var(--border)] rounded-full flex items-center justify-center hover:bg-[var(--gold-primary)] hover:border-[var(--gold-primary)] transition-all text-white hover:text-black"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          {!sidebarCollapsed && (
            <div className="flex items-center gap-3">
              <img src="/logo-cosmos.png" alt="CosmosCraft" className="w-10 h-10 object-contain flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[var(--text-light)] font-black text-lg tracking-tight">CosmosCraft</p>
                <span className="text-[10px] uppercase tracking-widest text-[var(--gold-primary)] font-semibold">Staff Hub</span>
              </div>
            </div>
          )}
          {sidebarCollapsed && (
            <img src="/logo-cosmos.png" alt="CosmosCraft" className="w-10 h-10 object-contain flex-shrink-0 mx-auto" />
          )}
        </div>

        <nav className="p-4 space-y-1.5 overflow-y-auto flex-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] border-2 border-[var(--gold-primary)] shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-light)] border-2 border-transparent'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-[var(--text-dark)]' : 'text-[var(--text-muted)]'}`} />
                {!sidebarCollapsed && (
                  <span className={`truncate font-semibold ${isActive ? 'text-[var(--text-dark)]' : 'text-[var(--text-muted)]'}`}>
                    {tab.label}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </aside>

      {/* ── Main Content Area ──────────────────────────────────────────────── */}
      <div className={`transition-all duration-300 bg-[var(--bg-primary)] ${sidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
        <Topbar title={pageTitle} userRole={user?.role || 'staff'} />

        <main className={`p-6 ${activeTab === 'pos' ? 'pt-19' : 'pt-5'}`}>
          {/* ── DASHBOARD TAB ─────────────────────────────────────────────── */}
          {activeTab === 'dashboard' && (
            <DashboardTab
              user={user}
              salesReport={salesReport}
              visibleOrders={orders}
              visibleProjects={projects}
              visibleAppointments={appointments}
              inventoryHealthData={inventoryHealthData}
              enhancedOrderStats={enhancedOrderStats}
              handleRefresh={handleRefresh}
              isLoading={isLoading}
              setActiveTab={setActiveTab}
              lastRefreshed={lastRefreshed}
            />
          )}

          {/* ── PROJECTS TAB ──────────────────────────────────────────────── */}
          {activeTab === 'projects' && (
            <ProjectsTab
              visibleProjects={visibleProjects}
              visibleArchivedProjects={visibleArchivedProjects}
              projects={projects}
              archivedProjects={archivedProjects}
              users={users}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              projectStatusFilter={projectStatusFilter}
              setProjectStatusFilter={setProjectStatusFilter}
              projectAssignedFilter={projectAssignedFilter}
              setProjectAssignedFilter={setProjectAssignedFilter}
              projectSort={projectSort}
              setProjectSort={setProjectSort}
              projectGuitarTypeFilter={projectGuitarTypeFilter}
              setProjectGuitarTypeFilter={setProjectGuitarTypeFilter}
              projectDateFrom={projectDateFrom}
              setProjectDateFrom={setProjectDateFrom}
              projectDateTo={projectDateTo}
              setProjectDateTo={setProjectDateTo}
              projectDueDateFrom={projectDueDateFrom}
              setProjectDueDateFrom={setProjectDueDateFrom}
              projectDueDateTo={projectDueDateTo}
              setProjectDueDateTo={setProjectDueDateTo}
              projectCompletionFilter={projectCompletionFilter}
              setProjectCompletionFilter={setProjectCompletionFilter}
              setProjectPage={setProjectPage}
              openModal={openModal}
              isSuperAdmin={isSuperAdmin}
              showDefaultWorkflowEditor={false}
              setShowDefaultWorkflowEditor={() => {}}
              deleteProject={deleteProject}
              restoreProject={restoreProject}
              projectArchiveTab={projectArchiveTab}
              setProjectArchiveTab={setProjectArchiveTab}
              archivedProjectsPagination={archivedProjectsPagination}
              setArchivedProjectsPagination={setArchivedProjectsPagination}
              projectsPagination={projectsPagination}
              PROJECTS_PAGE_SIZE={PROJECTS_PAGE_SIZE}
              isAdmin={isSuperAdmin}
              debouncedSearch={debouncedSearch}
            />
          )}

          {/* ── ORDERS TAB ────────────────────────────────────────────────── */}
          {activeTab === 'orders' && (
            <OrdersTab
              orders={orders}
              fetchOrders={fetchOrders}
              user={user}
              pagination={ordersPagination}
              showToast={showToast}
              ordersLoading={ordersLoading}
              onManageProject={handleManageCustomizationProject}
              onGoToProjects={() => handleManageCustomizationProject()}
            />
          )}

          {/* ── INVENTORY TAB ─────────────────────────────────────────────── */}
          {activeTab === 'inventory' && (
            <InventoryTab
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
              categoryTree={categoryTree}
            />
          )}

          {/* ── APPOINTMENTS TAB ──────────────────────────────────────────── */}
          {activeTab === 'appointments' && (
            <AppointmentsTab
              visibleAppointments={appointments}
              appointmentLoading={appointmentLoading}
              appointmentPagination={appointmentPagination}
              selectedCalendarDate={selectedCalendarDate}
              unavailableDates={unavailableDates.map((entry) => entry?.date || entry).filter(Boolean)}
              availableDates={availableDates}
              fetchAppointments={fetchAppointments}
              setSelectedAppointment={setSelectedAppointment}
              setAppointmentModalOpen={setAppointmentModalOpen}
              setAppointmentFormData={setAppointmentFormData}
              setAppointmentFormOpen={setAppointmentFormOpen}
              setUnavailableDatesOpen={setUnavailableDatesOpen}
              setAppointmentPagination={setAppointmentPagination}
              isSuperAdmin={true}
            />
          )}

          {/* ── POS TAB ───────────────────────────────────────────────────── */}
          {activeTab === 'pos' && (
            <motion.div key="pos" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <PosWorkspace
                inventoryItems={visibleInventory}
                showToast={showToast}
                description="Create and record walk-in sales."
              />
            </motion.div>
          )}
        </main>
      </div>

      {/* ── MODALS ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modal.open && (
          <motion.div
            key={`modal-${modal.type || 'default'}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeModal()
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl p-8 w-full shadow-2xl overflow-y-auto ${
                modal.type === 'project_tasks' ? 'max-w-6xl h-[90vh]' : 'max-w-lg max-h-[90vh]'
              }`}
            >
              {modal.type === 'project_tasks' && modal.data && (
                <ProjectTasksModal modal={modal} closeModal={closeModal} visibleParts={visibleParts} />
              )}

              {modal.type === 'inventory' && (
                <AdjustStockModal
                  visibleProducts={visibleInventory}
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
              )}

              {modal.type === 'part_inventory' && (
                <AdjustPartStockModal
                  modal={modal}
                  form={form}
                  setForm={setForm}
                  formErrors={formErrors}
                  setFormErrors={setFormErrors}
                  closeModal={closeModal}
                  isSaving={isSaving}
                  savePartStockAdjust={savePartStockAdjust}
                  formatCurrency={formatCurrency}
                />
              )}

              {modal.type === 'project' && (
                <ProjectModal
                  modal={modal}
                  form={form}
                  setForm={setForm}
                  formErrors={formErrors}
                  closeModal={closeModal}
                  isSaving={isSaving}
                  saveProject={saveProject}
                  labelCls={labelCls}
                  inputCls={inputCls}
                  validateAndSave={validateAndSave}
                  projectRules={PROJECT_RULES}
                />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AppointmentModal
        isOpen={appointmentModalOpen}
        onClose={() => {
          setAppointmentModalOpen(false)
          setSelectedAppointment(null)
        }}
        appointment={selectedAppointment}
        onStatusChange={updateAppointmentStatus}
        onReschedule={rescheduleAppointment}
        onCancel={cancelAppointment}
        onPaymentStatusUpdate={updateAppointmentPaymentStatus}
        loading={appointmentLoading}
      />

      <AppointmentForm
        isOpen={appointmentFormOpen}
        onClose={() => {
          setAppointmentFormOpen(false)
          setAppointmentFormData(null)
          setSelectedCalendarDate(null)
        }}
        onSubmit={submitAppointment}
        initialData={appointmentFormData}
        services={services}
        users={users}
        loading={appointmentLoading}
        selectedDate={selectedCalendarDate}
      />

      <UnavailableDatesManager
        isOpen={unavailableDatesOpen}
        onClose={() => setUnavailableDatesOpen(false)}
        unavailableDates={unavailableDates}
        onAddUnavailable={async (date, reason) => {
          try {
            await staffApi.addUnavailableDate({ date, reason })
            showToast('Date marked unavailable')
            await fetchUnavailableDates()
          } catch (error) {
            showToast(error.message, 'error')
          }
        }}
        onRemoveUnavailable={async (id) => {
          try {
            await staffApi.removeUnavailableDate(id)
            showToast('Date reopened')
            await fetchUnavailableDates()
          } catch (error) {
            showToast(error.message, 'error')
          }
        }}
        loading={appointmentLoading}
      />
    </div>
  )
}

export default StaffDashboard
