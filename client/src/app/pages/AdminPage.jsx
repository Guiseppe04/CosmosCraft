import { isValidShippingFee } from '../utils/shippingFee'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import '../../styles/AdminWorkspace.css'
import { isValidPhoneNumber, normalizePhoneForSubmit, PHONE_ERROR_MESSAGE } from '../utils/phone'
import { getSiteContactSnapshot, publishSiteContact, refreshSiteContact } from '../utils/siteContact'
import { motion, AnimatePresence } from 'motion/react'
import {
  Users, Package, ShoppingBag, Calendar, Search,
  Filter, Edit, Trash2, Eye, BarChart3,
  PieChart, Activity, ArrowUpRight,
  CheckCircle, Check, Info, XCircle, Plus, RefreshCw, X,
  MessageSquare, Briefcase,
  ChevronDown, ChevronUp, ArrowUp, ArrowDown,
  Printer, Mail, FileText, CreditCard, RotateCcw, Copy, Truck, MapPin, Smartphone, Upload,
  UserCheck, Clock10, PackageCheck, CircleCheck,
  Layers, User, Tag, AlertCircle, DollarSign, Save, TrendingUp, UsersRound, Clock, Loader2, Grid3X3, List, MoreHorizontal, Shield, Settings, Guitar, Wrench, PaintBucket, Hammer, Zap, Sparkles, Wallet, CalendarX, ArrowLeft,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import ProjectTaskTracker from '../components/projects/ProjectTaskTracker'
import DefaultWorkflowEditor from '../components/projects/DefaultWorkflowEditor'
import AppointmentDetailsModal from '../components/appointments/AppointmentDetailsModal'
import AppointmentForm from '../components/appointments/AppointmentForm'
import UnavailableDatesManager from '../components/appointments/UnavailableDatesManager'
import { PosWorkspace } from '../components/pos/PosWorkspace'
import { useAuth } from '../context/AuthContext'
import { hasRole } from '../utils/roles.js'
import { useNavigate } from 'react-router'
import { Topbar } from '../components/admin/Topbar'
import { WorkspaceSidebar } from '../components/admin/WorkspaceSidebar'
import { formatCurrency } from '../utils/formatCurrency'
import { adminApi } from '../utils/adminApi'
import { ProjectsTab } from './admin/tabs/ProjectsTab'
import { UsersTab } from './admin/tabs/UsersTab'
import { AppointmentsTab } from './admin/tabs/AppointmentsTab'
import { InventoryTab } from './admin/tabs/InventoryTab'
import { DashboardTab } from './admin/tabs/DashboardTab'
import { SalesReportTab } from './admin/tabs/SalesReportTab'
import {
  getAllowedPaymentStatuses,
  getPaymentStatusConfig as getOrderPaymentStatusConfig,
  normalizePaymentStatus,
} from '../utils/orderPaymentStatus'
import { uploadToCloudinary } from '../utils/cloudinary'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { useDebounce } from '../hooks/useDebounce'
import { useSocketEvent } from '../context/SocketContext'
import { useProductsAdmin } from '../hooks/useProductsAdmin'
import { useCategoriesAdmin } from '../hooks/useCategoriesAdmin'
import { usePartsAdmin } from '../hooks/usePartsAdmin'
import { useUsersAdmin } from '../hooks/useUsersAdmin'
import { useOrdersAdmin } from '../hooks/useOrdersAdmin'
import { useProjectsAdmin } from '../hooks/useProjectsAdmin'
import { useAppointmentsAdmin } from '../hooks/useAppointmentsAdmin'
import { useDebouncedCallback } from '../hooks/useDebouncedCallback'
import { useServicesAdmin } from '../hooks/useServicesAdmin'
import { useInventoryAdmin } from '../hooks/useInventoryAdmin'
import {
  VALID_ROLES,
  GUITAR_TYPE_LABELS,
  PART_CATEGORY_LABELS,
  PART_CATEGORIES_BY_GUITAR_TYPE,
  PRODUCT_RULES,
  CATEGORY_RULES,
  PART_RULES,
  PROJECT_RULES,
  APPOINTMENT_RULES,
  SERVICE_RULES,
  PAGE_SIZE_OPTIONS,
  INVENTORY_PART_CATEGORY_OPTIONS,
  SLOT_TO_PART_CATEGORY,
  BUILDER_CATEGORY_MAP,
  INVENTORY_PART_CATEGORY_LABELS,
} from './admin/constants/adminOptions'
import {
  ORDER_STATUS_LIFECYCLE,
  ORDER_STATUS_TABS,
  TIMELINE_STEPS,
  ORDER_STATUS_TRANSITIONS,
  getOrderStatusConfig,
  getPaymentStatusConfig,
} from './admin/constants/orderStatus'
import { validate } from './admin/constants/adminOptions'
import { ADJUSTMENT_TYPE_LABELS } from './admin/constants/stockAdjustment'
import {
  normalizeBuilderPart,
  deriveInventoryPartCategory,
  getBuilderCategoryForTypeMapping,
  normalizeInventoryPartCategory,
  makePartIdentityKey,
} from './admin/utils/partHelpers'
import { updateIfChanged } from './admin/utils/slug'
import { buildProjectPaginationView, normalizeProjectPagination } from './admin/utils/projectPagination'
import { extractOrderPaymentMethod, isCashOnDeliveryOrder } from './admin/utils/orderHelpers'
import { StatusBadge } from './admin/components/shared/StatusBadge'
import { EmptyState } from './admin/components/shared/EmptyState'
import { SectionLoader } from './admin/components/shared/SectionLoader'
import { PaginationBar } from './admin/components/shared/PaginationBar'
import { ImageZoomModal } from './admin/components/shared/ImageZoomModal'
import { FormField } from './admin/components/shared/FormField'
import { AdminTable } from './admin/components/shared/AdminTable'
import { ModalHeader } from './admin/components/shared/ModalHeader'
import { ModalFooter } from './admin/components/shared/ModalFooter'
import { ImageUploadWidget } from './admin/components/shared/ImageUploadWidget'
import { GuitarPartsStickyHeader } from './admin/components/parts/GuitarPartsStickyHeader'
import { AdjustStockModal, AdjustPartStockModal } from './admin/components/inventory/StockAdjustmentModals'
import { OrderTableSkeleton, OrderDetailsSkeleton } from './admin/components/shared/Skeletons'
import { ServiceTableView, ServiceGridView } from './admin/components/services/ServiceViews'
import { GuitarPartAccordion, GuitarPartTableView } from './admin/components/parts/GuitarPartsViews'
import { PaymentSettingsTab } from './admin/components/settings/PaymentSettingsTab'
import { ServicesTab } from './admin/tabs/ServicesTab'
import { ProductsTab } from './admin/tabs/ProductsTab'
import { GuitarPartsTab } from './admin/tabs/GuitarPartsTab'
import { ProductCategoriesTab } from './admin/tabs/ProductCategoriesTab'
import { OrdersTab } from './admin/tabs/OrdersTab'
import { SettingsTab } from './admin/tabs/SettingsTab'
import { ProjectTasksModal } from './admin/components/modals/ProjectTasksModal'
import { ViewAppointmentModal } from './admin/components/modals/ViewAppointmentModal'
import { AppointmentStatusModal } from './admin/components/modals/AppointmentStatusModal'
import { GuitarViewModal } from './admin/components/modals/GuitarViewModal'
import { OrderViewModal } from './admin/components/modals/OrderViewModal'
import { ProjectTeamModal } from './admin/components/modals/ProjectTeamModal'
import { AppointmentModal as AdminAppointmentModal } from './admin/components/modals/AppointmentModal'
import { ServiceModal } from './admin/components/modals/ServiceModal'
import { ProjectModal } from './admin/components/modals/ProjectModal'
import { ProductModal } from './admin/components/modals/ProductModal'
import { CategoryModal } from './admin/components/modals/CategoryModal'
import { PartModal } from './admin/components/modals/PartModal'
import { PaymentApprovalModal } from './admin/components/modals/PaymentApprovalModal'
import { OrderDetailsModal } from './admin/components/modals/OrderDetailsModal'
import { OrderStatusModal } from './admin/components/modals/OrderStatusModal'
import { getStockTier } from '../utils/stockUtils'


export function AdminPage() {
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const isSuperAdmin = hasRole(user?.role, 'admin')

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const [activeTab, setActiveTab] = useState('dashboard')
  const [appointmentCapacity, setAppointmentCapacity] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 300)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState(null)
  const [toasts, setToasts] = useState([])
  const toastTimersRef = useRef(new Map())
  const [productViewMode, setProductViewMode] = useState('table') // table | grid
  const [productActiveTab, setProductActiveTab] = useState('active') // all | active | inactive

  // Modal state
  const [modal, setModal] = useState({ open: false, type: null, data: null })
  const [showGuitarTypeSelector, setShowGuitarTypeSelector] = useState(false)
  const [showDefaultWorkflowEditor, setShowDefaultWorkflowEditor] = useState(false)
  const [paymentStatusUpdate, setPaymentStatusUpdate] = useState({ loading: false, orderId: null })

  // Confirm dialog state
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
  const [projectArchiveFeedback, setProjectArchiveFeedback] = useState({
    open: false,
    projectId: null,
    projectName: '',
    snapshot: null,
    busy: false,
  })

  // ── Toast ────────────────────────────────────────────────────────────────
  const showToast = useCallback((msg, type = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setToasts((prev) => [...prev, { id, msg, type }])

    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
      toastTimersRef.current.delete(id)
    }, 3500)

    toastTimersRef.current.set(id, timer)
  }, [])

  const fetchAppointmentCapacity = useCallback(async () => {
    try {
      const response = await adminApi.getAppointmentCapacity()
      setAppointmentCapacity(response.data || null)
    } catch (error) {
      showToast(error.message || 'Failed to load appointment capacity', 'error')
    }
  }, [showToast])

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

  const {
    parts,
    partsLoading,
    partsPagination,
    partQuery,
    setPartQuery,
    fetchParts,
  } = usePartsAdmin({ debouncedSearch, showToast })

  const {
    products,
    productsLoading,
    productsPagination,
    productQuery,
    setProductQuery,
    fetchProducts,
  } = useProductsAdmin({ debouncedSearch, showToast })

  const { categories, fetchCategories } = useCategoriesAdmin({ showToast })
  const { users, fetchUsers } = useUsersAdmin({ debouncedSearch, showToast })
  const { orders, ordersLoading, ordersPagination, fetchOrders, setOrdersPagination } = useOrdersAdmin({ debouncedSearch, showToast })
  const { projects, projectsPagination, fetchProjects, setProjects, setProjectsPagination } = useProjectsAdmin({ debouncedSearch, showToast })
  const { appointments, calendarAppointments, appointmentPagination, setAppointmentPagination, appointmentLoading, unavailableDates, availableDates, search: appointmentSearch, setSearch: setAppointmentSearch, fetchAppointments, fetchCalendarAppointments, fetchUnavailableDates, fetchAvailableDates } = useAppointmentsAdmin({ showToast })
  const { services, servicesLoading, servicesPagination, serviceQuery, setServiceQuery, setServices, setServicesPagination, fetchServices } = useServicesAdmin({ debouncedSearch, showToast })
  const { inventory, inventoryStats, salesReport, setInventory, setInventoryStats, setSalesReport, fetchInventory, fetchSalesReport } = useInventoryAdmin({ products, showToast })

  // Filters
  const [userRoleFilter, setUserRoleFilter] = useState('all')
  const [userStatusFilter, setUserStatusFilter] = useState('all')

  // Data state
  const [wizardTab, setWizardTab] = useState('basic')
  const [inventorySubTab, setInventorySubTab] = useState('products')

  // Inventory tab state - separate for products and parts
  const [productsInventoryFilter, setProductsInventoryFilter] = useState({ search: '', status: 'all', category: '', sort: 'name_asc', page: 1 })
  const [partsInventoryFilter, setPartsInventoryFilter] = useState({ search: '', status: 'all', category: 'all', sort: 'name_asc', page: 1 })
  const INVENTORY_SUB_TABS = [
    { id: 'products', label: 'Products', icon: Package },
    { id: 'guitar-parts', label: 'Guitar Parts', icon: Guitar },
  ]

  // Orders tab state
  const [expandedOrderIds, setExpandedOrderIds] = useState(new Set())
  const [orderStatusFilter, setOrderStatusFilter] = useState('all')
  const [orderSort, setOrderSort] = useState('newest')
  const [orderPage, setOrderPage] = useState(1)
  const ORDERS_PAGE_SIZE = 10

  // Dashboard deep-link filters – set by Dashboard before tab navigation, consumed on mount, reset to 'all' after
  const [dashboardOrderPaymentFilter, setDashboardOrderPaymentFilter] = useState('all')
  const [dashboardOrderStatusFilter, setDashboardOrderStatusFilter] = useState('all')
  const [dashboardAppointmentStatusFilter, setDashboardAppointmentStatusFilter] = useState('all')

  // Redirect context: set when admin is sent from ProjectTaskTracker → OrdersTab to verify a payment.
  // Stores the source { order, projectData } so we can auto-open the right order and prompt the admin to return.
  const [orderRedirectState, setOrderRedirectState] = useState(null)
  // Set to the updated order after the admin verifies payment from a redirect, to show the return prompt.
  const [postPaymentUpdatedOrder, setPostPaymentUpdatedOrder] = useState(null)

  // Dashboard deep-link filters are one-shot: DashboardTab sets them right before
  // switching tabs and the target tab applies them on mount via the existing
  // initial-filter props (OrdersTab → OrderManagement, AppointmentsTab). Reset
  // them immediately after that mount so a later sidebar navigation or an order
  // redirect never re-applies a stale dashboard filter.
  useEffect(() => {
    if (activeTab === 'orders') {
      setDashboardOrderPaymentFilter('all')
      setDashboardOrderStatusFilter('all')
    }
    if (activeTab === 'appointments') {
      setDashboardAppointmentStatusFilter('all')
    }
  }, [activeTab])

  // Projects tab state
  const [projectStatusFilter, setProjectStatusFilter] = useState('all')
  const [projectAssignedFilter, setProjectAssignedFilter] = useState('all')
  const [projectGuitarTypeFilter, setProjectGuitarTypeFilter] = useState('all')
  const [projectDateFrom, setProjectDateFrom] = useState('')
  const [projectDateTo, setProjectDateTo] = useState('')
  const [projectDueDateFrom, setProjectDueDateFrom] = useState('')
  const [projectDueDateTo, setProjectDueDateTo] = useState('')
  const [projectCompletionFilter, setProjectCompletionFilter] = useState('all')
  const [projectSort, setProjectSort] = useState('updated')
  const [projectSortDirection, setProjectSortDirection] = useState('desc')
  const [projectPage, setProjectPage] = useState(1)
  const [projectPageSize, setProjectPageSize] = useState(10)
  const [projectArchiveTab, setProjectArchiveTab] = useState('active')
  const [archivedProjects, setArchivedProjects] = useState([])
  const [archivedProjectsPagination, setArchivedProjectsPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 })

  // Inventory tab state
  const [expandedInventoryIds, setExpandedInventoryIds] = useState(new Set())
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState('all')
  const [inventorySort, setInventorySort] = useState('name_asc')
  const [inventoryPage, setInventoryPage] = useState(1)
  const [inventoryPageSize, setInventoryPageSize] = useState(10)
  const [optimisticStock, setOptimisticStock] = useState({})
  const [adjustPopover, setAdjustPopover] = useState({ open: false, itemId: null, amount: 0, name: '' })
  const [form, setForm] = useState({})
  const [formErrors, setFormErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  
  // Appointment Management state
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [appointmentFormOpen, setAppointmentFormOpen] = useState(false)
  const [appointmentFormData, setAppointmentFormData] = useState(null)
  const [unavailableDatesOpen, setUnavailableDatesOpen] = useState(false)
  const [openOverrides, setOpenOverrides] = useState([])
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null)
  
  const [orderStatusDropdownOpen, setOrderStatusDropdownOpen] = useState(false)
  const [paymentStatusDropdownOpen, setPaymentStatusDropdownOpen] = useState(false)

  // Guitar Parts section state
  const [guitarPartViewMode, setGuitarPartViewMode] = useState('tree')
  const [expandedGuitarTypes, setExpandedGuitarTypes] = useState(new Set(['electric', 'general']))
  const [expandedPartCategories, setExpandedPartCategories] = useState(new Set())
  const [partDensity, setPartDensity] = useState('comfortable')
  const [partSearchQuery, setPartSearchQuery] = useState('')

  // Services section state
  const [serviceViewMode, setServiceViewMode] = useState('table')

  // Message panel
  const [messagePanelOpen, setMessagePanelOpen] = useState(false)
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [siteContactInfo, setSiteContactInfo] = useState(getSiteContactSnapshot)

  // ── Derived / filtered views ─────────────────────────────────────────────
  const visibleProducts = products || []
  const visibleParts = useMemo(() => (parts || []).map((part) => normalizeBuilderPart(part)), [parts])
  const productImageById = useMemo(
    () =>
      new Map(
        (products || []).map((product) => [
          product.product_id,
          product.primary_image || product.image_url || product.product_image || null,
        ])
      ),
    [products]
  )
  const visibleOrders = orders || []
  const visibleProjects = projects || []
  const visibleArchivedProjects = archivedProjects || []
  // The paginators render from the tab's own page and page-size state plus the server
  // total. Only the rows come from a request, so an in-flight refresh or a websocket
  // update can never repaint the control with a different page size.
  const projectsPaginationView = useMemo(
    () => buildProjectPaginationView({ page: projectPage, pageSize: projectPageSize, total: projectsPagination.total }),
    [projectPage, projectPageSize, projectsPagination.total]
  )
  const archivedProjectsPaginationView = useMemo(
    () => buildProjectPaginationView({ page: archivedProjectsPagination.page, pageSize: archivedProjectsPagination.pageSize, total: archivedProjectsPagination.total }),
    [archivedProjectsPagination.page, archivedProjectsPagination.pageSize, archivedProjectsPagination.total]
  )
  const visibleAppointments = useMemo(() => appointments || [], [appointments])
  const visibleCalendarAppointments = useMemo(() => calendarAppointments || [], [calendarAppointments])
  const normalizedUnavailableDates = useMemo(() => unavailableDates.map((entry) => entry?.date || entry).filter(Boolean), [unavailableDates])
  const visibleInventory = useMemo(() => {
    const source = (inventory && inventory.length > 0) ? inventory : (products || [])
    return source.map((item) => ({
      ...item,
      primary_image: item.primary_image || item.image_url || item.product_image || productImageById.get(item.product_id) || null,
    }))
  }, [inventory, products, productImageById])

  const visibleUsers = useMemo(() => {
    const query = searchQuery?.trim().toLowerCase()
    return (users || []).filter((u) => {
      if (userRoleFilter !== 'all' && u.role !== userRoleFilter) return false
      if (userStatusFilter !== 'all') {
        const active = userStatusFilter === 'active'
        if (u.is_active !== active) return false
      }
      if (query) {
        const fullName = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase()
        const email = (u.email || '').toLowerCase()
        const role = (u.role || '').toLowerCase().replace(/_/g, ' ')
        if (!fullName.includes(query) && !email.includes(query) && !role.includes(query)) {
          return false
        }
      }
      return true
    })
  }, [users, userRoleFilter, userStatusFilter, searchQuery])

  const inventoryPartCategoryOptions = useMemo(() => {
    const presentCategories = new Set((visibleParts || []).map((part) => part.inventory_category).filter(Boolean))
    return INVENTORY_PART_CATEGORY_OPTIONS.filter(({ value }) => presentCategories.has(value))
  }, [visibleParts])

  // Filtered and sorted orders
  const filteredOrders = useMemo(() => {
    let result = [...visibleOrders]
    if (orderStatusFilter !== 'all') {
      result = result.filter(o => o.status === orderStatusFilter)
    }
    result.sort((a, b) => {
      const aVal = a.created_at ? new Date(a.created_at).getTime() : 0
      const bVal = b.created_at ? new Date(b.created_at).getTime() : 0
      if (orderSort === 'newest') return bVal - aVal
      if (orderSort === 'oldest') return aVal - bVal
      const aAmt = a.total || a.total_amount || 0
      const bAmt = b.total || b.total_amount || 0
      if (orderSort === 'highest') return bAmt - aAmt
      if (orderSort === 'lowest') return aAmt - bAmt
      return 0
    })
    return result
  }, [visibleOrders, orderStatusFilter, orderSort])

  // Enhanced order stats for dashboard
  const enhancedOrderStats = useMemo(() => {
    const stats = {
      pending: 0,
      processing: 0,
      shipped: 0,
      out_for_delivery: 0,
      delivered: 0,
      cancelled: 0,
    }
    visibleOrders.forEach(o => {
      const status = o.status || 'pending'
      if (stats[status] !== undefined) {
        stats[status]++
      }
    })
    return stats
  }, [visibleOrders])

  const paginatedOrders = useMemo(() => {
    const start = (orderPage - 1) * ORDERS_PAGE_SIZE
    return filteredOrders.slice(start, start + ORDERS_PAGE_SIZE)
  }, [filteredOrders, orderPage])

  const orderStats = useMemo(() => {
    const now = new Date()
    const thisMonth = now.getMonth()
    const thisYear = now.getFullYear()
    const monthOrders = visibleOrders.filter(o => {
      const d = o.created_at ? new Date(o.created_at) : null
      return d && d.getMonth() === thisMonth && d.getFullYear() === thisYear
    })
    const revenue = monthOrders.reduce((sum, o) => sum + (o.total || o.total_amount || 0), 0)
    const pendingCount = visibleOrders.filter(o => o.status === 'pending').length
    return {
      revenue,
      orderCount: monthOrders.length,
      avgValue: monthOrders.length ? revenue / monthOrders.length : 0,
      pendingCount,
    }
  }, [visibleOrders])

  // Combined inventory items (products + parts)
  const inventoryItems = useMemo(() => {
    const prods = visibleInventory.map(p => ({ ...p, type: 'product', stock: p.stock, name: p.name, sku: p.sku, low_stock_threshold: p.low_stock_threshold, part_id: p.product_id }))
    const pts = visibleParts.map(p => ({ ...p, type: 'part', stock: Number(p.stock ?? p.quantity ?? 0), name: p.name, sku: p.type_mapping, low_stock_threshold: 10 }))
    return [...prods, ...pts]
  }, [visibleInventory, visibleParts])

  const filteredInventory = useMemo(() => {
    let result = [...inventoryItems]
    if (inventoryStatusFilter !== 'all') {
      result = result.filter(item => {
        const stock = Number(item.stock ?? 0)
        const threshold = item.type === 'product' ? Number(item.low_stock_threshold ?? 10) : 10
        const tier = getStockTier(stock, threshold, item.max_stock)
        if (inventoryStatusFilter === 'out_of_stock') return tier === 'out_of_stock'
        if (inventoryStatusFilter === 'low_stock' || inventoryStatusFilter === 'critical') return tier === 'critical'
        if (inventoryStatusFilter === 'attention' || inventoryStatusFilter === 'issues') return tier === 'out_of_stock' || tier === 'critical'
        if (inventoryStatusFilter === 'warning') return tier === 'warning'
        if (inventoryStatusFilter === 'healthy') return tier === 'healthy'
        return true
      })
    }
    result.sort((a, b) => {
      if (inventorySort === 'name_asc') return (a.name || '').localeCompare(b.name || '')
      if (inventorySort === 'name_desc') return (b.name || '').localeCompare(a.name || '')
      if (inventorySort === 'category_asc') return (a.category_name || a.inventory_category || '').localeCompare(b.category_name || b.inventory_category || '')
      if (inventorySort === 'category_desc') return (b.category_name || b.inventory_category || '').localeCompare(a.category_name || a.inventory_category || '')
      if (inventorySort === 'date_modified_asc') return new Date(a.updated_at || 0) - new Date(b.updated_at || 0)
      if (inventorySort === 'date_modified_desc') return new Date(b.updated_at || 0) - new Date(a.updated_at || 0)
      if (inventorySort === 'sku_asc') return (a.sku || '').localeCompare(b.sku || '')
      if (inventorySort === 'sku_desc') return (b.sku || '').localeCompare(a.sku || '')
      if (inventorySort === 'stock_asc') return Number(a.stock || 0) - Number(b.stock || 0)
      if (inventorySort === 'stock_desc') return Number(b.stock || 0) - Number(a.stock || 0)
      return 0
    })
    return result
  }, [inventoryItems, inventoryStatusFilter, inventorySort])

  // Separate filtered inventory for Products sub-tab
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
        if (statusFilter === 'low_stock' || statusFilter === 'critical') return tier === 'critical'
        if (statusFilter === 'attention' || statusFilter === 'issues') return tier === 'out_of_stock' || tier === 'critical'
        if (statusFilter === 'warning') return tier === 'warning'
        if (statusFilter === 'healthy') return tier === 'healthy'
        return true
      })
    }
    const categoryFilter = productsInventoryFilter.category
    if (categoryFilter) {
      result = result.filter((item) => String(item.category_id) === String(categoryFilter))
    }
    result.sort((a, b) => {
      if (productsInventoryFilter.sort === 'name_asc') return (a.name || '').localeCompare(b.name || '')
      if (productsInventoryFilter.sort === 'name_desc') return (b.name || '').localeCompare(a.name || '')
      if (productsInventoryFilter.sort === 'category_asc') return (a.category_name || '').localeCompare(b.category_name || '')
      if (productsInventoryFilter.sort === 'category_desc') return (b.category_name || '').localeCompare(a.category_name || '')
      if (productsInventoryFilter.sort === 'date_modified_asc') return new Date(a.updated_at || 0) - new Date(b.updated_at || 0)
      if (productsInventoryFilter.sort === 'date_modified_desc') return new Date(b.updated_at || 0) - new Date(a.updated_at || 0)
      if (productsInventoryFilter.sort === 'sku_asc') return (a.sku || '').localeCompare(b.sku || '')
      if (productsInventoryFilter.sort === 'sku_desc') return (b.sku || '').localeCompare(a.sku || '')
      if (productsInventoryFilter.sort === 'stock_asc') return Number(a.stock || 0) - Number(b.stock || 0)
      if (productsInventoryFilter.sort === 'stock_desc') return Number(b.stock || 0) - Number(a.stock || 0)
      return 0
    })
    return result
  }, [visibleInventory, productsInventoryFilter])

  const paginatedProductsInventory = useMemo(() => {
    const start = (inventoryPage - 1) * inventoryPageSize
    return filteredProductsInventory.slice(start, start + inventoryPageSize)
  }, [filteredProductsInventory, inventoryPage])

  // Separate filtered inventory for Guitar Parts sub-tab
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
        String(INVENTORY_PART_CATEGORY_LABELS[item.inventory_category] || '').toLowerCase().includes(searchTerm)
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
        const threshold = 10 // parts always use 10 as threshold
        const tier = getStockTier(stock, threshold, item.max_stock)
        if (statusFilter === 'out_of_stock') return tier === 'out_of_stock'
        if (statusFilter === 'low_stock' || statusFilter === 'critical') return tier === 'critical'
        if (statusFilter === 'attention' || statusFilter === 'issues') return tier === 'out_of_stock' || tier === 'critical'
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
  }, [visibleParts, partsInventoryFilter])

  const paginatedPartsInventory = useMemo(() => {
    const start = (inventoryPage - 1) * inventoryPageSize
    return filteredPartsInventory.slice(start, start + inventoryPageSize)
  }, [filteredPartsInventory, inventoryPage])

  const paginatedInventory = useMemo(() => {
    const start = (inventoryPage - 1) * inventoryPageSize
    return filteredInventory.slice(start, start + inventoryPageSize)
  }, [filteredInventory, inventoryPage])

  const inventoryHealthData = (() => {
    const productList = (visibleInventory && visibleInventory.length > 0) ? visibleInventory : (visibleProducts || [])
    const productItems = productList.map((p) => ({ stock: Number(p.stock ?? 0), threshold: Number(p.low_stock_threshold ?? 10), maxStock: Number(p.max_stock ?? 0) }))
    const partItems = visibleParts.map((p) => ({ stock: Number(p.stock ?? p.quantity ?? 0), threshold: 10, maxStock: 0 }))
    const items = [...productItems, ...partItems]
    if (items.length === 0) return { value: '0%', status: 'Healthy', statusClass: 'text-emerald-400', iconBg: 'bg-emerald-500/15', outOfStockCount: 0, lowStockCount: 0, totalAttentionCount: 0 }
    let critical = false, warning = false, healthyCount = 0
    let outOfStockCount = 0, lowStockCount = 0
    productItems.forEach(({ stock, threshold, maxStock }) => {
      const tier = getStockTier(stock, threshold, maxStock)
      if (tier === 'out_of_stock') outOfStockCount += 1
      else if (tier === 'critical') lowStockCount += 1
    })
    items.forEach(({ stock, threshold, maxStock }) => {
      const tier = getStockTier(stock, threshold, maxStock)
      if (tier === 'out_of_stock' || tier === 'critical') critical = true
      else if (tier === 'warning') warning = true
      else healthyCount += 1
    })
    const status = critical ? 'Critical' : warning ? 'Warning' : 'Healthy'
    const statusClass = critical ? 'text-red-400' : warning ? 'text-amber-400' : 'text-emerald-400'
    const iconBg = critical ? 'bg-red-500/15' : warning ? 'bg-amber-500/15' : 'bg-emerald-500/15'
    return {
      value: `${Math.round((healthyCount / items.length) * 100)}%`,
      status,
      statusClass,
      iconBg,
      outOfStockCount,
      lowStockCount,
      totalAttentionCount: outOfStockCount + lowStockCount,
    }
  })()

  useEffect(() => {
    let isMounted = true
    refreshSiteContact().then((contact) => {
      if (isMounted) setSiteContactInfo(contact)
    })
    return () => { isMounted = false }
  }, [])

  const saveSiteContactInfo = useCallback(async () => {
    const cleanEmail = siteContactInfo.email.trim()
    const rawPhone = siteContactInfo.phone.trim()
    const cleanPhone = normalizePhoneForSubmit(rawPhone)

    if (!cleanEmail || !rawPhone) {
      showToast('Email and phone are required', 'error')
      return
    }
    if (!isValidPhoneNumber(rawPhone) || !cleanPhone) {
      showToast(PHONE_ERROR_MESSAGE, 'error')
      return
    }

    try {
      const response = await adminApi.updateContactSettings({ email: cleanEmail, phone: cleanPhone })
      const savedContact = response.data || { email: cleanEmail, phone: cleanPhone }
      setSiteContactInfo(savedContact)
      publishSiteContact(savedContact)
      showToast('Site contact information saved')
    } catch (error) {
      showToast(error.message || 'Failed to save contact info', 'error')
    }
  }, [showToast, siteContactInfo])

  const syncLandingServiceConfig = useCallback((service) => {
    if (!service || !service.name) return

    try {
      const storageKey = 'cosmoscraft.landing.services'
      const raw = window.localStorage.getItem(storageKey)
      const existing = raw ? JSON.parse(raw) : []
      const normalizedExisting = Array.isArray(existing) ? existing : []
      const nextItem = {
        serviceId: service.service_id ?? null,
        title: form.name || service.name,
        text: form.landing_text || form.description || service.description || 'Premium service tailored for your instrument.',
        image: service.image_url || form.image_url || form.image || '',
        href: `/appointments?step=2&service=${encodeURIComponent((form.name || service.name).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' '))}&serviceName=${encodeURIComponent(form.name || service.name)}`,
        enabled: Boolean(service.is_active ?? form.is_active ?? true),
        order: Number(form.landing_order ?? 1),
      }

      const merged = normalizedExisting.filter((item) => String(item.serviceId ?? item.id) !== String(service.service_id))
      if (nextItem.enabled) {
        merged.push(nextItem)
      }

      merged.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
      window.localStorage.setItem(storageKey, JSON.stringify(merged))
      window.dispatchEvent(new CustomEvent('cosmoscraft-landing-services-updated'))
    } catch {
      showToast('Failed to sync landing page service settings', 'error')
    }
  }, [form, showToast])

  // ── Confirm dialog helper ────────────────────────────────────────────────
  const openConfirm = ({ title, description, onConfirm, variant = 'danger', confirmLabel = 'Confirm', cancelLabel = 'Cancel' }) => {
    setConfirm({ open: true, title, description, confirmLabel, cancelLabel, onConfirm, isBusy: false, variant })
  }
  const closeConfirm = () => setConfirm(c => ({ ...c, open: false }))
  const handleConfirmAction = async () => {
    setConfirm(c => ({ ...c, isBusy: true }))
    try {
      await confirm.onConfirm()
    } finally {
      setConfirm(c => ({ ...c, open: false, isBusy: false }))
    }
  }

  const handleLogout = () => {
    openConfirm({
      title: 'Log out',
      description: 'Are you sure you want to log out of the admin workspace?',
      confirmLabel: 'Log out',
      cancelLabel: 'Cancel',
      variant: 'warning',
      onConfirm: async () => {
        await logout()
        navigate('/')
      },
    })
  }

  // ── Data fetching ────────────────────────────────────────────────────────
  const buildProjectQuery = useCallback((pageNum = 1) => {
    const params = {
      search: debouncedSearch || undefined,
      status: projectStatusFilter === 'all' ? undefined : projectStatusFilter,
      assigned_to: projectAssignedFilter === 'all' ? undefined : projectAssignedFilter,
      guitar_type: projectGuitarTypeFilter === 'all' ? undefined : projectGuitarTypeFilter,
      date_from: projectDateFrom || undefined,
      date_to: projectDateTo || undefined,
      due_date_from: projectDueDateFrom || undefined,
      due_date_to: projectDueDateTo || undefined,
      completion_percentage: projectCompletionFilter === 'all' ? undefined : projectCompletionFilter,
      include_tasks: true,
      page: pageNum,
      page_size: projectPageSize,
      sort_by: ({ updated: 'updated_at', created: 'created_at', name: 'project_name', customer: 'customer_name', progress: 'progress', due: 'estimated_completion_date', status: 'status' })[projectSort] || 'updated_at',
      sort_dir: projectSortDirection,
    }
    Object.keys(params).forEach((key) => params[key] === undefined && delete params[key])
    return params
  }, [debouncedSearch, projectStatusFilter, projectAssignedFilter, projectGuitarTypeFilter, projectDateFrom, projectDateTo, projectDueDateFrom, projectDueDateTo, projectCompletionFilter, projectSort, projectSortDirection, projectPageSize])

  // Every projects read reuses the shared page size, and the Projects tab adds its
  // active page, filters and sort. A bare fetchProjects() falls back to the API default
  // page size of 20, which both repainted the shared paginator with 20 and left 20 rows
  // in the store — opening the tab then rendered those rows before the real page
  // arrived. Dashboard reads stay capped at one page of the same size so the stored
  // rows never outgrow what the tab can show.
  const refreshProjects = useCallback(() => (
    activeTab === 'projects'
      ? fetchProjects(buildProjectQuery(projectPage))
      : fetchProjects({ page: 1, page_size: projectPageSize })
  ), [activeTab, buildProjectQuery, fetchProjects, projectPage, projectPageSize])

  // Appointment action handlers
  const handleAppointmentStatusChange = useCallback(async (id, status, reason) => {
    try {
      await adminApi.updateAppointmentStatus(id, status, reason)
      showToast('Appointment status updated', 'success')
      fetchAppointments()
    } catch (e) { showToast(e.message, 'error') }
  }, [showToast, fetchAppointments])

  const handleAppointmentReschedule = useCallback(async (id, newScheduledAt, reason) => {
    try {
      await adminApi.rescheduleAppointment(id, newScheduledAt, reason)
      showToast('Appointment rescheduled', 'success')
      fetchAppointments()
    } catch (e) { showToast(e.message, 'error') }
  }, [showToast, fetchAppointments])

  const handleAppointmentCancel = useCallback(async (id, reason) => {
    try {
      await adminApi.cancelAppointment(id, reason)
      showToast('Appointment cancelled', 'success')
      fetchAppointments()
    } catch (e) { showToast(e.message, 'error') }
  }, [showToast, fetchAppointments])

  const handleAppointmentPaymentStatusUpdate = useCallback(async (id, paymentStatus) => {
    try {
      const response = await adminApi.updateAppointmentPaymentStatus(id, paymentStatus)
      const updated = response.data?.appointment
      setSelectedAppointment(prev => prev && (prev.appointment_id || prev.id) === id ? { ...prev, ...updated } : prev)
      setModal(prev => prev?.type === 'view_appointment' && (prev.data?.appointment_id || prev.data?.id) === id ? { ...prev, data: { ...prev.data, ...updated } } : prev)
      showToast(`Payment status updated to ${paymentStatus}`, 'success')
      await Promise.allSettled([fetchAppointments(), fetchCalendarAppointments()])
      return updated
    } catch (e) { showToast(e.message, 'error'); throw e }
  }, [showToast, fetchAppointments, fetchCalendarAppointments])

  const handleCreateAppointment = useCallback(async (data) => {
    try {
      await adminApi.createAppointment(data)
      showToast('Appointment created successfully', 'success')
      fetchAppointments()
    } catch (e) { showToast(e.message, 'error') }
  }, [showToast, fetchAppointments])

  const handleAddUnavailableDate = useCallback(async (date, reason) => {
    try {
      await adminApi.setUnavailableDate(date, reason)
      showToast('Date marked as unavailable', 'success')
      fetchUnavailableDates()
    } catch (e) { showToast(e.message, 'error') }
  }, [showToast, fetchUnavailableDates])

  const handleRemoveUnavailableDate = useCallback(async (dateId) => {
    try {
      await adminApi.removeUnavailableDate(dateId)
      showToast('Date availability restored', 'success')
      fetchUnavailableDates()
    } catch (e) { showToast(e.message, 'error') }
  }, [showToast, fetchUnavailableDates])

  const fetchOpenOverrides = useCallback(async () => {
    try {
      const res = await adminApi.getOpenOverrides()
      setOpenOverrides(res.data?.open_overrides || [])
    } catch (e) { /* silent */ }
  }, [])

  const handleAddOpenOverride = useCallback(async (date) => {
    try {
      await adminApi.addOpenOverride(date)
      showToast('Holiday marked as open', 'success')
      fetchOpenOverrides()
    } catch (e) { showToast(e.message, 'error') }
  }, [showToast, fetchOpenOverrides])

  const handleRemoveOpenOverride = useCallback(async (id) => {
    try {
      await adminApi.removeOpenOverride(id)
      showToast('Holiday reverted to closed', 'success')
      fetchOpenOverrides()
    } catch (e) { showToast(e.message, 'error') }
  }, [showToast, fetchOpenOverrides])

  // ── Initial data load on tab change ─────────────────────────────────────
  useEffect(() => {
    setSearchQuery('')
    setFormErrors({})
    const loaders = {
      'products': () => { fetchProducts(); fetchCategories(); },
      'guitar-parts': () => { fetchParts(); },
      'product-categories': () => { fetchCategories(); },
      'users': fetchUsers,
      'orders': fetchOrders,
      'projects': refreshProjects,
      'appointments': () => { fetchAppointments(); fetchCalendarAppointments(); fetchServices(); fetchUnavailableDates(); fetchAvailableDates(); },
      'inventory': () => { fetchInventory(); fetchParts(); fetchProducts(); },
      'pos': () => { fetchInventory(); fetchProducts(); },
      'sales-report': fetchSalesReport,
      'dashboard': () => { fetchOrders(); refreshProjects(); fetchAppointments(); fetchCalendarAppointments(); fetchSalesReport(); fetchInventory({ silent: true }); fetchProducts(); },
    }
    loaders[activeTab]?.()
  }, [activeTab]) // run only when switching tabs

  useEffect(() => {
    if (activeTab === 'users') fetchAppointmentCapacity()
  }, [activeTab, fetchAppointmentCapacity])

   // ── Re-fetch when debounced search changes ───────────────────────────────
   useEffect(() => {
     if (activeTab === 'products') {
       setProductQuery((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }))
     }
     if (activeTab === 'guitar-parts') {
       setPartQuery((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }))
     }
     if (activeTab === 'services') {
       setServiceQuery(prev => (prev.page === 1 ? prev : { ...prev, page: 1 }))
     }
      if (activeTab === 'users') fetchUsers()
      if (activeTab === 'orders') fetchOrders()
      // Projects are handled by the query effect below: it rebuilds the request with the
      // new search term, and a bare fetchProjects() here would race it back to the
      // API default page size.
      if (activeTab === 'appointments') { fetchAppointments(); fetchCalendarAppointments(); }
     if (activeTab === 'inventory') { fetchInventory(); fetchParts(); }
     if (activeTab === 'pos') fetchInventory()
    }, [debouncedSearch]) // eslint-disable-line

    // ── Re-fetch projects when filters/sort/page change ─────────────────────
    useEffect(() => {
      if (activeTab === 'projects') {
        fetchProjects(buildProjectQuery(projectPage))
      }
    }, [activeTab, projectPage, fetchProjects, buildProjectQuery])

    useEffect(() => {
      setProjectPage(1)
    }, [projectStatusFilter, projectAssignedFilter, projectGuitarTypeFilter, projectDateFrom, projectDateTo, projectDueDateFrom, projectDueDateTo, projectCompletionFilter, projectSort, projectSortDirection, debouncedSearch])

    useEffect(() => {
      setArchivedProjectsPagination((prev) => ({ ...prev, page: 1 }))
    }, [projectStatusFilter, projectAssignedFilter, projectGuitarTypeFilter, projectDateFrom, projectDateTo, projectDueDateFrom, projectDueDateTo, projectCompletionFilter, projectSort, projectSortDirection, debouncedSearch])

  useEffect(() => {
    if (activeTab === 'products') fetchProducts()
  }, [activeTab, fetchProducts])

   useEffect(() => {
     if (activeTab === 'guitar-parts') fetchParts()
   }, [activeTab, fetchParts])

   useEffect(() => {
     if (activeTab === 'services') fetchServices()
   }, [activeTab, fetchServices])

  // ── Real-time Event-Driven Updates for Admin Dashboard ─────────────────
  // Appointment changes often arrive in bursts (the no-show sweep publishes one
  // event per appointment), so the list and the calendar are re-read once per
  // burst instead of once per event.
  const refreshAppointmentsRealtime = useDebouncedCallback(() => {
    fetchAppointments({ silent: true })
    fetchCalendarAppointments()
  })

  useSocketEvent('order:created', () => {
    fetchOrders()
    fetchInventory({ silent: true })
    if (['dashboard', 'sales-report'].includes(activeTab)) {
      fetchSalesReport()
    }
    showToast('New order received!', 'info')
  })

  useSocketEvent('order:updated', () => {
    fetchOrders()
    fetchInventory({ silent: true })
    if (['dashboard', 'sales-report'].includes(activeTab)) {
      fetchSalesReport()
    }
  })

  useSocketEvent('payment:created', () => {
    fetchOrders()
    if (['dashboard', 'sales-report'].includes(activeTab)) {
      fetchSalesReport()
    }
  })

  useSocketEvent('payment:updated', () => {
    fetchOrders()
    if (['dashboard', 'sales-report'].includes(activeTab)) {
      fetchSalesReport()
    }
  })

  useSocketEvent('appointment:created', () => {
    refreshAppointmentsRealtime()
    showToast('New appointment booked!', 'info')
  })

  useSocketEvent('appointment:updated', (data) => {
    const updated = data?.appointment
    const id = updated?.appointment_id || updated?.id
    if (id) {
      setSelectedAppointment(prev => prev && String(prev.appointment_id || prev.id) === String(id)
        ? { ...prev, ...updated } : prev)
    }
    refreshAppointmentsRealtime()
  })

  useSocketEvent('appointment:schedule_updated', () => {
    // Availability edits change which slots exist, so the list, the calendar and
    // the blocked/available day pickers all have to be re-read.
    refreshAppointmentsRealtime()
    fetchUnavailableDates()
    fetchAvailableDates()
    fetchOpenOverrides()
  })

  useSocketEvent('project:updated', () => {
    refreshProjects()
  })

  useSocketEvent('stock:updated', () => {
    fetchInventory({ silent: true })
    fetchProducts()
  })

  useSocketEvent('inventory:updated', () => {
    fetchInventory({ silent: true })
    fetchProducts()
  })

  useSocketEvent('product:updated', () => {
    fetchProducts()
    fetchInventory({ silent: true })
  })

  useSocketEvent('product:created', () => {
    fetchProducts()
    fetchInventory({ silent: true })
  })

  useSocketEvent('product:deleted', () => {
    fetchProducts()
    fetchInventory({ silent: true })
  })

  useSocketEvent('builder-part:updated', () => {
    fetchParts()
  })

  useSocketEvent('builder-part:created', () => {
    fetchParts()
  })

  useSocketEvent('builder-part:deleted', () => {
    fetchParts()
  })

  useSocketEvent('pos:sale_completed', (data) => {
    if (['dashboard', 'pos', 'sales-report', 'inventory'].includes(activeTab)) {
      fetchSalesReport()
      fetchInventory({ silent: true })
    }
    if (data?.saleNumber) {
      showToast(`POS Sale completed: ${data.saleNumber}`, 'info')
    }
  })

  useSocketEvent('pos:sale_updated', () => {
    // A void/return changes today's figures and puts stock back, so the report
    // and every inventory-backed view have to follow.
    if (['dashboard', 'pos', 'sales-report', 'inventory'].includes(activeTab)) {
      fetchSalesReport()
      fetchInventory({ silent: true })
    }
  })

  useSocketEvent('refund:created', () => {
    fetchOrders()
    showToast('New refund request submitted!', 'info')
  })

  useSocketEvent('refund:updated', () => {
    fetchOrders()
  })

  // Events published while the socket was down never arrive, so re-read the data
  // this tab is actually showing once the connection is restored.
  useSocketEvent('connect', () => {
    if (['appointments', 'dashboard'].includes(activeTab)) {
      fetchAppointments({ silent: true })
      fetchCalendarAppointments()
      fetchUnavailableDates()
      fetchAvailableDates()
      fetchOpenOverrides()
    }
    if (['dashboard', 'pos', 'inventory', 'sales-report'].includes(activeTab)) {
      fetchInventory({ silent: true })
    }
  })

  const handleRefresh = () => {
    setIsLoading(true)
    setLastRefreshed(Date.now())
    const map = {
      'products': fetchProducts,
      'guitar-parts': fetchParts,
      'product-categories': fetchCategories,
      'orders': fetchOrders,
      'projects': refreshProjects,
      'services': fetchServices,
      'users': async () => { await fetchUsers(); await fetchAppointmentCapacity(); },
      'appointments': async () => { await fetchAppointments({ silent: true }); fetchCalendarAppointments(); },
      'inventory': () => fetchInventory({ silent: true }),
      'pos': () => fetchInventory({ silent: true }),
      'sales-report': fetchSalesReport,
      'dashboard': async () => { await fetchOrders(); await refreshProjects(); await fetchAppointments({ silent: true }); fetchCalendarAppointments(); await fetchSalesReport() },
    }
    map[activeTab]?.()?.finally(() => setIsLoading(false))
  }

   // ── Modal helpers ────────────────────────────────────────────────────────
   const openModal = (type, data = null) => {
     let initialForm = data ? { ...data } : {}

     // Aligns primary_image coming from API to image_url used in form wizard
     if (type === 'product' && data?.primary_image) {
       initialForm.image_url = data.primary_image
     }

    // Initialize status fields for order-details modal
    if (type === 'order-details' && data) {
      initialForm.order_status = data.status || 'pending'
      initialForm.payment_status = normalizePaymentStatus(data.payment_status || data.payment?.status)
    }

     // Convert duration_minutes (from API) to duration (hours for form)
     if (type === 'service' && data?.duration_minutes) {
       initialForm.duration = Number(data.duration_minutes) / 60
     }


      if (type === 'part') {
        const normalizedPart = normalizeBuilderPart(initialForm)
        initialForm = {
          guitar_type: 'electric',
          part_category: '',
          type_mapping: '',
          builder_category: '',
          inventory_category: '',
          stock: 0,
          price: 0,
          is_active: true,
          ...normalizedPart,
        }
        initialForm.builder_category =
          initialForm.builder_category || getBuilderCategoryForTypeMapping(initialForm.type_mapping)
        initialForm.part_category =
          initialForm.part_category || SLOT_TO_PART_CATEGORY[initialForm.type_mapping] || ''
        initialForm.inventory_category =
          normalizeInventoryPartCategory(initialForm.inventory_category) ||
          deriveInventoryPartCategory(initialForm)
        initialForm.option_key = initialForm.metadata?.option_key || initialForm.option_key || ''  // ← add this line
      }

     setForm(initialForm)
     setFormErrors({})
     if (type === 'product') setWizardTab('basic')
     setModal({ open: true, type, data })
   }

  // The in-memory `parts` list is search-scoped and is not loaded on every tab, so a
  // project's linked part is often missing from it. Always fall back to a direct
  // by-id fetch so restocking works regardless of the current tab/search state.
  const resolveBuilderPart = async (partId) => {
    if (!partId) return null
    const id = String(partId)
    const cached = visibleParts.find((part) => String(part.part_id) === id)
    if (cached) return cached

    try {
      const response = await adminApi.getBuilderPart(id)
      const part = response?.data?.part || response?.data || response?.part
      return part ? normalizeBuilderPart(part) : null
    } catch (error) {
      console.error('Failed to load linked builder part:', error)
      return null
    }
  }

  // Same story for product-backed inventory: `visibleInventory` is not loaded on
  // every tab, so fall back to a direct by-id fetch.
  const resolveInventoryProduct = async (productId) => {
    if (!productId) return null
    const id = String(productId)
    const cached = visibleInventory.find((item) => String(item.product_id) === id)
    if (cached) return cached

    try {
      const response = await adminApi.getInventoryProduct(id)
      const product = response?.data?.product || response?.data || response?.product
      return product || null
    } catch (error) {
      console.error('Failed to load linked inventory product:', error)
      return null
    }
  }

  const handleProjectPartRestock = async (requiredPart) => {
    // Customer-added required parts are backed by a product, not a builder part,
    // so they are restocked from Inventory > Products instead of Guitar Parts.
    if (!requiredPart?.builder_part_id && !requiredPart?.part_id) {
      if (requiredPart?.product_id) {
        const product = await resolveInventoryProduct(requiredPart.product_id)
        setActiveTab('inventory')
        setInventorySubTab('products')
        setInventoryPage(1)
        setProductsInventoryFilter((prev) => ({ ...prev, search: requiredPart?.name || '', status: 'all', category: '', page: 1 }))

        if (!product) {
          setModal({ open: false, type: null, data: null })
          showToast('The linked Products inventory record could not be found.', 'error')
          return
        }

        openModal('inventory', {
          ...product,
          current_stock: Number(product.stock ?? 0),
          change_type: 'stock_in',
        })
        return
      }

      setModal({ open: false, type: null, data: null })
      showToast('This part has no linked inventory record to restock.', 'error')
      return
    }

    const inventoryPart = await resolveBuilderPart(requiredPart.builder_part_id || requiredPart.part_id)

    setActiveTab('inventory')
    setInventorySubTab('guitar-parts')
    setInventoryPage(1)
    setPartsInventoryFilter((prev) => ({ ...prev, search: requiredPart?.name || '', status: 'all', category: 'all', page: 1 }))

    if (!inventoryPart) {
      setModal({ open: false, type: null, data: null })
      showToast('The linked Guitar Parts inventory record could not be found.', 'error')
      return
    }

    openModal('part_inventory', {
      ...inventoryPart,
      current_stock: Number(inventoryPart.stock ?? inventoryPart.quantity ?? 0),
      change_type: 'stock_in',
    })
  }

  const handleManageCustomizationProject = async (order) => {
    setActiveTab('projects')
    let project = null
    const projectId = order?.project_id || order?.project?.project_id || (typeof order === 'string' ? order : null)

    if (projectId) {
      try {
        const response = await adminApi.getProject(projectId)
        project = response?.data || response
      } catch (error) {
        console.error('Failed to get project by projectId:', error)
      }
    }

    if (!project && (order?.order_id || order?.order_number)) {
      try {
        const searchVal = order.order_number || order.order_id
        const response = await adminApi.getProjects({ search: searchVal, page: 1, page_size: 10 })
        const list = response?.data?.projects || response?.projects || response?.data || []
        project = list.find((p) => String(p.order_id) === String(order.order_id) || String(p.order_number) === String(order.order_number)) || list[0]
      } catch (error) {
        console.error('Failed to find project by order info:', error)
      }
    }

    if (project?.project_id) {
      openModal('project_tasks', {
        ...project,
        source_order: order || null,
      })
    } else if (order) {
      showToast('This customization order does not have an associated project yet.', 'error')
    }
  }

  const closeModal = () => {
    const shouldRefreshProjects = modal.type === 'project_tasks'
    setModal({ open: false, type: null, data: null })
    setFormErrors({})
    setOrderStatusDropdownOpen(false)
    setPaymentStatusDropdownOpen(false)
    if (shouldRefreshProjects) refreshProjects()
  }

  // ── Form validation helper ───────────────────────────────────────────────
  const validateAndSave = (rules, saveFn) => async () => {
    const errors = validate(rules, form)
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return }
    await saveFn()
  }

  // ── CRUD: Products ───────────────────────────────────────────────────────
  const saveProduct = async ({ addAnother = false } = {}) => {
    setIsSaving(true)
    try {
      let finalImageUrl = form.image_url
      if (form.image_file) {
        finalImageUrl = await uploadToCloudinary(form.image_file)
      }
      
      // Ensure numbers are properly converted
      const payload = {
        ...form,
        image_url: finalImageUrl,
        price: Number(form.price),
        cost_price: form.cost_price !== '' && form.cost_price != null ? Number(form.cost_price) : 0,
        low_stock_threshold: form.low_stock_threshold !== '' && form.low_stock_threshold != null ? Number(form.low_stock_threshold) : 10,
        max_stock: form.max_stock !== '' && form.max_stock != null && Number(form.max_stock) > 0 ? Number(form.max_stock) : undefined,
      }
      delete payload.stock
      delete payload.image_file
      delete payload.preview_url

      if (modal.data?.product_id) {
        await adminApi.updateProduct(modal.data.product_id, payload)
        showToast('Product updated!')
      } else {
        await adminApi.createProduct(payload)
        showToast('Product created!')
      }
      fetchProducts()
      if (addAnother) {
        setForm({})
        setFormErrors({})
        setWizardTab('basic')
        setModal({ open: true, type: 'product', data: null })
      } else {
        closeModal()
      }
      return true
    } catch (e) {
      // Map field-level errors from the API to the form so they show inline.
      if (Array.isArray(e.fieldErrors) && e.fieldErrors.length > 0) {
        const mapped = {}
        for (const fe of e.fieldErrors) {
          if (fe?.field) mapped[fe.field] = fe.message || 'This field is required'
        }
        setFormErrors(mapped)
      } else {
        showToast(e.message, 'error')
      }
      return false
    }
    finally { setIsSaving(false) }
  }

  const deleteProduct = (id, name) => {
    openConfirm({
      title: 'Deactivate Product?',
      description: `"${name}" will be hidden from the shop. You can reactivate it at any time by editing the product.`,
      variant: 'warning',
      onConfirm: async () => {
        await adminApi.deleteProduct(id)
        showToast('Product deactivated')
        fetchProducts()
      },
    })
  }

  // ── CRUD: Categories ─────────────────────────────────────────────────────
  const saveCategory = async () => {
    setIsSaving(true)
    try {
      if (modal.data?.category_id) {
        const payload = { ...form, description: form.description ?? '' }
        await adminApi.updateCategory(modal.data.category_id, payload)
        showToast('Category updated!')
      } else {
        const payload = { ...form, description: form.description ?? '' }
        await adminApi.createCategory(payload)
        showToast('Category created!')
      }
      fetchCategories(); closeModal()
    } catch (e) { showToast(e.message, 'error') }
    finally { setIsSaving(false) }
  }

  const deleteCategory = (id, name) => {
    openConfirm({
      title: 'Delete Category?',
      description: `"${name}" will be permanently deleted. Products in this category will become uncategorized.`,
      variant: 'danger',
      onConfirm: async () => {
        await adminApi.deleteCategory(id)
        await fetchCategories()
        fetchProducts()
        showToast('Category deleted')
      },
    })
  }

  const toggleGuitarType = (guitarType) => {
    setExpandedGuitarTypes(prev => {
      const next = new Set(prev)
      if (next.has(guitarType)) {
        next.delete(guitarType)
      } else {
        next.add(guitarType)
      }
      return next
    })
  }

  const togglePartCategory = (categoryKey) => {
    setExpandedPartCategories(prev => {
      const next = new Set(prev)
      if (next.has(categoryKey)) {
        next.delete(categoryKey)
      } else {
        next.add(categoryKey)
      }
      return next
    })
  }

  const handleQuickAddPart = (guitarType, category) => {
    openModal('part', {
      guitar_type: guitarType,
      type_mapping: category,
      part_category: SLOT_TO_PART_CATEGORY[category] || 'misc',
      builder_category: getBuilderCategoryForTypeMapping(category),
    })
  }

  const migrateCurrentCatalog = (guitarType) => {
    const label = guitarType === 'bass' ? 'Bass' : 'Electric'
    openConfirm({
      title: `Sync ${label} Customization catalog?`,
      description: `Sync the current ${label} Customization catalog into Guitar Parts without deleting the other guitar type's catalog?`,
      confirmLabel: 'Sync Catalog',
      cancelLabel: 'Cancel',
      variant: 'info',
      onConfirm: async () => {
        try {
          const result = await adminApi.seedCustomizeBuilderParts(guitarType)
          setPartQuery((prev) => ({
            ...prev,
            guitar_type: guitarType,
            is_active: 'true',
            page: 1,
          }))
          const seeded = result.data?.seeded || {}
          const created = seeded.created || 0
          const updated = seeded.updated || 0
          showToast(`${label} catalog synced: ${created} new, ${updated} updated.`)
          await fetchParts()
        } catch (error) {
          showToast(error.message, 'error')
        }
      },
    })
  }

  const clearPartFilters = () => {
    setPartQuery({ page: 1, pageSize: partQuery.pageSize, sortBy: 'created_at', sortDir: 'desc', guitar_type: '', part_category: '', is_active: '', min_price: '', max_price: '' })
    setPartSearchQuery('')
  }

  const filteredParts = useMemo(() => {
    let result = [...visibleParts]
    if (partSearchQuery) {
      const q = partSearchQuery.toLowerCase()
      result = result.filter(p => 
        p.name?.toLowerCase().includes(q) || 
        p.part_category?.toLowerCase().includes(q) ||
        p.guitar_type?.toLowerCase().includes(q)
      )
    }
    return result
  }, [visibleParts, partSearchQuery])

  const [partSortConfig, setPartSortConfig] = useState({ sortBy: 'name', sortDir: 'asc' })

  const handlePartSort = (column) => {
    setPartSortConfig(prev => ({
      sortBy: column,
      sortDir: prev.sortBy === column && prev.sortDir === 'asc' ? 'desc' : 'asc'
    }))
  }

  const sortedFilteredParts = useMemo(() => {
    const sorted = [...filteredParts]
    const { sortBy, sortDir } = partSortConfig
    sorted.sort((a, b) => {
      let aVal = a[sortBy] ?? ''
      let bVal = b[sortBy] ?? ''
      if (sortBy === 'price') {
        aVal = Number(aVal) || 0
        bVal = Number(bVal) || 0
      } else {
        aVal = String(aVal).toLowerCase()
        bVal = String(bVal).toLowerCase()
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return sorted
  }, [filteredParts, partSortConfig])

  // ── CRUD: Builder Parts ──────────────────────────────────────────────────
  const savePart = async () => {
    setIsSaving(true)
    try {
      let finalImageUrl = form.image_url
      if (form.image_file) {
        finalImageUrl = await uploadToCloudinary(form.image_file)
      }
      const technicalPartCategory =
        form.part_category ||
        SLOT_TO_PART_CATEGORY[form.type_mapping] ||
        'misc'
      const payload = {
        ...form,
        image_url: finalImageUrl,
        part_category: technicalPartCategory,
        stock: Number(form.stock ?? 0) || 0,
        price: Number(form.price ?? 0) || 0,
        metadata: {
          ...(form.metadata && typeof form.metadata === 'object' ? form.metadata : {}),
          ...((form.metadata?.option_key?.trim() || form.option_key?.trim()) ? { option_key: (form.metadata?.option_key?.trim() || form.option_key?.trim()) } : {}),
          inventory_category:
            normalizeInventoryPartCategory(form.inventory_category) ||
            deriveInventoryPartCategory(form),
        },
      }
      delete payload.image_file
      delete payload.preview_url
      delete payload.inventory_category
      delete payload.quantity

      if (modal.data?.part_id) {
        await adminApi.updateBuilderPart(modal.data.part_id, payload)
        showToast('Builder Part updated!')
      } else {
        await adminApi.createBuilderPart(payload)
        showToast('Builder Part created!')
      }
      fetchParts(); closeModal()
    } catch (e) { showToast(e.message, 'error') }
    finally { setIsSaving(false) }
  }

  const deletePart = (id, name, isActive = true) => {
    if (isActive) {
      openConfirm({
        title: 'Deactivate Builder Part?',
        description: `"${name}" will be removed from the guitar configurator. Existing customizations using it will not be affected.`,
        variant: 'warning',
        onConfirm: async () => {
          await adminApi.deleteBuilderPart(id)
          showToast('Builder Part deactivated')
          fetchParts()
        },
      })
    } else {
      openConfirm({
        title: 'Permanently Delete Part?',
        description: `"${name}" will be permanently deleted and cannot be recovered.`,
        confirmLabel: 'Delete Permanently',
        variant: 'danger',
        onConfirm: async () => {
          try {
            await adminApi.deleteBuilderPart(id, { permanent: true })
            showToast('Builder Part permanently deleted')
            fetchParts()
          } catch (e) {
            showToast(e.message || 'Failed to permanently delete part', 'error')
          }
        },
      })
    }
  }

  // ── Image Upload ─────────────────────────────────────────────────────────
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validates image types (JPG, JPEG, PNG) as per storage requirements
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png']
    if (!validTypes.includes(file.type)) {
      showToast('Please upload a valid JPG or PNG file', 'error')
      if (e.target) e.target.value = '' // Clear input
      return
    }

    const previewUrl = URL.createObjectURL(file)
    setForm(f => ({ ...f, image_file: file, preview_url: previewUrl }))
  }

  // ── CRUD: Users ──────────────────────────────────────────────────────────
  const toggleUserStatus = (userId, currentStatus, name) => {
    const willActivate = !currentStatus
    openConfirm({
      title: willActivate ? 'Activate User?' : 'Deactivate User?',
      description: willActivate
        ? `${name} will regain access to the platform.`
        : `${name} will lose access to the platform. Their data will be preserved.`,
      variant: willActivate ? 'info' : 'warning',
      onConfirm: async () => {
        await adminApi.updateUserStatus(userId, willActivate)
        showToast(`User ${willActivate ? 'activated' : 'deactivated'}`)
        fetchUsers()
        fetchAppointmentCapacity()
      },
    })
  }

  const changeUserRole = async (userId, newRole) => {
    try {
      await adminApi.updateUserRole(userId, newRole)
      showToast(`Role updated to ${newRole.replace('_', ' ')}`)
      fetchUsers()
      fetchAppointmentCapacity()
    } catch (e) { showToast(e.message, 'error') }
  }

  // Create a staff/admin account from the Users tab's "Add Staff" modal.
  // Throws on failure so the modal stays open for the admin to correct the form.
  const createStaffAccount = async (staffData) => {
    try {
      const result = await adminApi.createUser(staffData)
      showToast(result?.data?.user?.role === 'admin' ? 'Admin account created!' : 'Staff account created!')
      await fetchUsers()
      fetchAppointmentCapacity()
      return result
    } catch (e) {
      showToast(e.message || 'Failed to create account', 'error')
      throw e
    }
  }

  // ── CRUD: Orders ─────────────────────────────────────────────────────────
  const updateOrderStatus = async (orderId, status) => {
    const order = orders.find(o => o.order_id === orderId)
    const currentStatus = order?.status || 'pending'
    const allowedTransitions = ORDER_STATUS_TRANSITIONS[currentStatus] || []

    if (!allowedTransitions.includes(status)) {
      showToast(`Invalid status transition from ${currentStatus} to ${status}.`, 'error')
      return
    }
    
    if (status === 'processing') {
      const paymentVerified = normalizePaymentStatus(order?.payment_status || order?.payment?.status) === 'approved'
      if (!paymentVerified) {
        showToast('Cannot start processing - payment not verified. Please approve payment first.', 'error')
        return
      }
    }
    
    try {
      await adminApi.updateOrder(orderId, { status })
      showToast(`Order ${status.toLowerCase()}!`)
      fetchOrders()
    } catch (e) { showToast(e.message, 'error') }
  }

  // Opening the payment approval form marks the payment as under review so the customer
  // sees an admin has picked it up. Best-effort: never blocks the admin's action.
  const markPaymentUnderReview = async (order) => {
    if (normalizePaymentStatus(order.payment_status) !== 'proof_submitted') return
    try {
      await adminApi.updatePaymentStatus(order.order_id, 'under_review', {
        admin_name: user?.firstName ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}` : user?.email,
        admin_email: user?.email,
      })
    } catch (error) {
      console.warn('Could not mark payment as under review:', error)
    }
  }

  const approvePayment = async (orderId) => {
    const order = orders.find(o => o.order_id === orderId)
    if (order && isCashOnDeliveryOrder(order)) {
      showToast('COD orders do not require payment verification.', 'error')
      return
    }
    if (order?.payment) {
      await markPaymentUnderReview(order)
      setForm({
        order_id: order.order_id,
        order_number: order.order_number || order.order_id?.slice(0, 8),
        payment_method: order.payment?.method || order.payment_method || 'N/A',
        amount: order.total || order.total_amount || order.payment?.amount || 0,
        payment_status: normalizePaymentStatus(order.payment_status || order.payment?.status),
        proof_url: order.payment?.proof_url || null,
      })
      setFormErrors({})
      setModal({ open: true, type: 'payment_approval', data: order })
    } else {
      showToast('No payment found for this order', 'error')
    }
  }

  const updatePaymentStatus = async () => {
    if (!form.order_id) return
    if (modal.data && isCashOnDeliveryOrder(modal.data)) {
      showToast('COD orders do not support payment status updates.', 'error')
      return
    }
    
    const originalStatus = normalizePaymentStatus(modal.data?.payment_status || modal.data?.payment?.status)
    if (form.payment_status === originalStatus) {
      showToast('No changes detected', 'error')
      return
    }

    setPaymentStatusUpdate({ loading: true, orderId: form.order_id })
    try {
      await adminApi.updatePaymentStatus(form.order_id, form.payment_status)
      showToast(`Payment status updated to ${form.payment_status}!`)
      
      setOrders(prev => prev.map(o => 
        o.order_id === form.order_id 
          ? { ...o, payment_status: form.payment_status }
          : o
      ))
      
      closeModal()
    } catch (e) { showToast(e.message, 'error') }
    finally {
      setPaymentStatusUpdate({ loading: false, orderId: null })
    }
  }

  const updateOrderAndPaymentStatus = async () => {
    if (!modal.data?.order_id) return
    
    const currentOrder = orders.find(o => o.order_id === modal.data.order_id)
    const currentOrderStatus = currentOrder?.status || modal.data.status || 'pending'
    const currentPaymentStatus = normalizePaymentStatus(
      currentOrder?.payment_status || modal.data.payment_status || modal.data?.payment?.status
    )
    
    const newOrderStatus = form.order_status || currentOrderStatus
    const newPaymentStatus = normalizePaymentStatus(form.payment_status || currentPaymentStatus)
    
    const orderStatusChanged = newOrderStatus !== currentOrderStatus
    const paymentStatusChanged = newPaymentStatus !== currentPaymentStatus
    
    if (!orderStatusChanged && !paymentStatusChanged) {
      showToast('No changes detected', 'error')
      return
    }

    if (orderStatusChanged) {
      const allowedTransitions = ORDER_STATUS_TRANSITIONS[currentOrderStatus] || []
      if (!allowedTransitions.includes(newOrderStatus)) {
        showToast(`Invalid status transition from ${currentOrderStatus} to ${newOrderStatus}.`, 'error')
        return
      }
    }

    if (newOrderStatus === 'processing' && newPaymentStatus !== 'approved') {
      showToast('Cannot start processing until the payment is approved.', 'error')
      return
    }

    if (orderStatusChanged && newOrderStatus === 'shipped') {
      if (!isValidShippingFee(form.additional_shipping_fee) || !form.tracking_info?.trim()) {
        showToast('Enter a valid additional shipping fee and tracking number before shipping.', 'error')
        return
      }
    }

    setPaymentStatusUpdate({ loading: true, orderId: modal.data.order_id })
    try {
      if (paymentStatusChanged) {
        await adminApi.updatePaymentStatus(modal.data.order_id, newPaymentStatus)
      }
      
      if (orderStatusChanged) {
        await adminApi.updateOrder(modal.data.order_id, {
          status: newOrderStatus,
          ...(newOrderStatus === 'shipped' ? { additional_shipping_fee: Number(form.additional_shipping_fee), tracking_number: form.tracking_info.trim() } : {}),
        })
      }
      
      showToast('Order statuses updated!')
      fetchOrders()
      closeModal()
    } catch (e) { showToast(e.message, 'error') }
    finally {
      setPaymentStatusUpdate({ loading: false, orderId: null })
    }
  }

  const cancelOrder = (id, orderNum) => {
    openConfirm({
      title: 'Cancel Order?',
      description: `Order #${orderNum} will be cancelled. The customer will need to place a new order.`,
      variant: 'danger',
      onConfirm: async () => {
        await adminApi.cancelOrder(id)
        showToast('Order cancelled')
        fetchOrders()
      },
    })
  }

  // ── CRUD: Projects ───────────────────────────────────────────────────────
  const saveProject = async () => {
    setIsSaving(true)
    try {
      if (modal.data?.project_id) {
        await adminApi.updateProject(modal.data.project_id, form)
        showToast('Project updated!')
      } else {
        await adminApi.createProject(form)
        showToast('Project created!')
      }
      refreshProjects(); closeModal()
    } catch (e) { showToast(e.message, 'error') }
    finally { setIsSaving(false) }
  }

  const deleteProject = (id, name) => {
    openConfirm({
      title: 'Archive Project',
      description: 'Are you sure you want to archive this project? It will be moved to the Archived Projects tab and can be restored at any time.',
      confirmLabel: 'Confirm Archive',
      cancelLabel: 'Cancel',
      variant: 'warning',
      onConfirm: async () => {
        const existingProject = (projects || []).find((project) => project.project_id === id) || null
        const response = await adminApi.deleteProject(id)
        const deletedProject = response?.data || existingProject

        setProjects((prev) => prev.filter((project) => project.project_id !== id))
        setProjectArchiveFeedback({
          open: true,
          projectId: id,
          projectName: name || deletedProject?.name || deletedProject?.title || 'Project',
          snapshot: deletedProject,
          busy: false,
        })
      },
    })
  }

  const closeProjectArchiveFeedback = () => {
    setProjectArchiveFeedback({
      open: false,
      projectId: null,
      projectName: '',
      snapshot: null,
      busy: false,
    })
  }

  const undoArchivedProject = async () => {
    if (!projectArchiveFeedback.projectId) return
    setProjectArchiveFeedback((prev) => ({ ...prev, busy: true }))

    try {
      const response = await adminApi.restoreProject(projectArchiveFeedback.projectId)
      const restoredProject = response?.data || projectArchiveFeedback.snapshot

      if (restoredProject) {
        setProjects((prev) => {
          const withoutRestored = prev.filter((project) => project.project_id !== restoredProject.project_id)
          const next = [restoredProject, ...withoutRestored]
          next.sort((left, right) => new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime())
          return next
        })
      } else {
        await refreshProjects()
      }

      closeProjectArchiveFeedback()
    } catch (error) {
      showToast(error.message || 'Failed to restore archived project', 'error')
      setProjectArchiveFeedback((prev) => ({ ...prev, busy: false }))
    }
  }

  const restoreProject = async (id, name) => {
    openConfirm({
      title: 'Restore Project',
      description: 'Are you sure you want to restore this project?',
      confirmLabel: 'Restore',
      cancelLabel: 'Cancel',
      onConfirm: async () => {
        try {
          const response = await adminApi.restoreProject(id)
          const restoredProject = response?.data
          setArchivedProjects((prev) => prev.filter((project) => project.project_id !== id))
          if (restoredProject) {
            setProjects((prev) => {
              const withoutRestored = prev.filter((project) => project.project_id !== restoredProject.project_id)
              const next = [restoredProject, ...withoutRestored]
              next.sort((left, right) => new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime())
              return next
            })
          }
          showToast('Project restored successfully')
        } catch (e) {
          showToast(e.message || 'Failed to restore project', 'error')
        }
      },
    })
  }

  const fetchArchivedProjects = useCallback(async (queryParams = {}) => {
    try {
      const res = await adminApi.getArchivedProjects({
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        include_tasks: true,
        ...queryParams,
      })
      const newData = Array.isArray(res.data) ? res.data : res.data?.projects || []
      setArchivedProjects(newData)
      setArchivedProjectsPagination(normalizeProjectPagination(res.pagination, queryParams))
    } catch (e) {
      showToast(e.message, 'error')
    }
  }, [debouncedSearch, showToast])

  const buildArchivedProjectQuery = useCallback((pageNum = 1) => {
    const params = {
      status: projectStatusFilter === 'all' ? undefined : projectStatusFilter,
      assigned_to: projectAssignedFilter === 'all' ? undefined : projectAssignedFilter,
      guitar_type: projectGuitarTypeFilter === 'all' ? undefined : projectGuitarTypeFilter,
      date_from: projectDateFrom || undefined,
      date_to: projectDateTo || undefined,
      due_date_from: projectDueDateFrom || undefined,
      due_date_to: projectDueDateTo || undefined,
      completion_percentage: projectCompletionFilter === 'all' ? undefined : projectCompletionFilter,
      include_tasks: true,
      page: pageNum,
      // The archived list carries its own page size, so changing it refetches that
      // page instead of leaving the control describing rows that were not requested.
      page_size: archivedProjectsPagination.pageSize || projectPageSize,
      sort_by: ({ updated: 'updated_at', created: 'created_at', name: 'project_name', customer: 'customer_name', progress: 'progress', due: 'estimated_completion_date', status: 'status' })[projectSort] || 'updated_at',
      sort_dir: projectSortDirection,
    }
    Object.keys(params).forEach((key) => params[key] === undefined && delete params[key])
    return params
  }, [projectStatusFilter, projectAssignedFilter, projectGuitarTypeFilter, projectDateFrom, projectDateTo, projectDueDateFrom, projectDueDateTo, projectCompletionFilter, projectSort, projectSortDirection, projectPageSize, archivedProjectsPagination.pageSize])

  useEffect(() => {
    if (activeTab === 'projects' && projectArchiveTab === 'archived') {
      fetchArchivedProjects(buildArchivedProjectQuery(archivedProjectsPagination.page))
    }
  }, [activeTab, projectArchiveTab, archivedProjectsPagination.page, fetchArchivedProjects, buildArchivedProjectQuery, debouncedSearch]) // eslint-disable-line

  const assignProjectTeam = async (projectId, userIds) => {
    try {
      await adminApi.assignTeam(projectId, userIds)
      showToast('Team assigned!')
      refreshProjects()
    } catch (e) { showToast(e.message, 'error') }
  }

   // ── CRUD: Services ──────────────────────────────────────────────────────
   const saveService = async () => {
     setIsSaving(true)
     try {
       let finalImageUrl = form.image_url || modal.data?.image_url || null
       if (form.image_file) {
         setIsUploading(true)
         try {
           finalImageUrl = await uploadToCloudinary(form.image_file)
         } finally {
           setIsUploading(false)
         }
       }

       const payload = {
         name: form.name,
         description: form.description || '',
         price: Number(form.price),
         duration_minutes: form.duration !== '' && form.duration != null ? Math.round(Number(form.duration) * 60) : null,
         is_active: form.is_active !== undefined ? Boolean(form.is_active) : true,
       }
       if (typeof finalImageUrl === 'string') payload.image_url = finalImageUrl

       let savedService = null
       if (modal.data?.service_id) {
         savedService = await adminApi.updateService(modal.data.service_id, payload)
         showToast('Service updated!')
       } else {
         savedService = await adminApi.createService(payload)
         showToast('Service added!')
       }

       const mergedService = {
         ...(modal.data || {}),
         ...form,
         ...(savedService?.data || savedService || {}),
         image_url: finalImageUrl,
         is_active: payload.is_active,
         service_id: savedService?.data?.service_id || savedService?.service_id || modal.data?.service_id,
       }
       syncLandingServiceConfig(mergedService)
       fetchServices()
       closeModal()
     } catch (e) { showToast(e.message, 'error') }
     finally { setIsSaving(false) }
   }

   const deleteService = (id, title) => {
     openConfirm({
       title: 'Deactivate Service?',
       description: `"${title}" will be marked inactive and hidden from new bookings.`,
       variant: 'danger',
       onConfirm: async () => {
         await adminApi.deleteService(id)
         showToast('Service deactivated')
         fetchServices()
       },
     })
   }
  const saveAppointment = async () => {
    setIsSaving(true)
    try {
      if (modal.data?.appointment_id) {
        await adminApi.updateAppointment(modal.data.appointment_id, form)
        showToast('Appointment updated!')
      } else {
        await adminApi.createAppointment(form)
        showToast('Appointment booked!')
      }
      fetchAppointments(); closeModal()
    } catch (e) { showToast(e.message, 'error') }
    finally { setIsSaving(false) }
  }

  const deleteAppointment = (id, title) => {
    openConfirm({
      title: 'Cancel Appointment?',
      description: `"${title || 'This appointment'}" will be soft-cancelled. The customer's data will be preserved.`,
      variant: 'warning',
      onConfirm: async () => {
        await adminApi.deleteAppointment(id)
        showToast('Appointment cancelled')
        fetchAppointments()
      },
    })
  }

  // ── CRUD: Inventory ──────────────────────────────────────────────────────
  const saveStockAdjust = async (overrideForm = {}) => {
    setIsSaving(true)
    try {
      const { product_id, change_type, quantity, current_stock: overrideCurrentStock } = { ...form, ...overrideForm }
      if (!product_id || !change_type || quantity === undefined || quantity === null || quantity === '') {
        showToast('Please fill all required fields', 'error'); return
      }
      // The modal may be opened from the Inventory tab, where the Products-tab
      // list can be stale or missing the row. Resolve the freshest stock so the
      // Manual Set delta lands on the correct final value.
      const existingProduct = await resolveInventoryProduct(product_id)
      const currentStock = Number(existingProduct?.stock ?? overrideCurrentStock ?? form.current_stock ?? 0) || 0
      const qty = Number(quantity)

      if (change_type === 'stock_out' && qty > currentStock) {
        showToast(`Insufficient stock. Available: ${currentStock}`, 'error'); return
      }
      if (change_type === 'adjustment') {
        if (qty < 0) {
          showToast('Stock cannot be negative', 'error'); return
        }
        if (qty === currentStock) {
          showToast('Stock is already set to that value', 'error'); return
        }
      }
      const payload = { 
        productId: product_id, 
        quantity: change_type === 'adjustment' ? qty - currentStock : qty,
      }
      if (change_type === 'stock_in') await adminApi.addStock(payload)
      else if (change_type === 'stock_out') await adminApi.deductStock(payload)
      else await adminApi.adjustStock(payload)
      showToast('Stock adjusted!')
      fetchInventory()
      closeModal()
    } catch (e) { showToast(e.message, 'error') }
    finally { setIsSaving(false) }
  }

  const savePartStockAdjust = async (overrideForm = {}) => {
    setIsSaving(true)
    try {
      const { part_id, change_type, quantity, current_stock: overrideCurrentStock } = { ...form, ...overrideForm }
      if (!part_id || !change_type || quantity === undefined || quantity === null || quantity === '') {
        showToast('Please fill all required fields', 'error'); return
      }

      const existingPart = await resolveBuilderPart(part_id)
      const currentStock = Number(existingPart?.stock ?? existingPart?.quantity ?? overrideCurrentStock ?? form.current_stock ?? 0) || 0
      const qty = Number(quantity)

      let nextStock = currentStock
      if (change_type === 'stock_in') nextStock = currentStock + qty
      else if (change_type === 'stock_out') nextStock = currentStock - qty
      else nextStock = qty

      if (nextStock < 0) {
        showToast('Stock cannot be negative', 'error')
        return
      }
      if (change_type === 'adjustment' && nextStock === currentStock) {
        showToast('Stock is already set to that value', 'error')
        return
      }

      await adminApi.updateBuilderPart(part_id, {
        stock: nextStock,
        metadata: {
          ...(existingPart?.metadata && typeof existingPart.metadata === 'object' ? existingPart.metadata : {}),
          last_stock_adjustment: {
            change_type,
            quantity: qty,
            adjusted_at: new Date().toISOString(),
          },
        },
      })

      showToast('Guitar part stock adjusted!')
      fetchParts()
      closeModal()
    } catch (e) { showToast(e.message, 'error') }
    finally { setIsSaving(false) }
  }

  // ── Styles ───────────────────────────────────────────────────────────────
  const getStatusBadge = (status) => {
    const map = {
      Active: 'bg-green-500/20 text-green-400 border-green-500/30',
      Inactive: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      Completed: 'bg-green-500/20 text-green-400 border-green-500/30',
      completed: 'bg-green-500/20 text-green-400 border-green-500/30',
      'In Progress': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      Pending: 'bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] border-[var(--gold-primary)]/30',
      pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      not_started: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      Confirmed: 'bg-green-500/20 text-green-400 border-green-500/30',
      Scheduled: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      Cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
      cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
      no_show: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      'Low Stock': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      'Out of Stock': 'bg-red-500/20 text-red-400 border-red-500/30',
      processing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      shipped: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
      out_for_delivery: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
      delivered: 'bg-green-500/20 text-green-400 border-green-500/30',
    }
    return map[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }

  const inputCls = 'w-full px-4 py-3 bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl text-[var(--text-light)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] text-sm'
  const inputErrCls = 'w-full px-4 py-3 bg-[var(--surface-dark)] border border-red-500/50 rounded-2xl text-[var(--text-light)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-red-500 text-sm'
  const labelCls = 'block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-2'

  // ── Tabs ─────────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'guitar-parts', label: 'Guitar Parts', icon: Layers },
    { id: 'product-categories', label: 'Categories', icon: Tag },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'inventory', label: 'Inventory', icon: Activity },
    { id: 'pos', label: 'POS', icon: Wallet },
    ...(isSuperAdmin ? [
      { id: 'sales-report', label: 'Sales Report', icon: PieChart },
    ] : []),
    { id: 'projects', label: 'Projects', icon: Briefcase },
    { id: 'services', label: 'Services', icon: Wrench },
    { id: 'appointments', label: 'Appointments', icon: Calendar },
    ...(isSuperAdmin ? [{ id: 'users', label: 'Users', icon: Shield }] : []),
    { id: 'payment-settings', label: 'Payment Settings', icon: CreditCard },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]

  const inventoryIsProducts = inventorySubTab === 'products'
  const inventoryCurrentFilter = inventoryIsProducts ? productsInventoryFilter : partsInventoryFilter
  const inventoryCurrentRows = inventoryIsProducts ? filteredProductsInventory : filteredPartsInventory
  const inventoryCurrentPageRows = inventoryIsProducts ? paginatedProductsInventory : paginatedPartsInventory
  const inventoryTotalPages = Math.max(1, Math.ceil(inventoryCurrentRows.length / inventoryPageSize))
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
  const resolveInventoryImage = (item) => {
    if (!item) return null
    if (item.primary_image) return item.primary_image
    if (item.image_url) return item.image_url
    if (item.product_image) return item.product_image
    if (item.product_id && productImageById.has(item.product_id)) return productImageById.get(item.product_id)
    if (item.preview_url) return item.preview_url
    if (item.image) return item.image
    if (Array.isArray(item.images) && item.images.length > 0) {
      const first = item.images[0]
      if (typeof first === 'string') return first
      if (first?.url) return first.url
    }
    return null

  }

   // ── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div className={`admin-workspace ${sidebarCollapsed ? 'admin-workspace--collapsed' : ''}`}>

      {/* Toast */}
      <AnimatePresence>
        {toasts.length > 0 && (
          <div className="fixed bottom-6 right-6 z-[9999] flex w-[calc(100vw-3rem)] max-w-sm flex-col items-end gap-3 pointer-events-none">
            <AnimatePresence initial={false}>
              {toasts.map((toast) => {
                const toastStyles = {
                  success: 'bg-green-500/10 border-green-500/30 text-green-400',
                  error: 'bg-red-500/10 border-red-500/30 text-red-400',
                  warning: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
                  info: 'bg-sky-500/10 border-sky-500/30 text-sky-300',
                }
                const toastIcons = {
                  success: CheckCircle,
                  error: AlertCircle,
                  warning: AlertCircle,
                  info: Info,
                }
                const ToastIcon = toastIcons[toast.type] || CheckCircle

                return (
                  <motion.div
                    key={toast.id}
                    layout
                    initial={{ opacity: 0, y: 24, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 24, scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                    className={`pointer-events-auto w-full rounded-2xl border px-5 py-3 shadow-2xl flex items-start gap-3 text-sm font-semibold ${toastStyles[toast.type] || toastStyles.success}`}
                  >
                    <ToastIcon className="w-4 h-4 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">{toast.msg}</div>
                    <button
                      type="button"
                      onClick={() => dismissToast(toast.id)}
                      className="shrink-0 text-current/70 hover:text-current transition-colors"
                      aria-label="Dismiss toast"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Modal */}
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

      <AnimatePresence>
        {projectArchiveFeedback.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[210] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 12 }}
              className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-6 shadow-2xl"
            >
              <div className="mb-5">
                <h3 className="text-xl font-bold text-white">Project Archived</h3>
                <p className="mt-2 text-sm text-[var(--text-muted)]">This project has been moved to the Archived Projects tab. You can restore it at any time.</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]/80">
                  {projectArchiveFeedback.projectName}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeProjectArchiveFeedback}
                  disabled={projectArchiveFeedback.busy}
                  className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--text-muted)] transition-colors hover:text-white disabled:opacity-60"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={undoArchivedProject}
                  disabled={projectArchiveFeedback.busy}
                  className="flex-1 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] px-4 py-2.5 text-sm font-bold text-black transition-all hover:shadow-[0_0_20px_rgba(212,175,55,0.35)] disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {projectArchiveFeedback.busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  Undo / Revert
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {false && (
        <>
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
              {/* POS Header */}
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
                    <>
                      <button onClick={() => setPosShowCloseConfirm(true)} className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm text-red-400 hover:bg-red-500/10 transition-colors">
                        Close Drawer
                      </button>
                    </>
                  )}
                  <button onClick={() => setPosDrawerOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                    <X className="w-5 h-5 text-[var(--text-muted)]" />
                  </button>
                </div>
              </div>

              {/* POS Content */}
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
                  {/* Left Panel - Products */}
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
                      {visibleInventory
                        .filter(p => p.stock > 0)
                        .filter(p => !posSearchQuery || p.name?.toLowerCase().includes(posSearchQuery.toLowerCase()) || p.sku?.toLowerCase().includes(posSearchQuery.toLowerCase()))
                        .slice(0, 20)
                        .map(product => (
                          <button
                            key={product.product_id}
                            onClick={() => addToCart(product)}
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

                  {/* Right Panel - Cart & Payment */}
                  <div className="w-1/2 flex flex-col">
                    {/* Cart Items */}
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
                                <button onClick={() => removeFromCart(item.product_id)} className="p-1 hover:bg-white/10 rounded">
                                  <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                                </button>
                                <span className="text-white font-mono w-6 text-center">{item.quantity}</span>
                                <button onClick={() => addToCart(item)} className="p-1 hover:bg-white/10 rounded">
                                  <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
                                </button>
                                <span className="text-cyan-400 font-mono w-20 text-right">{formatCurrency(item.price * item.quantity)}</span>
                                <button onClick={() => removeEntireItem(item.product_id)} className="p-1 hover:bg-red-500/20 rounded">
                                  <X className="w-4 h-4 text-red-400" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Totals */}
                    <div className="p-3 border-b border-[var(--border)] space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-[var(--text-muted)]">Subtotal</span>
                        <span className="text-white font-mono">{formatCurrency(calculateSalesTotal())}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[var(--text-muted)]">Tax (12%)</span>
                        <span className="text-white font-mono">{formatCurrency(calculateTax())}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold pt-2 border-t border-[var(--border)]">
                        <span className="text-white">Total</span>
                        <span className="text-cyan-400">{formatCurrency(calculateGrandTotal())}</span>
                      </div>
                    </div>

                    {/* Payment */}
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
                        onClick={processSale}
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

        {/* Close Drawer Confirmation */}
        {posShowCloseConfirm && (
          <motion.div
            key="close-drawer-confirm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setPosShowCloseConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <Wallet className="w-8 h-8 text-red-400" />
                </div>
                <h3 className="text-white text-xl font-bold">Close Cash Drawer?</h3>
                <p className="text-[var(--text-muted)] mt-2">
                  Count the cash in the drawer and compare with expected amount.
                </p>
              </div>

              {/* Cash Denominations */}
              <div className="mb-6">
                <h4 className="text-white font-semibold mb-3">Cash Count</h4>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { denom: '1000', label: '₱1000' },
                    { denom: '500', label: '₱500' },
                    { denom: '200', label: '₱200' },
                    { denom: '100', label: '₱100' },
                    { denom: '50', label: '₱50' },
                    { denom: '20', label: '₱20' },
                    { denom: '10', label: '₱10' },
                    { denom: '5', label: '₱5' },
                    { denom: '1', label: '₱1' },
                    { denom: '0.25', label: '₱0.25' },
                    { denom: '0.10', label: '₱0.10' },
                    { denom: '0.05', label: '₱0.05' },
                  ].map(({ denom, label }) => (
                    <div key={denom} className="flex items-center gap-2">
                      <span className="text-xs text-[var(--text-muted)] w-12">{label}</span>
                      <input
                        type="number"
                        min="0"
                        value={posDenominations[denom]}
                        onChange={(e) => setPosDenominations(prev => ({ ...prev, [denom]: Number(e.target.value) }))}
                        className="w-16 px-2 py-1 bg-[var(--bg-primary)] border border-[var(--border)] rounded text-white text-sm text-center font-mono"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="bg-[var(--bg-primary)]/50 rounded-xl p-4 mb-6 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Opening Cash</span>
                  <span className="text-white font-mono">{formatCurrency(posDrawerState.openingCash)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Sales Revenue</span>
                  <span className="text-white font-mono">{formatCurrency(calculateSalesTotal())}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-[var(--border)] pt-2">
                  <span className="text-[var(--text-muted)]">Total in Drawer</span>
                  <span className="text-white font-mono">{formatCurrency(calculateTotalCash())}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setPosShowCloseConfirm(false)}
                  className="flex-1 py-3 rounded-xl bg-[var(--bg-primary)] text-white font-semibold hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={closePosDrawer}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold hover:shadow-[0_8px_25px_rgba(239,68,68,0.35)] transition-all"
                >
                  Close Drawer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
        </>
      )}

      <WorkspaceSidebar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((previous) => !previous)}
        user={user}
        roleLabel={isSuperAdmin ? 'Administrator' : 'Admin'}
        navigationLabel="Admin navigation"
        onLogout={handleLogout}
      />

      {/* Main content */}
      <div className="admin-content transition-all duration-300">
        <Topbar title={tabs.find(t => t.id === activeTab)?.label || 'Dashboard'} userRole={user?.role} workspace
          search={activeTab === 'settings' ? (
            <label className="admin-settings-search">
              <Search aria-hidden="true" />
              <input type="search" aria-label="Search settings" placeholder="Search settings" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
            </label>
          ) : null}
        />

        <main className={activeTab === 'settings' ? 'admin-settings-main' : `p-6 ${activeTab === 'pos' ? 'pt-19' : ['orders', 'sales-report', 'projects', 'users', 'payment-settings'].includes(activeTab) ? 'pt-3.5' : 'pt-5'}`}>

          {/* Actions bar */}
          {['product-categories', 'services'].includes(activeTab) && (
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            {['product-categories', 'services'].includes(activeTab) && (
              <div className="relative max-w-sm w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder={`Search ${activeTab.replace('-', ' ')}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl text-[var(--text-light)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] text-sm"
                />
              </div>
            )}

            <div className="flex items-center gap-2 ml-auto">
                {activeTab === 'services' && (
                  <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
                    <button
                      onClick={() => setServiceViewMode('grid')}
                     className={`p-2 ${serviceViewMode === 'grid' ? 'bg-[var(--gold-primary)] text-black' : 'bg-[var(--surface-dark)] text-[var(--text-muted)] hover:text-white'} transition-colors`}
                     title="Grid View"
                   >
                     <Grid3X3 className="w-4 h-4" />
                   </button>
                   <button
                     onClick={() => setServiceViewMode('table')}
                     className={`p-2 ${serviceViewMode === 'table' ? 'bg-[var(--gold-primary)] text-black' : 'bg-[var(--surface-dark)] text-[var(--text-muted)] hover:text-white'} transition-colors`}
                     title="Table View"
                   >
                     <List className="w-4 h-4" />
                   </button>
                 </div>
               )}
                {activeTab === 'product-categories' && isSuperAdmin && (
                  <button onClick={() => openModal('category')} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black rounded-xl font-semibold text-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all">
                    <Plus className="w-4 h-4" /> Add Category
                  </button>
              )}
               {activeTab === 'services' && isSuperAdmin && (
                 <button onClick={() => openModal('service')} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black rounded-xl font-semibold text-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all">
                   <Plus className="w-4 h-4" /> Add Service
                 </button>
               )}
            </div>
          </div>
          )}

          {/* ── DASHBOARD ──────────────────────────────────────────────────── */}
          {activeTab === 'dashboard' && (
            <DashboardTab
              user={user}
              salesReport={salesReport}
              visibleOrders={visibleOrders}
              visibleProjects={visibleProjects}
              visibleAppointments={visibleAppointments}
              inventoryHealthData={inventoryHealthData}
              visibleProducts={visibleInventory}
              enhancedOrderStats={enhancedOrderStats}
              fetchInventory={fetchInventory}
              handleRefresh={handleRefresh}
              isLoading={isLoading}
              setActiveTab={setActiveTab}
              // Dashboard filter-aware navigation setters
              setDashboardOrderPaymentFilter={setDashboardOrderPaymentFilter}
              setDashboardOrderStatusFilter={setDashboardOrderStatusFilter}
              setProjectStatusFilter={setProjectStatusFilter}
              setProductsInventoryFilter={setProductsInventoryFilter}
              setPartsInventoryFilter={setPartsInventoryFilter}
              setInventorySubTab={setInventorySubTab}
              setDashboardAppointmentStatusFilter={setDashboardAppointmentStatusFilter}
            />
          )}

          {/* ── PRODUCTS ───────────────────────────────────────────── */}
          {activeTab === 'products' && (
            <ProductsTab
              productViewMode={productViewMode}
              setProductViewMode={setProductViewMode}
              productActiveTab={productActiveTab}
              setProductActiveTab={setProductActiveTab}
              productQuery={productQuery}
              setProductQuery={setProductQuery}
              productsLoading={productsLoading}
              visibleProducts={visibleProducts}
              productsPagination={productsPagination}
              categories={categories}
              openModal={openModal}
              handleRefresh={handleRefresh}
              isLoading={isLoading}
              isSuperAdmin={isSuperAdmin}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              inputCls={inputCls}
              deleteProduct={deleteProduct}
            />
          )}

          {/* ── GUITAR PARTS ───────────────────────────────────────────── */}
          {activeTab === 'guitar-parts' && (
            <GuitarPartsTab
              guitarPartViewMode={guitarPartViewMode}
              setGuitarPartViewMode={setGuitarPartViewMode}
              partDensity={partDensity}
              setPartDensity={setPartDensity}
              partSearchQuery={partSearchQuery}
              setPartSearchQuery={setPartSearchQuery}
              openModal={openModal}
              clearPartFilters={clearPartFilters}
              migrateCatalog={migrateCurrentCatalog}
              partQuery={partQuery}
              partsLoading={partsLoading}
              sortedFilteredParts={sortedFilteredParts}
              expandedGuitarTypes={expandedGuitarTypes}
              onToggleGuitarType={toggleGuitarType}
              expandedPartCategories={expandedPartCategories}
              onTogglePartCategory={togglePartCategory}
              deletePart={deletePart}
              handleQuickAddPart={handleQuickAddPart}
              partSortConfig={partSortConfig}
              handlePartSort={handlePartSort}
            />
          )}

          {/* ── CATEGORIES ─────────────────────────────────────────────────── */}
          {activeTab === 'product-categories' && (
            <ProductCategoriesTab
              categories={categories}
              searchQuery={searchQuery}
              deleteCategory={deleteCategory}
              openModal={openModal}
              isSuperAdmin={isSuperAdmin}
            />
          )}

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
              projectSortDirection={projectSortDirection}
              setProjectSortDirection={setProjectSortDirection}
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
              setShowGuitarTypeSelector={setShowGuitarTypeSelector}
              showDefaultWorkflowEditor={showDefaultWorkflowEditor}
              setShowDefaultWorkflowEditor={setShowDefaultWorkflowEditor}
              deleteProject={deleteProject}
              restoreProject={restoreProject}
              projectArchiveTab={projectArchiveTab}
              setProjectArchiveTab={setProjectArchiveTab}
              archivedProjectsPagination={archivedProjectsPaginationView}
              setArchivedProjectsPagination={setArchivedProjectsPagination}
              projectsPagination={projectsPaginationView}
              setProjectPageSize={setProjectPageSize}
              isAdmin={isSuperAdmin}
              debouncedSearch={debouncedSearch}
            />
          )}

          {activeTab === 'services' && (
            <ServicesTab
              services={services}
              servicesLoading={servicesLoading}
              debouncedSearch={debouncedSearch}
              serviceViewMode={serviceViewMode}
              servicesPagination={servicesPagination}
              serviceQuery={serviceQuery}
              setServiceQuery={setServiceQuery}
              openModal={openModal}
              deleteService={deleteService}
            />
          )}

          {activeTab === 'users' && (
            <UsersTab
              visibleUsers={visibleUsers}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              userRoleFilter={userRoleFilter}
              setUserRoleFilter={setUserRoleFilter}
              userStatusFilter={userStatusFilter}
              setUserStatusFilter={setUserStatusFilter}
              handleRefresh={handleRefresh}
              isLoading={isLoading}
              isSuperAdmin={isSuperAdmin}
              changeUserRole={changeUserRole}
              toggleUserStatus={toggleUserStatus}
              appointmentCapacity={appointmentCapacity}
              createStaffAccount={createStaffAccount}
            />
          )}

          {/* ── PAYMENT SETTINGS ──────────────────────────────────────────── */}
          {activeTab === 'payment-settings' && (
            <PaymentSettingsTab showToast={showToast} />
          )}

          {/* ── SETTINGS ───────────────────────────────────────────────────── */}
          {activeTab === 'settings' && (
            <SettingsTab
              user={user}
              isSuperAdmin={isSuperAdmin}
              searchQuery={searchQuery}
              siteContactInfo={siteContactInfo}
              setSiteContactInfo={setSiteContactInfo}
              saveSiteContactInfo={saveSiteContactInfo}
              showToast={showToast}
            />
          )}

          {activeTab === 'orders' && (
            <>
              {/* Return-to-tracker banner: shown after admin updates payment from a ProjectTaskTracker redirect */}
              {postPaymentUpdatedOrder && orderRedirectState?.projectData && (
                <motion.div
                  key="return-to-tracker-banner"
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="mb-4 flex flex-col gap-3 rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-transparent p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                      <CheckCircle className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-emerald-300">Payment Updated Successfully</p>
                      <p className="mt-0.5 text-xs text-emerald-200/70">
                        Would you like to return to the Project Task Tracker for{' '}
                        <span className="font-semibold text-emerald-200">
                          {orderRedirectState.projectData?.name || orderRedirectState.projectData?.title || 'this project'}
                        </span>{' '}
                        and continue working?
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 pl-12 sm:pl-0">
                    <button
                      type="button"
                      onClick={() => {
                        setPostPaymentUpdatedOrder(null)
                        setOrderRedirectState(null)
                      }}
                      className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white/60 hover:text-white transition-colors"
                    >
                      Stay Here
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const projectData = orderRedirectState.projectData
                        setPostPaymentUpdatedOrder(null)
                        setOrderRedirectState(null)
                        openModal('project_tasks', projectData)
                        setActiveTab('projects')
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 px-4 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30 hover:text-white transition-all"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Go Back to Tracker
                    </button>
                  </div>
                </motion.div>
              )}
              <OrdersTab
                orders={visibleOrders}
                fetchOrders={fetchOrders}
                user={user}
                pagination={ordersPagination}
                showToast={showToast}
                onManageProject={handleManageCustomizationProject}
                onGoToProjects={() => handleManageCustomizationProject()}
                ordersLoading={ordersLoading}
                initialPaymentStatusFilter={dashboardOrderPaymentFilter}
                initialStatusFilter={dashboardOrderStatusFilter}
                initialOrder={orderRedirectState?.order ?? null}
                onInitialOrderConsumed={() => {
                  // Clear just the order so the useEffect guard on Strict Mode's
                  // second run sees null — keeps projectData for the return banner.
                  setOrderRedirectState(prev => prev ? { ...prev, order: null } : null)
                }}
                onPaymentStatusUpdated={(updatedOrder) => {
                  // Only trigger the return-to-tracker prompt when this was a redirect from ProjectTaskTracker
                  if (orderRedirectState) {
                    setPostPaymentUpdatedOrder(updatedOrder)
                  }
                }}
              />
            </>
          )}

          {/* ── APPOINTMENTS ───────────────────────────────────────────────── */}
          {activeTab === 'appointments' && (

<AppointmentsTab
               visibleAppointments={visibleAppointments}
               visibleCalendarAppointments={visibleCalendarAppointments}
               appointmentLoading={appointmentLoading}
               appointmentPagination={appointmentPagination}
               selectedCalendarDate={selectedCalendarDate}
                unavailableDates={normalizedUnavailableDates}
               availableDates={availableDates}
               openOverrides={openOverrides}
               fetchAppointments={fetchAppointments}
               setSelectedAppointment={setSelectedAppointment}
               setAppointmentModalOpen={setAppointmentModalOpen}
               setAppointmentFormData={setAppointmentFormData}
               setAppointmentFormOpen={setAppointmentFormOpen}
               setUnavailableDatesOpen={setUnavailableDatesOpen}
               setAppointmentPagination={setAppointmentPagination}
               isSuperAdmin={isSuperAdmin}
               searchQuery={appointmentSearch}
               onSearchChange={setAppointmentSearch}
               initialStatusFilter={dashboardAppointmentStatusFilter}
             />
          )}

          {/* ── INVENTORY ──────────────────────────────────────────────────── */}
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
              inventoryPageSize={inventoryPageSize}
              setInventoryPageSize={setInventoryPageSize}
              setProductsInventoryFilter={setProductsInventoryFilter}
              setPartsInventoryFilter={setPartsInventoryFilter}
              resolveInventoryImage={resolveInventoryImage}
              openModal={openModal}
              isSuperAdmin={isSuperAdmin}
              categories={categories}
            />
          )}

          {activeTab === 'pos' && (
            <motion.div key="pos" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <PosWorkspace
                inventoryItems={visibleInventory}
                showToast={showToast}
                description="Create and record walk-in sales."
              />
            </motion.div>
          )}

          {activeTab === 'sales-report' && (
            <SalesReportTab salesReport={salesReport} fetchSalesReport={fetchSalesReport} categories={categories} />
          )}

        </main>
      </div>

      {/* ── MODAL ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modal.open && (
          <motion.div
            key={`modal-${modal.type || 'default'}`}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl w-full shadow-2xl ${modal.type === 'product' ? 'flex max-h-[90dvh] max-w-3xl flex-col overflow-hidden' : `p-8 overflow-y-auto ${modal.type === 'project_tasks' ? 'max-w-6xl h-[90vh]' : modal.type === 'part' ? 'max-h-[90vh] max-w-[min(92vw,72rem)]' : 'max-w-lg max-h-[90vh]'}`}`}
            >

              {modal.type === 'project_tasks' && modal.data && (
                <ProjectTasksModal
                  modal={modal}
                  closeModal={closeModal}
                  visibleParts={visibleParts}
                  onRestockPart={handleProjectPartRestock}
                  staffMembers={users}
                  onProjectChange={(updated) => {
                    setProjects(previous => previous.map(project => project.project_id === updated.project_id ? { ...project, progress: updated.progress, task_summary: updated.task_summary } : project))
                  }}
                  onRedirectToOrder={(order) => {
                    const targetOrder = order || (modal.data?.order_id ? { order_id: modal.data.order_id } : null)
                    if (!targetOrder) {
                      setActiveTab('orders')
                      closeModal()
                      return
                    }
                    // Store the target order so OrdersTab can auto-open it
                    // and we can show the return-to-tracker prompt after payment update.
                    setOrderRedirectState({
                      order: targetOrder,
                      projectData: modal.data,
                    })
                    setPostPaymentUpdatedOrder(null)
                    setActiveTab('orders')
                    closeModal()
                  }}
                />
              )}

              {modal.type === 'view_appointment' && modal.data && (
                <ViewAppointmentModal modal={modal} closeModal={closeModal} onPaymentStatusUpdate={handleAppointmentPaymentStatusUpdate} />
              )}

              {modal.type === 'appointment' && modal.data && modal.data.hasOwnProperty('appointment_id') && (
                <AppointmentStatusModal
                  modal={modal}
                  form={form}
                  setForm={setForm}
                  closeModal={closeModal}
                  isSaving={isSaving}
                  saveAppointment={saveAppointment}
                />
              )}

              {/* Product setup wizard */}
              {modal.type === 'product' && (
                <ProductModal
                  modal={modal}
                  form={form}
                  setForm={setForm}
                  formErrors={formErrors}
                  setFormErrors={setFormErrors}
                  wizardTab={wizardTab}
                  setWizardTab={setWizardTab}
                  closeModal={closeModal}
                  isSaving={isSaving}
                  isUploading={isUploading}
                  saveProduct={saveProduct}
                  handleImageUpload={handleImageUpload}
                  categories={categories}
                  formatCurrency={formatCurrency}
                  validateAndSave={validateAndSave}
                  productRules={PRODUCT_RULES}
                  labelCls={labelCls}
                />
              )}

              {modal.type === 'category' && (
                <CategoryModal
                  modal={modal}
                  form={form}
                  setForm={setForm}
                  formErrors={formErrors}
                  closeModal={closeModal}
                  validateAndSave={validateAndSave}
                  showToast={showToast}
                  CATEGORY_RULES={CATEGORY_RULES}
                  isSaving={isSaving}
                  saveCategory={saveCategory}
                  inputCls={inputCls}
                />
              )}

              {/* Builder Part Modal */}
              {modal.type === 'part' && (
                <PartModal
                  modal={modal}
                  form={form}
                  setForm={setForm}
                  formErrors={formErrors}
                  setFormErrors={setFormErrors}
                  closeModal={closeModal}
                  isSaving={isSaving}
                  savePart={savePart}
                  validateAndSave={validateAndSave}
                  PART_RULES={PART_RULES}
                  BUILDER_CATEGORY_MAP={BUILDER_CATEGORY_MAP}
                  SLOT_TO_PART_CATEGORY={SLOT_TO_PART_CATEGORY}
                  INVENTORY_PART_CATEGORY_LABELS={INVENTORY_PART_CATEGORY_LABELS}
                  INVENTORY_PART_CATEGORY_OPTIONS={INVENTORY_PART_CATEGORY_OPTIONS}
                  isUploading={isUploading}
                  handleImageUpload={handleImageUpload}
                  formatCurrency={formatCurrency}
                  labelCls={labelCls}
                  inputCls={inputCls}
                  normalizeInventoryPartCategory={normalizeInventoryPartCategory}
                  deriveInventoryPartCategory={deriveInventoryPartCategory}
                />
              )}

              {/* Inventory Adjust Modal */}
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

              {/* Guitar View Modal */}
              {modal.type === 'guitar_view' && modal.data && (
                <GuitarViewModal modal={modal} closeModal={closeModal} formatCurrency={formatCurrency} />
              )}

              {/* Order View Modal */}
              {modal.type === 'order_view' && modal.data && (
                <OrderViewModal modal={modal} closeModal={closeModal} getStatusBadge={getStatusBadge} formatCurrency={formatCurrency} />
              )}

              {/* Project Modal */}
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

              {/* Project Team Modal */}
              {modal.type === 'project_team' && modal.data && (
                <ProjectTeamModal
                  modal={modal}
                  form={form}
                  setForm={setForm}
                  users={users}
                  closeModal={closeModal}
                  isSaving={isSaving}
                  assignProjectTeam={assignProjectTeam}
                />
              )}

              {/* Appointment Modal */}
              {modal.type === 'appointment' && (
                <AdminAppointmentModal
                  modal={modal}
                  form={form}
                  setForm={setForm}
                  formErrors={formErrors}
                  closeModal={closeModal}
                  isSaving={isSaving}
                  saveAppointment={validateAndSave(APPOINTMENT_RULES, saveAppointment)}
                  labelCls={labelCls}
                  inputCls={inputCls}
                />
              )}

              {/* Service Modal */}
              {modal.type === 'service' && (
                <ServiceModal
                  modal={modal}
                  form={form}
                  setForm={setForm}
                  formErrors={formErrors}
                  closeModal={closeModal}
                  isSaving={isSaving}
                  isUploading={isUploading}
                  handleImageUpload={handleImageUpload}
                  saveService={validateAndSave(SERVICE_RULES, saveService)}
                  inputCls={inputCls}
                />
              )}

            </motion.div>
          </motion.div>
        )}

        {/* Payment Status Update Modal */}
        {modal.type === 'payment_approval' && modal.data?.payment && (
          <PaymentApprovalModal
            modal={modal}
            form={form}
            setForm={setForm}
            closeModal={closeModal}
            formatCurrency={formatCurrency}
            paymentStatusDropdownOpen={paymentStatusDropdownOpen}
            setPaymentStatusDropdownOpen={setPaymentStatusDropdownOpen}
            updatePaymentStatus={updatePaymentStatus}
            normalizePaymentStatus={normalizePaymentStatus}
            getAllowedPaymentStatuses={getAllowedPaymentStatuses}
            paymentStatusUpdate={paymentStatusUpdate}
          />
        )}

        {/* Order Details Modal */}
        {modal.type === 'order-details' && modal.data && (
          <OrderDetailsModal
            modal={modal}
            form={form}
            setForm={setForm}
            closeModal={closeModal}
            formatCurrency={formatCurrency}
            updateOrderAndPaymentStatus={updateOrderAndPaymentStatus}
            normalizePaymentStatus={normalizePaymentStatus}
            getAllowedPaymentStatuses={getAllowedPaymentStatuses}
            getOrderStatusConfig={getOrderStatusConfig}
            getPaymentStatusConfig={getPaymentStatusConfig}
            isCashOnDeliveryOrder={isCashOnDeliveryOrder}
            TIMELINE_STEPS={TIMELINE_STEPS}
            ORDER_STATUS_LIFECYCLE={ORDER_STATUS_LIFECYCLE}
            ORDER_STATUS_TRANSITIONS={ORDER_STATUS_TRANSITIONS}
            paymentStatusUpdate={paymentStatusUpdate}
          />
        )}

        {/* Update Order Status Modal */}
        {modal.type === 'order-status' && modal.data && (
          <OrderStatusModal
            modal={modal}
            form={form}
            setForm={setForm}
            closeModal={closeModal}
            isSaving={isSaving}
            setIsSaving={setIsSaving}
            formatCurrency={formatCurrency}
            showToast={showToast}
            fetchOrders={fetchOrders}
            adminApi={adminApi}
            ORDER_STATUS_LIFECYCLE={ORDER_STATUS_LIFECYCLE}
            ORDER_STATUS_TRANSITIONS={ORDER_STATUS_TRANSITIONS}
          />
        )}

        {/* Guitar Type Selector Modal */}
        {showGuitarTypeSelector && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowGuitarTypeSelector(false) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl p-8 w-full max-w-2xl shadow-2xl"
            >
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Select Guitar Type</h2>
                <p className="text-[var(--text-muted)]">Choose the guitar type you want to customize</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Electric */}
                <button
                  onClick={() => {
                    setShowGuitarTypeSelector(false)
                    navigate('/customize?type=electric&mode=walk-in')
                  }}
                  className="p-6 rounded-2xl border-2 border-[var(--border)] hover:border-[var(--gold-primary)] bg-[var(--bg-primary)] hover:bg-[var(--gold-primary)]/5 transition-all group"
                >
                  <Guitar className="w-8 h-8 text-[var(--gold-primary)] mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="text-white font-semibold text-lg mb-1">Electric</h3>
                  <p className="text-[var(--text-muted)] text-sm">Build your custom electric guitar</p>
                </button>

                {/* Bass */}
                <button
                  onClick={() => {
                    setShowGuitarTypeSelector(false)
                    navigate('/customize?type=bass&mode=walk-in')
                  }}
                  className="p-6 rounded-2xl border-2 border-[var(--border)] hover:border-[var(--gold-primary)] bg-[var(--bg-primary)] hover:bg-[var(--gold-primary)]/5 transition-all group"
                >
                  <Guitar className="w-8 h-8 text-[var(--gold-primary)] mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="text-white font-semibold text-lg mb-1">Bass</h3>
                  <p className="text-[var(--text-muted)] text-sm">Design your custom bass guitar</p>
                </button>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowGuitarTypeSelector(false)}
                  className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── APPOINTMENT MODALS ─────────────────────────────────────────────── */}
      <AppointmentDetailsModal
        show={appointmentModalOpen}
        onClose={() => {
          setAppointmentModalOpen(false)
          setSelectedAppointment(null)
        }}
        appointment={selectedAppointment}
        onStatusChange={async (nextStatus, reason) => {
          const id = selectedAppointment?.appointment_id || selectedAppointment?.id
          if (id) {
            await handleAppointmentStatusChange(id, nextStatus, reason)
            setSelectedAppointment((prev) => prev ? { ...prev, status: nextStatus } : null)
          }
        }}
        onCancel={async (reason) => {
          const id = selectedAppointment?.appointment_id || selectedAppointment?.id
          if (id) {
            await handleAppointmentCancel(id, reason)
            setSelectedAppointment((prev) => prev ? { ...prev, status: 'cancelled' } : null)
          }
        }}
        onPaymentStatusUpdate={handleAppointmentPaymentStatusUpdate}
      />

      <AppointmentForm
        isOpen={appointmentFormOpen}
        onClose={() => {
          setAppointmentFormOpen(false)
          setAppointmentFormData(null)
        }}
        onSubmit={handleCreateAppointment}
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
        openOverrides={openOverrides}
        onAddUnavailable={handleAddUnavailableDate}
        onRemoveUnavailable={handleRemoveUnavailableDate}
        onAddOpenOverride={handleAddOpenOverride}
        onRemoveOpenOverride={handleRemoveOpenOverride}
        onOpen={fetchOpenOverrides}
        loading={appointmentLoading}
      />
    </div>
  )
}

