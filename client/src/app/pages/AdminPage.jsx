import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Users, Package, ShoppingBag, Calendar, Search,
  Filter, Edit, Trash2, Eye, BarChart3,
  PieChart, Activity, ArrowUpRight,
  CheckCircle, Check, Info, XCircle, Plus, RefreshCw, X,
  MessageSquare, Briefcase, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, ArrowUpDown, ArrowUp, ArrowDown,
  Printer, Mail, FileText, CreditCard, RotateCcw, Copy, Truck, MapPin,
  UserCheck, Clock10, PackageCheck, CircleCheck,
  Layers, User, Tag, AlertCircle, DollarSign, Save, TrendingUp, UsersRound, Clock, Loader2, Grid3X3, List, MoreHorizontal, Shield, Settings, Guitar, Wrench, PaintBucket, Hammer, Zap, Sparkles,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import ProjectTaskTracker from '../components/projects/ProjectTaskTracker'
import AppointmentCalendar from '../components/appointments/AppointmentCalendar'
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

// ── Category Tree Helpers ─────────────────────────────────────────────────────
function buildCategoryTree(categories) {
  const map = new Map()
  const roots = []
  
  categories.forEach(c => {
    map.set(c.category_id, { ...c, children: [] })
  })
  
  categories.forEach(c => {
    const node = map.get(c.category_id)
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id).children.push(node)
    } else {
      roots.push(node)
    }
  })
  
  const sortNodes = (nodes) => {
    nodes.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    nodes.forEach(n => sortNodes(n.children))
  }
  sortNodes(roots)
  
  return roots
}

function flattenCategoryTreeForAdmin(tree, depth = 0) {
  const result = []
  
  tree.forEach(node => {
    result.push({ ...node, depth, isParent: node.children && node.children.length > 0 })
    if (node.children && node.children.length > 0) {
      result.push(...flattenCategoryTreeForAdmin(node.children, depth + 1))
    }
  })
  
  return result
}

function CategoryTreeRow({ category, expandedIds, onToggle, onEdit, onDelete, categories, depth = 0 }) {
  const hasChildren = category.children && category.children.length > 0
  const isExpanded = expandedIds.has(category.category_id)
  const indent = depth * 24

  return (
    <>
      <tr className="border-b border-[var(--border)] hover:bg-[var(--bg-primary)]/50 transition-colors">
        <td className="py-4 px-6" style={{ paddingLeft: `${16 + indent}px` }}>
          <div className="flex items-center gap-2">
            {hasChildren ? (
              <button
                onClick={() => onToggle(category.category_id)}
                className="p-0.5 hover:bg-[var(--gold-primary)]/20 rounded transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-[var(--gold-primary)]" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[var(--gold-primary)]" />
                )}
              </button>
            ) : (
              <span className="w-4" />
            )}
            <span className="font-semibold text-white">{category.name}</span>
          </div>
        </td>
        <td className="py-4 px-6 text-[var(--text-muted)] font-mono text-sm">{category.slug}</td>
        <td className="py-4 px-6">
          {hasChildren ? (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] border border-[var(--gold-primary)]/30">
              Parent
            </span>
          ) : category.parent_id ? (
            (() => {
              const parentCat = categories?.find(c => c.category_id === category.parent_id)
              return parentCat ? (
                <span className="text-[var(--text-muted)] text-sm">{parentCat.name}</span>
              ) : (
                <span className="text-[var(--text-muted)]/50">—</span>
              )
            })()
          ) : (
            <span className="text-[var(--text-muted)]/50">—</span>
          )}
        </td>
        <td className="py-4 px-6">
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${category.is_active ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'}`}>
            {category.is_active ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td className="py-4 px-6">
          <div className="flex gap-2">
            <button onClick={() => onEdit('category', category)} className="p-1.5 hover:bg-[var(--gold-primary)]/10 rounded">
              <Edit className="w-4 h-4 text-[var(--text-muted)]" />
            </button>
            <button onClick={() => onDelete(category.category_id, category.name)} className="p-1.5 hover:bg-red-500/10 rounded">
              <Trash2 className="w-4 h-4 text-red-400" />
            </button>
          </div>
        </td>
      </tr>
      {hasChildren && isExpanded && category.children.map(child => (
        <CategoryTreeRow
          key={child.category_id}
          category={child}
          expandedIds={expandedIds}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
          categories={categories}
          depth={depth + 1}
        />
      ))}
    </>
  )
}

const VALID_ROLES = ['customer', 'staff', 'admin', 'super_admin']

function updateIfChanged(currentData, newData, setter) {
  const currentStr = JSON.stringify(currentData)
  const newStr = JSON.stringify(newData)
  if (currentStr !== newStr) {
    setter(newData)
  }
}

