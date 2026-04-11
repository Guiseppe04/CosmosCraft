import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Users, Package, ShoppingBag, Calendar, Search,
  Filter, Edit, Trash2, Eye, BarChart3,
  PieChart, Activity, ArrowUpRight,
  CheckCircle, Check, Info, XCircle, Plus, RefreshCw, X,
  MessageSquare, Briefcase, ChevronLeft, ChevronRight,
  User, Guitar, Layers, Shield, Tag, AlertCircle, DollarSign,
  Save, TrendingUp, UsersRound, Clock, Loader2, Grid3X3, List, MoreHorizontal,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import ProjectTaskTracker from '../components/projects/ProjectTaskTracker'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router'
import { Topbar } from '../components/admin/Topbar'
import { MessagePanel } from '../components/admin/MessagePanel'
import { ProjectProgress, ProgressBadge } from '../components/admin/ProjectProgress'
import { formatCurrency } from '../utils/formatCurrency'
import { adminApi } from '../utils/adminApi'
import { uploadToCloudinary } from '../utils/cloudinary'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { useDebounce } from '../hooks/useDebounce'
import { useSmartPolling } from '../hooks/useSmartPolling'

const VALID_ROLES = ['customer', 'staff', 'admin', 'super_admin']

function updateIfChanged(currentData, newData, setter) {
  const currentStr = JSON.stringify(currentData)
  const newStr = JSON.stringify(newData)
  if (currentStr !== newStr) {
    setter(newData)
  }
}

// ── Validation helpers ───────────────────────────────────────────────────────
function validate(rules, form) {
  const errors = {}
  for (const [field, checks] of Object.entries(rules)) {
    for (const check of checks) {
      const err = check(form[field], form)
      if (err) { errors[field] = err; break }
    }
  }
  return errors
}
const required = (label) => (v) => (!v?.toString().trim() ? `${label} is required` : null)
const positive = (label) => (v) => (Number(v) <= 0 ? `${label} must be greater than 0` : null)

const PRODUCT_RULES = {
  sku: [required('SKU')],
  name: [required('Name')],
  price: [required('Price'), positive('Price')],
}
const CATEGORY_RULES = {
  name: [required('Name')],
  slug: [required('Slug')],
}
const PART_RULES = {
  name: [required('Name')],
  type_mapping: [required('Type Mapping')],
}
const BUILDER_CATEGORY_MAP = {
  body: ['body', 'bodyWood', 'bodyFinish', 'pickguard'],
  neck: ['neck', 'fretboard', 'headstock', 'headstockWood', 'inlays'],
  hardware: ['hardware', 'bridge', 'knobs'],
  electronics: ['pickups'],
}
const SLOT_TO_PART_CATEGORY = {
  body: 'body',
  bodyWood: 'wood_type',
  bodyFinish: 'finish',
  pickguard: 'pickguard',
  neck: 'neck',
  fretboard: 'fretboard',
  headstock: 'misc',
  headstockWood: 'wood_type',
  inlays: 'misc',
  hardware: 'hardware',
  bridge: 'bridge',
  knobs: 'hardware',
  pickups: 'pickups',
}
const PROJECT_RULES = {
  name: [required('Project Name')],
}
const APPOINTMENT_RULES = {
  title: [required('Title')],
  date: [required('Date')],
}

const PAGE_SIZE_OPTIONS = [10, 25, 50]