function generateSlug(text) {
  if (!text) return ''
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\-]+/g, '-')
    .replace(/[^a-z0-9\-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
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

function ImageZoomModal({ src, alt }) {
  const [isOpen, setIsOpen] = useState(false)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })

  const handleWheel = (e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setScale(s => Math.max(0.5, Math.min(3, s + delta)))
  }

  const handleMouseDown = (e) => {
    setIsDragging(true)
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y }
  }

  const handleMouseMove = (e) => {
    if (!isDragging) return
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    })
  }

  const handleMouseUp = () => setIsDragging(false)

  const resetZoom = () => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }

  return (
    <>
      <div 
        className="relative cursor-zoom-in overflow-hidden rounded-lg border border-[var(--border)]"
        onClick={() => setIsOpen(true)}
      >
        <img 
          src={src} 
          alt={alt} 
          className="w-full h-48 object-contain bg-[var(--bg-primary)]/50"
        />
        <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="bg-black/60 px-3 py-1.5 rounded-full text-white text-sm">Click to zoom</span>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="image-zoom-modal"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center"
            onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false) }}
          >
            <button
              onClick={() => { setIsOpen(false); resetZoom() }}
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            
            <div 
              className="w-full h-full overflow-hidden flex items-center justify-center p-8"
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <motion.img
                src={src}
                alt={alt}
                className="max-w-full max-h-full object-contain select-none"
                style={{ 
                  transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
                  cursor: isDragging ? 'grabbing' : 'grab',
                }}
                draggable={false}
              />
            </div>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 px-4 py-2 rounded-full">
              <button 
                onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
                className="text-white hover:text-[var(--gold-primary)] transition-colors"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
              <span className="text-white text-sm min-w-[60px] text-center">{Math.round(scale * 100)}%</span>
              <button 
                onClick={() => setScale(s => Math.min(3, s + 0.25))}
                className="text-white hover:text-[var(--gold-primary)] transition-colors"
              >
                <ChevronUp className="w-5 h-5" />
              </button>
              <button 
                onClick={resetZoom}
                className="ml-2 text-white hover:text-[var(--gold-primary)] transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

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
const SERVICE_RULES = {
  name: [required('Service Name')],
  price: [required('Base Price')],
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
  const [paymentStatusUpdate, setPaymentStatusUpdate] = useState({ loading: false, orderId: null })

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
    brand: '',
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

  // Orders tab state
  const [expandedOrderIds, setExpandedOrderIds] = useState(new Set())
  const [orderStatusFilter, setOrderStatusFilter] = useState('all')
  const [orderSort, setOrderSort] = useState('newest')
  const [orderPage, setOrderPage] = useState(1)
  const ORDERS_PAGE_SIZE = 10

  // Inventory tab state
  const [expandedInventoryIds, setExpandedInventoryIds] = useState(new Set())
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState('all')
  const [inventorySort, setInventorySort] = useState('name')
  const [inventoryPage, setInventoryPage] = useState(1)
  const INVENTORY_PAGE_SIZE = 10
  const [optimisticStock, setOptimisticStock] = useState({})
  const [adjustPopover, setAdjustPopover] = useState({ open: false, itemId: null, amount: 0, reason: '', name: '' })
  const [form, setForm] = useState({})
  const [formErrors, setFormErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [orderStatusDropdownOpen, setOrderStatusDropdownOpen] = useState(false)
  const [paymentStatusDropdownOpen, setPaymentStatusDropdownOpen] = useState(false)
  const [productsLoading, setProductsLoading] = useState(false)
  const [partsLoading, setPartsLoading] = useState(false)
  const [productsPagination, setProductsPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 })
  const [partsPagination, setPartsPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 })

  // Category tree expand/collapse state
  const [expandedCategoryIds, setExpandedCategoryIds] = useState(new Set())

  // Message panel
  const [messagePanelOpen, setMessagePanelOpen] = useState(false)
  const [selectedConversation, setSelectedConversation] = useState(null)

  // ── Derived / filtered views ─────────────────────────────────────────────
  const visibleProducts = products || []
  const visibleParts = parts || []
  const categoryTree = useMemo(() => buildCategoryTree(categories || []), [categories])
  const visibleCategories = useMemo(() => flattenCategoryTreeForAdmin(categoryTree), [categoryTree])
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
    const pts = visibleParts.map(p => ({ ...p, type: 'part', stock: p.quantity, name: p.name, sku: p.type_mapping, low_stock_threshold: 10 }))
    return [...prods, ...pts]
  }, [visibleInventory, visibleParts])

  const filteredInventory = useMemo(() => {
    let result = [...inventoryItems]
    if (inventoryStatusFilter !== 'all') {
      result = result.filter(item => {
        const stock = Number(item.stock ?? 0)
        const threshold = item.type === 'product' ? Number(item.low_stock_threshold ?? 10) : 10
        if (inventoryStatusFilter === 'out_of_stock') return stock === 0
        if (inventoryStatusFilter === 'critical') return stock > 0 && stock <= threshold
        if (inventoryStatusFilter === 'warning') return stock > threshold && stock <= threshold * 2
        if (inventoryStatusFilter === 'healthy') return stock > threshold * 2
        return true
      })
    }
    result.sort((a, b) => {
      if (inventorySort === 'name') return (a.name || '').localeCompare(b.name || '')
      if (inventorySort === 'sku') return (a.sku || '').localeCompare(b.sku || '')
      if (inventorySort === 'stock_low') return Number(a.stock || 0) - Number(b.stock || 0)
      if (inventorySort === 'stock_high') return Number(b.stock || 0) - Number(a.stock || 0)
      return 0
    })
    return result
  }, [inventoryItems, inventoryStatusFilter, inventorySort])

  const paginatedInventory = useMemo(() => {
    const start = (inventoryPage - 1) * INVENTORY_PAGE_SIZE
    return filteredInventory.slice(start, start + INVENTORY_PAGE_SIZE)
  }, [filteredInventory, inventoryPage])

  const guitarTypeOptions = useMemo(
    () => ['electric', 'bass', 'acoustic', 'ukulele'].sort(),
    []
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
      const res = await adminApi.getOrders({ search: debouncedSearch, include_items: true })
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
      'users': fetchUsers,
      'orders': fetchOrders,
      'projects': fetchProjects,
      'appointments': fetchAppointments,
      'inventory': fetchInventory,
      'sales-report': fetchSalesReport,
      'dashboard': async () => { await fetchOrders(); await fetchProjects(); await fetchAppointments() },
    }
    return map[activeTab]?.()
  }, [activeTab, fetchProducts, fetchParts, fetchCategories, fetchUsers, fetchOrders, fetchProjects, fetchAppointments, fetchInventory, fetchSalesReport])

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
  const closeModal = () => { setModal({ open: false, type: null, data: null }); setFormErrors({}); setOrderStatusDropdownOpen(false); setPaymentStatusDropdownOpen(false) }

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

  const toggleCategoryExpand = (categoryId) => {
    setExpandedCategoryIds(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
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
    const order = orders.find(o => o.order_id === orderId)
    
    if (status === 'processing') {
      const paymentVerified = order?.payment?.status === 'verified' || order?.payment_status === 'paid'
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

  const approvePayment = async (orderId) => {
    const order = orders.find(o => o.order_id === orderId)
    if (order?.payment) {
      setForm({
        order_id: order.order_id,
        order_number: order.order_number || order.order_id?.slice(0, 8),
        payment_method: order.payment?.method || order.payment_method || 'N/A',
        amount: order.total || order.total_amount || order.payment?.amount || 0,
        payment_status: order.payment_status || order.payment?.status || 'pending',
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
    
    const originalStatus = modal.data?.payment_status || modal.data?.payment?.status || 'pending'
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

  // ── CRUD: Services ──────────────────────────────────────────────────────
  const saveService = async () => {
    setIsSaving(true)
    try {
      if (modal.data?.id) {
        // Update existing service
        showToast('Service updated!')
      } else {
        // Create new service
        showToast('Service added!')
      }
      closeModal()
    } catch (e) { showToast(e.message, 'error') }
    finally { setIsSaving(false) }
  }

  const deleteService = (id, title) => {
    openConfirm({
      title: 'Delete Service?',
      description: `"${title}" will be permanently removed.`,
      variant: 'danger',
      onConfirm: async () => {
        // await adminApi.deleteService(id)
        showToast('Service deleted')
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
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'inventory', label: 'Inventory', icon: Activity },
    { id: 'sales-report', label: 'Sales Report', icon: PieChart },
    { id: 'projects', label: 'Projects', icon: Briefcase },
    { id: 'services', label: 'Services', icon: Wrench },
    { id: 'appointments', label: 'Appointments', icon: Calendar },
    { id: 'users', label: 'Users', icon: Shield },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]

  // ── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
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
      <aside className={`fixed left-0 top-0 h-screen bg-[var(--surface-dark)] border-r border-[var(--border)] transition-all duration-300 z-40 flex flex-col ${sidebarCollapsed ? 'w-20' : 'w-64'}`}>
        {/* Header with CosmosCraft branding */}
        <div className="h-24 px-4 py-4 border-b border-[var(--border)] flex items-center justify-between relative">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="absolute -right-3 top-6 w-6 h-6 bg-[var(--surface-dark)] border border-[var(--border)] rounded-full flex items-center justify-center hover:bg-[var(--gold-primary)] hover:border-[var(--gold-primary)] transition-all"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4 text-[var(--text-light)]" /> : <ChevronLeft className="w-4 h-4 text-[var(--text-light)]" />}
          </button>

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
                {!sidebarCollapsed && (
                  <span className={`truncate ${activeTab === tab.id ? 'text-[var(--text-dark)]' : 'text-[var(--text-muted)]'}`}>{tab.label}</span>
                )}
              </button>
            )
          })}
        </nav>

       
      </aside>

      {/* Main content */}
      <div className={`transition-all duration-300 bg-[var(--bg-primary)] ${sidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
        <Topbar title={tabs.find(t => t.id === activeTab)?.label || 'Dashboard'} userRole={user?.role} />

        <main className="p-6 pt-28">

          {/* Actions bar */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            {['products-parts', 'users', 'categories', 'orders', 'projects', 'appointments'].includes(activeTab) && (
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
                      { label: 'Revenue this month', value: formatCurrency(salesReport?.monthlySales || 0), badge: salesReport?.monthlySales > 0 ? '+live' : 'Live', badgeCls: 'bg-green-500/10 text-green-400' },
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
                    {categoryTree.map(parent => (
                      <optgroup key={parent.category_id} label={parent.name}>
                        <option value={parent.category_id}>{parent.name} (All)</option>
                        {parent.children?.map(child => (
                          <option key={child.category_id} value={child.category_id}>{'→ ' + child.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <input 
                    type="text"
                    aria-label="Filter products by brand" 
                    placeholder="Filter by brand..."
                    value={productQuery.brand} 
                    onChange={(e) => setProductQuery((prev) => ({ ...prev, page: 1, brand: e.target.value }))} 
                    className={inputCls}
                  />
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
                  columns={['Image', 'Product', 'Brand', 'SKU', 'Price', 'Cost', 'Stock Status', 'Actions']}
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
                      <td className="py-4 px-6 text-[var(--text-muted)] font-semibold">{p.brand || '—'}</td>
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
                              {p.brand && <p className="text-[var(--text-muted)] text-sm mt-1">Brand: <span className="text-white font-medium">{p.brand}</span></p>}
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
              <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl overflow-hidden">
                {categoryTree.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Tag className="w-12 h-12 text-[var(--text-muted)] mb-4" />
                    <p className="text-[var(--text-muted)] mb-4">No categories yet</p>
                    <button onClick={() => openModal('category')} className="px-4 py-2 bg-[var(--gold-primary)] text-black rounded-xl font-semibold text-sm">
                      Add Category
                    </button>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="text-left py-4 px-6 text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Name</th>
                        <th className="text-left py-4 px-6 text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Slug</th>
                        <th className="text-left py-4 px-6 text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Type</th>
                        <th className="text-left py-4 px-6 text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Status</th>
                        <th className="text-left py-4 px-6 text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryTree.map((rootCat) => (
                        <CategoryTreeRow
                          key={rootCat.category_id}
                          category={rootCat}
                          expandedIds={expandedCategoryIds}
                          onToggle={toggleCategoryExpand}
                          onEdit={openModal}
                          onDelete={deleteCategory}
                          categories={categories}
                        />
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
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

          {/* ── SETTINGS ───────────────────────────────────────────────────── */}
          {activeTab === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
              <div className="space-y-6">
                {/* General Settings Section */}
                <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                    <Settings className="w-5 h-5 text-[var(--gold-primary)]" />
                    General Settings
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">Dashboard Theme</label>
                      <p className="text-white text-sm">Light mode is the default. You can switch to dark mode using the theme toggle in the top bar.</p>
                    </div>
                  </div>
                </div>

                {/* System Information */}
                <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                    <Info className="w-5 h-5 text-[var(--gold-primary)]" />
                    System Information
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--text-muted)]">System Version</span>
                      <span className="text-white font-mono">v1.0.0</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--text-muted)]">Last Updated</span>
                      <span className="text-white font-mono">{new Date().toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--text-muted)]">Admin Role</span>
                      <span className="text-white font-mono capitalize">{user?.role?.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>

                {/* User Account */}
                <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                    <User className="w-5 h-5 text-[var(--gold-primary)]" />
                    Your Account
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <span className="text-[var(--text-muted)] text-sm">Email</span>
                      <p className="text-white font-mono">{user?.email || 'Not available'}</p>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] text-sm">Name</span>
                      <p className="text-white font-mono">{user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.firstName || 'Admin'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── ORDERS ─────────────────────────────────────────────────────── */}
          {activeTab === 'orders' && (
            <motion.div key="orders" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              {/* Filters & Sort */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div className="flex flex-wrap gap-2">
                  {['all', 'pending', 'processing', 'completed', 'cancelled'].map((status) => {
                    const isActive = orderStatusFilter === status
                    const chipStyles = {
                      all: isActive ? 'bg-[var(--gold-primary)] text-black' : 'bg-[var(--surface-dark)] text-[var(--text-muted)] hover:text-white',
                      pending: isActive ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-[var(--surface-dark)] text-[var(--text-muted)] hover:text-amber-400',
                      processing: isActive ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-[var(--surface-dark)] text-[var(--text-muted)] hover:text-blue-400',
                      completed: isActive ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-[var(--surface-dark)] text-[var(--text-muted)] hover:text-green-400',
                      cancelled: isActive ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-[var(--surface-dark)] text-[var(--text-muted)] hover:text-red-400',
                    }
                    return (
                      <button
                        key={status}
                        onClick={() => { setOrderStatusFilter(status); setOrderPage(1) }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${chipStyles[status]}`}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    )
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--text-muted)] text-sm">Sort:</span>
                  <select
                    value={orderSort}
                    onChange={(e) => setOrderSort(e.target.value)}
                    className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="highest">Highest value</option>
                    <option value="lowest">Lowest value</option>
                  </select>
                </div>
              </div>

              {/* Orders List */}
              {filteredOrders.length === 0 ? (
                <EmptyState icon={ShoppingBag} label="No orders found" />
              ) : (
                <div className="space-y-2">
                  {paginatedOrders.map((order) => {
                    const isExpanded = expandedOrderIds.has(order.order_id)
                    const toggleExpand = () => {
                      setExpandedOrderIds(prev => {
                        const next = new Set(prev)
                        if (next.has(order.order_id)) next.delete(order.order_id)
                        else next.add(order.order_id)
                        return next
                      })
                    }
                    const statusDotColors = {
                      pending: 'bg-amber-400',
                      processing: 'bg-blue-400',
                      completed: 'bg-green-400',
                      cancelled: 'bg-gray-400',
                    }
                    const statusBgColors = {
                      pending: 'bg-amber-400/10 text-amber-400',
                      processing: 'bg-blue-400/10 text-blue-400',
                      completed: 'bg-green-400/10 text-green-400',
                      cancelled: 'bg-gray-400/10 text-gray-400',
                    }
                    const orderStatus = order.status || 'pending'
                    const itemCount = order.items?.length || 0

                    return (
                      <motion.div
                        key={order.order_id}
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        className={`bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl overflow-hidden ${orderStatus === 'cancelled' ? 'opacity-60' : ''}`}
                      >
                        {/* Collapsed Row */}
                        <div
                          className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-white/5 transition-colors"
                          onClick={toggleExpand}
                        >
                          <div className="w-32 flex-shrink-0">
                            <p className="text-white font-mono text-sm font-semibold">#{order.order_number || order.order_id?.slice(0, 8)}</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{order.customer_name || order.user_name || 'Customer'}</p>
                            <p className="text-[var(--text-muted)] text-xs truncate">
                              {itemCount > 0 
                                ? order.items.map(item => item.product_name || item.name || 'Product').join(', ')
                                : order.customer_email || order.email || ''
                              }
                            </p>
                          </div>
                          <div className="w-16 text-center text-[var(--text-muted)] text-sm">{itemCount} items</div>
                          <div className="w-24 text-right text-[var(--text-muted)] text-sm">{order.created_at ? new Date(order.created_at).toLocaleDateString() : '—'}</div>
                          <div className="w-32 flex-shrink-0">
                            <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-1">Order Status</p>
                            <p className={`inline-flex px-3 py-1.5 rounded-full text-xs font-semibold ${statusBgColors[orderStatus]}`}>
                              {orderStatus.charAt(0).toUpperCase() + orderStatus.slice(1)}
                            </p>
                            {order.payment_status && order.payment_status !== 'paid' && (
                              <p className="mt-2 text-sm font-semibold text-[var(--text-muted)]">
                                Payment Status: <span className={`${order.payment_status === 'pending' || order.payment_status === 'awaiting_approval' ? 'text-amber-400' : order.payment_status === 'failed' ? 'text-red-400' : 'text-green-400'}`}>
                                  {order.payment_status === 'pending' || order.payment_status === 'awaiting_approval' ? 'Payment Pending' : order.payment_status === 'failed' ? 'Payment Failed' : order.payment_status}
                                </span>
                              </p>
                            )}
                          </div>
                          <div className={`w-28 text-right font-bold text-sm ${orderStatus === 'cancelled' ? 'text-gray-500' : 'text-[var(--gold-primary)]'}`}>
                            {formatCurrency(order.total || order.total_amount)}
                          </div>
                          <button className="p-1 text-[var(--text-muted)] hover:text-white transition-colors">
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </button>
                        </div>

                        {/* Expanded Details */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              key={`order-details-${order.order_id || order.order_number}`}
                              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                              className="border-t border-[var(--border)] bg-[var(--bg-primary)]/50"
                            >
                              <div className="p-5 space-y-6">
                                {/* Metadata Row */}
                                <div className="flex flex-wrap gap-6 text-sm">
                                  <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-4">
                                      <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">Payment Method</p>
                                      <p className="text-white font-semibold">
                                        {(() => {
                                          const method = order.payment_method || order.payment?.method || 'Unknown'
                                          const methodLower = method.toString().toLowerCase()

                                          if (methodLower.includes('gcash') || methodLower.includes('g-cash')) return 'GCash'
                                          if (methodLower.includes('bank') || methodLower.includes('transfer') || methodLower.includes('bdo') || methodLower.includes('bpi') || methodLower.includes('unionbank')) return 'Bank Transfer'
                                          if (methodLower.includes('cod') || methodLower.includes('cash')) return 'Cash on Delivery'
                                          return method.charAt(0).toUpperCase() + method.slice(1)
                                        })()}
                                      </p>
                                    </div>

                                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-4">
                                      <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">Payment Status</p>
                                      <p className={`text-sm font-semibold ${
                                        (order.payment_status || 'paid') === 'paid' ? 'text-green-400' :
                                        (order.payment_status || 'paid') === 'pending' ? 'text-amber-400' :
                                        (order.payment_status || 'paid') === 'failed' ? 'text-red-400' :
                                        'text-blue-400'
                                      }`}>
                                        {(order.payment_status || 'paid') === 'pending' || (order.payment_status || 'paid') === 'awaiting_approval'
                                          ? 'Payment Pending'
                                          : (order.payment_status || 'paid') === 'failed'
                                            ? 'Payment Failed'
                                            : (order.payment_status || 'paid') === 'paid'
                                              ? 'Paid'
                                              : order.payment_status}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 text-[var(--text-muted)]">
                                    <Truck className="w-4 h-4" />
                                    <span>{order.shipping_method || 'Standard'} • {order.shipping_address || 'See details'}</span>
                                  </div>
                                </div>

                                {/* Items Table */}
                                {itemCount > 0 ? (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                      <thead className="border-b border-[var(--border)]">
                                        <tr>
                                          <th className="py-3 pr-4 text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">Product</th>
                                          <th className="py-3 px-4 text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider text-center">Qty</th>
                                          <th className="py-3 px-4 text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider text-right">Unit Price</th>
                                          <th className="py-3 pl-4 text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider text-right">Subtotal</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {order.items.map((item, idx) => (
                                          <tr key={idx} className="border-b border-[var(--border)]/30">
                                            <td className="py-3 pr-4">
                                              <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-[var(--surface-dark)] flex items-center justify-center overflow-hidden">
                                                  {item.image_url ? (
                                                    <img src={item.image_url} alt={item.product_name || item.name} className="w-full h-full object-cover" />
                                                  ) : (
                                                    <Package className="w-5 h-5 text-[var(--text-muted)]" />
                                                  )}
                                                </div>
                                                <div>
                                                  <p className="text-white text-sm font-medium">{item.product_name || item.name || 'Product'}</p>
                                                  {item.product_sku && <p className="text-[var(--text-muted)] text-xs">SKU: {item.product_sku}</p>}
                                                </div>
                                              </div>
                                            </td>
                                            <td className="py-3 px-4 text-center text-white">{item.quantity || item.qty || 1}</td>
                                            <td className="py-3 px-4 text-right text-white">{formatCurrency(item.unit_price || item.price || 0)}</td>
                                            <td className="py-3 pl-4 text-right text-[var(--gold-primary)] font-semibold">{formatCurrency((item.unit_price || item.price || 0) * (item.quantity || item.qty || 1))}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <p className="text-[var(--text-muted)] text-sm text-center py-4">No items details available</p>
                                )}

                                {/* Order Timeline */}
                                <div>
                                  <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider mb-4">Order Timeline</p>
                                  <div className="space-y-3">
                                    {[
                                      { step: 'placed', label: 'Order Placed', time: order.created_at, desc: 'Customer placed the order' },
                                      { step: 'confirmed', label: 'Order Confirmed', time: orderStatus !== 'pending' ? order.created_at : null, desc: 'Order confirmed and payment verified' },
                                      { step: 'processing', label: 'Processing', time: orderStatus === 'processing' || orderStatus === 'completed' || orderStatus === 'shipped' || orderStatus === 'delivered' ? order.updated_at : null, desc: 'Order is being prepared' },
                                      { step: 'shipped', label: 'Shipped', time: orderStatus === 'shipped' || orderStatus === 'delivered' ? order.shipped_at : null, desc: 'Order has been shipped' },
                                      { step: 'delivered', label: 'Delivered', time: orderStatus === 'delivered' ? order.delivered_at : null, desc: 'Order delivered successfully' },
                                    ].map((item, idx, arr) => {
                                      const isCompleted = arr.slice(0, idx + 1).some(s => orderStatus === s.step || (s.step !== 'placed' && orderStatus === 'cancelled') || (orderStatus !== 'pending' && s.step === 'confirmed'))
                                      const isActive = orderStatus === item.step || (orderStatus === 'pending' && item.step === 'confirmed')
                                      const isCancelled = orderStatus === 'cancelled' && idx > 0

                                      return (
                                        <div key={item.step} className={`flex items-start gap-4 p-3 rounded-lg border transition-all ${
                                          isCompleted
                                            ? 'bg-green-500/5 border-green-500/20'
                                            : isActive
                                              ? 'bg-blue-500/5 border-blue-500/20'
                                              : isCancelled
                                                ? 'bg-red-500/5 border-red-500/20'
                                                : 'bg-[var(--bg-primary)] border-[var(--border)]'
                                        }`}>
                                          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                            isCompleted
                                              ? 'bg-green-500 text-white'
                                              : isActive
                                                ? 'bg-blue-500 text-white'
                                                : isCancelled
                                                  ? 'bg-red-500 text-white'
                                                  : 'bg-[var(--surface-dark)] text-[var(--text-muted)] border border-[var(--border)]'
                                          }`}>
                                            {idx + 1}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                              <h4 className={`font-semibold text-sm ${
                                                isCompleted
                                                  ? 'text-green-400'
                                                  : isActive
                                                    ? 'text-blue-400'
                                                    : isCancelled
                                                      ? 'text-red-400'
                                                      : 'text-[var(--text-muted)]'
                                              }`}>
                                                {item.label}
                                              </h4>
                                              {item.time && (
                                                <span className={`text-xs font-medium ${
                                                  isCompleted
                                                    ? 'text-green-400/80'
                                                    : isActive
                                                      ? 'text-blue-400/80'
                                                      : 'text-[var(--text-muted)]'
                                                }`}>
                                                  {new Date(item.time).toLocaleDateString()} at {new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                              )}
                                            </div>
                                            <p className={`text-xs ${
                                              isCompleted || isActive
                                                ? 'text-white/80'
                                                : 'text-[var(--text-muted)]'
                                            }`}>
                                              {item.desc}
                                            </p>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>

                                {/* Contextual Actions */}
                                <div className="flex flex-wrap gap-2 pt-4 border-t border-[var(--border)]">
                                  <button onClick={(e) => { e.stopPropagation(); openModal('order-status', order) }} className="px-4 py-2 bg-violet-500/10 text-violet-300 rounded-lg text-sm hover:bg-violet-500/20 transition-all">
                                    Update Order Status
                                  </button>
                                  {orderStatus === 'pending' && (
                                    <>
                                      {(order.payment_status === 'pending' || order.payment_status === 'awaiting_approval') && (
                                        <button onClick={(e) => { e.stopPropagation(); approvePayment(order.order_id) }} className="px-4 py-2 bg-teal-500/10 text-teal-300 rounded-lg text-sm hover:bg-teal-500/20 transition-all">
                                          Update Payment Status
                                        </button>
                                      )}
                                      <button onClick={(e) => { e.stopPropagation(); updateOrderStatus(order.order_id, 'processing') }} className="px-4 py-2 bg-green-500/10 text-green-300 rounded-lg text-sm hover:bg-green-500/20 transition-all">
                                        Confirm Order
                                      </button>
                                      <button onClick={(e) => e.stopPropagation()} className="px-4 py-2 bg-slate-500/10 text-slate-200 rounded-lg text-sm border border-slate-600 hover:bg-slate-500/20 transition-all">
                                        Print Slip
                                      </button>
                                      <button onClick={(e) => e.stopPropagation()} className="px-4 py-2 bg-blue-500/10 text-blue-300 rounded-lg text-sm hover:bg-blue-500/20 transition-all">
                                        Email Customer
                                      </button>
                                      <button onClick={(e) => { e.stopPropagation(); cancelOrder(order.order_id, order.order_number) }} className="px-4 py-2 bg-red-500/10 text-red-300 rounded-lg text-sm hover:bg-red-500/20 transition-all">
                                        Cancel
                                      </button>
                                    </>
                                  )}
                                  {orderStatus === 'processing' && (
                                    <>
                                      <button onClick={(e) => { e.stopPropagation(); updateOrderStatus(order.order_id, 'completed') }} className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 rounded-lg text-sm hover:bg-blue-500/20 transition-all">
                                        <PackageCheck className="w-4 h-4" /> Mark Complete
                                      </button>
                                      <button onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 px-4 py-2 bg-[var(--surface-dark)] text-white rounded-lg text-sm border border-[var(--border)] hover:border-[var(--gold-primary)]/50 transition-all">
                                        <Printer className="w-4 h-4" /> Print Slip
                                      </button>
                                      <button onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 px-4 py-2 bg-[var(--surface-dark)] text-white rounded-lg text-sm border border-[var(--border)] hover:border-[var(--gold-primary)]/50 transition-all">
                                        <MessageSquare className="w-4 h-4" /> Add Note
                                      </button>
                                    </>
                                  )}
                                  {orderStatus === 'completed' && (
                                    <>
                                      <button onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 px-4 py-2 bg-[var(--surface-dark)] text-white rounded-lg text-sm border border-[var(--border)] hover:border-[var(--gold-primary)]/50 transition-all">
                                        <FileText className="w-4 h-4" /> Export Receipt
                                      </button>
                                      <button onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 text-orange-400 rounded-lg text-sm hover:bg-orange-500/20 transition-all">
                                        <RotateCcw className="w-4 h-4" /> Refund/Return
                                      </button>
                                    </>
                                  )}
                                  {orderStatus === 'cancelled' && (
                                    <>
                                      <button onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 px-4 py-2 bg-[var(--surface-dark)] text-white rounded-lg text-sm border border-[var(--border)] hover:border-[var(--gold-primary)]/50 transition-all">
                                        <CreditCard className="w-4 h-4" /> Process Refund
                                      </button>
                                      <button onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 px-4 py-2 bg-[var(--surface-dark)] text-white rounded-lg text-sm border border-[var(--border)] hover:border-[var(--gold-primary)]/50 transition-all">
                                        <Copy className="w-4 h-4" /> Duplicate Order
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )
                  })}
                </div>
              )}

              {/* Pagination */}
              {filteredOrders.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-6 pt-4 border-t border-[var(--border)]">
                  <p className="text-[var(--text-muted)] text-sm">
                    Showing {(orderPage - 1) * ORDERS_PAGE_SIZE + 1}–{Math.min(orderPage * ORDERS_PAGE_SIZE, filteredOrders.length)} of {filteredOrders.length} orders
                  </p>
                  <div className="flex items-center gap-1 mt-4 sm:mt-0">
                    <button
                      onClick={() => setOrderPage(p => Math.max(1, p - 1))}
                      disabled={orderPage === 1}
                      className="p-2 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-white hover:border-[var(--gold-primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: Math.ceil(filteredOrders.length / ORDERS_PAGE_SIZE) }, (_, i) => i + 1).slice(
                      Math.max(0, orderPage - 3),
                      Math.min(Math.ceil(filteredOrders.length / ORDERS_PAGE_SIZE), orderPage + 2)
                    ).map(page => (
                      <button
                        key={page}
                        onClick={() => setOrderPage(page)}
                        className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${orderPage === page ? 'bg-[var(--gold-primary)] text-black' : 'border border-[var(--border)] text-[var(--text-muted)] hover:text-white hover:border-[var(--gold-primary)]'}`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => setOrderPage(p => Math.min(Math.ceil(filteredOrders.length / ORDERS_PAGE_SIZE), p + 1))}
                      disabled={orderPage >= Math.ceil(filteredOrders.length / ORDERS_PAGE_SIZE)}
                      className="p-2 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-white hover:border-[var(--gold-primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
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

          {/* ── SERVICES ───────────────────────────────────────────────────── */}
          {activeTab === 'services' && (
            <motion.div key="services" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Services Management</h2>
                    <p className="text-[var(--text-muted)] mt-1">Manage guitar services and pricing</p>
                  </div>
                  <button onClick={() => openModal('service')} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black rounded-xl font-semibold text-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all">
                    <Plus className="w-4 h-4" /> Add Service
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[
                    {
                      id: 'setup-intonation',
                      title: 'Setup & Intonation',
                      description: 'Professional guitar setup and intonation adjustment',
                      icon: Wrench,
                      color: 'text-blue-400',
                      bgColor: 'bg-blue-500/10',
                      borderColor: 'border-blue-500/30'
                    },
                    {
                      id: 'refinishing',
                      title: 'Refinishing',
                      description: 'Guitar refinishing and restoration services',
                      icon: PaintBucket,
                      color: 'text-green-400',
                      bgColor: 'bg-green-500/10',
                      borderColor: 'border-green-500/30'
                    },
                    {
                      id: 'repair-restoration',
                      title: 'Repair & Restoration',
                      description: 'Comprehensive repair and restoration work',
                      icon: Hammer,
                      color: 'text-orange-400',
                      bgColor: 'bg-orange-500/10',
                      borderColor: 'border-orange-500/30'
                    },
                    {
                      id: 'electronics-upgrade',
                      title: 'Electronics Upgrade',
                      description: 'Pickup upgrades and electronic modifications',
                      icon: Zap,
                      color: 'text-purple-400',
                      bgColor: 'bg-purple-500/10',
                      borderColor: 'border-purple-500/30'
                    },
                    {
                      id: 'custom-guitar-build',
                      title: 'Custom Guitar Build',
                      description: 'Bespoke guitar construction from design to completion',
                      icon: Sparkles,
                      color: 'text-amber-400',
                      bgColor: 'bg-amber-500/10',
                      borderColor: 'border-amber-500/30'
                    }
                  ].map((service) => {
                    const Icon = service.icon
                    return (
                      <motion.div
                        key={service.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-2xl p-6 hover:border-[var(--gold-primary)]/50 transition-all group"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className={`w-12 h-12 rounded-xl ${service.bgColor} border ${service.borderColor} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                            <Icon className={`w-6 h-6 ${service.color}`} />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => openModal('service', service)} className="p-2 hover:bg-[var(--gold-primary)]/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                              <Edit className="w-4 h-4 text-[var(--gold-primary)]" />
                            </button>
                            <button onClick={() => deleteService(service.id, service.title)} className="p-2 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        </div>
                        <h3 className="text-white font-semibold text-lg mb-2">{service.title}</h3>
                        <p className="text-[var(--text-muted)] text-sm mb-4">{service.description}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-[var(--gold-primary)] font-bold">{formatCurrency(0, false)}</span>
                          <button className="text-[var(--text-muted)] text-sm hover:text-white transition-colors">
                            Configure Pricing →
                          </button>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── APPOINTMENTS ───────────────────────────────────────────────── */}
          {activeTab === 'appointments' && (
            <motion.div key="appointments" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              {visibleAppointments.length === 0 ? (
                <EmptyState icon={Calendar} label="No appointments scheduled" action={() => openModal('appointment')} actionLabel="Book Appointment" />
              ) : (
                <>
                  <AppointmentCalendar
                    appointments={visibleAppointments}
                    onAppointmentClick={(apt) => openModal('view_appointment', apt)}
                  />
                  <div className="mt-8 mb-4">
                    <h3 className="text-white text-lg font-semibold mb-4">All Appointments</h3>
                  </div>
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
                              <tr key={apt.appointment_id || apt.id || i} className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-primary)]/50 transition-colors">
                                <td className="py-4 px-6 text-[var(--text-muted)] font-mono text-sm">#{i + 1}</td>
                                <td className="py-4 px-6">
                                  <p className="text-white font-medium">{apt.guitar_details ? `${apt.guitar_details.brand} ${apt.guitar_details.model}` : (apt.title || apt.service_name || 'Appointment')}</p>
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
                                <td className="py-4 px-6 text-[var(--text-muted)] capitalize">
                                  {Array.isArray(apt.services) ? apt.services.map(s => s.replace(/-/g, ' ')).join(', ') : (apt.service_name || 'Consultation')}
                                </td>
                                <td className="py-4 px-6">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${statusCls}`}>
                                    {apt.status || 'Pending'}
                                  </span>
                                </td>
                                <td className="py-4 px-6">
                                  <div className="flex gap-2">
                                    <button onClick={() => openModal('view_appointment', apt)} className="p-1.5 hover:bg-blue-500/10 rounded transition-colors" title="View Summary">
                                      <Eye className="w-4 h-4 text-blue-400" />
                                    </button>
                                    <button onClick={() => openModal('appointment', apt)} className="p-1.5 hover:bg-green-500/10 rounded transition-colors" title="Update Status">
                                      <CheckCircle className="w-4 h-4 text-green-400" />
                                    </button>
                                    <button onClick={() => deleteAppointment(apt.appointment_id, apt.title)} className="p-1.5 hover:bg-red-500/10 rounded transition-colors" title="Delete">
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
                </>
              )}
            </motion.div>
          )}

          {/* ── INVENTORY ──────────────────────────────────────────────────── */}
          {activeTab === 'inventory' && (
            <motion.div key="inventory" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              {/* Filters & Sort */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'healthy', label: 'Healthy', cls: 'text-green-400' },
                    { id: 'warning', label: 'Warning', cls: 'text-amber-400' },
                    { id: 'critical', label: 'Critical', cls: 'text-orange-400' },
                    { id: 'out_of_stock', label: 'Out of Stock', cls: 'text-red-400' },
                  ].map((status) => {
                    const isActive = inventoryStatusFilter === status.id
                    return (
                      <button
                        key={status.id}
                        onClick={() => { setInventoryStatusFilter(status.id); setInventoryPage(1) }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          isActive
                            ? status.id === 'all' ? 'bg-[var(--gold-primary)] text-black'
                              : status.id === 'healthy' ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                              : status.id === 'warning' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : status.id === 'critical' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-[var(--surface-dark)] text-[var(--text-muted)] hover:text-white'
                        }`}
                      >
                        {status.label}
                      </button>
                    )
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[var(--text-muted)] text-sm">Sort:</span>
                  <select
                    value={inventorySort}
                    onChange={(e) => setInventorySort(e.target.value)}
                    className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
                  >
                    <option value="name">Name (A-Z)</option>
                    <option value="sku">SKU</option>
                    <option value="stock_low">Stock (Low to High)</option>
                    <option value="stock_high">Stock (High to Low)</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {}}
                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(14,165,233,0.18)] hover:shadow-[0_12px_35px_rgba(14,165,233,0.25)] transition-all"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    POS
                  </button>
                </div>
              </div>

              {/* Inventory List */}
              {filteredInventory.length === 0 ? (
                <div className="text-center py-16 text-[var(--text-muted)]">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="font-semibold text-lg">No inventory items found.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {paginatedInventory.map((item) => {
                    const isExpanded = expandedInventoryIds.has(item.product_id || item.part_id)
                    const toggleExpand = () => {
                      setExpandedInventoryIds(prev => {
                        const next = new Set(prev)
                        const id = item.product_id || item.part_id
                        if (next.has(id)) next.delete(id)
                        else next.add(id)
                        return next
                      })
                    }
                    const stock = Number(item.stock ?? 0)
                    const threshold = item.type === 'product' ? Number(item.low_stock_threshold ?? 10) : 10
                    const isCritical = stock <= threshold && stock > 0
                    const isWarning = !isCritical && stock <= threshold * 2 && stock > threshold
                    const isOutOfStock = stock === 0
                    const statusLabel = isOutOfStock ? 'Out of Stock' : isCritical ? 'Critical' : isWarning ? 'Warning' : 'Healthy'
                    const statusDotColors = {
                      'Healthy': 'bg-green-400',
                      'Warning': 'bg-amber-400',
                      'Critical': 'bg-orange-400',
                      'Out of Stock': 'bg-red-400',
                    }
                    const statusBgColors = {
                      'Healthy': 'bg-green-400/10 text-green-400',
                      'Warning': 'bg-amber-400/10 text-amber-400',
                      'Critical': 'bg-orange-400/10 text-orange-400',
                      'Out of Stock': 'bg-red-400/10 text-red-400',
                    }
                    const maxCapacity = Math.max(stock * 2, threshold * 4, 20)
                    const pct = Math.min((stock / maxCapacity) * 100, 100)

                    const handleQuickAdjust = async (amount) => {
                      if (item.type === 'product') {
                        await adminApi.adjustStock({ product_id: item.product_id, quantity: amount, notes: 'Quick adjustment from table' })
                        fetchInventory()
                      } else {
                        await adminApi.updateBuilderPart(item.part_id, { ...item, stock: stock + amount })
                        fetchParts()
                      }
                    }

                    return (
                      <motion.div
                        key={item.product_id || item.part_id}
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl overflow-hidden"
                      >
                        {/* Collapsed Row */}
                        <div
                          className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-white/5 transition-colors"
                          onClick={toggleExpand}
                        >
                          <div className="w-8 flex-shrink-0">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.type === 'product' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'}`}>
                              <Package className="w-4 h-4" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{item.name}</p>
                            <p className="text-[var(--text-muted)] text-xs truncate">{item.type === 'product' ? 'Product' : 'Part'} • {item.sku || '—'}</p>
                          </div>
                          <div className="w-32 flex-shrink-0">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${isOutOfStock ? 'bg-red-500' : isCritical ? 'bg-orange-400' : isWarning ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          </div>
                          <div className="w-24 text-center">
                            <span className={`inline-flex px-3 py-1.5 rounded-full text-xs font-semibold ${statusBgColors[statusLabel]}`}>
                              {statusLabel}
                            </span>
                          </div>
                          <div className="w-16 text-right">
                            <span className="text-white text-sm font-mono">{stock}</span>
                          </div>
                          {item.type === 'product' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); openModal('inventory', { product_id: item.product_id, name: item.name }) }}
                              className="p-2 hover:bg-[var(--gold-primary)]/10 rounded transition-colors"
                            >
                              <Edit className="w-4 h-4 text-[var(--text-muted)] hover:text-[var(--gold-primary)]" />
                            </button>
                          )}
                          <button className="p-1 text-[var(--text-muted)] hover:text-white transition-colors">
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </button>
                        </div>

                        {/* Expanded Details */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              key={`inventory-details-${item.product_id || item.part_id}`}
                              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                              className="border-t border-[var(--border)] bg-[var(--bg-primary)]/50"
                            >
                              <div className="p-5 space-y-4">
                                {/* Metadata Row */}
                                <div className="flex flex-wrap gap-6 text-sm">
                                  <div className="flex items-center gap-2 text-[var(--text-muted)]">
                                    <span className="text-xs uppercase tracking-wider">Type:</span>
                                    <span className="text-white">{item.type === 'product' ? 'Standard Product' : 'Custom Builder Part'}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[var(--text-muted)]">
                                    <span className="text-xs uppercase tracking-wider">SKU:</span>
                                    <span className="text-white font-mono text-xs">{item.sku || '—'}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[var(--text-muted)]">
                                    <span className="text-xs uppercase tracking-wider">Threshold:</span>
                                    <span className="text-white">{threshold}</span>
                                  </div>
                                  {item.type === 'product' && item.primary_image && (
                                    <div className="flex items-center gap-2">
                                      <img src={item.primary_image} alt="" className="w-12 h-12 rounded-lg object-cover bg-[var(--surface-dark)]" />
                                    </div>
                                  )}
                                  {item.type === 'part' && item.image_url && (
                                    <div className="flex items-center gap-2">
                                      <img src={item.image_url} alt="" className="w-12 h-12 rounded-lg object-cover bg-[var(--surface-dark)]" />
                                    </div>
                                  )}
                                </div>

                                {/* Stock Details */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[var(--border)]">
                                  <div className="bg-[var(--surface-dark)] rounded-lg p-4">
                                    <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-1">Current Stock</p>
                                    <p className={`text-2xl font-bold ${isOutOfStock ? 'text-red-400' : isCritical ? 'text-orange-400' : isWarning ? 'text-amber-400' : 'text-white'}`}>{stock}</p>
                                  </div>
                                  <div className="bg-[var(--surface-dark)] rounded-lg p-4">
                                    <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-1">Low Stock Threshold</p>
                                    <p className="text-white text-2xl font-bold">{threshold}</p>
                                  </div>
                                  <div className="bg-[var(--surface-dark)] rounded-lg p-4">
                                    <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-1">Capacity</p>
                                    <p className="text-white text-2xl font-bold">{Math.round(pct)}%</p>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )
                  })}
                </div>
              )}

              {/* Pagination */}
              {filteredInventory.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-6 pt-4 border-t border-[var(--border)]">
                  <p className="text-[var(--text-muted)] text-sm">
                    Showing {(inventoryPage - 1) * INVENTORY_PAGE_SIZE + 1}–{Math.min(inventoryPage * INVENTORY_PAGE_SIZE, filteredInventory.length)} of {filteredInventory.length} items
                  </p>
                  <div className="flex items-center gap-1 mt-4 sm:mt-0">
                    <button
                      onClick={() => setInventoryPage(p => Math.max(1, p - 1))}
                      disabled={inventoryPage === 1}
                      className="p-2 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-white hover:border-[var(--gold-primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: Math.ceil(filteredInventory.length / INVENTORY_PAGE_SIZE) }, (_, i) => i + 1).slice(
                      Math.max(0, inventoryPage - 3),
                      Math.min(Math.ceil(filteredInventory.length / INVENTORY_PAGE_SIZE), inventoryPage + 2)
                    ).map(page => (
                      <button
                        key={page}
                        onClick={() => setInventoryPage(page)}
                        className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${inventoryPage === page ? 'bg-[var(--gold-primary)] text-black' : 'border border-[var(--border)] text-[var(--text-muted)] hover:text-white hover:border-[var(--gold-primary)]'}`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => setInventoryPage(p => Math.min(Math.ceil(filteredInventory.length / INVENTORY_PAGE_SIZE), p + 1))}
                      disabled={inventoryPage >= Math.ceil(filteredInventory.length / INVENTORY_PAGE_SIZE)}
                      className="p-2 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-white hover:border-[var(--gold-primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
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
                      { icon: DollarSign, label: 'Total Gross Sales', value: formatCurrency(salesReport.totalGrossSales || 0), color: 'var(--gold-primary)', bg: 'from-[var(--gold-primary)]/10', border: 'border-[var(--gold-primary)]/30' },
                      { icon: ShoppingBag, label: 'Total Transactions', value: salesReport.totalTransactions || 0, color: '#60a5fa', bg: 'from-blue-500/10', border: 'border-blue-500/30' },
                      { icon: TrendingUp, label: 'Avg per Transaction', value: formatCurrency(salesReport.averagePerTransaction || 0), color: '#34d399', bg: 'from-green-500/10', border: 'border-green-500/30' },
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
                          <Tooltip contentStyle={{ backgroundColor: 'var(--surface-dark)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white' }} formatter={(v) => [formatCurrency(v), 'Revenue']} />
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
                          <p className="text-white text-lg">{formatCurrency(ch.sales || 0)}</p>
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
                              <span className="text-[var(--gold-primary)] font-bold">{formatCurrency(p.sales || 0)}</span>
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
                                <td className="py-4 px-6 text-[var(--gold-primary)] font-bold">{formatCurrency(product.revenue)}</td>
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
            key={`modal-${modal.type || 'default'}`}
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

              {/* Appointment View Modal */}
              {modal.type === 'view_appointment' && modal.data && (() => {
                const apt = modal.data;
                const apptDate = apt.scheduled_at || apt.date;
                const statusColors = {
                  pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
                  approved: 'bg-green-500/10 text-green-400 border-green-500/30',
                  completed: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
                  cancelled: 'bg-red-500/10 text-red-500 border-red-500/30',
                  'no_show': 'bg-orange-500/10 text-orange-400 border-orange-500/30',
                };
                const statusCls = statusColors[apt.status] || 'bg-gray-500/10 text-gray-400 border-gray-500/30';
                return (
                  <>
                    <ModalHeader title="Appointment Summary" onClose={closeModal} />
                    <div className="mt-6 space-y-6 text-sm">
                      <div className="bg-[var(--bg-primary)] p-5 rounded-xl border border-[var(--border)]">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-xl font-bold text-white mb-1">
                              {apt.guitar_details ? `${apt.guitar_details.brand} ${apt.guitar_details.model}` : (apt.title || apt.service_name || 'Appointment')}
                            </h3>
                            <p className="text-[var(--text-muted)] font-mono text-xs">ID: {apt.appointment_id || apt.id || 'N/A'}</p>
                          </div>
                          <span className={`px-3 py-1 text-xs font-bold uppercase rounded-full border ${statusCls}`}>
                            {apt.status || 'Pending'}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--border)]">
                           <div>
                             <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-1">Schedule</p>
                             <p className="text-white font-medium">{apptDate ? new Date(apptDate).toLocaleDateString() : '—'}</p>
                             <p className="text-[var(--text-muted)]">{apt.time || (apptDate ? new Date(apptDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—')}</p>
                           </div>
                           <div>
                             <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-1">Branch</p>
                             <p className="text-white font-medium capitalize">{apt.location_id || 'Main Branch'}</p>
                           </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="bg-[var(--bg-primary)] p-5 rounded-xl border border-[var(--border)]">
                           <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-3">Customer Information</p>
                           <div className="space-y-3">
                             <div>
                               <p className="text-[var(--text-muted)] text-xs mb-0.5">Name</p>
                               <p className="text-white font-medium">{apt.customer_name || apt.user_name || '—'}</p>
                             </div>
                             <div>
                               <p className="text-[var(--text-muted)] text-xs mb-0.5">Email</p>
                               <p className="text-white">{apt.customer_email || apt.user_email || '—'}</p>
                             </div>
                             <div>
                               <p className="text-[var(--text-muted)] text-xs mb-0.5">Phone</p>
                               <p className="text-white">{apt.customer_phone || apt.user_phone || '—'}</p>
                             </div>
                           </div>
                        </div>

                        <div className="bg-[var(--bg-primary)] p-5 rounded-xl border border-[var(--border)]">
                           <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-3">Guitar Details</p>
                           {apt.guitar_details ? (
                             <div className="space-y-3">
                               <div>
                                 <p className="text-[var(--text-muted)] text-xs mb-0.5">Brand & Model</p>
                                 <p className="text-white font-medium">{apt.guitar_details.brand} {apt.guitar_details.model}</p>
                               </div>
                               <div>
                                 <p className="text-[var(--text-muted)] text-xs mb-0.5">Serial Number</p>
                                 <p className="text-white">{apt.guitar_details.serialNumber || '—'}</p>
                               </div>
                               {apt.guitar_details.type && (
                                 <div>
                                   <p className="text-[var(--text-muted)] text-xs mb-0.5">Type</p>
                                   <p className="text-white capitalize">{apt.guitar_details.type}</p>
                                 </div>
                               )}
                             </div>
                           ) : (
                             <p className="text-[var(--text-muted)] text-sm italic">No detailed guitar specs provided.</p>
                           )}
                        </div>
                      </div>

                      <div className="bg-[var(--bg-primary)] p-5 rounded-xl border border-[var(--border)]">
                         <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-3">Requested Services</p>
                         {Array.isArray(apt.services) && apt.services.length > 0 ? (
                           <ul className="list-disc list-inside space-y-1 text-white">
                             {apt.services.map((s, i) => <li key={i} className="capitalize">{s.replace(/-/g, ' ')}</li>)}
                           </ul>
                         ) : (
                           <p className="text-white capitalize">{apt.service_name || 'Consultation'}</p>
                         )}
                      </div>

                      {apt.notes && (
                        <div className="bg-[var(--bg-primary)] p-5 rounded-xl border border-[var(--border)] flex flex-col items-start gap-3">
                           <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Additional Notes</p>
                           <p className="text-white bg-[var(--surface-dark)] p-4 rounded-lg border border-[var(--border)] leading-relaxed w-full min-h-[60px] whitespace-pre-wrap">{apt.notes}</p>
                        </div>
                      )}
                      
                      <div className="flex justify-end pt-4">
                        <button onClick={closeModal} className="px-6 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-white hover:bg-[var(--bg-primary)] transition-colors font-semibold">
                          Close Summary
                        </button>
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* Appointment Status Modal */}
              {modal.type === 'appointment' && modal.data && (() => {
                const APPOINTMENT_STATUSES = [
                  { value: 'approved', label: 'Approved (Confirmed)' },
                  { value: 'completed', label: 'Completed (Showed Up)' },
                  { value: 'no_show', label: 'No-Show (Missed)' },
                  { value: 'cancelled', label: 'Cancelled' }
                ];
                // Use form.status if it was set, else fallback to modal.data.status
                const currentStatus = form.status || modal.data.status || 'approved';
                return (
                  <>
                    <ModalHeader title="Update Appointment Status" onClose={closeModal} />
                    <div className="mt-6 space-y-6">
                      <div className="p-4 bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl">
                        <p className="text-white text-lg font-bold mb-1">{modal.data.guitar_details ? `${modal.data.guitar_details.brand} ${modal.data.guitar_details.model}` : (modal.data.title || modal.data.service_name || 'Appointment')}</p>
                        <p className="text-[var(--text-muted)] text-sm">Customer: <span className="font-medium text-white">{modal.data.customer_name || modal.data.user_name || '—'}</span></p>
                        <p className="text-[var(--text-muted)] text-sm">Date: <span className="font-medium text-white">{modal.data.scheduled_at ? new Date(modal.data.scheduled_at).toLocaleDateString() : '—'}</span></p>
                      </div>

                      <div>
                        <label className="block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-3">Status</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {APPOINTMENT_STATUSES.map(stat => {
                            const isSelected = currentStatus === stat.value;
                            return (
                              <button
                                key={stat.value}
                                onClick={() => setForm({ ...form, status: stat.value })}
                                className={`p-4 text-left rounded-xl border flex flex-col gap-1 transition-all ${
                                  isSelected 
                                    ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10 text-white' 
                                    : 'border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-muted)] hover:border-[var(--gold-primary)]/40 hover:text-white'
                                }`}
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span className="font-semibold">{stat.label.split(' (')[0]}</span>
                                  {isSelected && <CheckCircle className="w-4 h-4 text-[var(--gold-primary)]" />}
                                </div>
                                <span className={`text-xs ${isSelected ? 'text-[var(--gold-primary)]/80' : 'text-[var(--text-muted)]'}`}>
                                  {stat.label.includes('(') ? stat.label.split('(')[1].replace(')', '') : ''}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        {currentStatus === 'no_show' && (
                          <p className="mt-4 text-xs flex items-center gap-2 text-orange-400 bg-orange-500/10 p-3 rounded-lg border border-orange-500/20">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            Warning: Marking as No-Show will lock the appointment.
                          </p>
                        )}
                        {currentStatus === 'cancelled' && (
                          <p className="mt-4 text-xs flex items-center gap-2 text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            Warning: This will cancel the customer's appointment.
                          </p>
                        )}
                      </div>
                    </div>
                    <ModalFooter onCancel={closeModal} onSave={saveAppointment} isSaving={isSaving} saveText="Update Status" />
                  </>
                );
              })()}

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
                                <label className={`${labelCls} ${formErrors.brand ? 'text-red-400' : ''}`}>Brand</label>
                                <input
                                  value={form.brand || ''}
                                  onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                                  placeholder="e.g. Fender, Gibson, Ibanez"
                                  className={formErrors.brand ? fieldErr : fieldOk}
                                />
                                {formErrors.brand && <p className="mt-1 text-xs text-red-400">{formErrors.brand}</p>}
                                <p className="mt-1.5 text-xs text-[var(--text-muted)]">Manufacturer or brand name for product identification.</p>
                              </div>
                              <div>
                                <label className={`${labelCls} ${formErrors.category_id ? 'text-red-400' : ''}`}>Category *</label>
                                <select
                                  value={form.category_id || ''}
                                  onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                                  className={formErrors.category_id ? selErr : selOk}
                                >
                                  <option value="">Select Category</option>
                                  {categoryTree.map(parent => (
                                    <optgroup key={parent.category_id} label={parent.name}>
                                      <option value={parent.category_id}>{parent.name} (All)</option>
                                      {parent.children?.map(child => (
                                        <option key={child.category_id} value={child.category_id}>{child.name}</option>
                                      ))}
                                    </optgroup>
                                  ))}
                                </select>
                                {formErrors.category_id && <p className="mt-1 text-xs text-red-400">{formErrors.category_id}</p>}
                                <p className="mt-1.5 text-xs text-[var(--text-muted)]">Groups this product in the shop catalog.</p>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col justify-start pb-0.5 md:pb-1">
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
              {modal.type === 'category' && (() => {
                const fieldBase = 'w-full px-4 py-2.5 bg-[var(--bg-primary)] rounded-xl text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 text-sm transition-colors'
                const fieldOk = `${fieldBase} border border-[var(--border)] focus:ring-[var(--gold-primary)]`
                const fieldErr = `${fieldBase} border border-[var(--border)] border-l-4 border-l-red-500 focus:ring-red-500/40`
                const selErr = `${inputCls} border-l-4 border-l-red-500`
                const selOk = inputCls
                return (
                  <>
                    <ModalHeader title={modal.data ? 'Edit Category' : 'New Category'} onClose={closeModal} />
                    <div className="space-y-5 mt-6">
                      {/* Basic Information */}
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                        <div>
                          <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${formErrors.name ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>Category Name *</label>
                          <input
                            value={form.name || ''}
                            onChange={(e) => {
                              const nameVal = e.target.value
                              setForm(f => ({ ...f, name: nameVal, slug: f.slug || generateSlug(nameVal) }))
                            }}
                            placeholder="e.g. Custom Builds, Acoustic Guitars"
                            className={formErrors.name ? fieldErr : fieldOk}
                          />
                          {formErrors.name && <p className="mt-1 text-xs text-red-400">{formErrors.name}</p>}
                          <p className="mt-1.5 text-xs text-[var(--text-muted)]">The display name for this category.</p>
                        </div>

                        <div>
                          <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${formErrors.slug ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>URL Slug *</label>
                          <div className="flex items-center gap-2">
                            <input
                              value={form.slug || ''}
                              onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))}
                              placeholder="custom-builds"
                              className={`${formErrors.slug ? fieldErr : fieldOk} flex-1`}
                            />
                            <button
                              type="button"
                              onClick={() => setForm(f => ({ ...f, slug: generateSlug(f.name) }))}
                              className="p-2.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl hover:border-[var(--gold-primary)] transition-colors"
                              title="Regenerate slug"
                            >
                              <RefreshCw className="w-4 h-4 text-[var(--text-muted)]" />
                            </button>
                          </div>
                          {formErrors.slug && <p className="mt-1 text-xs text-red-400">{formErrors.slug}</p>}
                          <p className="mt-1.5 text-xs text-[var(--text-muted)]">URL-friendly identifier. Auto-generated from name but can be customized.</p>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">Description</label>
                          <textarea
                            rows={3}
                            value={form.description || ''}
                            onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                            placeholder="Write a brief description for this category..."
                            className={fieldOk}
                          />
                        </div>
                      </motion.div>

                      {/* Organization */}
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/60 p-4 sm:p-5">
                        <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Organization</p>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">Parent Category</label>
                            <select value={form.parent_id || ''} onChange={e => setForm(f => ({ ...f, parent_id: e.target.value || null }))} className={selOk}>
                              <option value="">None</option>
                              {categoryTree.map(parent => (
                                <optgroup key={parent.category_id} label={parent.name}>
                                  {parent.category_id !== modal.data?.category_id && (
                                    <option value={parent.category_id}>{parent.name}</option>
                                  )}
                                  {parent.children?.filter(child => child.category_id !== modal.data?.category_id).map(child => (
                                    <option key={child.category_id} value={child.category_id}>{child.name}</option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                            <p className="mt-1.5 text-xs text-[var(--text-muted)]">Create subcategories by selecting a parent.</p>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">Sort Order</label>
                            <input
                              type="number"
                              value={form.sort_order ?? 0}
                              onChange={(v) => setForm(f => ({ ...f, sort_order: v }))}
                              placeholder="0"
                              className={fieldOk}
                            />
                            <p className="mt-1.5 text-xs text-[var(--text-muted)]">Controls display order. Lower numbers appear first.</p>
                          </div>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="flex flex-col justify-start pb-0.5 md:pb-1">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id="category_is_active"
                            checked={form.is_active ?? true}
                            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                            className="h-5 w-5 rounded border-gray-600 bg-gray-800 text-[var(--gold-primary)] focus:ring-[var(--gold-primary)] focus:ring-offset-gray-900"
                          />
                          <label htmlFor="category_is_active" className="cursor-pointer font-medium text-white">
                            Active Category
                          </label>
                        </div>
                        <p className="ml-8 mt-1 text-xs text-[var(--text-muted)]">When unchecked, this category will be hidden from the storefront.</p>
                      </div>
                    </div>
                    <ModalFooter onCancel={closeModal} onSave={validateAndSave(CATEGORY_RULES, saveCategory)} isSaving={isSaving} />
                  </>
                )
              })()}

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
                                <option value="">Select Category</option>
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
                                <option value="">Select Type</option>
                                {(form.builder_category ? BUILDER_CATEGORY_MAP[form.builder_category] || [] : Object.values(BUILDER_CATEGORY_MAP).flat()).map((t) => (
                                  <option key={t} value={t}>
                                    {t.replace(/([A-Z])/g, ' ').replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
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
                      ['Total', <span className="text-[var(--gold-primary)] font-bold">{formatCurrency(modal.data.total || modal.data.total_amount)}</span>],
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
                              <span className="text-[var(--gold-primary)] text-sm">{formatCurrency((item.unit_price || item.price || 0) * (item.quantity || 1))}</span>
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

              {/* Service Modal */}
              {modal.type === 'service' && (
                <>
                  <ModalHeader title={modal.data ? 'Edit Service' : 'Add Service'} onClose={closeModal} />
                  <div className="space-y-4 mt-6">
                    <FormField label="Service Name *" value={form.name || ''} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. Setup & Intonation" error={formErrors.name} />
                    <FormField label="Description" value={form.description || ''} onChange={v => setForm(f => ({ ...f, description: v }))} textarea placeholder="Describe the service..." />
                    <FormField label="Base Price *" type="number" value={form.price || ''} onChange={v => setForm(f => ({ ...f, price: v }))} placeholder="1500.00" error={formErrors.price} />
                    <FormField label="Duration (hours)" type="number" value={form.duration || ''} onChange={v => setForm(f => ({ ...f, duration: v }))} placeholder="e.g. 2" />
                    <div>
                      <label className={labelCls}>Category</label>
                      <select value={form.category || ''} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
                        <option value="">Select Category</option>
                        <option value="setup-intonation">Setup & Intonation</option>
                        <option value="refinishing">Refinishing</option>
                        <option value="repair-restoration">Repair & Restoration</option>
                        <option value="electronics-upgrade">Electronics Upgrade</option>
                        <option value="custom-guitar-build">Custom Guitar Build</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Status</label>
                      <select value={form.is_active !== undefined ? form.is_active : true} onChange={e => setForm(f => ({ ...f, is_active: e.target.value === 'true' }))} className={inputCls}>
                        <option value={true}>Active</option>
                        <option value={false}>Inactive</option>
                      </select>
                    </div>
                  </div>
                  <ModalFooter onCancel={closeModal} onSave={validateAndSave(SERVICE_RULES, saveService)} isSaving={isSaving} />
                </>
              )}

            </motion.div>
          </motion.div>
        )}

        {/* Payment Status Update Modal */}
        {modal.type === 'payment_approval' && modal.data?.payment && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl p-8 w-full max-w-2xl shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Update Payment Status</h2>
                <button onClick={closeModal} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Order # - Highlighted */}
                <div className="bg-[var(--gold-primary)]/10 border border-[var(--gold-primary)]/30 rounded-lg p-4">
                  <p className="text-[var(--gold-primary)] text-sm mb-1">Order #</p>
                  <p className="text-white font-mono text-xl font-bold">{form.order_number || modal.data?.order_number || modal.data?.order_id?.slice(0, 8)}</p>
                </div>

                {/* Payment Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[var(--bg-primary)]/50 rounded-lg p-4">
                    <p className="text-[var(--text-muted)] text-sm mb-2">Payment Method</p>
                    <div className="flex items-center gap-3">
                      {(() => {
                        const method = form.payment_method || 'card'
                        const methodLower = method.toLowerCase()

                        if (methodLower.includes('gcash') || methodLower.includes('g-cash')) {
                          return (
                            <>
                              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                <span className="text-white text-xs font-bold">G</span>
                              </div>
                              <span className="text-white font-semibold">GCash</span>
                            </>
                          )
                        } else if (methodLower.includes('bank') || methodLower.includes('transfer') || methodLower.includes('bdo') || methodLower.includes('bpi') || methodLower.includes('unionbank')) {
                          return (
                            <>
                              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                                <CreditCard className="w-3.5 h-3.5 text-white" />
                              </div>
                              <span className="text-white font-semibold">Bank Transfer</span>
                            </>
                          )
                        } else if (methodLower.includes('cod') || methodLower.includes('cash')) {
                          return (
                            <>
                              <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                                <DollarSign className="w-3.5 h-3.5 text-white" />
                              </div>
                              <span className="text-white font-semibold">Cash on Delivery</span>
                            </>
                          )
                        } else {
                          return (
                            <>
                              <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                                <CreditCard className="w-3.5 h-3.5 text-white" />
                              </div>
                              <span className="text-white font-semibold capitalize">{method}</span>
                            </>
                          )
                        }
                      })()}
                    </div>
                  </div>
                  <div className="bg-[var(--bg-primary)]/50 rounded-lg p-4">
                    <p className="text-[var(--text-muted)] text-sm mb-1">Amount</p>
                    <p className="text-[var(--gold-primary)] font-bold text-xl">{formatCurrency(form.amount || 0)}</p>
                  </div>
                </div>

                {/* Status Cards */}
                <div className="bg-[var(--bg-primary)]/50 rounded-lg p-4">
                  <p className="text-[var(--text-muted)] text-sm mb-3">Status</p>
                  <div className="relative">
                    {(() => {
                      const statuses = [
                        { value: 'pending', label: 'Pending', color: '#f59e0b' },
                        { value: 'paid', label: 'Paid', color: '#22c55e' },
                        { value: 'failed', label: 'Cancel', color: '#f87171' },
                        { value: 'refunded', label: 'Refunded', color: '#38bdf8' },
                      ]
                      const currentValue = form.payment_status || 'pending'
                      const currentStatus = statuses.find((status) => status.value === currentValue)

                      return (
                        <>
                          <button
                            type="button"
                            onClick={() => setPaymentStatusDropdownOpen((open) => !open)}
                            className="w-full rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] px-4 py-3 text-left flex items-center justify-between gap-3 transition-all hover:border-[var(--gold-primary)]/30"
                          >
                            <span className="text-sm font-semibold" style={{ color: currentStatus?.color || '#ffffff' }}>
                              {currentStatus?.label || 'Pending'}
                            </span>
                            <ChevronDown className="w-4 h-4 text-white" />
                          </button>

                          {paymentStatusDropdownOpen && (
                            <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] shadow-2xl">
                              {statuses.map((status) => (
                                <button
                                  key={status.value}
                                  type="button"
                                  onClick={() => {
                                    setForm((f) => ({ ...f, payment_status: status.value }))
                                    setPaymentStatusDropdownOpen(false)
                                  }}
                                  className={`w-full px-4 py-3 text-left text-sm font-medium transition-colors ${
                                    currentValue === status.value ? 'bg-[var(--border)]/20' : 'hover:bg-[var(--gold-primary)]/10'
                                  }`}
                                >
                                  <span className="text-white">{status.label}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </div>
                  <p className="mt-3 text-[var(--text-muted)] text-sm leading-relaxed">
                    Choose the current payment status for this order. Save your selection with Update Status.
                  </p>
                </div>

                {/* Payment Proof Image - Zoomable */}
                {form.proof_url && (
                  <div className="space-y-3">
                    <p className="text-white font-semibold flex items-center gap-2">
                      Payment Proof
                      <span className="text-xs text-[var(--text-muted)] font-normal">(Click to zoom)</span>
                    </p>
                    <ImageZoomModal src={form.proof_url} alt="Payment Proof" />
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={closeModal}
                    className="flex-1 px-4 py-3 bg-[var(--surface-dark)] border border-[var(--border)] rounded-lg text-white font-semibold hover:border-[var(--gold-primary)]/50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={updatePaymentStatus}
                    disabled={paymentStatusUpdate.loading || form.payment_status === (modal.data?.payment_status || modal.data?.payment?.status)}
                    className={`flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 rounded-lg text-white font-semibold hover:shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-all flex items-center justify-center gap-2 ${
                      paymentStatusUpdate.loading || form.payment_status === (modal.data?.payment_status || modal.data?.payment?.status)
                        ? 'opacity-50 cursor-not-allowed'
                        : ''
                    }`}
                  >
                    {paymentStatusUpdate.loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Update Status
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Update Order Status Modal */}
        {modal.type === 'order-status' && modal.data && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl p-8 w-full max-w-lg shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Update Order Status</h2>
                <button onClick={closeModal} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Order Info */}
                <div className="bg-[var(--bg-primary)]/50 rounded-lg p-4">
                  <p className="text-[var(--text-muted)] text-sm mb-1">Order #</p>
                  <p className="text-white font-mono text-lg font-bold">{modal.data.order_number || modal.data.order_id?.slice(0, 8)}</p>
                  <p className="text-[var(--text-muted)] text-sm mt-2">Total: {formatCurrency(modal.data.total || modal.data.total_amount || 0)}</p>
                </div>

                {/* Status Selection */}
                <div>
                  <p className="text-[var(--text-muted)] text-sm mb-3">Select New Order Status</p>
                  <div className="relative">
                    {(() => {
                      const statusItems = [
                        { value: 'pending', label: 'Pending', color: '#f59e0b' },
                        { value: 'processing', label: 'Processing', color: '#60a5fa' },
                        { value: 'shipped', label: 'Shipped', color: '#a78bfa' },
                        { value: 'delivered', label: 'Delivered', color: '#22c55e' },
                        { value: 'cancelled', label: 'Cancelled', color: '#f87171' },
                      ]
                      const currentValue = form.order_status || modal.data.status || 'pending'
                      const currentItem = statusItems.find(item => item.value === currentValue) || statusItems[0]

                      return (
                        <>
                          <button
                            type="button"
                            onClick={() => setOrderStatusDropdownOpen((open) => !open)}
                            className="w-full rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] px-4 py-4 text-left flex items-center justify-between gap-3 transition-all hover:border-[var(--gold-primary)]/30"
                          >
                            <span className="text-sm font-semibold" style={{ color: currentItem.color }}>{currentItem.label}</span>
                            <ChevronDown className="w-4 h-4 text-white" />
                          </button>

                          {orderStatusDropdownOpen && (
                            <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] shadow-2xl">
                              {statusItems.map((status) => (
                                <button
                                  key={status.value}
                                  type="button"
                                  onClick={() => {
                                    setForm((f) => ({ ...f, order_status: status.value }))
                                    setOrderStatusDropdownOpen(false)
                                  }}
                                  className={`w-full px-4 py-3 text-left text-sm font-medium transition-colors ${
                                    currentValue === status.value ? 'bg-[var(--border)]/20' : 'hover:bg-[var(--gold-primary)]/10'
                                  }`}
                                >
                                  <span className="text-white">{status.label}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </div>
                  <p className="mt-3 text-[var(--text-muted)] text-sm leading-relaxed">
                    Choose the current order status for this order and save it with Update Status.
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={closeModal}
                    className="flex-1 px-4 py-3 bg-[var(--surface-dark)] border border-[var(--border)] rounded-lg text-white font-semibold hover:border-[var(--gold-primary)]/50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!form.order_status) return
                      setIsSaving(true)
                      try {
                        await adminApi.updateOrder(modal.data.order_id, { status: form.order_status })
                        showToast(`Order status updated to ${form.order_status}!`)
                        fetchOrders()
                        closeModal()
                      } catch (e) {
                        showToast(e.message, 'error')
                      } finally {
                        setIsSaving(false)
                      }
                    }}
                    disabled={isSaving || !form.order_status}
                    className={`flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg text-white font-semibold hover:shadow-[0_0_20px_rgba(147,51,234,0.4)] transition-all flex items-center justify-center gap-2 ${
                      isSaving || !form.order_status ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Update Status
                      </>
                    )}
                  </button>
                </div>
              </div>
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