export function AdminPage() {
  const { user, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const isSuperAdmin = user?.role === 'super_admin'

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const [activeTab, setActiveTab] = useState('dashboard')
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 300)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [productViewMode, setProductViewMode] = useState('grid') // grid | table
  const [productActiveTab, setProductActiveTab] = useState('active') // all | active | inactive

  // Modal state
  const [modal, setModal] = useState({ open: false, type: null, data: null })
  const [showGuitarTypeSelector, setShowGuitarTypeSelector] = useState(false)

  // Confirm dialog state
  const [confirm, setConfirm] = useState({ open: false, title: '', description: '', onConfirm: null, isBusy: false, variant: 'danger' })

  // Filters
  const [userRoleFilter, setUserRoleFilter] = useState('all')
  const [userStatusFilter, setUserStatusFilter] = useState('all')
  const [productQuery, setProductQuery] = useState({
    page: 1,
    pageSize: 10,
    sortBy: 'created_at',
    sortDir: 'desc',
    category_id: '',
    is_active: '',
    min_price: '',
    max_price: '',
  })
  const [partQuery, setPartQuery] = useState({
    page: 1,
    pageSize: 10,
    sortBy: 'created_at',
    sortDir: 'desc',
    guitar_type: '',
    part_category: '',
    is_active: '',
    min_price: '',
    max_price: '',
  })

  // Data state
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [guitars, setGuitars] = useState([])
  const [parts, setParts] = useState([])
  const [users, setUsers] = useState([])
  const [orders, setOrders] = useState([])
  const [projects, setProjects] = useState([])
  const [appointments, setAppointments] = useState([])
  const [inventory, setInventory] = useState([])
  const [salesReport, setSalesReport] = useState(null)
  const [inventoryStats, setInventoryStats] = useState(null)

  const [wizardTab, setWizardTab] = useState('basic')
  const [inventorySubTab, setInventorySubTab] = useState('products')
  const [optimisticStock, setOptimisticStock] = useState({})
  const [adjustPopover, setAdjustPopover] = useState({ open: false, itemId: null, amount: 0, reason: '', name: '' })
  const [form, setForm] = useState({})
  const [formErrors, setFormErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [productsLoading, setProductsLoading] = useState(false)
  const [partsLoading, setPartsLoading] = useState(false)
  const [productsPagination, setProductsPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 })
  const [partsPagination, setPartsPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 })

  // Message panel
  const [messagePanelOpen, setMessagePanelOpen] = useState(false)
  const [selectedConversation, setSelectedConversation] = useState(null)

  // ── Derived / filtered views ─────────────────────────────────────────────
  const visibleProducts = products || []
  const visibleParts = parts || []
  const visibleGuitars = guitars || []
  const visibleCategories = categories || []
  const visibleOrders = orders || []
  const visibleProjects = projects || []
  const visibleAppointments = appointments || []
  const visibleInventory = inventory || []

  const visibleUsers = (users || []).filter(u => {
    if (userRoleFilter !== 'all' && u.role !== userRoleFilter) return false
    if (userStatusFilter !== 'all') {
      const active = userStatusFilter === 'active'
      if (u.is_active !== active) return false
    }
    return true
  })

  const partCategoryOptions = useMemo(
    () => Array.from(new Set((parts || []).map((p) => p.part_category).filter(Boolean))).sort(),
    [parts]
  )
  const guitarTypeOptions = useMemo(
    () => Array.from(new Set((parts || []).map((p) => p.guitar_type).filter(Boolean))).sort(),
    [parts]
  )

  const inventoryHealthData = (() => {
    const productItems = visibleProducts.map((p) => ({ stock: Number(p.stock ?? 0), threshold: Number(p.low_stock_threshold ?? 10) }))
    const partItems = visibleParts.map((p) => ({ stock: Number(p.quantity ?? 0), threshold: 10 }))
    const items = [...productItems, ...partItems]
    if (items.length === 0) return { value: '0%', status: 'Healthy', statusClass: 'text-emerald-400', iconBg: 'bg-emerald-500/15' }
    let critical = false, warning = false, healthyCount = 0
    items.forEach(({ stock, threshold }) => {
      if (stock <= threshold) critical = true
      else if (stock <= threshold * 2) warning = true
      else healthyCount += 1
    })
    const status = critical ? 'Critical' : warning ? 'Warning' : 'Healthy'
    const statusClass = critical ? 'text-red-400' : warning ? 'text-amber-400' : 'text-emerald-400'
    const iconBg = critical ? 'bg-red-500/15' : warning ? 'bg-amber-500/15' : 'bg-emerald-500/15'
    return { value: `${Math.round((healthyCount / items.length) * 100)}%`, status, statusClass, iconBg }
  })()

  // ── Toast ────────────────────────────────────────────────────────────────
  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  // ── Confirm dialog helper ────────────────────────────────────────────────
  const openConfirm = ({ title, description, onConfirm, variant = 'danger' }) => {
    setConfirm({ open: true, title, description, onConfirm, isBusy: false, variant })
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

  // ── Data fetching ────────────────────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    setProductsLoading(true)
    try {
      const res = await adminApi.getProducts({
        search: debouncedSearch,
        ...productQuery,
      })
      updateIfChanged(products, res.data || [], setProducts)
      setProductsPagination(res.pagination || { page: 1, pageSize: 10, total: 0, totalPages: 1 })
    } catch (e) { showToast(e.message, 'error') }
    finally { setProductsLoading(false) }
  }, [debouncedSearch, productQuery, showToast, products])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await adminApi.getCategories()
      const newData = Array.isArray(res.data) ? res.data : res.data?.categories || []
      updateIfChanged(categories, newData, setCategories)
    } catch { }
  }, [categories])

  const fetchGuitars = useCallback(async () => {
    try {
      const res = await adminApi.getCustomizations({ search: debouncedSearch })
      const newData = Array.isArray(res.data) ? res.data : res.data?.customizations || []
      updateIfChanged(guitars, newData, setGuitars)
    } catch (e) { showToast(e.message, 'error') }
  }, [debouncedSearch, showToast, guitars])

  const fetchParts = useCallback(async () => {
    setPartsLoading(true)
    try {
      const res = await adminApi.getBuilderParts({
        search: debouncedSearch,
        ...partQuery,
      })
      updateIfChanged(parts, res.data || [], setParts)
      setPartsPagination(res.pagination || { page: 1, pageSize: 10, total: 0, totalPages: 1 })
    } catch (e) { showToast(e.message, 'error') }
    finally { setPartsLoading(false) }
  }, [debouncedSearch, partQuery, showToast, parts])

  const fetchUsers = useCallback(async () => {
    try {
      const res = await adminApi.getUsers({ search: debouncedSearch })
      const newData = Array.isArray(res.data) ? res.data : res.data?.users || []
      updateIfChanged(users, newData, setUsers)
    } catch (e) { showToast(e.message, 'error') }
  }, [debouncedSearch, showToast, users])

  const fetchOrders = useCallback(async () => {
    try {
      const res = await adminApi.getOrders({ search: debouncedSearch })
      const newData = Array.isArray(res.data) ? res.data : res.data?.orders || []
      updateIfChanged(orders, newData, setOrders)
    } catch (e) { showToast(e.message, 'error') }
  }, [debouncedSearch, showToast, orders])

  const fetchProjects = useCallback(async () => {
    try {
      const res = await adminApi.getProjects({ search: debouncedSearch })
      const newData = Array.isArray(res.data) ? res.data : res.data?.projects || []
      updateIfChanged(projects, newData, setProjects)
    } catch (e) { showToast(e.message, 'error') }
  }, [debouncedSearch, showToast, projects])

  const fetchAppointments = useCallback(async () => {
    try {
      const res = await adminApi.getAppointments({ search: debouncedSearch })
      const newData = Array.isArray(res.data) ? res.data : res.data?.appointments || []
      updateIfChanged(appointments, newData, setAppointments)
    } catch (e) { showToast(e.message, 'error') }
  }, [debouncedSearch, showToast, appointments])

  const fetchInventory = useCallback(async () => {
    try {
      const statsRes = await adminApi.getInventorySummary()
      updateIfChanged(inventoryStats, statsRes.data || {}, setInventoryStats)
      const prodsRes = await adminApi.getInventoryProducts()
      const newData = Array.isArray(prodsRes.data) ? prodsRes.data : prodsRes.data?.products || []
      updateIfChanged(inventory, newData, setInventory)
    } catch (e) { showToast(e.message, 'error') }
  }, [showToast, inventoryStats, inventory])

  const fetchSalesReport = useCallback(async () => {
    try {
      const res = await adminApi.getSalesReport()
      updateIfChanged(salesReport, res.data || {}, setSalesReport)
    } catch (e) {
      showToast(e.message, 'error')
      setSalesReport({
        totalGrossSales: 0, totalTransactions: 0, averagePerTransaction: 0, customizationOrders: 0,
        walkInSales: 0, walkInTransactions: 0, walkInAvg: 0, walkInPercentage: 0,
        onlineSales: 0, onlineTransactions: 0, onlineAvg: 0, onlinePercentage: 0,
        customizationSales: 0, customizationTransactions: 0, customizationAvg: 0, customizationPercentage: 0,
        dailySales: 0, dailyTransactions: 0, weeklySales: 0, weeklyTransactions: 0,
        monthlySales: 0, monthlyTransactions: 0, bestSellingProducts: [], customizationTypes: [],
        customizationRevenue: 0, avgCustomization: 0, walkInConversion: 0, onlineConversion: 0,
      })
    }
  }, [showToast, salesReport])

  // ── Initial data load on tab change ─────────────────────────────────────
  useEffect(() => {
    setSearchQuery('')
    setFormErrors({})
    const loaders = {
      'products-parts': () => { fetchProducts(); fetchCategories(); fetchParts() },
      'categories': () => { fetchCategories(); },
      'guitars': fetchGuitars,
      'users': fetchUsers,
      'orders': fetchOrders,
      'projects': fetchProjects,
      'appointments': fetchAppointments,
      'inventory': () => { fetchInventory(); fetchParts(); },
      'sales-report': fetchSalesReport,
      'dashboard': () => { fetchOrders(); fetchProjects(); fetchAppointments() },
    }
    loaders[activeTab]?.()
  }, [activeTab]) // eslint-disable-line

  // ── Re-fetch when debounced search changes ───────────────────────────────
  useEffect(() => {
    if (activeTab === 'products-parts') {
      setProductQuery((prev) => ({ ...prev, page: 1 }))
      setPartQuery((prev) => ({ ...prev, page: 1 }))
    }
    if (activeTab === 'guitars') fetchGuitars()
    if (activeTab === 'users') fetchUsers()
    if (activeTab === 'orders') fetchOrders()
    if (activeTab === 'projects') fetchProjects()
    if (activeTab === 'appointments') fetchAppointments()
    if (activeTab === 'inventory') { fetchInventory(); fetchParts(); }
  }, [debouncedSearch]) // eslint-disable-line

  useEffect(() => {
    if (activeTab === 'products-parts') fetchProducts()
  }, [activeTab, fetchProducts])

  useEffect(() => {
    if (activeTab === 'products-parts' || activeTab === 'inventory') fetchParts()
  }, [activeTab, fetchParts])

  // ── Smart polling: active tab ────────────────────────────────────────────
  const pollingFn = useCallback(async () => {
    const map = {
      'products-parts': async () => { await fetchProducts(); await fetchParts() },
      'categories': fetchCategories,
      'guitars': fetchGuitars,
      'users': fetchUsers,
      'orders': fetchOrders,
      'projects': fetchProjects,
      'appointments': fetchAppointments,
      'inventory': fetchInventory,
      'sales-report': fetchSalesReport,
      'dashboard': async () => { await fetchOrders(); await fetchProjects(); await fetchAppointments() },
    }
    return map[activeTab]?.()
  }, [activeTab, fetchProducts, fetchParts, fetchCategories, fetchGuitars, fetchUsers, fetchOrders, fetchProjects, fetchAppointments, fetchInventory, fetchSalesReport])

  const pollingEnabled = ['dashboard', 'orders', 'inventory', 'projects', 'appointments'].includes(activeTab)
  useSmartPolling(pollingFn, { interval: 5000, maxInterval: 60000, backoffFactor: 1.5, enabled: pollingEnabled })

  const handleRefresh = () => {
    setIsLoading(true)
    pollingFn()?.finally(() => setIsLoading(false))
  }

  // ── Modal helpers ────────────────────────────────────────────────────────
  const openModal = (type, data = null) => {
    let initialForm = data ? { ...data } : {}
    
    // Aligns primary_image coming from API to image_url used in form wizard
    if (type === 'product' && data?.primary_image) {
      initialForm.image_url = data.primary_image
    }
    
    setForm(initialForm)
    setFormErrors({})
    setModal({ open: true, type, data })
  }
  const closeModal = () => { setModal({ open: false, type: null, data: null }); setFormErrors({}) }

  // ── Form validation helper ───────────────────────────────────────────────
  const validateAndSave = (rules, saveFn) => async () => {
    const errors = validate(rules, form)
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return }
    await saveFn()
  }

  // ── CRUD: Products ───────────────────────────────────────────────────────
  const saveProduct = async () => {
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
        cost_price: form.cost_price ? Number(form.cost_price) : null,
        stock: form.stock ? Number(form.stock) : 0,
        low_stock_threshold: form.low_stock_threshold ? Number(form.low_stock_threshold) : 10,
      }
      delete payload.image_file
      delete payload.preview_url

      if (modal.data?.product_id) {
        await adminApi.updateProduct(modal.data.product_id, payload)
        showToast('Product updated!')
      } else {
        await adminApi.createProduct(payload)
        showToast('Product created!')
      }
      fetchProducts(); closeModal()
    } catch (e) { showToast(e.message, 'error') }
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
        await adminApi.updateCategory(modal.data.category_id, form)
        showToast('Category updated!')
      } else {
        await adminApi.createCategory(form)
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
        showToast('Category deleted')
        fetchCategories()
      },
    })
  }

  // ── CRUD: Builder Parts ──────────────────────────────────────────────────
  const savePart = async () => {
    setIsSaving(true)
    try {
      let finalImageUrl = form.image_url
      if (form.image_file) {
        finalImageUrl = await uploadToCloudinary(form.image_file)
      }
      const payload = { ...form, image_url: finalImageUrl }
      delete payload.image_file
      delete payload.preview_url

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

  const deletePart = (id, name) => {
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

  // ── CRUD: Guitar Customizations ──────────────────────────────────────────
  const deleteGuitar = (id) => {
    openConfirm({
      title: 'Delete Customization?',
      description: 'This will permanently delete the customer\'s saved guitar configuration. This cannot be undone.',
      variant: 'danger',
      onConfirm: async () => {
        await adminApi.deleteCustomization(id)
        showToast('Customization deleted')
        fetchGuitars()
      },
    })
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
      },
    })
  }

  const changeUserRole = async (userId, newRole) => {
    try {
      await adminApi.updateUserRole(userId, newRole)
      showToast(`Role updated to ${newRole.replace('_', ' ')}`)
      fetchUsers()
    } catch (e) { showToast(e.message, 'error') }
  }

  // ── CRUD: Orders ─────────────────────────────────────────────────────────
  const updateOrderStatus = async (orderId, status) => {
    try {
      await adminApi.updateOrder(orderId, { status })
      showToast(`Order ${status.toLowerCase()}!`)
      fetchOrders()
    } catch (e) { showToast(e.message, 'error') }
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
      fetchProjects(); closeModal()
    } catch (e) { showToast(e.message, 'error') }
    finally { setIsSaving(false) }
  }

  const deleteProject = (id, name) => {
    openConfirm({
      title: 'Archive Project?',
      description: `"${name}" will be soft-deleted and hidden from the project list. Linked tasks will be preserved.`,
      variant: 'danger',
      onConfirm: async () => {
        await adminApi.deleteProject(id)
        showToast('Project archived')
        fetchProjects()
      },
    })
  }

  const assignProjectTeam = async (projectId, userIds) => {
    try {
      await adminApi.assignTeam(projectId, userIds)
      showToast('Team assigned!')
      fetchProjects()
    } catch (e) { showToast(e.message, 'error') }
  }

  // ── CRUD: Appointments ───────────────────────────────────────────────────
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
  const saveStockAdjust = async () => {
    setIsSaving(true)
    try {
      const { product_id, change_type, quantity, notes } = form
      if (!product_id || !change_type || !quantity) {
        showToast('Please fill all required fields', 'error'); return
      }
      if (change_type === 'stock_in') await adminApi.addStock({ product_id, quantity: Number(quantity), notes })
      else if (change_type === 'stock_out') await adminApi.deductStock({ product_id, quantity: Number(quantity), notes })
      else await adminApi.adjustStock({ product_id, quantity: Number(quantity), notes })
      showToast('Stock adjusted!')
      fetchInventory()
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
      pending: 'bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] border-[var(--gold-primary)]/30',
      not_started: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      Confirmed: 'bg-green-500/20 text-green-400 border-green-500/30',
      Scheduled: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      Cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
      cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
      'Low Stock': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      'Out of Stock': 'bg-red-500/20 text-red-400 border-red-500/30',
      processing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    }
    return map[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }

  const inputCls = 'w-full px-4 py-3 bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl text-[var(--text-light)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] text-sm'
  const inputErrCls = 'w-full px-4 py-3 bg-[var(--surface-dark)] border border-red-500/50 rounded-2xl text-[var(--text-light)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-red-500 text-sm'
  const labelCls = 'block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-2'

  // ── Tabs ─────────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'products-parts', label: 'Guitar Parts & Products', icon: Layers },
    { id: 'categories', label: 'Categories', icon: Tag },
    { id: 'guitars', label: 'Customizations', icon: Guitar },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'inventory', label: 'Inventory', icon: Activity },
    { id: 'sales-report', label: 'Sales Report', icon: PieChart },
    { id: 'projects', label: 'Projects', icon: Briefcase },
    { id: 'appointments', label: 'Appointments', icon: Calendar },
    { id: 'users', label: 'Users', icon: Shield },
  ]

  // ── JSX ──────────────────────────────────────────────────────────────────
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
      <aside className={`fixed left-0 top-0 h-screen bg-[#1E201E] border-r border-[#5A5555] transition-all duration-300 z-40 ${sidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-6 w-6 h-6 bg-[#1E201E] border border-[#5A5555] rounded-full flex items-center justify-center hover:bg-[var(--gold-primary)] hover:border-[var(--gold-primary)] transition-all"
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4 text-[#F5F5F5]" /> : <ChevronLeft className="w-4 h-4 text-[#F5F5F5]" />}
        </button>

        <nav className="p-4 space-y-1 overflow-y-auto max-h-[calc(100vh-10rem)]">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-medium transition-all duration-200 ${activeTab === tab.id
                  ? 'bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] border-2 border-[var(--gold-primary)] shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-primary)] hover:text-white border-2 border-transparent'
                  }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${activeTab === tab.id ? 'text-[var(--text-dark)]' : 'text-[var(--text-muted)]'}`} />
                {!sidebarCollapsed && (
                  <span className={`truncate ${activeTab === tab.id ? 'text-[var(--text-dark)]' : 'text-[var(--text-muted)]'}`}>{tab.label}</span>
                )}
              </button>
            )
          })}
        </nav>

        <div className={`absolute bottom-4 left-0 right-0 px-4 ${sidebarCollapsed ? 'text-center' : ''}`}>
          <div className={`flex items-center gap-3 p-4 rounded-2xl bg-[#1E201E] border border-[#5A5555] ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] flex items-center justify-center flex-shrink-0 border-2 border-white">
              <User className="w-5 h-5 text-[var(--text-dark)]" />
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm truncate">{user?.firstName || 'Admin'}</p>
                <p className="text-[var(--gold-primary)] text-xs capitalize">{user?.role?.replace('_', ' ')}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className={`transition-all duration-300 bg-[var(--bg-primary)] ${sidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
        <Topbar title={tabs.find(t => t.id === activeTab)?.label || 'Dashboard'} userRole={user?.role} />

        <main className="p-6 pt-28">

          {/* Actions bar */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            {['products-parts', 'guitars', 'users', 'categories', 'orders', 'projects', 'appointments'].includes(activeTab) && (
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
              {/* Refresh button — always shown */}
              {activeTab !== 'dashboard' && (
                <button onClick={handleRefresh} className="p-2 border border-[var(--border)] rounded-lg hover:border-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/10 transition-all" title="Refresh">
                  <RefreshCw className={`w-4 h-4 text-[var(--text-muted)] ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              )}
              {activeTab === 'products-parts' && (
                <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
                  <button
                    onClick={() => setProductViewMode('grid')}
                    className={`p-2 ${productViewMode === 'grid' ? 'bg-[var(--gold-primary)] text-black' : 'bg-[var(--surface-dark)] text-[var(--text-muted)] hover:text-white'} transition-colors`}
                    title="Grid View"
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setProductViewMode('table')}
                    className={`p-2 ${productViewMode === 'table' ? 'bg-[var(--gold-primary)] text-black' : 'bg-[var(--surface-dark)] text-[var(--text-muted)] hover:text-white'} transition-colors`}
                    title="Table View"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              )}
              {activeTab === 'products-parts' && (
                <>
                  <button onClick={() => openModal('product')} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black rounded-xl font-semibold text-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all">
                    <Plus className="w-4 h-4" /> Add Product
                  </button>
                  <button onClick={() => openModal('part')} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black rounded-xl font-semibold text-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all">
                    <Plus className="w-4 h-4" /> Add Part
                  </button>
                </>
              )}
              {activeTab === 'categories' && (
                <button onClick={() => openModal('category')} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black rounded-xl font-semibold text-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all">
                  <Plus className="w-4 h-4" /> Add Category
                </button>
              )}
              {activeTab === 'projects' && (
                <button onClick={() => setShowGuitarTypeSelector(true)} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black rounded-xl font-semibold text-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all">
                  <Plus className="w-4 h-4" /> New Project
                </button>
              )}
              {activeTab === 'appointments' && (
                <button onClick={() => openModal('appointment')} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black rounded-xl font-semibold text-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all">
                  <Plus className="w-4 h-4" /> Add Appointment
                </button>
              )}
              {activeTab === 'inventory' && (
                <button onClick={() => openModal('inventory')} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black rounded-xl font-semibold text-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all">
                  <Plus className="w-4 h-4" /> Adjust Stock
                </button>
              )}
            </div>
          </div>

          {/* ── DASHBOARD ──────────────────────────────────────────────────── */}
          {activeTab === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="space-y-6">
                <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl p-6">
                  <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
                    <div>
                      <p className="text-[var(--gold-primary)] text-sm font-semibold uppercase tracking-[0.3em] mb-3">Admin Dashboard</p>
                      <h1 className="text-3xl md:text-4xl font-bold text-white">Welcome back, {user?.firstName || 'Admin'}</h1>
                      <p className="text-[var(--text-muted)] mt-3 max-w-2xl">Monitor sales performance, inventory health, and customer activity in real-time.</p>
                    </div>
                    <div className="flex flex-wrap gap-3 items-center">
                      <button onClick={handleRefresh} className="inline-flex items-center gap-2 rounded-2xl bg-[var(--gold-primary)] px-4 py-2 text-sm font-semibold text-black hover:bg-[var(--gold-secondary)] transition-all">
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh data
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-8">
                    {[
                      { label: 'Revenue this month', value: formatCurrency(salesReport?.monthlySales || 0, true), badge: salesReport?.monthlySales > 0 ? '+live' : 'Live', badgeCls: 'bg-green-500/10 text-green-400' },
                      { label: 'Total orders', value: visibleOrders.length, badge: 'Order volume', badgeCls: 'bg-blue-500/10 text-blue-400' },
                      { label: 'Active projects', value: visibleProjects.filter(p => p.status === 'in_progress').length, badge: 'In progress', badgeCls: 'bg-purple-500/10 text-purple-400' },
                      { label: 'Open appointments', value: visibleAppointments.filter(a => a.status === 'pending' || a.status === 'approved').length, badge: 'Action required', badgeCls: 'bg-[var(--gold-primary)]/10 text-[var(--gold-primary)]' },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-3xl border border-[var(--border)] bg-[var(--bg-primary)] p-5">
                        <p className="text-[var(--text-muted)] text-sm">{stat.label}</p>
                        <p className="mt-3 text-3xl font-bold text-white">{stat.value}</p>
                        <div className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${stat.badgeCls}`}>{stat.badge}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.8fr_1.2fr]">
                  <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                      <div>
                        <h2 className="text-white text-2xl font-semibold">Performance Trends</h2>
                        <p className="text-[var(--text-muted)] mt-1">Revenue across the last 6 months.</p>
                      </div>
                    </div>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={[
                          { month: 'Jan', revenue: 42000 }, { month: 'Feb', revenue: 38000 },
                          { month: 'Mar', revenue: 51000 }, { month: 'Apr', revenue: 47000 },
                          { month: 'May', revenue: 56000 }, { month: 'Jun', revenue: 62000 },
                        ]}>
                          <defs>
                            <linearGradient id="dashboardTrend" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#d4af37" stopOpacity={0.25} />
                              <stop offset="95%" stopColor="#d4af37" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                          <XAxis dataKey="month" stroke="#b0b4bc" fontSize={12} />
                          <YAxis stroke="#b0b4bc" fontSize={12} tickFormatter={(v) => `₱${v / 1000}k`} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#131313', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px' }}
                            labelStyle={{ color: '#f8fafc' }}
                            itemStyle={{ color: '#d4af37' }}
                            formatter={(v) => [`₱${v.toLocaleString()}`, 'Revenue']}
                          />
                          <Area type="monotone" dataKey="revenue" stroke="#d4af37" strokeWidth={2} fill="url(#dashboardTrend)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-6">
                      <div className="flex items-center justify-between mb-5">
                        <div>
                          <h3 className="text-white text-lg font-semibold">Operational Pulse</h3>
                          <p className="text-[var(--text-muted)] text-sm">Live system health indicators.</p>
                        </div>
                        <span className="text-[var(--gold-primary)] text-sm font-semibold">Real-time</span>
                      </div>
                      <div className="space-y-4">
                        {[
                          { label: 'Inventory health', value: inventoryHealthData.value, status: inventoryHealthData.status, icon: Activity, iconBg: inventoryHealthData.iconBg, statusClass: inventoryHealthData.statusClass },
                          { label: 'Pending orders', value: visibleOrders.filter(o => o.status === 'pending').length, status: 'Processing', icon: Package, statusClass: 'text-blue-400', iconBg: 'bg-blue-500/15' },
                          { label: 'Open appointments', value: visibleAppointments.filter(a => a.status === 'pending').length, status: 'Upcoming', icon: Calendar, statusClass: 'text-[var(--gold-primary)]', iconBg: 'bg-[var(--gold-primary)]/15' },
                        ].map((item) => {
                          const Icon = item.icon
                          return (
                            <div key={item.label} className="flex items-center justify-between rounded-3xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
                              <div className="flex items-center gap-4">
                                <div className={`grid h-11 w-11 place-items-center rounded-2xl ${item.iconBg}`}>
                                  <Icon className="w-5 h-5 text-[var(--gold-primary)]" />
                                </div>
                                <div>
                                  <p className="text-white font-semibold">{item.label}</p>
                                  <p className={`text-sm ${item.statusClass}`}>{item.status}</p>
                                </div>
                              </div>
                              <p className="text-white text-lg font-semibold">{item.value}</p>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-6">
                      <div className="flex items-center justify-between mb-5">
                        <div>
                          <h3 className="text-white text-lg font-semibold">Upcoming appointments</h3>
                          <p className="text-[var(--text-muted)] text-sm">Next customer meetings.</p>
                        </div>
                        <button onClick={() => setActiveTab('appointments')} className="text-[var(--gold-primary)] text-sm font-semibold hover:underline">View all</button>
                      </div>
                      {visibleAppointments.length === 0 ? (
                        <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-primary)] p-8 text-center text-[var(--text-muted)]">No upcoming appointments.</div>
                      ) : (
                        <div className="space-y-3">
                          {visibleAppointments.slice(0, 4).map((apt) => (
                            <div key={apt.appointment_id} className="rounded-3xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="text-white font-semibold">{apt.title || 'Appointment'}</p>
                                  <p className="text-[var(--text-muted)] text-sm">{apt.customer_name || apt.user_name || 'Customer'}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[var(--gold-primary)] font-semibold">{apt.time || 'TBA'}</p>
                                  <p className="text-[var(--text-muted)] text-xs">{apt.date ? new Date(apt.date).toLocaleDateString() : apt.scheduled_at ? new Date(apt.scheduled_at).toLocaleDateString() : '—'}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── PRODUCTS & PARTS ───────────────────────────────────────────── */}
          {activeTab === 'products-parts' && (
            <motion.div key="products-parts" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-white text-xl font-semibold">Products</h2>
                  <p className="text-[var(--text-muted)] text-sm">Manage catalog items, visibility, and pricing.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setProductActiveTab('active')
                    setProductQuery({ page: 1, pageSize: productQuery.pageSize, sortBy: 'created_at', sortDir: 'desc', category_id: '', is_active: 'true', min_price: '', max_price: '' })
                  }}
                  className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-white hover:border-[var(--gold-primary)] transition-colors"
                >
                  Clear product filters
                </button>
              </div>
              {/* Product Activity Tabs */}
              <div className="flex border-b border-[var(--border)] mb-6 gap-4 pb-0">
                {[{ id: 'all', label: 'All Products' }, { id: 'active', label: 'Active' }, { id: 'inactive', label: 'Inactive' }].map(tab => {
                  const tabIsActive = productActiveTab === tab.id
                  const tabCount = tab.id === 'all' ? productsPagination.total : tab.id === 'active' ? (visibleProducts.filter(p => p.is_active).length) : (visibleProducts.filter(p => !p.is_active).length)
                  return (
                    <button key={tab.id}
                      onClick={() => {
                        setProductActiveTab(tab.id)
                        const isActiveValue = tab.id === 'all' ? '' : tab.id === 'active' ? 'true' : 'false'
                        setProductQuery((prev) => ({ ...prev, page: 1, is_active: isActiveValue }))
                      }}
                      className={`px-4 py-3 text-sm font-semibold uppercase tracking-wider transition-all relative ${tabIsActive ? 'text-[var(--gold-primary)]' : 'text-[var(--text-muted)] hover:text-white'}`}
                    >
                      {tab.label}
                      {tabIsActive && (
                        <motion.div layoutId="product-tab-indicator" className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--gold-primary)]" />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Product Filter Bar */}
              <div className="mb-6 p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)]/70 backdrop-blur-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                  <select aria-label="Filter products by category" value={productQuery.category_id} onChange={(e) => setProductQuery((prev) => ({ ...prev, page: 1, category_id: e.target.value }))} className={inputCls}>
                    <option value="">All categories</option>
                    {visibleCategories.map((c) => <option key={c.category_id} value={c.category_id}>{c.name}</option>)}
                  </select>
                  <select aria-label="Sort products" value={`${productQuery.sortBy}:${productQuery.sortDir}`} onChange={(e) => {
                    const [sortBy, sortDir] = e.target.value.split(':')
                    setProductQuery((prev) => ({ ...prev, page: 1, sortBy, sortDir }))
                  }} className={inputCls}>
                    <option value="created_at:desc">Newest first</option>
                    <option value="created_at:asc">Oldest first</option>
                    <option value="name:asc">Name A-Z</option>
                    <option value="name:desc">Name Z-A</option>
                    <option value="price:asc">Price: Low to High</option>
                    <option value="price:desc">Price: High to Low</option>
                  </select>
                  <select aria-label="Products page size" value={productQuery.pageSize} onChange={(e) => setProductQuery((prev) => ({ ...prev, page: 1, pageSize: Number(e.target.value) }))} className={inputCls}>
                    {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n} per page</option>)}
                  </select>
                </div>
              </div>

              {productsLoading ? (
                <SectionLoader label="Loading products..." />
              ) : visibleProducts.length === 0 ? (
                <EmptyState icon={Package} label={debouncedSearch ? 'No products match your search/filters' : 'No products found'} action={() => openModal('product')} actionLabel="Add First Product" />
              ) : productViewMode === 'table' ? (
                <AdminTable
                  columns={['Image', 'Product', 'SKU', 'Price', 'Cost', 'Stock Status', 'Actions']}
                  rows={visibleProducts}
                  renderRow={(p) => (
                    <>
                      <td className="py-4 px-6">
                        {p.primary_image ? (
                          <img src={p.primary_image} alt={p.name} className="w-12 h-12 object-cover rounded-lg border border-[var(--border)]" loading="lazy" />
                        ) : (
                          <div className="w-12 h-12 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg flex items-center justify-center">
                            <Package className="w-5 h-5 text-[var(--text-muted)]" />
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <p className="text-white font-semibold">{p.name}</p>
                      </td>
                      <td className="py-4 px-6 text-[var(--text-muted)] font-mono text-sm">{p.sku || '—'}</td>
                      <td className="py-4 px-6 text-[var(--gold-primary)] font-bold">{formatCurrency(p.price)}</td>
                      <td className="py-4 px-6 text-[var(--text-muted)] text-sm">{p.cost_price ? formatCurrency(p.cost_price) : '—'}</td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2" title={`Stock: ${p.stock}`}>
                          <span className={`w-2 h-2 rounded-full ${p.stock > (p.low_stock_threshold || 10) ? 'bg-green-400' : p.stock > 0 ? 'bg-amber-400' : 'bg-red-400'}`} />
                          <span className={`text-sm font-semibold ${p.stock > (p.low_stock_threshold || 10) ? 'text-green-400' : p.stock > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                            {p.stock > (p.low_stock_threshold || 10) ? 'In Stock' : p.stock > 0 ? 'Low Stock' : 'Out of Stock'}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openModal('product', p)} className="p-2 hover:bg-[var(--gold-primary)]/10 rounded-lg transition-colors" title="Edit">
                            <Edit className="w-4 h-4 text-[var(--text-muted)]" />
                          </button>
                          <button onClick={() => deleteProduct(p.product_id, p.name)} className="p-2 hover:bg-red-500/10 rounded-lg transition-colors" title="Deactivate">
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                  empty={<EmptyState icon={Package} label="No products found" action={() => openModal('product')} actionLabel="Add Product" />}
                />
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {visibleProducts.map((p) => {
                    const profitMargin = p.price && p.cost_price && p.cost_price > 0 && p.cost_price < p.price 
                      ? Math.round(((p.price - p.cost_price) / p.price) * 100)
                      : null
                    const hasNoMargin = p.price && p.cost_price && p.cost_price >= p.price
                    
                    return (
                      <motion.div key={p.product_id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        className={`bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl overflow-hidden hover:border-[var(--gold-primary)]/50 hover:-translate-y-1 transition-all group ${!p.is_active ? 'opacity-60 filter grayscale-[0.4]' : ''}`}
                      >
                        <div className="relative h-44 overflow-hidden bg-[var(--bg-primary)]">
                          {p.primary_image ? (
                            <img src={p.primary_image} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-16 h-16 text-[var(--text-muted)]/30" />
                            </div>
                          )}
                          <div className="absolute top-3 right-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${p.is_active ? 'bg-green-500/80 text-white border-green-400' : 'bg-gray-500/80 text-white border-gray-400'}`}>
                              {p.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                        <div className="p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-[var(--gold-primary)] text-xs font-mono">{p.sku || 'No SKU'}</p>
                              <h3 className="text-white font-semibold text-lg truncate">{p.name}</h3>
                            </div>
                          </div>

                          <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--border)]">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className="text-white font-bold text-xl">{formatCurrency(p.price)}</span>
                                {profitMargin !== null && !hasNoMargin && (
                                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded-full">
                                    +{profitMargin}% margin
                                  </span>
                                )}
                                {hasNoMargin && (
                                  <span className="px-2 py-0.5 bg-red-500/10 text-red-400 text-xs font-semibold rounded-full">
                                    No margin
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${p.stock > (p.low_stock_threshold || 10) ? 'bg-green-400' : p.stock > 0 ? 'bg-amber-400' : 'bg-red-400'}`} />
                                <span className={`text-xs font-semibold ${p.stock > (p.low_stock_threshold || 10) ? 'text-green-400' : p.stock > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                                  {p.stock > (p.low_stock_threshold || 10) ? 'In Stock' : p.stock > 0 ? 'Low Stock' : 'Out of Stock'}
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => openModal('product', p)} className="p-2 bg-[var(--bg-primary)] hover:bg-[var(--gold-primary)]/20 rounded-lg transition-colors" title="Edit">
                                <Edit className="w-4 h-4 text-[var(--text-muted)]" />
                              </button>
                              <button onClick={() => deleteProduct(p.product_id, p.name)} className="p-2 bg-[var(--bg-primary)] hover:bg-red-500/20 rounded-lg transition-colors" title="Delete">
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
              <PaginationBar
                pagination={productsPagination}
                onPageChange={(nextPage) => setProductQuery((prev) => ({ ...prev, page: nextPage }))}
              />

              {/* Builder Parts Section */}
              <div className="flex justify-between items-center mb-4 mt-10">
                <div>
                  <h3 className="text-white text-xl font-semibold">Guitar Parts (Builder Catalog)</h3>
                  <p className="text-[var(--text-muted)] text-sm">Align parts with builder slots used in customization pages.</p>
                </div>
                <button onClick={() => openModal('part')} className="flex items-center gap-2 bg-[var(--surface-dark)] border border-[var(--border)] text-white px-4 py-2 rounded-xl font-semibold hover:border-[var(--gold-primary)]/50 transition-colors">
                  <Plus className="w-5 h-5 text-[var(--gold-primary)]" /> Add Builder Part
                </button>
              </div>
              <div className="mb-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setPartQuery({ page: 1, pageSize: partQuery.pageSize, sortBy: 'created_at', sortDir: 'desc', guitar_type: '', part_category: '', is_active: '', min_price: '', max_price: '' })}
                  className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-white hover:border-[var(--gold-primary)] transition-colors"
                >
                  Clear part filters
                </button>
              </div>
              <div className="mb-4 p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)]/70 backdrop-blur-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-3">
                  <select aria-label="Filter parts by guitar type" value={partQuery.guitar_type} onChange={(e) => setPartQuery((prev) => ({ ...prev, page: 1, guitar_type: e.target.value }))} className={inputCls}>
                    <option value="">All guitar types</option>
                    {guitarTypeOptions.map((val) => <option key={val} value={val}>{val}</option>)}
                  </select>
                  <select aria-label="Filter parts by category" value={partQuery.part_category} onChange={(e) => setPartQuery((prev) => ({ ...prev, page: 1, part_category: e.target.value }))} className={inputCls}>
                    <option value="">All categories</option>
                    {partCategoryOptions.map((val) => <option key={val} value={val}>{val}</option>)}
                  </select>
                  <select aria-label="Filter parts by status" value={partQuery.is_active} onChange={(e) => setPartQuery((prev) => ({ ...prev, page: 1, is_active: e.target.value }))} className={inputCls}>
                    <option value="">All statuses</option>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                  <select aria-label="Sort parts" value={`${partQuery.sortBy}:${partQuery.sortDir}`} onChange={(e) => {
                    const [sortBy, sortDir] = e.target.value.split(':')
                    setPartQuery((prev) => ({ ...prev, page: 1, sortBy, sortDir }))
                  }} className={inputCls}>
                    <option value="created_at:desc">Newest first</option>
                    <option value="created_at:asc">Oldest first</option>
                    <option value="name:asc">Name A-Z</option>
                    <option value="name:desc">Name Z-A</option>
                    <option value="price:asc">Price: Low to High</option>
                    <option value="price:desc">Price: High to Low</option>
                  </select>
                  <select aria-label="Parts page size" value={partQuery.pageSize} onChange={(e) => setPartQuery((prev) => ({ ...prev, page: 1, pageSize: Number(e.target.value) }))} className={inputCls}>
                    {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n} per page</option>)}
                  </select>
                </div>
              </div>
              {partsLoading ? (
                <SectionLoader label="Loading builder parts..." />
              ) : (
                <AdminTable
                  columns={['Asset', 'Part Name', 'Guitar Type', 'Category', 'Stock', 'Upgrade Price', 'Status', 'Actions']}
                  rows={visibleParts}
                  renderRow={(part) => (
                    <>
                      <td className="py-4 px-6">
                        {part.image_url ? (
                          <div className="w-12 h-12 relative flex items-center justify-center p-1 bg-black/30 rounded-lg overflow-hidden border border-[var(--border)]">
                            <img src={part.image_url} alt={part.name} className="max-w-full max-h-full object-contain drop-shadow-md" loading="lazy" />
                          </div>
                        ) : (
                          <div className="w-12 h-12 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg flex items-center justify-center">
                            <Guitar className="w-5 h-5 text-[var(--text-muted)]" />
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6 text-white font-semibold">{part.name}</td>
                      <td className="py-4 px-6 text-[var(--text-muted)] capitalize">{part.guitar_type || '—'}</td>
                      <td className="py-4 px-6 text-[var(--text-muted)] capitalize">{(part.part_category || part.type_mapping || '—').replace('_', ' ')}</td>
                      <td className="py-4 px-6">
                        <span className={part.stock > 0 ? 'text-green-400' : 'text-red-400'}>{part.stock}</span>
                      </td>
                      <td className="py-4 px-6 text-[var(--gold-primary)] font-bold text-lg">{formatCurrency(part.price)}</td>
                      <td className="py-4 px-6">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${part.is_active ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                          {part.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex gap-2">
                          <button onClick={() => openModal('part', part)} className="p-2 hover:bg-[var(--gold-primary)]/10 rounded-lg transition-colors" aria-label={`View ${part.name}`}>
                            <Eye className="w-4 h-4 text-[var(--text-muted)]" />
                          </button>
                          <button onClick={() => openModal('part', part)} className="p-2 hover:bg-[var(--gold-primary)]/10 rounded-lg transition-colors" aria-label={`Edit ${part.name}`}>
                            <Edit className="w-4 h-4 text-[var(--text-muted)]" />
                          </button>
                          <button onClick={() => deletePart(part.part_id, part.name)} className="p-2 hover:bg-red-500/10 rounded-lg transition-colors" aria-label={`Deactivate ${part.name}`}>
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                  empty={<EmptyState icon={Layers} label={debouncedSearch ? 'No builder parts match your search/filters' : 'No builder parts yet'} action={() => openModal('part')} actionLabel="Add Builder Part" />}
                />
              )}
              <PaginationBar
                pagination={partsPagination}
                onPageChange={(nextPage) => setPartQuery((prev) => ({ ...prev, page: nextPage }))}
              />
            </motion.div>
          )}

          {/* ── CATEGORIES ─────────────────────────────────────────────────── */}
          {activeTab === 'categories' && (
            <motion.div key="categories" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <AdminTable
                columns={['Name', 'Slug', 'Parent', 'Status', 'Actions']}
                rows={visibleCategories}
                renderRow={(cat) => (
                  <>
                    <td className="py-4 px-6 text-white font-semibold">{cat.name}</td>
                    <td className="py-4 px-6 text-[var(--text-muted)] font-mono text-sm">{cat.slug}</td>
                    <td className="py-4 px-6 text-[var(--text-muted)]">{cat.parent_name || '—'}</td>
                    <td className="py-4 px-6"><StatusBadge active={cat.is_active} /></td>
                    <td className="py-4 px-6">
                      <div className="flex gap-2">
                        <button onClick={() => openModal('category', cat)} className="p-1.5 hover:bg-[var(--gold-primary)]/10 rounded">
                          <Edit className="w-4 h-4 text-[var(--text-muted)]" />
                        </button>
                        <button onClick={() => deleteCategory(cat.category_id, cat.name)} className="p-1.5 hover:bg-red-500/10 rounded">
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </>
                )}
                empty={<EmptyState icon={Tag} label="No categories yet" action={() => openModal('category')} actionLabel="Add Category" />}
              />
            </motion.div>
          )}

          {/* ── GUITAR CUSTOMIZATIONS ──────────────────────────────────────── */}
          {activeTab === 'guitars' && (
            <motion.div key="guitars" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <AdminTable
                columns={['Customer', 'Guitar', 'Type', 'Price', 'Saved', 'Actions']}
                rows={visibleGuitars}
                renderRow={(g) => (
                  <>
                    <td className="py-4 px-6">
                      <p className="text-white font-semibold">{g.user_name || '—'}</p>
                      <p className="text-[var(--text-muted)] text-xs">{g.user_email || '—'}</p>
                    </td>
                    <td className="py-4 px-6 text-white">{g.name || 'Untitled'}</td>
                    <td className="py-4 px-6">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] border border-[var(--gold-primary)]/30 capitalize">{g.guitar_type}</span>
                    </td>
                    <td className="py-4 px-6 text-[var(--gold-primary)] font-bold">{formatCurrency(g.total_price)}</td>
                    <td className="py-4 px-6"><StatusBadge active={g.is_saved} trueLabel="Saved" falseLabel="Draft" /></td>
                    <td className="py-4 px-6">
                      <div className="flex gap-2">
                        <button onClick={() => openModal('guitar_view', g)} className="p-1.5 hover:bg-[var(--gold-primary)]/10 rounded">
                          <Eye className="w-4 h-4 text-[var(--text-muted)]" />
                        </button>
                        {isSuperAdmin && (
                          <button onClick={() => deleteGuitar(g.customization_id)} className="p-1.5 hover:bg-red-500/10 rounded">
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        )}
                      </div>
                    </td>
                  </>
                )}
                empty={<EmptyState icon={Guitar} label="No customizations yet" />}
              />
            </motion.div>
          )}

          {/* ── USERS ──────────────────────────────────────────────────────── */}
          {activeTab === 'users' && (
            <motion.div key="users" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4 p-4 bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl">
                <div className="flex items-center gap-3">
                  <Filter className="w-5 h-5 text-[var(--gold-primary)]" />
                  <span className="text-white font-medium">Filters:</span>
                </div>
                <div className="flex flex-wrap gap-4">
                  <select value={userRoleFilter} onChange={(e) => setUserRoleFilter(e.target.value)} className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-[var(--gold-primary)]">
                    <option value="all">All Roles</option>
                    {VALID_ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                  </select>
                  <select value={userStatusFilter} onChange={(e) => setUserStatusFilter(e.target.value)} className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-[var(--gold-primary)]">
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <AdminTable
                columns={['User', 'Role', 'Status', 'Joined', 'Actions']}
                rows={visibleUsers}
                renderRow={(u) => (
                  <>
                    <td className="py-4 px-6">
                      <p className="text-white font-semibold">{u.first_name} {u.last_name}</p>
                      <p className="text-[var(--text-muted)] text-xs">{u.email}</p>
                    </td>
                    <td className="py-4 px-6">
                      {isSuperAdmin ? (
                        <select value={u.role} onChange={(e) => changeUserRole(u.user_id, e.target.value)}
                          className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-[var(--gold-primary)]">
                          {VALID_ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                        </select>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] border border-[var(--gold-primary)]/30 capitalize">{u.role?.replace('_', ' ')}</span>
                      )}
                    </td>
                    <td className="py-4 px-6"><StatusBadge active={u.is_active} /></td>
                    <td className="py-4 px-6 text-[var(--text-muted)] text-sm">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                    <td className="py-4 px-6">
                      <button
                        onClick={() => toggleUserStatus(u.user_id, u.is_active, `${u.first_name} ${u.last_name}`)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${u.is_active
                          ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30'
                          : 'bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/30'
                          }`}
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </>
                )}
                empty={<EmptyState icon={Users} label="No users found" />}
              />
            </motion.div>
          )}

          {/* ── ORDERS ─────────────────────────────────────────────────────── */}
          {activeTab === 'orders' && (
            <motion.div key="orders" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              {visibleOrders.length === 0 ? (
                <EmptyState icon={ShoppingBag} label="No orders found" />
              ) : (
                <div className="space-y-4">
                  {visibleOrders.map((order) => (
                    <motion.div key={order.order_id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 hover:border-[var(--gold-primary)]/50 transition-all"
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <p className="text-white font-semibold">Order #{order.order_number || order.order_id?.slice(0, 8)}</p>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(order.status)}`}>
                              {order.status || 'Pending'}
                            </span>
                          </div>
                          <p className="text-[var(--text-muted)] text-sm">
                            {order.customer_name || order.user_name || 'Customer'} • {order.items?.length || 0} items
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[var(--gold-primary)] font-bold text-lg">{formatCurrency(order.total || order.total_amount, true)}</p>
                          <p className="text-[var(--text-muted)] text-xs">{order.created_at ? new Date(order.created_at).toLocaleDateString() : '—'}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-4 border-t border-[var(--border)]">
                        <button onClick={() => openModal('order_view', order)} className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-white text-sm hover:border-[var(--gold-primary)]/50 transition-all">
                          <Eye className="w-4 h-4" /> View
                        </button>
                        {order.status === 'pending' && (
                          <button onClick={() => updateOrderStatus(order.order_id, 'processing')} className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm hover:bg-green-500/20 transition-all">
                            <CheckCircle className="w-4 h-4" /> Confirm
                          </button>
                        )}
                        {order.status === 'processing' && (
                          <button onClick={() => updateOrderStatus(order.order_id, 'completed')} className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400 text-sm hover:bg-blue-500/20 transition-all">
                            <CheckCircle className="w-4 h-4" /> Complete
                          </button>
                        )}
                        {order.status !== 'cancelled' && order.status !== 'completed' && (
                          <button onClick={() => cancelOrder(order.order_id, order.order_number)} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm hover:bg-red-500/20 transition-all">
                            <XCircle className="w-4 h-4" /> Cancel
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── PROJECTS ───────────────────────────────────────────────────── */}
          {activeTab === 'projects' && (
            <motion.div key="projects" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              {visibleProjects.length === 0 ? (
                <EmptyState icon={Briefcase} label="No projects yet" action={() => openModal('project')} actionLabel="Create Project" />
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {visibleProjects.map((project) => (
                    <motion.div key={project.project_id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 hover:border-[var(--gold-primary)]/50 transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-white font-semibold">{project.name || project.title || 'Untitled Project'}</h3>
                          <p className="text-[var(--text-muted)] text-xs">{project.customer_name || project.user_name || '—'}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(project.status)}`}>
                          {project.status?.replace('_', ' ') || 'Pending'}
                        </span>
                      </div>
                      {project.description && (
                        <p className="text-[var(--text-muted)] text-sm mb-4 line-clamp-2">{project.description}</p>
                      )}
                      {project.progress !== undefined && (
                        <div className="mb-4">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-[var(--text-muted)]">Progress</span>
                            <span className="text-[var(--gold-primary)]">{project.progress}%</span>
                          </div>
                          <div className="h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] rounded-full" style={{ width: `${project.progress}%` }} />
                          </div>
                        </div>
                      )}
                      <div className="flex flex-col gap-2 pt-4 border-t border-[var(--border)]">
                        <button onClick={() => openModal('project_tasks', project)} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[var(--gold-primary)]/10 border border-[var(--gold-primary)]/30 rounded-lg text-[var(--gold-primary)] text-sm hover:bg-[var(--gold-primary)]/20 transition-all">
                          <Activity className="w-4 h-4" /> Tasks & Parts
                        </button>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button onClick={() => openModal('project', project)} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-white text-sm hover:border-[var(--gold-primary)]/50 transition-all">
                          <Edit className="w-4 h-4" /> Edit
                        </button>
                        <button onClick={() => openModal('project_team', project)} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-white text-sm hover:border-[var(--gold-primary)]/50 transition-all">
                          <Users className="w-4 h-4" /> Team
                        </button>
                        <button onClick={() => deleteProject(project.project_id, project.name || project.title)} className="p-2 hover:bg-red-500/10 rounded-lg transition-all border border-transparent">
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── APPOINTMENTS ───────────────────────────────────────────────── */}
          {activeTab === 'appointments' && (
            <motion.div key="appointments" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              {visibleAppointments.length === 0 ? (
                <EmptyState icon={Calendar} label="No appointments scheduled" action={() => openModal('appointment')} actionLabel="Book Appointment" />
              ) : (
                <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-[var(--bg-primary)] border-b border-[var(--border)]">
                        <tr>
                          {['#', 'Title', 'Customer', 'Date & Time', 'Service', 'Status', 'Actions'].map(col => (
                            <th key={col} className="text-left py-4 px-6 text-[var(--text-muted)] font-medium text-xs uppercase tracking-wider">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visibleAppointments.map((apt, i) => {
                          const statusColors = {
                            pending: 'bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] border-[var(--gold-primary)]/30',
                            approved: 'bg-green-500/20 text-green-400 border-green-500/30',
                            completed: 'bg-green-500/20 text-green-400 border-green-500/30',
                            cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
                            'no_show': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
                          }
                          const statusCls = statusColors[apt.status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                          const apptDate = apt.scheduled_at || apt.date
                          return (
                            <tr key={apt.appointment_id} className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-primary)]/50 transition-colors">
                              <td className="py-4 px-6 text-[var(--text-muted)] font-mono text-sm">#{i + 1}</td>
                              <td className="py-4 px-6">
                                <p className="text-white font-medium">{apt.title || apt.service_name || 'Appointment'}</p>
                                {apt.notes && <p className="text-[var(--text-muted)] text-xs truncate max-w-xs">{apt.notes}</p>}
                              </td>
                              <td className="py-4 px-6">
                                <p className="text-white">{apt.customer_name || apt.user_name || '—'}</p>
                                <p className="text-[var(--text-muted)] text-xs">{apt.customer_email || '—'}</p>
                              </td>
                              <td className="py-4 px-6">
                                <p className="text-white">{apptDate ? new Date(apptDate).toLocaleDateString() : '—'}</p>
                                <p className="text-[var(--text-muted)] text-sm">{apt.time || (apptDate ? new Date(apptDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—')}</p>
                              </td>
                              <td className="py-4 px-6 text-[var(--text-muted)]">{apt.service_name || 'Consultation'}</td>
                              <td className="py-4 px-6">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${statusCls}`}>
                                  {apt.status || 'Pending'}
                                </span>
                              </td>
                              <td className="py-4 px-6">
                                <div className="flex gap-2">
                                  <button onClick={() => openModal('appointment', apt)} className="p-1.5 hover:bg-[var(--gold-primary)]/10 rounded transition-colors">
                                    <Edit className="w-4 h-4 text-[var(--text-muted)]" />
                                  </button>
                                  <button onClick={() => deleteAppointment(apt.appointment_id, apt.title)} className="p-1.5 hover:bg-red-500/10 rounded transition-colors">
                                    <Trash2 className="w-4 h-4 text-red-400" />
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

          {/* ── INVENTORY ──────────────────────────────────────────────────── */}
          {activeTab === 'inventory' && (
            <motion.div key="inventory" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="space-y-6">
                
                {/* Visual Stats Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Total Tracked Products', value: (inventoryStats?.total_products || 0) + visibleParts.length, cls: 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]' },
                    { label: 'Out of Stock Items', value: (inventoryStats?.out_of_stock_count || 0) + visibleParts.filter(p => !p.stock).length, cls: 'text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]' },
                    { label: 'Low Stock Assets', value: (inventoryStats?.low_stock_count || 0) + visibleParts.filter(p => p.stock > 0 && p.stock <= 5).length, cls: 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' },
                  ].map(stat => (
                    <div key={stat.label} className="rounded-2xl border border-[var(--border)] bg-gradient-to-tr from-[var(--surface-dark)] to-[var(--bg-primary)] p-5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-8 -mt-8" />
                      <p className="text-[var(--text-muted)] text-sm font-semibold tracking-wide uppercase">{stat.label}</p>
                      <p className={`mt-3 text-4xl font-bold ${stat.cls}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                {/* Main Data View */}
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] flex flex-col">
                  
                  {/* Modern Tab Bar */}
                  <div className="flex border-b border-[var(--border)] pt-2 px-4 gap-4">
                     {['products', 'parts'].map(tab => (
                        <button key={tab}
                          onClick={() => setInventorySubTab(tab)}
                          className={`px-4 py-3 text-sm font-semibold uppercase tracking-wider transition-all relative ${inventorySubTab === tab ? 'text-[var(--gold-primary)]' : 'text-[var(--text-muted)] hover:text-white'}`}
                        >
                          {tab === 'products' ? 'Standard Products' : 'Custom Builder Parts'}
                          {inventorySubTab === tab && (
                            <motion.div layoutId="inv-tab-indicator" className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--gold-primary)]" />
                          )}
                        </button>
                      ))}
                  </div>

                  {/* Stock Tables */}
                  <div className="p-6 overflow-x-auto">
                    {((inventorySubTab === 'products' && visibleInventory.length === 0) || (inventorySubTab === 'parts' && visibleParts.length === 0)) ? (
                      <div className="text-center py-16 text-[var(--text-muted)]">
                        <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p className="font-semibold text-lg">No inventory items tracked.</p>
                      </div>
                    ) : (
                      <table className="w-full text-left">
                        <thead className="border-b border-[var(--border)]/50">
                          <tr>
                            {['Item Description', 'SKU / Type', 'Capacity', 'Metric', 'Status', 'Manage'].map(c => (
                              <th key={c} className="py-4 pr-6 text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-[0.2em]">{c}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(inventorySubTab === 'products' ? visibleInventory : visibleParts).map((item, i) => {
                            const isProduct = inventorySubTab === 'products'
                            const itemName = item.name
                            const sku = item.sku || (item.type_mapping ? item.type_mapping.replace('_', ' ').toUpperCase() : '—')
                            const stock = Number(item.stock ?? item.qty ?? 0)
                            const threshold = Number(item.low_stock_threshold ?? 10)
                            const isCritical = stock <= (isProduct ? threshold : 5)
                            const isWarning = !isCritical && stock <= (isProduct ? threshold * 2 : 15)
                            const statusLabel = stock === 0 ? 'Out of Stock' : isCritical ? 'Critical' : isWarning ? 'Warning' : 'Healthy'
                            const statusCls = stock === 0 
                              ? 'bg-red-500/10 text-red-500 border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                              : isCritical
                                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20 drop-shadow'
                                : isWarning
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'

                            // Capacity Bar calc
                            const maxCapacity = Math.max(stock * 2, threshold * 4, 20)
                            const pct = Math.min((stock / maxCapacity) * 100, 100)

                            // Quick adjust handlers
                            const handleQuickAdjust = async (amount) => {
                               if (isProduct) {
                                  await adminApi.adjustStock({ product_id: item.product_id, quantity: amount, notes: 'Quick adjustment from table' })
                                  fetchInventory()
                               } else {
                                  await adminApi.updateBuilderPart(item.part_id, { ...item, stock: stock + amount })
                                  fetchParts()
                               }
                            }

                            return (
                              <tr key={item.product_id || item.part_id || i} className="border-b border-[var(--border)]/30 hover:bg-white/5 transition-colors group">
                                <td className="py-5 pr-6 text-white font-medium">{itemName}</td>
                                <td className="py-5 pr-6 text-[var(--text-muted)] font-mono text-xs">{sku}</td>
                                
                                {/* Capacity Bar */}
                                <td className="py-5 pr-6 w-48">
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full ${stock === 0 ? 'bg-red-500' : isCritical ? 'bg-orange-400' : isWarning ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className={`text-xs font-mono font-bold ${stock === 0 ? 'text-red-500' : 'text-white'}`}>{stock}</span>
                                  </div>
                                </td>

                                <td className="py-5 pr-6 text-[var(--text-muted)] text-sm font-mono">{isProduct ? threshold : 'n/a'}</td>
                                
                                <td className="py-5 pr-6">
                                  <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider ${statusCls}`}>{statusLabel}</span>
                                </td>
                                
                                <td className="py-5 pr-6">
                                  <div className="flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                                    <button 
                                      onClick={() => handleQuickAdjust(-1)}
                                      disabled={stock === 0}
                                      className="w-7 h-7 flex items-center justify-center rounded bg-[var(--surface-dark)] border border-[var(--border)] text-white hover:text-red-400 hover:border-red-500/50 transition-colors disabled:opacity-50"
                                    >
                                      -
                                    </button>
                                    <button 
                                      onClick={() => handleQuickAdjust(1)}
                                      className="w-7 h-7 flex items-center justify-center rounded bg-[var(--surface-dark)] border border-[var(--border)] text-white hover:text-emerald-400 hover:border-emerald-500/50 transition-colors"
                                    >
                                      +
                                    </button>
                                    {isProduct && (
                                     <button
                                       onClick={() => openModal('inventory', { product_id: item.product_id, name: item.name })}
                                       className="ml-2 w-7 h-7 flex items-center justify-center rounded bg-[var(--gold-primary)]/10 border border-[var(--gold-primary)]/30 text-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/20 transition-all"
                                     >
                                       <Edit className="w-3.5 h-3.5" />
                                     </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── SALES REPORT ───────────────────────────────────────────────── */}
          {activeTab === 'sales-report' && (
            <motion.div key="sales-report" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              {salesReport ? (
                <div className="space-y-8">
                  <div className="text-center border-b border-[var(--border)] pb-6">
                    <h1 className="text-white text-3xl font-bold mb-2">Sales Performance Report</h1>
                    <p className="text-[var(--text-muted)] text-sm mt-2">Report generated on {new Date().toLocaleDateString()}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[
                      { icon: DollarSign, label: 'Total Gross Sales', value: formatCurrency(salesReport.totalGrossSales || 0, true), color: 'var(--gold-primary)', bg: 'from-[var(--gold-primary)]/10', border: 'border-[var(--gold-primary)]/30' },
                      { icon: ShoppingBag, label: 'Total Transactions', value: salesReport.totalTransactions || 0, color: '#60a5fa', bg: 'from-blue-500/10', border: 'border-blue-500/30' },
                      { icon: TrendingUp, label: 'Avg per Transaction', value: formatCurrency(salesReport.averagePerTransaction || 0, true), color: '#34d399', bg: 'from-green-500/10', border: 'border-green-500/30' },
                      { icon: BarChart3, label: 'Customization Orders', value: salesReport.customizationOrders || 0, color: '#a78bfa', bg: 'from-purple-500/10', border: 'border-purple-500/30' },
                    ].map((s) => {
                      const Icon = s.icon
                      return (
                        <div key={s.label} className={`bg-gradient-to-br ${s.bg} to-transparent border ${s.border} rounded-2xl p-6 text-center`}>
                          <Icon className="w-8 h-8 mx-auto mb-3" style={{ color: s.color }} />
                          <h3 className="text-white text-sm font-medium mb-1">{s.label}</h3>
                          <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                        </div>
                      )
                    })}
                  </div>

                  <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
                    <h2 className="text-white text-xl font-semibold mb-6 text-center">Sales Breakdown by Channel</h2>
                    <div className="h-80 mb-6">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[
                          { category: 'Walk-in', amount: salesReport.walkInSales || 0 },
                          { category: 'Online', amount: salesReport.onlineSales || 0 },
                          { category: 'Customization', amount: salesReport.customizationSales || 0 },
                        ]} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="category" stroke="var(--text-muted)" fontSize={12} tick={{ fill: 'var(--text-muted)' }} />
                          <YAxis stroke="var(--text-muted)" fontSize={12} tick={{ fill: 'var(--text-muted)' }} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
                          <Tooltip contentStyle={{ backgroundColor: 'var(--surface-dark)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white' }} formatter={(v) => [formatCurrency(v, true), 'Revenue']} />
                          <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                            {['#10B981', '#3B82F6', '#8B5CF6'].map((color, idx) => <Cell key={idx} fill={color} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                      {[
                        { label: 'Walk-in Sales', sales: salesReport.walkInSales, tx: salesReport.walkInTransactions, cls: 'bg-green-500/10 border-green-500/30 text-green-400' },
                        { label: 'Online Sales', sales: salesReport.onlineSales, tx: salesReport.onlineTransactions, cls: 'bg-blue-500/10 border-blue-500/30 text-blue-400' },
                        { label: 'Customization', sales: salesReport.customizationSales, tx: salesReport.customizationTransactions, cls: 'bg-purple-500/10 border-purple-500/30 text-purple-400' },
                      ].map(ch => (
                        <div key={ch.label} className={`p-4 border rounded-lg ${ch.cls}`}>
                          <p className="font-semibold">{ch.label}</p>
                          <p className="text-white text-lg">{formatCurrency(ch.sales || 0, true)}</p>
                          <p className="text-[var(--text-muted)] text-sm">{ch.tx || 0} transactions</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                      { label: 'Daily Performance', icon: Clock, sales: salesReport.dailySales, tx: salesReport.dailyTransactions, iconCls: 'text-[var(--gold-primary)]' },
                      { label: 'Weekly Performance', icon: Calendar, sales: salesReport.weeklySales, tx: salesReport.weeklyTransactions, iconCls: 'text-blue-400' },
                      { label: 'Monthly Performance', icon: BarChart3, sales: salesReport.monthlySales, tx: salesReport.monthlyTransactions, iconCls: 'text-green-400' },
                    ].map(p => {
                      const Icon = p.icon
                      return (
                        <div key={p.label} className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
                          <div className="flex items-center gap-3 mb-4">
                            <Icon className={`w-6 h-6 ${p.iconCls}`} />
                            <h3 className="text-white text-lg font-semibold">{p.label}</h3>
                          </div>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
                              <span className="text-[var(--text-muted)]">Revenue</span>
                              <span className="text-[var(--gold-primary)] font-bold">{formatCurrency(p.sales || 0, true)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                              <span className="text-[var(--text-muted)]">Transactions</span>
                              <span className="text-white font-medium">{p.tx || 0}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {(salesReport.bestSellingProducts || []).length > 0 && (
                    <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
                      <h2 className="text-white text-xl font-semibold mb-6">Top Performing Products</h2>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-[var(--bg-primary)] border-b border-[var(--border)]">
                            <tr>
                              {['Rank', 'Product', 'Units Sold', 'Revenue', 'Category'].map(h => (
                                <th key={h} className="text-left py-4 px-6 text-[var(--text-muted)] font-semibold uppercase text-xs tracking-wider">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border)]">
                            {salesReport.bestSellingProducts.map((product, i) => (
                              <tr key={i} className="hover:bg-[var(--bg-primary)]/50 transition-colors">
                                <td className="py-4 px-6">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${i === 0 ? 'bg-[var(--gold-primary)]' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-orange-600' : 'bg-[var(--bg-primary)]'}`}>{i + 1}</div>
                                </td>
                                <td className="py-4 px-6 text-white font-medium">{product.name}</td>
                                <td className="py-4 px-6 text-white font-medium">{product.units}</td>
                                <td className="py-4 px-6 text-[var(--gold-primary)] font-bold">{formatCurrency(product.revenue, true)}</td>
                                <td className="py-4 px-6">
                                  <span className="px-3 py-1 bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] rounded-full text-sm">{product.category}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <BarChart3 className="w-16 h-16 text-[var(--gold-primary)] mx-auto mb-4" />
                  <h2 className="text-white text-xl font-semibold mb-2">Loading Sales Report...</h2>
                  <p className="text-[var(--text-muted)]">Fetching comprehensive sales analytics data.</p>
                </div>
              )}
            </motion.div>
          )}

        </main>
      </div>

      {/* ── MODAL ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modal.open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl p-8 w-full shadow-2xl overflow-y-auto ${modal.type === 'project_tasks' ? 'max-w-6xl h-[90vh]' : modal.type === 'part' ? 'max-h-[90vh] max-w-[min(92vw,72rem)]' : 'max-w-lg max-h-[90vh]'}`}
            >

              {/* Project Tasks */}
              {modal.type === 'project_tasks' && modal.data && (
                <>
                  <ModalHeader title="Project Tasks & Parts" onClose={closeModal} />
                  <div className="mt-6">
                    <ProjectTaskTracker 
                      projectId={modal.data.project_id} 
                      projectName={modal.data.name || modal.data.title}
                      isAdmin={true}
                      parts={visibleParts}
                      projectData={modal.data}
                    />
                  </div>
                </>
              )}

              {/* Product Modal - Industry Redesign Wizard */}
              {modal.type === 'product' && (() => {
                const productStep1Complete = Boolean(String(form.name || '').trim() && String(form.category_id || '').trim())
                const sellingN = parseFloat(form.price)
                const productStep2Complete = Boolean(String(form.sku || '').trim() && !Number.isNaN(sellingN) && sellingN > 0)
                const productStep3Complete = Boolean(form.image_url || form.preview_url || form.image_file)
                const productTabs = [
                  { id: 'basic', step: 1, label: 'Basic Info', done: productStep1Complete },
                  { id: 'inventory', step: 2, label: 'Pricing & Stock', done: productStep2Complete },
                  { id: 'media', step: 3, label: 'Media & Assets', done: productStep3Complete },
                ]
                const sellingPrice = parseFloat(form.price)
                const costPrice = parseFloat(form.cost_price) || 0
                const hasValidSelling = !Number.isNaN(sellingPrice)
                const profitAmount = hasValidSelling ? sellingPrice - costPrice : NaN
                const marginPct = hasValidSelling && sellingPrice > 0 ? (profitAmount / sellingPrice) * 100 : null
                const marginHealthy = marginPct != null && marginPct >= 20
                const marginWarn = marginPct != null && marginPct < 20
                const fieldBase = 'w-full px-4 py-2.5 bg-[var(--bg-primary)] rounded-xl text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 text-sm transition-colors'
                const fieldOk = `${fieldBase} border border-[var(--border)] focus:ring-[var(--gold-primary)]`
                const fieldErr = `${fieldBase} border border-[var(--border)] border-l-4 border-l-red-500 focus:ring-red-500/40`
                const selErr = `${inputCls} border-l-4 border-l-red-500`
                const selOk = inputCls
                return (
                  <>
                    <div className="sticky top-0 z-20 -mx-8 px-8 pt-0 pb-4 mb-1 bg-[var(--surface-dark)] border-b border-[var(--border)]">
                      <ModalHeader title={modal.data ? 'Edit Product' : 'New Product'} onClose={closeModal} />
                      <div className="mt-5 flex w-full items-center">
                        {productTabs.map((tab, idx) => (
                          <div key={tab.id} className="flex min-w-0 flex-1 items-center">
                            <button
                              type="button"
                              onClick={() => setWizardTab(tab.id)}
                              className="flex w-full min-w-0 flex-col items-center gap-2"
                            >
                              <div
                                className={`relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors ${
                                  wizardTab === tab.id
                                    ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/20 text-[var(--gold-primary)]'
                                    : tab.done
                                      ? 'border-emerald-500/70 bg-emerald-500/15 text-emerald-400'
                                      : 'border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-muted)]'
                                }`}
                              >
                                {tab.done ? <Check className="h-4 w-4" strokeWidth={2.5} /> : tab.step}
                              </div>
                              <span className={`text-center text-[10px] font-semibold uppercase leading-tight tracking-wide sm:text-xs ${wizardTab === tab.id ? 'text-[var(--gold-primary)]' : 'text-[var(--text-muted)]'}`}>
                                {tab.label}
                              </span>
                            </button>
                            {idx < productTabs.length - 1 && (
                              <div className="mx-1 h-0.5 min-w-[1rem] flex-1 shrink rounded-full bg-[var(--border)] sm:mx-2" aria-hidden />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="min-h-[350px]">
                      {wizardTab === 'basic' && (
                        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
                          <div>
                            <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${formErrors.name ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>Product Name *</label>
                            <input
                              value={form.name || ''}
                              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                              placeholder="Classic Stratocaster"
                              className={formErrors.name ? fieldErr : fieldOk}
                            />
                            {formErrors.name && <p className="mt-1 text-xs text-red-400">{formErrors.name}</p>}
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Product Description</label>
                            <textarea
                              rows={3}
                              value={form.description || ''}
                              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                              placeholder="Write a compelling description..."
                              className={fieldOk}
                            />
                            <p className="mt-1.5 text-xs text-[var(--text-muted)]">Shown on the product page and in search previews.</p>
                          </div>
                          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/60 p-4 sm:p-5">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
                              <div>
                                <label className={`${labelCls} ${formErrors.category_id ? 'text-red-400' : ''}`}>Category *</label>
                                <select
                                  value={form.category_id || ''}
                                  onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                                  className={formErrors.category_id ? selErr : selOk}
                                >
                                  <option value="">— Select Category —</option>
                                  {categories.map((c) => (
                                    <option key={c.category_id} value={c.category_id}>
                                      {c.name}
                                    </option>
                                  ))}
                                </select>
                                {formErrors.category_id && <p className="mt-1 text-xs text-red-400">{formErrors.category_id}</p>}
                                <p className="mt-1.5 text-xs text-[var(--text-muted)]">Groups this product in the shop catalog.</p>
                              </div>
                              <div className="flex flex-col justify-end pb-0.5 md:pb-1">
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    id="is_active"
                                    checked={form.is_active ?? true}
                                    onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                                    className="h-5 w-5 rounded border-gray-600 bg-gray-800 text-[var(--gold-primary)] focus:ring-[var(--gold-primary)] focus:ring-offset-gray-900"
                                  />
                                  <label htmlFor="is_active" className="cursor-pointer font-medium text-white">
                                    Active Product
                                  </label>
                                </div>
                                <p className="ml-8 mt-1 text-xs text-[var(--text-muted)]">When off, the product is hidden from the storefront.</p>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {wizardTab === 'inventory' && (
                        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                            <div className="min-w-0 flex-1">
                              <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${formErrors.sku ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>Stock Keeping Unit (SKU) *</label>
                              <input
                                value={form.sku || ''}
                                onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                                placeholder="e.g. GTR-STR-001"
                                className={formErrors.sku ? fieldErr : fieldOk}
                              />
                              {formErrors.sku && <p className="mt-1 text-xs text-red-400">{formErrors.sku}</p>}
                              <p className="mt-1.5 text-xs text-[var(--text-muted)]">Used for inventory tracking and order fulfillment.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const prefix = 'GTR'
                                const timestamp = Date.now().toString(36).toUpperCase()
                                const random = Math.random().toString(36).substring(2, 5).toUpperCase()
                                setForm((f) => ({ ...f, sku: `${prefix}-${timestamp}-${random}` }))
                              }}
                              className="shrink-0 self-start rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2.5 text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)] sm:mt-7"
                            >
                              Auto-generate
                            </button>
                          </div>

                          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/60 p-4 sm:p-5">
                            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Pricing</p>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                              <div>
                                <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${formErrors.price ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>Selling Price (₱) *</label>
                                <input
                                  type="number"
                                  value={form.price || ''}
                                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                                  placeholder="e.g. 50000"
                                  className={formErrors.price ? fieldErr : fieldOk}
                                />
                                {formErrors.price && <p className="mt-1 text-xs text-red-400">{formErrors.price}</p>}
                              </div>
                              <div>
                                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Cost Price (₱)</label>
                                <input
                                  type="number"
                                  value={form.cost_price || ''}
                                  onChange={(e) => setForm((f) => ({ ...f, cost_price: e.target.value }))}
                                  placeholder="e.g. 30000"
                                  className={fieldOk}
                                />
                                <p className="mt-1.5 text-xs text-[var(--text-muted)]">Your landed cost per unit (optional, for margin math).</p>
                              </div>
                            </div>
                          </div>

                          {form.price !== '' && form.price !== null && form.price !== undefined && (
                            <div
                              className={`rounded-xl border p-4 sm:p-5 ${
                                marginWarn
                                  ? 'border-amber-500/40 bg-amber-500/10'
                                  : marginHealthy
                                    ? 'border-emerald-500/35 bg-emerald-500/10'
                                    : 'border-[var(--border)] bg-[var(--bg-primary)]/50'
                              }`}
                            >
                              <p className="mb-3 text-sm font-semibold text-white">Profit preview</p>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="rounded-lg border border-[var(--border)]/80 bg-black/20 px-3 py-2.5">
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Selling price</p>
                                  <p className="mt-1 font-semibold text-white">{hasValidSelling ? formatCurrency(sellingPrice, false) : '—'}</p>
                                </div>
                                <div className="rounded-lg border border-[var(--border)]/80 bg-black/20 px-3 py-2.5">
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Cost price</p>
                                  <p className="mt-1 font-semibold text-white">{formatCurrency(costPrice, false)}</p>
                                </div>
                                <div className="rounded-lg border border-[var(--border)]/80 bg-black/20 px-3 py-2.5">
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Profit amount</p>
                                  <p className={`mt-1 font-semibold ${Number.isNaN(profitAmount) ? 'text-[var(--text-muted)]' : profitAmount >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                                    {hasValidSelling && !Number.isNaN(profitAmount) ? formatCurrency(profitAmount, false) : '—'}
                                  </p>
                                </div>
                                <div className="rounded-lg border border-[var(--border)]/80 bg-black/20 px-3 py-2.5">
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Margin %</p>
                                  <p className={`mt-1 font-semibold ${marginPct == null ? 'text-[var(--text-muted)]' : marginHealthy ? 'text-emerald-300' : 'text-amber-200'}`}>
                                    {marginPct != null ? `${Math.round(marginPct)}%` : '—'}
                                  </p>
                                </div>
                              </div>
                              {marginWarn && marginPct != null && (
                                <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-200/90">
                                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                  Margin is below 20%. Consider adjusting price or cost.
                                </p>
                              )}
                              {marginHealthy && marginPct != null && (
                                <p className="mt-3 text-xs text-emerald-300/90">Healthy margin at or above 20%.</p>
                              )}
                            </div>
                          )}

                          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/60 p-4 sm:p-5">
                            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Stock levels</p>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                              <div>
                                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Initial Stock Quantity</label>
                                <input
                                  type="number"
                                  value={form.stock ?? ''}
                                  onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                                  placeholder="0"
                                  className={fieldOk}
                                />
                                <p className="mt-1.5 text-xs text-[var(--text-muted)]">On-hand count when creating the product.</p>
                              </div>
                              <div>
                                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Low Stock Alert Threshold</label>
                                <input
                                  type="number"
                                  value={form.low_stock_threshold ?? ''}
                                  onChange={(e) => setForm((f) => ({ ...f, low_stock_threshold: e.target.value }))}
                                  placeholder="10"
                                  className={fieldOk}
                                />
                                <p className="mt-1.5 text-xs text-[var(--text-muted)]">You&apos;ll be alerted when stock drops to this level.</p>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {wizardTab === 'media' && (
                        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                          <motion.div
                            whileHover={{
                              boxShadow: '0 0 0 2px rgba(212, 175, 55, 0.22)',
                              borderColor: 'rgba(212, 175, 55, 0.45)',
                            }}
                            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                            className="rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--bg-primary)]/40 p-4 sm:p-5"
                          >
                            <ImageUploadWidget
                              label="Primary Main Image"
                              imageUrl={form.image_url}
                              previewUrl={form.preview_url}
                              isUploading={isUploading}
                              onUpload={handleImageUpload}
                              hint="High-quality transparent PNGs or JPGs work best for optimal catalog display."
                            />
                          </motion.div>
                          {(form.image_file || form.preview_url || form.image_url) && (
                            <div className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0 text-sm">
                                <p className="truncate font-medium text-white">
                                  {form.image_file?.name || (form.image_url ? 'Current catalog image' : 'Selected image')}
                                </p>
                                <p className="text-xs text-[var(--text-muted)]">
                                  {form.image_file ? `${(form.image_file.size / 1024).toFixed(form.image_file.size >= 102400 ? 0 : 1)} KB` : form.image_url ? 'Replace below or remove to clear.' : ''}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setForm((f) => ({
                                    ...f,
                                    image_file: undefined,
                                    preview_url: undefined,
                                    image_url: '',
                                  }))
                                }
                                className="shrink-0 rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/10"
                              >
                                Remove image
                              </button>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </div>

                    <div className="mt-8 flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface-dark)] -mx-8 -mb-8 rounded-b-2xl px-8 pb-8 pt-5">
                      <div className="flex gap-2 text-sm">
                        <button
                          type="button"
                          onClick={() => setWizardTab(wizardTab === 'inventory' ? 'basic' : wizardTab === 'media' ? 'inventory' : 'basic')}
                          className={`rounded-lg border border-[var(--border)] px-4 py-2 font-medium text-white hover:bg-[var(--bg-primary)] ${wizardTab === 'basic' ? 'invisible' : 'visible'}`}
                        >
                          Back
                        </button>
                      </div>
                      <div className="flex gap-3">
                        <button type="button" onClick={closeModal} className="px-4 py-2 font-medium text-[var(--text-muted)] transition-colors hover:text-white">
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await validateAndSave(PRODUCT_RULES, async () => {
                              await saveProduct()
                              setForm({})
                              setWizardTab('basic')
                              showToast('Product saved! Add another.')
                            })()
                          }}
                          disabled={isSaving}
                          className="rounded-lg border border-[var(--gold-primary)] px-4 py-2 font-medium text-[var(--gold-primary)] transition-colors hover:bg-[var(--gold-primary)]/10"
                        >
                          Save & Add Another
                        </button>
                        <button
                          type="button"
                          onClick={validateAndSave(PRODUCT_RULES, saveProduct)}
                          disabled={isSaving}
                          className="flex items-center gap-2 rounded-lg bg-[var(--gold-primary)] px-6 py-2 font-semibold text-black shadow-lg shadow-[var(--gold-primary)]/20 transition-all hover:bg-[var(--gold-secondary)]"
                        >
                          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Product'}
                        </button>
                      </div>
                    </div>
                  </>
                )
              })()}

              {/* Category Modal */}
              {modal.type === 'category' && (
                <>
                  <ModalHeader title={modal.data ? 'Edit Category' : 'New Category'} onClose={closeModal} />
                  <div className="space-y-4 mt-6">
                    <FormField label="Name *" value={form.name || ''} onChange={v => setForm(f => ({ ...f, name: v, slug: f.slug || v.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') }))} error={formErrors.name} />
                    <FormField label="Slug *" value={form.slug || ''} onChange={v => setForm(f => ({ ...f, slug: v }))} placeholder="e.g. custom-builds" error={formErrors.slug} />
                    <FormField label="Description" value={form.description || ''} onChange={v => setForm(f => ({ ...f, description: v }))} textarea />
                    <div>
                      <label className={labelCls}>Parent Category</label>
                      <select value={form.parent_id || ''} onChange={e => setForm(f => ({ ...f, parent_id: e.target.value || null }))} className={inputCls}>
                        <option value="">— None —</option>
                        {categories.filter(c => c.category_id !== modal.data?.category_id).map(c => (
                          <option key={c.category_id} value={c.category_id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <FormField label="Sort Order" type="number" value={form.sort_order ?? 0} onChange={v => setForm(f => ({ ...f, sort_order: v }))} />
                  </div>
                  <ModalFooter onCancel={closeModal} onSave={validateAndSave(CATEGORY_RULES, saveCategory)} isSaving={isSaving} />
                </>
              )}

              {/* Builder Part Modal */}
              {modal.type === 'part' && (() => {
                const partFieldBase =
                  'w-full min-h-[2.875rem] px-4 py-3 bg-[var(--bg-primary)] rounded-2xl text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 text-sm transition-colors box-border'
                const partFieldOk = `${partFieldBase} border border-[var(--border)] focus:ring-[var(--gold-primary)]`
                const partFieldErr = `${partFieldBase} border border-[var(--border)] border-l-4 border-l-red-500 focus:ring-red-500/40`
                const partSelErr = `${inputCls} border-l-4 border-l-red-500`
                const partHint = (text, tone = 'muted') => (
                  <p
                    className={`mt-1.5 flex gap-2 text-xs leading-relaxed ${
                      tone === 'gold' ? 'text-[var(--gold-primary)]/95' : 'text-[var(--text-muted)]'
                    }`}
                  >
                    <Info
                      className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${tone === 'gold' ? 'text-[var(--gold-primary)]' : 'text-[var(--text-muted)]'}`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">{text}</span>
                  </p>
                )
                const partTextareaOk =
                  'w-full min-h-[5.5rem] resize-y px-4 py-3 box-border bg-[var(--bg-primary)] rounded-2xl border border-[var(--border)] text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] text-sm transition-colors'
                const slotHints = {
                  body: 'Controls the guitar body shape and wood.',
                  bodyWood: 'Controls body wood species and grain for the configurator.',
                  bodyFinish: 'Controls finish color and treatment on the body.',
                  pickguard: 'Sets pickguard style and material on the body.',
                  neck: 'Controls neck profile and construction options.',
                  fretboard: 'Sets the fretboard material and inlay style.',
                  headstock: 'Controls headstock shape and branding placement.',
                  headstockWood: 'Sets headstock wood and contrast details.',
                  inlays: 'Controls fretboard inlay pattern and markers.',
                  hardware: 'Groups general hardware options on the build.',
                  bridge: 'Controls bridge type, routing, and string anchoring.',
                  knobs: 'Sets control knob style and layout.',
                  pickups: 'Determines pickup configuration and sound.',
                }
                const slotHint = form.type_mapping ? slotHints[form.type_mapping] : null
                const previewGuitarType = (form.guitar_type || 'electric').replace(/\b\w/g, (l) => l.toUpperCase())
                const previewPartCat = (form.part_category || form.type_mapping || 'misc').replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
                const previewPrice = form.price !== '' && form.price != null && !Number.isNaN(Number(form.price)) ? formatCurrency(Number(form.price), false) : '—'
                return (
                  <>
                    <div className="sticky top-0 z-20 -mx-8 mb-4 border-b border-[var(--border)] bg-[var(--surface-dark)] px-8 pb-4 pt-0">
                      <ModalHeader title={modal.data ? 'Edit Guitar Part' : 'New Guitar Part'} onClose={closeModal} />
                    </div>
                    <div className="mt-0 grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-0">
                      <div className="min-w-0 space-y-5 md:pr-8">
                        <div>
                          <label className={`${labelCls} ${formErrors.name ? 'text-red-400' : ''}`}>Part Name *</label>
                          <input
                            value={form.name || ''}
                            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                            placeholder="e.g. Mahogany Body"
                            className={formErrors.name ? partFieldErr : partFieldOk}
                          />
                          {formErrors.name && <p className="mt-1 text-xs text-red-400">{formErrors.name}</p>}
                          {partHint('This label appears in the builder catalog and admin lists.')}
                        </div>
                        <div>
                          <label className={labelCls}>Description</label>
                          <textarea
                            rows={3}
                            value={form.description || ''}
                            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                            className={partTextareaOk}
                          />
                          {partHint('Optional notes for staff; not always shown to customers.')}
                        </div>
                        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/60 p-4 sm:p-5">
                          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Builder placement</p>
                          <div className="space-y-4">
                            <div>
                              <label className={labelCls}>Builder Category (Customize Page)</label>
                              <select
                                value={form.builder_category || ''}
                                onChange={(e) => {
                                  const builderCategory = e.target.value
                                  const firstSlot = BUILDER_CATEGORY_MAP[builderCategory]?.[0] || ''
                                  setForm((f) => ({
                                    ...f,
                                    builder_category: builderCategory,
                                    type_mapping: firstSlot || f.type_mapping || '',
                                    part_category: SLOT_TO_PART_CATEGORY[firstSlot] || f.part_category || 'misc',
                                  }))
                                }}
                                className={inputCls}
                              >
                                <option value="">— Select Category —</option>
                                <option value="body">Body</option>
                                <option value="neck">Neck & Headstock</option>
                                <option value="hardware">Hardware</option>
                                <option value="electronics">Electronics</option>
                              </select>
                              {partHint('High-level section in the customizer sidebar.')}
                            </div>
                            <div>
                              <label className={`${labelCls} ${formErrors.type_mapping ? 'text-red-400' : ''}`}>Type Mapping (UI Slot) *</label>
                              <select
                                value={form.type_mapping || ''}
                                onChange={(e) => {
                                  const typeMapping = e.target.value
                                  setForm((f) => ({
                                    ...f,
                                    type_mapping: typeMapping,
                                    part_category: SLOT_TO_PART_CATEGORY[typeMapping] || f.part_category || 'misc',
                                  }))
                                }}
                                className={formErrors.type_mapping ? partSelErr : inputCls}
                              >
                                <option value="">— Select Type —</option>
                                {(form.builder_category ? BUILDER_CATEGORY_MAP[form.builder_category] || [] : Object.values(BUILDER_CATEGORY_MAP).flat()).map((t) => (
                                  <option key={t} value={t}>
                                    {t.replace(/([A-Z])/g, ' $1').replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                                  </option>
                                ))}
                              </select>
                              {formErrors.type_mapping && <p className="mt-1 text-xs text-red-400">{formErrors.type_mapping}</p>}
                              {slotHint ? partHint(slotHint, 'gold') : null}
                              {partHint(
                                'Slots follow CustomizePage field names to keep admin parts aligned with builder logic.',
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/60 p-4 sm:p-5">
                          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Catalog metadata</p>
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                            <div>
                              <label className={labelCls}>Guitar Type</label>
                              <select value={form.guitar_type || 'electric'} onChange={(e) => setForm((f) => ({ ...f, guitar_type: e.target.value }))} className={inputCls}>
                                {['electric', 'bass', 'acoustic', 'ukulele'].map((t) => (
                                  <option key={t} value={t}>
                                    {t.replace(/\b\w/g, (l) => l.toUpperCase())}
                                  </option>
                                ))}
                              </select>
                              {partHint('Which instrument line this part belongs to.')}
                            </div>
                            <div>
                              <label className={labelCls}>Part Category</label>
                              <select value={form.part_category || form.type_mapping || 'misc'} onChange={(e) => setForm((f) => ({ ...f, part_category: e.target.value }))} className={inputCls}>
                                {['body', 'neck', 'fretboard', 'pickups', 'bridge', 'electronics', 'hardware', 'tuners', 'strings', 'finish', 'wood_type', 'pickguard', 'misc'].map((t) => (
                                  <option key={t} value={t}>
                                    {t.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                                  </option>
                                ))}
                              </select>
                              {partHint('Used for filtering and inventory grouping.')}
                            </div>
                          </div>
                        </div>
                        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/60 p-4 sm:p-5">
                          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Stock & pricing</p>
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                            <div>
                              <label className={labelCls}>Qty in Stock</label>
                              <input
                                type="number"
                                value={form.stock ?? ''}
                                onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                                className={partFieldOk}
                              />
                              {partHint('How many units are available for builds.')}
                            </div>
                            <div>
                              <label className={labelCls}>Upgrade Price (₱)</label>
                              <input
                                type="number"
                                value={form.price || ''}
                                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                                className={partFieldOk}
                              />
                              {partHint('Added cost when the customer selects this option.')}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/40 px-4 py-3.5">
                          <input
                            type="checkbox"
                            id="is_active_part"
                            checked={form.is_active ?? true}
                            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                            className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-gray-600 bg-[var(--surface-dark)] text-[var(--gold-primary)] accent-[var(--gold-primary)] focus:ring-2 focus:ring-[var(--gold-primary)] focus:ring-offset-0 focus:ring-offset-transparent"
                          />
                          <label htmlFor="is_active_part" className="cursor-pointer select-none text-sm leading-snug text-white">
                            <span className="font-medium">Active</span>
                            <span className="mt-0.5 block text-xs font-normal leading-relaxed text-[var(--text-muted)]">
                              Available in the configurator when checked.
                            </span>
                          </label>
                        </div>
                      </div>
                      <div className="min-w-0 border-[var(--border)] md:border-l md:pl-8">
                        <div className="space-y-5">
                          <motion.div
                            whileHover={{
                              boxShadow: '0 0 0 2px rgba(212, 175, 55, 0.22)',
                              borderColor: 'rgba(212, 175, 55, 0.45)',
                            }}
                            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                            className="rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--bg-primary)]/40 p-4 sm:p-5"
                          >
                            <ImageUploadWidget
                              label="Configurator Asset (Transparent PNG recommended)"
                              imageUrl={form.image_url}
                              previewUrl={form.preview_url}
                              isUploading={isUploading}
                              onUpload={handleImageUpload}
                              hint="Configurator assets are dynamically composed on the frontend."
                            />
                          </motion.div>
                          {(form.image_file || form.preview_url || form.image_url) && (
                            <div className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0 text-sm">
                                <p className="truncate font-medium text-white">
                                  {form.image_file?.name || (form.image_url ? 'Current configurator asset' : 'Selected image')}
                                </p>
                                <p className="text-xs text-[var(--text-muted)]">
                                  {form.image_file ? `${(form.image_file.size / 1024).toFixed(form.image_file.size >= 102400 ? 0 : 1)} KB` : form.image_url ? 'Replace below or remove to clear.' : ''}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setForm((f) => ({
                                    ...f,
                                    image_file: undefined,
                                    preview_url: undefined,
                                    image_url: '',
                                  }))
                                }
                                className="shrink-0 rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/10"
                              >
                                Remove image
                              </button>
                            </div>
                          )}
                          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/70 p-4 shadow-inner sm:p-5">
                            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Catalog preview</p>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                              <div className="flex h-20 w-full shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--border)] bg-black/25 sm:h-24 sm:w-28">
                                {form.preview_url || form.image_url ? (
                                  <img src={form.preview_url || form.image_url} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
                                ) : (
                                  <span className="px-2 text-center text-[10px] text-[var(--text-muted)]">No image yet</span>
                                )}
                              </div>
                              <div className="min-w-0 flex-1 space-y-2">
                                <p className="truncate text-base font-semibold text-white">{form.name?.trim() || 'Part name'}</p>
                                <div className="flex flex-wrap gap-2">
                                  <span className="rounded-md border border-[var(--gold-primary)]/35 bg-[var(--gold-primary)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--gold-primary)]">
                                    {previewGuitarType}
                                  </span>
                                  <span className="rounded-md border border-[var(--border)] bg-[var(--surface-dark)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                                    {previewPartCat}
                                  </span>
                                  <span
                                    className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                      form.is_active ?? true ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-300' : 'border border-[var(--border)] bg-black/20 text-[var(--text-muted)]'
                                    }`}
                                  >
                                    {form.is_active ?? true ? 'Active' : 'Inactive'}
                                  </span>
                                </div>
                                <p className="text-sm text-[var(--text-muted)]">
                                  Upgrade: <span className="font-semibold text-[var(--gold-primary)]">{previewPrice}</span>
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <ModalFooter onCancel={closeModal} onSave={validateAndSave(PART_RULES, savePart)} isSaving={isSaving} />
                  </>
                )
              })()}

              {/* Inventory Adjust Modal */}
              {modal.type === 'inventory' && (
                <>
                  <ModalHeader title="Adjust Stock" onClose={closeModal} />
                  <div className="space-y-4 mt-6">
                    {modal.data?.name && (
                      <div className="p-3 bg-[var(--bg-primary)] rounded-xl border border-[var(--border)]">
                        <p className="text-white font-semibold">{modal.data.name}</p>
                      </div>
                    )}
                    {!modal.data?.product_id && (
                      <div>
                        <label className={labelCls}>Select Product *</label>
                        <select value={form.product_id || ''} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))} className={inputCls}>
                          <option value="">— Select Product —</option>
                          {visibleProducts.map(p => <option key={p.product_id} value={p.product_id}>{p.name} ({p.sku})</option>)}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className={labelCls}>Adjustment Type *</label>
                      <select value={form.change_type || ''} onChange={e => setForm(f => ({ ...f, change_type: e.target.value }))} className={inputCls}>
                        <option value="">— Select Type —</option>
                        <option value="stock_in">Stock In (Add)</option>
                        <option value="stock_out">Stock Out (Deduct)</option>
                        <option value="adjustment">Manual Adjustment</option>
                      </select>
                    </div>
                    <FormField label="Quantity *" type="number" value={form.quantity ?? ''} onChange={v => setForm(f => ({ ...f, quantity: v }))} />
                    <FormField label="Reason / Notes" value={form.notes || ''} onChange={v => setForm(f => ({ ...f, notes: v }))} textarea placeholder="e.g. Used 2 fretboards for project PRJ-001" />
                  </div>
                  <ModalFooter onCancel={closeModal} onSave={saveStockAdjust} isSaving={isSaving} />
                </>
              )}

              {/* Guitar View Modal */}
              {modal.type === 'guitar_view' && modal.data && (
                <>
                  <ModalHeader title="Customization Details" onClose={closeModal} />
                  <div className="mt-6 space-y-3 text-sm">
                    {[
                      ['Customer', modal.data.user_name],
                      ['Guitar Type', modal.data.guitar_type],
                      ['Name', modal.data.name],
                      ['Body Wood', modal.data.body_wood],
                      ['Neck Wood', modal.data.neck_wood],
                      ['Fingerboard', modal.data.fingerboard_wood],
                      ['Bridge', modal.data.bridge_type],
                      ['Pickups', modal.data.pickups],
                      ['Color', modal.data.color],
                      ['Finish', modal.data.finish_type],
                      ['Total Price', formatCurrency(modal.data.total_price)],
                    ].map(([key, val]) => val ? (
                      <div key={key} className="flex justify-between gap-4 border-b border-[var(--border)] pb-2">
                        <span className="text-[var(--text-muted)]">{key}</span>
                        <span className="text-white font-medium capitalize">{val}</span>
                      </div>
                    ) : null)}
                  </div>
                  <button onClick={closeModal} className="w-full mt-6 py-3 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 transition-all">Close</button>
                </>
              )}

              {/* Order View Modal */}
              {modal.type === 'order_view' && modal.data && (
                <>
                  <ModalHeader title={`Order #${modal.data.order_number || modal.data.order_id?.slice(0, 8)}`} onClose={closeModal} />
                  <div className="mt-6 space-y-3 text-sm">
                    {[
                      ['Status', <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(modal.data.status)}`}>{modal.data.status || 'Pending'}</span>],
                      ['Customer', modal.data.customer_name || modal.data.user_name || '—'],
                      ['Date', modal.data.created_at ? new Date(modal.data.created_at).toLocaleDateString() : '—'],
                      ['Total', <span className="text-[var(--gold-primary)] font-bold">{formatCurrency(modal.data.total || modal.data.total_amount, true)}</span>],
                    ].map(([key, val]) => (
                      <div key={key} className="flex justify-between gap-4 border-b border-[var(--border)] pb-2">
                        <span className="text-[var(--text-muted)]">{key}</span>
                        <span className="text-white font-medium">{val}</span>
                      </div>
                    ))}
                      {modal.data.items && modal.data.items.length > 0 && (
                      <div className="mt-4">
                        <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">Items</p>
                        <div className="space-y-2">
                          {modal.data.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between bg-[var(--bg-primary)] p-3 rounded-lg">
                              <div className="flex flex-col">
                                <span className="text-white text-sm">{item.product_name || item.name || 'Item'}</span>
                                <span className="text-[var(--text-muted)] text-xs">Qty: {item.quantity || 1}</span>
                              </div>
                              <span className="text-[var(--gold-primary)] text-sm">{formatCurrency(item.unit_price || item.price)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <button onClick={closeModal} className="w-full mt-6 py-3 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 transition-all">Close</button>
                </>
              )}

              {/* Project Modal */}
              {modal.type === 'project' && (
                <>
                  <ModalHeader title={modal.data ? 'Edit Project' : 'New Project'} onClose={closeModal} />
                  <div className="space-y-4 mt-6">
                    <FormField label="Project Name *" value={form.name || form.title || ''} onChange={v => setForm(f => ({ ...f, name: v, title: v }))} error={formErrors.name} />
                    <FormField label="Description" value={form.description || form.notes || ''} onChange={v => setForm(f => ({ ...f, description: v, notes: v }))} textarea />
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>Status</label>
                        <select value={form.status || 'not_started'} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputCls}>
                          <option value="not_started">Not Started</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                      </div>
                      <FormField label="Progress (%)" type="number" value={form.progress ?? 0} onChange={v => setForm(f => ({ ...f, progress: Math.min(100, Math.max(0, Number(v))) }))} />
                    </div>
                    <FormField label="Estimated Completion" type="date" value={form.estimated_completion_date || form.end_date || ''} onChange={v => setForm(f => ({ ...f, estimated_completion_date: v, end_date: v }))} />
                  </div>
                  <ModalFooter onCancel={closeModal} onSave={validateAndSave(PROJECT_RULES, saveProject)} isSaving={isSaving} />
                </>
              )}

              {/* Project Team Modal */}
              {modal.type === 'project_team' && modal.data && (
                <>
                  <ModalHeader title="Assign Team" onClose={closeModal} />
                  <div className="mt-6">
                    <p className="text-[var(--text-muted)] text-sm mb-4">Select team members for: <span className="text-white font-medium">{modal.data.name || modal.data.title}</span></p>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {users.filter(u => u.role !== 'customer').map(user => (
                        <label key={user.user_id} className="flex items-center gap-3 p-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg cursor-pointer hover:border-[var(--gold-primary)]/50 transition-all">
                          <input
                            type="checkbox"
                            checked={!!form.team_ids?.includes(user.user_id)}
                            onChange={e => {
                              const current = form.team_ids || []
                              const updated = e.target.checked ? [...current, user.user_id] : current.filter(id => id !== user.user_id)
                              setForm(f => ({ ...f, team_ids: updated }))
                            }}
                            className="w-4 h-4"
                          />
                          <div>
                            <p className="text-white text-sm font-medium">{user.first_name} {user.last_name}</p>
                            <p className="text-[var(--text-muted)] text-xs capitalize">{user.role?.replace('_', ' ')}</p>
                          </div>
                        </label>
                      ))}
                      {users.filter(u => u.role !== 'customer').length === 0 && (
                        <p className="text-[var(--text-muted)] text-sm text-center py-4">No staff members available</p>
                      )}
                    </div>
                  </div>
                  <ModalFooter onCancel={closeModal} onSave={() => assignProjectTeam(modal.data.project_id, form.team_ids || [])} isSaving={isSaving} />
                </>
              )}

              {/* Appointment Modal */}
              {modal.type === 'appointment' && (
                <>
                  <ModalHeader title={modal.data ? 'Edit Appointment' : 'Book Appointment'} onClose={closeModal} />
                  <div className="space-y-4 mt-6">
                    <FormField label="Title *" value={form.title || ''} onChange={v => setForm(f => ({ ...f, title: v }))} placeholder="e.g. Guitar Setup Consultation" error={formErrors.title} />
                    <FormField label="Customer Name" value={form.customer_name || ''} onChange={v => setForm(f => ({ ...f, customer_name: v }))} />
                    <FormField label="Customer Email" value={form.customer_email || ''} onChange={v => setForm(f => ({ ...f, customer_email: v }))} />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField label="Date *" type="date" value={form.date || form.scheduled_at?.split('T')[0] || ''} onChange={v => setForm(f => ({ ...f, date: v }))} error={formErrors.date} />
                      <FormField label="Time" type="time" value={form.time || ''} onChange={v => setForm(f => ({ ...f, time: v }))} />
                    </div>
                    <div>
                      <label className={labelCls}>Status</label>
                      <select value={form.status || 'pending'} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputCls}>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                    <FormField label="Notes" value={form.notes || ''} onChange={v => setForm(f => ({ ...f, notes: v }))} textarea placeholder="Any special requirements or notes..." />
                  </div>
                  <ModalFooter onCancel={closeModal} onSave={validateAndSave(APPOINTMENT_RULES, saveAppointment)} isSaving={isSaving} />
                </>
              )}

            </motion.div>
          </motion.div>
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
                    navigate('/customize?type=electric')
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
                    navigate('/customize-bass')
                  }}
                  className="p-6 rounded-2xl border-2 border-[var(--border)] hover:border-[var(--gold-primary)] bg-[var(--bg-primary)] hover:bg-[var(--gold-primary)]/5 transition-all group"
                >
                  <Guitar className="w-8 h-8 text-[var(--gold-primary)] mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="text-white font-semibold text-lg mb-1">Bass</h3>
                  <p className="text-[var(--text-muted)] text-sm">Design your custom bass guitar</p>
                </button>

                {/* Ukulele */}
                <button
                  onClick={() => {
                    setShowGuitarTypeSelector(false)
                    navigate('/customize?type=ukulele')
                  }}
                  className="p-6 rounded-2xl border-2 border-[var(--border)] hover:border-[var(--gold-primary)] bg-[var(--bg-primary)] hover:bg-[var(--gold-primary)]/5 transition-all group"
                >
                  <Guitar className="w-8 h-8 text-[var(--gold-primary)] mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="text-white font-semibold text-lg mb-1">Ukulele</h3>
                  <p className="text-[var(--text-muted)] text-sm">Create your unique ukulele</p>
                </button>

                {/* Acoustic */}
                <button
                  onClick={() => {
                    setShowGuitarTypeSelector(false)
                    navigate('/customize?type=acoustic')
                  }}
                  className="p-6 rounded-2xl border-2 border-[var(--border)] opacity-50 cursor-not-allowed bg-[var(--bg-primary)]"
                  disabled
                >
                  <Guitar className="w-8 h-8 text-[var(--text-muted)] mb-3" />
                  <h3 className="text-[var(--text-muted)] font-semibold text-lg mb-1">Acoustic</h3>
                  <p className="text-[var(--text-muted)] text-sm text-xs">Coming soon</p>
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
    </div>
  )
}

// ── Shared sub-components ────────────────────────────────────────────────────

function AdminTable({ columns, rows, renderRow, empty }) {
  if (!rows || rows.length === 0) return empty || null
  return (
    <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[var(--bg-primary)] border-b border-[var(--border)]">
            <tr>
              {columns.map(col => (
                <th key={col} className="text-left py-4 px-6 text-[var(--text-muted)] font-medium text-xs uppercase tracking-wider">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-primary)]/50 transition-colors">
                {renderRow(row)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatusBadge({ active, trueLabel = 'Active', falseLabel = 'Inactive' }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${active ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
      {active ? trueLabel : falseLabel}
    </span>
  )
}

function EmptyState({ icon: Icon, label, action, actionLabel }) {
  return (
    <div className="text-center py-20 bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl">
      <Icon className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
      <p className="text-[var(--text-muted)] text-sm">{label}</p>
      {action && (
        <button onClick={action} className="mt-4 px-5 py-2.5 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black rounded-xl font-semibold text-sm">
          {actionLabel}
        </button>
      )}
    </div>
  )
}

function SectionLoader({ label = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl text-[var(--text-muted)]">
      <Loader2 className="w-5 h-5 animate-spin text-[var(--gold-primary)]" />
      <span>{label}</span>
    </div>
  )
}

function PaginationBar({ pagination, onPageChange }) {
  const page = pagination?.page || 1
  const totalPages = pagination?.totalPages || 1
  const total = pagination?.total || 0
  const pageSize = pagination?.pageSize || 10

  if (total <= 0) return null

  const pages = []
  for (let p = Math.max(1, page - 2); p <= Math.min(totalPages, page + 2); p += 1) pages.push(p)

  return (
    <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 border border-[var(--border)] rounded-xl bg-[var(--surface-dark)]">
      <p className="text-xs text-[var(--text-muted)]">
        Showing {Math.min((page - 1) * pageSize + 1, total)}-{Math.min(page * pageSize, total)} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm text-white disabled:opacity-40 hover:border-[var(--gold-primary)]">
          Prev
        </button>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={`px-3 py-1.5 rounded-lg border text-sm ${p === page ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/20 text-[var(--gold-primary)]' : 'border-[var(--border)] text-white hover:border-[var(--gold-primary)]'}`}
          >
            {p}
          </button>
        ))}
        <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm text-white disabled:opacity-40 hover:border-[var(--gold-primary)]">
          Next
        </button>
      </div>
    </div>
  )
}

function ModalHeader({ title, onClose }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-bold text-white">{title}</h2>
      <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all">
        <X className="w-5 h-5 text-[var(--text-muted)]" />
      </button>
    </div>
  )
}

function ModalFooter({ onCancel, onSave, isSaving }) {
  return (
    <div className="flex gap-3 mt-8">
      <button onClick={onCancel} className="flex-1 py-3 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 transition-all text-sm font-medium">Cancel</button>
      <button onClick={onSave} disabled={isSaving} className="flex-1 py-3 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black rounded-xl font-bold text-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all disabled:opacity-60 flex items-center justify-center gap-2">
        {isSaving ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
        {isSaving ? 'Saving...' : 'Save'}
      </button>
    </div>
  )
}

function FormField({ label, value, onChange, type = 'text', placeholder, textarea, error }) {
  const base = 'w-full px-4 py-2.5 bg-[var(--bg-primary)] border rounded-xl text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 text-sm transition-colors'
  const cls = error
    ? `${base} border-red-500/50 focus:ring-red-500`
    : `${base} border-[var(--border)] focus:ring-[var(--gold-primary)]`
  return (
    <div>
      <label className={`block text-xs uppercase tracking-wider font-semibold mb-1.5 ${error ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>{label}</label>
      {textarea ? (
        <textarea rows={3} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      )}
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  )
}

function ImageUploadWidget({ label, imageUrl, previewUrl, isUploading, onUpload, hint }) {
  const displayUrl = previewUrl || imageUrl
  return (
    <div className="space-y-2">
      <label className="block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">{label}</label>
      <div className="border-2 border-dashed border-[var(--border)] rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-[var(--bg-primary)]/50 transition-colors">
        {displayUrl ? (
          <div className="relative group w-full h-48 flex items-center justify-center p-4 bg-black/20 rounded-lg">
            <img src={displayUrl} alt="Preview" className="max-w-full max-h-full object-contain drop-shadow-lg" loading="lazy" />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-lg">
              <span className="text-white text-sm">Click below to change</span>
            </div>
          </div>
        ) : (
          <div className="w-full h-48 flex items-center justify-center flex-col gap-2">
            <div className="p-3 bg-[var(--gold-primary)]/10 rounded-full text-[var(--gold-primary)]"><Plus className="w-6 h-6" /></div>
            <p className="text-[var(--text-muted)] text-sm">No image selected</p>
          </div>
        )}
        <label className="mt-4 px-4 py-2 bg-[var(--surface-dark)] border border-[var(--border)] hover:border-[var(--gold-primary)]/50 rounded-lg text-white font-medium cursor-pointer transition-colors w-full text-center">
          {isUploading ? 'Uploading...' : 'Select Image'}
          <input type="file" accept="image/png, image/jpeg, image/jpg" className="hidden" disabled={isUploading} onChange={onUpload} />
        </label>
      </div>
      {hint && <p className="text-xs text-[var(--text-muted)] text-center">{hint}</p>}
    </div>
  )
}
