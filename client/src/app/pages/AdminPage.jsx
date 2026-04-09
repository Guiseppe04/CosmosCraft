import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Users, Package, ShoppingBag, Calendar, Settings, Search,
  Filter, MoreVertical, Edit, Trash2, Eye, BarChart3,
  PieChart, Activity, ArrowUpRight, ArrowDownRight, Clock,
  CheckCircle, XCircle, Plus, RefreshCw, X,
  MessageSquare, Briefcase, ChevronLeft, ChevronRight,
  User, Guitar, Layers, Shield, Tag, AlertCircle, DollarSign,
  Save, TrendingUp, TrendingDown, UsersRound, CreditCard, Mail,
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell } from 'recharts'
import { useAuth } from '../context/AuthContext'
import { Topbar } from '../components/admin/Topbar'
import { MessagePanel } from '../components/admin/MessagePanel'
import { ProjectProgress, ProgressBadge } from '../components/admin/ProjectProgress'
import { formatCurrency } from '../utils/formatCurrency'
import { adminApi } from '../utils/adminApi'

const VALID_ROLES = ['customer', 'staff', 'admin', 'super_admin']
const GUITAR_TYPES = ['acoustic', 'electric', 'bass']

export function AdminPage() {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'super_admin'

  const [activeTab, setActiveTab] = useState('dashboard')
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [toast, setToast] = useState(null)

  // Modal state
  const [modal, setModal] = useState({ open: false, type: null, data: null })

  // Data state
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [guitars, setGuitars] = useState([])
  const [parts, setParts] = useState([])
  const [users, setUsers] = useState([])
  const [orders, setOrders] = useState([])
  const [projects, setProjects] = useState([])
  const [appointments, setAppointments] = useState([])
  const [salesReport, setSalesReport] = useState(null)

  // Form state for modals
  const [form, setForm] = useState({})
  const [formErrors, setFormErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)

  // Message panel
  const [messagePanelOpen, setMessagePanelOpen] = useState(false)
  const [selectedConversation, setSelectedConversation] = useState(null)

  // ── Toast ──────────────────────────────────────────────────────────────────
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    try {
      const res = await adminApi.getProducts({ search: searchQuery })
      setProducts(res.data || [])
    } catch (e) { showToast(e.message, 'error') }
  }, [searchQuery])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await adminApi.getCategories()
      setCategories(res.data || [])
    } catch {}
  }, [])

  const fetchGuitars = useCallback(async () => {
    try {
      const res = await adminApi.getCustomizations({ search: searchQuery })
      setGuitars(res.data || [])
    } catch (e) { showToast(e.message, 'error') }
  }, [searchQuery])

  const fetchParts = useCallback(async () => {
    try {
      const res = await adminApi.getParts()
      setParts(res.data || [])
    } catch (e) { showToast(e.message, 'error') }
  }, [])

  const fetchUsers = useCallback(async () => {
    try {
      const res = await adminApi.getUsers({ search: searchQuery })
      setUsers(res.data || [])
    } catch (e) { showToast(e.message, 'error') }
  }, [searchQuery])

  const fetchOrders = useCallback(async () => {
    try {
      const res = await adminApi.getOrders({ search: searchQuery })
      setOrders(res.data || [])
    } catch (e) { showToast(e.message, 'error') }
  }, [searchQuery])

  const fetchProjects = useCallback(async () => {
    try {
      const res = await adminApi.getProjects({ search: searchQuery })
      setProjects(res.data || [])
    } catch (e) { showToast(e.message, 'error') }
  }, [searchQuery])

  const fetchAppointments = useCallback(async () => {
    try {
      const res = await adminApi.getAppointments({ search: searchQuery })
      setAppointments(res.data || [])
    } catch (e) { showToast(e.message, 'error') }
  }, [searchQuery])

  const fetchSalesReport = useCallback(async () => {
    try {
      // Mock data for demonstration
      const mockData = {
        totalGrossSales: 247850,
        totalTransactions: 156,
        averagePerTransaction: 1589.42,
        customizationOrders: 12,
        walkInSales: 145670,
        walkInTransactions: 89,
        walkInAvg: 1636.85,
        walkInPercentage: 58.7,
        onlineSales: 102180,
        onlineTransactions: 67,
        onlineAvg: 1525.07,
        onlinePercentage: 41.3,
        customizationSales: 45000,
        customizationTransactions: 12,
        customizationAvg: 3750.00,
        customizationPercentage: 18.1,
        dailySales: 12500,
        dailyTransactions: 8,
        weeklySales: 87500,
        weeklyTransactions: 52,
        monthlySales: 247850,
        monthlyTransactions: 156,
        bestSellingProducts: [
          { name: 'Custom Stratocaster', units: 15, revenue: 45000, category: 'Custom Guitar' },
          { name: 'Mahogany Body', units: 23, revenue: 34500, category: 'Guitar Part' },
          { name: 'Premium Pickups Set', units: 18, revenue: 27000, category: 'Accessories' },
          { name: 'Rosewood Fingerboard', units: 12, revenue: 18000, category: 'Guitar Part' },
          { name: 'Tremolo Bridge', units: 8, revenue: 12000, category: 'Hardware' }
        ],
        customizationTypes: [
          { name: 'Full Custom Build', count: 5 },
          { name: 'Body Only', count: 3 },
          { name: 'Neck Only', count: 2 },
          { name: 'Refinishing', count: 1 },
          { name: 'Hardware Upgrade', count: 1 }
        ],
        customizationRevenue: 45000,
        avgCustomization: 3750.00,
        walkInConversion: 85,
        onlineConversion: 72
      }
      setSalesReport(mockData)
      // Uncomment below when server endpoint is ready
      // const res = await adminApi.getSalesReport()
      // setSalesReport(res.data || {})
    } catch (e) {
      showToast(e.message, 'error')
      // Fallback to mock data on error
      setSalesReport({
        totalGrossSales: 0,
        totalTransactions: 0,
        averagePerTransaction: 0,
        customizationOrders: 0,
        walkInSales: 0,
        walkInTransactions: 0,
        walkInAvg: 0,
        walkInPercentage: 0,
        onlineSales: 0,
        onlineTransactions: 0,
        onlineAvg: 0,
        onlinePercentage: 0,
        customizationSales: 0,
        customizationTransactions: 0,
        customizationAvg: 0,
        customizationPercentage: 0,
        dailySales: 0,
        dailyTransactions: 0,
        weeklySales: 0,
        weeklyTransactions: 0,
        monthlySales: 0,
        monthlyTransactions: 0,
        bestSellingProducts: [],
        customizationTypes: [],
        customizationRevenue: 0,
        avgCustomization: 0,
        walkInConversion: 0,
        onlineConversion: 0
      })
    }
  }, [])

  // Load data when tab changes
  useEffect(() => {
    setSearchQuery('')
    if (activeTab === 'products-parts') { fetchProducts(); fetchCategories(); fetchParts() }
    if (activeTab === 'guitars') fetchGuitars()
    if (activeTab === 'users') fetchUsers()
    if (activeTab === 'orders') fetchOrders()
    if (activeTab === 'projects') fetchProjects()
    if (activeTab === 'appointments') fetchAppointments()
    if (activeTab === 'sales-report') fetchSalesReport()
  }, [activeTab])

  // Re-search on query change
  useEffect(() => {
    if (activeTab === 'products-parts') { fetchProducts(); fetchParts() }
    if (activeTab === 'guitars') fetchGuitars()
    if (activeTab === 'users') fetchUsers()
    if (activeTab === 'orders') fetchOrders()
    if (activeTab === 'projects') fetchProjects()
    if (activeTab === 'appointments') fetchAppointments()
  }, [searchQuery])

  const handleRefresh = () => {
    setIsLoading(true)
    const fetchers = {
      'products-parts': () => { fetchProducts(); fetchCategories(); fetchParts() },
      guitars: fetchGuitars,
      users: fetchUsers,
      orders: fetchOrders,
      projects: fetchProjects,
      appointments: fetchAppointments,
      'sales-report': fetchSalesReport,
    }
    const fn = fetchers[activeTab]
    if (fn) fn().finally(() => setIsLoading(false))
    else setIsLoading(false)
  }

  // ── Modal helpers ──────────────────────────────────────────────────────────
  const openModal = (type, data = null) => {
    setForm(data ? { ...data } : {})
    setFormErrors({})
    setModal({ open: true, type, data })
  }
  const closeModal = () => setModal({ open: false, type: null, data: null })

  // ── CRUD handlers ──────────────────────────────────────────────────────────

  // Products
  const saveProduct = async () => {
    setIsSaving(true)
    try {
      if (modal.data?.product_id) {
        await adminApi.updateProduct(modal.data.product_id, form)
        showToast('Product updated!')
      } else {
        await adminApi.createProduct(form)
        showToast('Product created!')
      }
      fetchProducts()
      closeModal()
    } catch (e) { showToast(e.message, 'error') }
    finally { setIsSaving(false) }
  }

  const deleteProduct = async (id) => {
    if (!confirm('Deactivate this product?')) return
    try {
      await adminApi.deleteProduct(id)
      showToast('Product deactivated')
      fetchProducts()
    } catch (e) { showToast(e.message, 'error') }
  }

  // Categories
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
      fetchCategories()
      closeModal()
    } catch (e) { showToast(e.message, 'error') }
    finally { setIsSaving(false) }
  }

  const deleteCategory = async (id) => {
    if (!confirm('Delete this category?')) return
    try {
      await adminApi.deleteCategory(id)
      showToast('Category deleted')
      fetchCategories()
    } catch (e) { showToast(e.message, 'error') }
  }

  // Parts
  const savePart = async () => {
    setIsSaving(true)
    try {
      if (modal.data?.part_id) {
        await adminApi.updatePart(modal.data.part_id, form)
        showToast('Part updated!')
      } else {
        await adminApi.createPart(form)
        showToast('Part created!')
      }
      fetchParts()
      closeModal()
    } catch (e) { showToast(e.message, 'error') }
    finally { setIsSaving(false) }
  }

  const deletePart = async (id) => {
    if (!confirm('Delete this part?')) return
    try {
      await adminApi.deletePart(id)
      showToast('Part deleted')
      fetchParts()
    } catch (e) { showToast(e.message, 'error') }
  }

  // Customizations
  const deleteGuitar = async (id) => {
    if (!confirm('Delete this customization? This cannot be undone.')) return
    try {
      await adminApi.deleteCustomization(id)
      showToast('Customization deleted')
      fetchGuitars()
    } catch (e) { showToast(e.message, 'error') }
  }

  // Users
  const changeUserRole = async (userId, role) => {
    try {
      await adminApi.updateUserRole(userId, role)
      showToast('Role updated!')
      fetchUsers()
    } catch (e) { showToast(e.message, 'error') }
  }

  const toggleUserStatus = async (userId, currentStatus) => {
    try {
      await adminApi.updateUserStatus(userId, !currentStatus)
      showToast(`User ${!currentStatus ? 'activated' : 'deactivated'}`)
      fetchUsers()
    } catch (e) { showToast(e.message, 'error') }
  }

  // Orders
  const saveOrder = async () => {
    setIsSaving(true)
    try {
      if (modal.data?.order_id) {
        await adminApi.updateOrder(modal.data.order_id, form)
        showToast('Order updated!')
      }
      fetchOrders()
      closeModal()
    } catch (e) { showToast(e.message, 'error') }
    finally { setIsSaving(false) }
  }

  const updateOrderStatus = async (orderId, status) => {
    try {
      await adminApi.updateOrder(orderId, { status })
      showToast(`Order ${status.toLowerCase()}!`)
      fetchOrders()
    } catch (e) { showToast(e.message, 'error') }
  }

  const cancelOrder = async (id) => {
    if (!confirm('Cancel this order?')) return
    try {
      await adminApi.cancelOrder(id)
      showToast('Order cancelled')
      fetchOrders()
    } catch (e) { showToast(e.message, 'error') }
  }

  // Projects
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
      fetchProjects()
      closeModal()
    } catch (e) { showToast(e.message, 'error') }
    finally { setIsSaving(false) }
  }

  const deleteProject = async (id) => {
    if (!confirm('Delete this project?')) return
    try {
      await adminApi.deleteProject(id)
      showToast('Project deleted')
      fetchProjects()
    } catch (e) { showToast(e.message, 'error') }
  }

  const assignProjectTeam = async (projectId, userIds) => {
    try {
      await adminApi.assignTeam(projectId, userIds)
      showToast('Team assigned!')
      fetchProjects()
    } catch (e) { showToast(e.message, 'error') }
  }

  // Appointments
  const saveAppointment = async () => {
    setIsSaving(true)
    try {
      if (modal.data?.appointment_id) {
        await adminApi.updateAppointment(modal.data.appointment_id, form)
        showToast('Appointment updated!')
      } else {
        await adminApi.createAppointment(form)
        showToast('Appointment created!')
      }
      fetchAppointments()
      closeModal()
    } catch (e) { showToast(e.message, 'error') }
    finally { setIsSaving(false) }
  }

  const deleteAppointment = async (id) => {
    if (!confirm('Cancel this appointment?')) return
    try {
      await adminApi.deleteAppointment(id)
      showToast('Appointment cancelled')
      fetchAppointments()
    } catch (e) { showToast(e.message, 'error') }
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  const getStatusBadge = (status) => {
    const map = {
      true: 'bg-green-500/20 text-green-400 border-green-500/30',
      Active: 'bg-green-500/20 text-green-400 border-green-500/30',
      Inactive: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      Completed: 'bg-green-500/20 text-green-400 border-green-500/30',
      'In Progress': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      Pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      Confirmed: 'bg-green-500/20 text-green-400 border-green-500/30',
      Cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
      'Low Stock': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      'Out of Stock': 'bg-red-500/20 text-red-400 border-red-500/30',
    }
    return map[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }

  const inputCls = 'w-full px-4 py-3 bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl text-[var(--text-light)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] text-sm'
  const labelCls = 'block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-2'

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'dashboard',  label: 'Dashboard',       icon: BarChart3 },
    { id: 'products-parts', label: 'Guitar Parts & Products', icon: Layers },
    { id: 'categories', label: 'Categories',       icon: Tag },
    { id: 'guitars',    label: 'Customizations',   icon: Guitar },
    { id: 'orders',     label: 'Orders',           icon: ShoppingBag },
    { id: 'inventory',  label: 'Inventory',        icon: Activity },
    { id: 'sales-report', label: 'Sales Report',   icon: PieChart },
    { id: 'projects',   label: 'Projects',         icon: Briefcase },
    { id: 'appointments', label: 'Appointments',   icon: Calendar },
    { id: 'users',      label: 'Users & RBAC',     icon: Shield },
  ]

  // ── Return JSX ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }}
            className={`fixed top-24 right-6 z-[200] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-semibold border ${
              toast.type === 'error'
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : 'bg-green-500/10 border-green-500/30 text-green-400'
            }`}
          >
            {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-screen bg-[#1E201E] border-r border-[#5A5555] transition-all duration-300 z-40 ${sidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-6 w-6 h-6 bg-[#1E201E] border border-[#5A5555] rounded-full flex items-center justify-center hover:bg-[#FFD700] hover:border-[#FFD700] transition-all"
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
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-[#FFD700] text-[#1E201E] font-bold shadow-lg shadow-[#FFD700]/20'
                    : 'text-[#F5F5F5] hover:bg-[#5A5555] hover:text-[#F5F5F5]'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${activeTab === tab.id ? 'text-[#1E201E]' : 'text-[#FFD700]'}`} />
                {!sidebarCollapsed && <span className={`truncate ${activeTab === tab.id ? 'text-[#1E201E]' : 'text-[#F5F5F5]'}`}>{tab.label}</span>}
              </button>
            )
          })}
        </nav>

        {/* Admin badge */}
        <div className={`absolute bottom-4 left-0 right-0 px-4`}>
          <div className={`flex items-center gap-3 p-4 rounded-2xl bg-[#1E201E] border border-[#5A5555] ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#FFD700] to-[#FFED4E] flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-[#1E201E]" />
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-[#F5F5F5] font-semibold text-sm truncate">{user?.firstName || 'Admin'}</p>
                <p className="text-[#FFD700] text-xs capitalize">{user?.role?.replace('_', ' ')}</p>
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
            {/* Search */}
            {['products-parts', 'guitars', 'users', 'categories', 'orders', 'projects', 'appointments'].includes(activeTab) && (
              <div className="relative max-w-sm w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder={`Search ${activeTab}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl text-[var(--text-light)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] text-sm"
                />
              </div>
            )}
            <div className="flex items-center gap-2 ml-auto">
              {activeTab === 'products-parts' && (
                <>
                  <button onClick={handleRefresh} className="p-2 border border-[var(--border)] rounded-lg hover:border-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/10 transition-all">
                    <RefreshCw className={`w-4 h-4 text-[var(--text-muted)] ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                  
                  <button onClick={() => openModal('product')} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black rounded-xl font-semibold text-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all">
                    <Plus className="w-4 h-4" /> Add Product
                  </button>
                  <button onClick={() => openModal('part')} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black rounded-xl font-semibold text-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all">
                    <Plus className="w-4 h-4" /> Add Part
                  </button>
                </>
              )}
              {activeTab === 'orders' && (
                <>
                  <button onClick={handleRefresh} className="p-2 border border-[var(--border)] rounded-lg hover:border-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/10 transition-all">
                    <RefreshCw className={`w-4 h-4 text-[var(--text-muted)] ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                  
                </>
              )}
              {activeTab === 'users' && (
                <>
                  <button onClick={handleRefresh} className="p-2 border border-[var(--border)] rounded-lg hover:border-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/10 transition-all">
                    <RefreshCw className={`w-4 h-4 text-[var(--text-muted)] ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                  
                </>
              )}
              {activeTab === 'categories' && (
                <>
                  <button onClick={handleRefresh} className="p-2 border border-[var(--border)] rounded-lg hover:border-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/10 transition-all">
                    <RefreshCw className={`w-4 h-4 text-[var(--text-muted)] ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                  
                  <button onClick={() => openModal('category')} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black rounded-xl font-semibold text-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all">
                    <Plus className="w-4 h-4" /> Add Category
                  </button>
                </>
              )}

              {activeTab === 'guitars' && (
                <>
                  <button onClick={handleRefresh} className="p-2 border border-[var(--border)] rounded-lg hover:border-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/10 transition-all">
                    <RefreshCw className={`w-4 h-4 text-[var(--text-muted)] ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                  
                  <button onClick={() => openModal('guitar_view')} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black rounded-xl font-semibold text-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all">
                    <Eye className="w-4 h-4" /> View Customizations
                  </button>
                </>
              )}
              {activeTab === 'sales-report' && (
                <>
                  <button onClick={handleRefresh} className="p-2 border border-[var(--border)] rounded-lg hover:border-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/10 transition-all">
                    <RefreshCw className={`w-4 h-4 text-[var(--text-muted)] ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                </>
              )}
              {activeTab === 'projects' && (
                <>
                  <button onClick={handleRefresh} className="p-2 border border-[var(--border)] rounded-lg hover:border-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/10 transition-all">
                    <RefreshCw className={`w-4 h-4 text-[var(--text-muted)] ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                  
                  <button onClick={() => openModal('project')} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black rounded-xl font-semibold text-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all">
                    <Plus className="w-4 h-4" /> New Project
                  </button>
                </>
              )}
              {activeTab === 'appointments' && (
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-2 px-4 py-2.5 bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl text-white text-sm hover:border-[var(--gold-primary)]/50 transition-all">
                    <Calendar className="w-4 h-4" /> Calendar View
                  </button>
                  <button onClick={handleRefresh} className="p-2 border border-[var(--border)] rounded-lg hover:border-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/10 transition-all">
                    <RefreshCw className={`w-4 h-4 text-[var(--text-muted)] ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                  
                  <button onClick={() => openModal('appointment')} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black rounded-xl font-semibold text-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all">
                    <Plus className="w-4 h-4" /> Add Appointment
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── GUITAR PARTS & PRODUCTS TAB ───────────────────────────────── */}
          {activeTab === 'products-parts' && (
            <motion.div key="products-parts" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              {products.length === 0 ? (
                <EmptyState icon={Package} label="No products found" action={() => openModal('product')} actionLabel="Add First Product" />
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {products.map((p) => (
                    <motion.div key={p.product_id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 hover:border-[var(--gold-primary)]/50 transition-all"
                    >
                      {p.primary_image && (
                        <img src={p.primary_image} alt={p.name} className="w-full h-36 object-cover rounded-xl mb-4 border border-white/5" />
                      )}
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-[var(--text-muted)] text-xs font-mono">{p.sku}</p>
                          <h3 className="text-white font-semibold">{p.name}</h3>
                          <p className="text-[var(--text-muted)] text-xs">{p.category_name || 'Uncategorised'}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${p.is_active ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                          {p.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--border)]">
                        <span className="text-[var(--gold-primary)] font-bold">{formatCurrency(p.price, true)}</span>
                        <div className="flex gap-2">
                          <button onClick={() => openModal('product', p)} className="p-1.5 hover:bg-[var(--gold-primary)]/10 rounded transition-colors">
                            <Eye className="w-4 h-4 text-[var(--text-muted)]" />
                          </button>
                          <button onClick={() => openModal('product_edit', p)} className="p-1.5 hover:bg-[var(--gold-primary)]/10 rounded transition-colors">
                            <Edit className="w-4 h-4 text-[var(--text-muted)]" />
                          </button>
                          <button onClick={() => deleteProduct(p.product_id)} className="p-1.5 hover:bg-red-500/10 rounded transition-colors">
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Guitar Parts Section */}
              <h3 className="text-white text-xl font-semibold mb-4 mt-8">Guitar Parts</h3>
              <AdminTable
                columns={['Part Name', 'Linked Product', 'Qty', 'Price', 'Actions']}
                rows={parts}
                renderRow={(part) => (
                  <>
                    <td className="py-4 px-6 text-white font-semibold">{part.part_name}</td>
                    <td className="py-4 px-6 text-[var(--text-muted)]">{part.product_name || '—'}</td>
                    <td className="py-4 px-6 text-white">{part.quantity}</td>
                    <td className="py-4 px-6 text-[var(--gold-primary)] font-bold">{formatCurrency(part.price, true)}</td>
                    <td className="py-4 px-6">
                      <div className="flex gap-2">
                        <button onClick={() => openModal('part', part)} className="p-1.5 hover:bg-[var(--gold-primary)]/10 rounded">
                          <Edit className="w-4 h-4 text-[var(--text-muted)]" />
                        </button>
                        <button onClick={() => deletePart(part.part_id)} className="p-1.5 hover:bg-red-500/10 rounded">
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </>
                )}
                empty={<EmptyState icon={Layers} label="No guitar parts yet" action={() => openModal('part')} actionLabel="Add Part" />}
              />
            </motion.div>
          )}

          {/* ── CATEGORIES TAB ───────────────────────────────────────────── */}
          {activeTab === 'categories' && (
            <motion.div key="categories" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <AdminTable
                columns={['Name', 'Slug', 'Parent', 'Status', 'Actions']}
                rows={categories}
                renderRow={(cat) => (
                  <>
                    <td className="py-4 px-6 text-white font-semibold">{cat.name}</td>
                    <td className="py-4 px-6 text-[var(--text-muted)] font-mono text-sm">{cat.slug}</td>
                    <td className="py-4 px-6 text-[var(--text-muted)]">{cat.parent_name || '—'}</td>
                    <td className="py-4 px-6">
                      <StatusBadge active={cat.is_active} />
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex gap-2">
                        <button onClick={() => openModal('category', cat)} className="p-1.5 hover:bg-[var(--gold-primary)]/10 rounded">
                          <Edit className="w-4 h-4 text-[var(--text-muted)]" />
                        </button>
                        <button onClick={() => deleteCategory(cat.category_id)} className="p-1.5 hover:bg-red-500/10 rounded">
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

          {/* ── GUITAR CUSTOMIZATIONS TAB ─────────────────────────────────── */}
          {activeTab === 'guitars' && (
            <motion.div key="guitars" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <AdminTable
                columns={['Customer', 'Guitar', 'Type', 'Price', 'Saved', 'Actions']}
                rows={guitars}
                renderRow={(g) => (
                  <>
                    <td className="py-4 px-6">
                      <p className="text-white font-semibold">{g.user_name || '—'}</p>
                      <p className="text-[var(--text-muted)] text-xs">{g.user_email || '—'}</p>
                    </td>
                    <td className="py-4 px-6 text-white">{g.name || 'Untitled'}</td>
                    <td className="py-4 px-6">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] border border-[var(--gold-primary)]/30 capitalize">
                        {g.guitar_type}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-[var(--gold-primary)] font-bold">{formatCurrency(g.total_price, true)}</td>
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


          {activeTab === 'users' && (
            <motion.div key="users" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <AdminTable
                columns={['User', 'Role', 'Status', 'Joined', 'Actions']}
                rows={users}
                renderRow={(u) => (
                  <>
                    <td className="py-4 px-6">
                      <p className="text-white font-semibold">{u.first_name} {u.last_name}</p>
                      <p className="text-[var(--text-muted)] text-xs">{u.email}</p>
                    </td>
                    <td className="py-4 px-6">
                      {isSuperAdmin ? (
                        <select
                          value={u.role}
                          onChange={(e) => changeUserRole(u.user_id, e.target.value)}
                          className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-[var(--gold-primary)]"
                        >
                          {VALID_ROLES.map(r => (
                            <option key={r} value={r}>{r.replace('_', ' ')}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] border border-[var(--gold-primary)]/30 capitalize">
                          {u.role?.replace('_', ' ')}
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6"><StatusBadge active={u.is_active} /></td>
                    <td className="py-4 px-6 text-[var(--text-muted)] text-sm">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                    <td className="py-4 px-6">
                      <button
                        onClick={() => toggleUserStatus(u.user_id, u.is_active)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          u.is_active
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

          {/* ── ORDERS TAB ───────────────────────────────────────────────────── */}
          {activeTab === 'orders' && (
            <motion.div key="orders" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              {orders.length === 0 ? (
                <EmptyState icon={ShoppingBag} label="No orders found" />
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <motion.div key={order.order_id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 hover:border-[var(--gold-primary)]/50 transition-all"
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <p className="text-white font-semibold">Order #{order.order_number || order.order_id}</p>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(order.status)}`}>
                              {order.status || 'Pending'}
                            </span>
                          </div>
                          <p className="text-[var(--text-muted)] text-sm">
                            {order.customer_name || order.user_name || 'Customer'} • {order.items?.length || 0} items
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[var(--gold-primary)] font-bold text-lg">{formatCurrency(order.total, true)}</p>
                          <p className="text-[var(--text-muted)] text-xs">{order.created_at ? new Date(order.created_at).toLocaleDateString() : '—'}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-4 border-t border-[var(--border)]">
                        <button onClick={() => openModal('order_view', order)} className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-white text-sm hover:border-[var(--gold-primary)]/50 transition-all">
                          <Eye className="w-4 h-4" /> View
                        </button>
                        {order.status === 'Pending' && (
                          <button onClick={() => updateOrderStatus(order.order_id, 'Confirmed')} className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm hover:bg-green-500/20 transition-all">
                            <CheckCircle className="w-4 h-4" /> Confirm
                          </button>
                        )}
                        {order.status === 'Confirmed' && (
                          <button onClick={() => updateOrderStatus(order.order_id, 'Completed')} className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400 text-sm hover:bg-blue-500/20 transition-all">
                            <CheckCircle className="w-4 h-4" /> Complete
                          </button>
                        )}
                        {order.status !== 'Cancelled' && order.status !== 'Completed' && (
                          <button onClick={() => cancelOrder(order.order_id)} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm hover:bg-red-500/20 transition-all">
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

          {/* ── PROJECTS TAB ─────────────────────────────────────────────────── */}
          {activeTab === 'projects' && (
            <motion.div key="projects" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              {projects.length === 0 ? (
                <EmptyState icon={Briefcase} label="No projects yet" action={() => openModal('project')} actionLabel="Create Project" />
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {projects.map((project) => (
                    <motion.div key={project.project_id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 hover:border-[var(--gold-primary)]/50 transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-white font-semibold">{project.name || 'Untitled Project'}</h3>
                          <p className="text-[var(--text-muted)] text-xs">{project.customer_name || project.user_name || '—'}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(project.status)}`}>
                          {project.status || 'Pending'}
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
                      <div className="flex gap-2 pt-4 border-t border-[var(--border)]">
                        <button onClick={() => openModal('project', project)} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-white text-sm hover:border-[var(--gold-primary)]/50 transition-all">
                          <Edit className="w-4 h-4" /> Edit
                        </button>
                        <button onClick={() => openModal('project_team', project)} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-white text-sm hover:border-[var(--gold-primary)]/50 transition-all">
                          <Users className="w-4 h-4" /> Team
                        </button>
                        <button onClick={() => deleteProject(project.project_id)} className="p-2 hover:bg-red-500/10 rounded-lg transition-all">
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

{/* ── APPOINTMENTS TAB ──────────────────────────────────────────────── */}
          {activeTab === 'appointments' && (
            <motion.div key="appointments" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              {/* Appointments Table */}
              {appointments.length === 0 ? (
                <EmptyState icon={Calendar} label="No appointments scheduled" action={() => openModal('appointment')} actionLabel="Book Appointment" />
              ) : (
                <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-[var(--bg-primary)] border-b border-[var(--border)]">
                        <tr>
                          <th className="text-left py-4 px-6 text-[var(--text-muted)] font-medium text-xs uppercase tracking-wider">ID</th>
                          <th className="text-left py-4 px-6 text-[var(--text-muted)] font-medium text-xs uppercase tracking-wider">Title</th>
                          <th className="text-left py-4 px-6 text-[var(--text-muted)] font-medium text-xs uppercase tracking-wider">Customer</th>
                          <th className="text-left py-4 px-6 text-[var(--text-muted)] font-medium text-xs uppercase tracking-wider">Date & Time</th>
                          <th className="text-left py-4 px-6 text-[var(--text-muted)] font-medium text-xs uppercase tracking-wider">Type</th>
                          <th className="text-left py-4 px-6 text-[var(--text-muted)] font-medium text-xs uppercase tracking-wider">Status</th>
                          <th className="text-left py-4 px-6 text-[var(--text-muted)] font-medium text-xs uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {appointments.map((apt, i) => {
                          const statusColors = {
                            Scheduled: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                            Completed: 'bg-green-500/20 text-green-400 border-green-500/30',
                            Cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
                            'No Show': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
                          }
                          const statusClass = statusColors[apt.status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                          return (
                            <tr key={apt.appointment_id} className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-primary)]/50 transition-colors">
                              <td className="py-4 px-6 text-[var(--text-muted)] font-mono text-sm">#{i + 1}</td>
                              <td className="py-4 px-6">
                                <p className="text-white font-medium">{apt.title || 'Appointment'}</p>
                                {apt.notes && <p className="text-[var(--text-muted)] text-xs truncate max-w-xs">{apt.notes}</p>}
                              </td>
                              <td className="py-4 px-6">
                                <p className="text-white">{apt.customer_name || apt.user_name || '—'}</p>
                                <p className="text-[var(--text-muted)] text-xs">{apt.customer_email || '—'}</p>
                              </td>
                              <td className="py-4 px-6">
                                <p className="text-white">{apt.date ? new Date(apt.date).toLocaleDateString() : '—'}</p>
                                <p className="text-[var(--text-muted)] text-sm">{apt.time || '—'}</p>
                              </td>
                              <td className="py-4 px-6 text-[var(--text-muted)]">Consultation</td>
                              <td className="py-4 px-6">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${statusClass}`}>
                                  {apt.status || 'Scheduled'}
                                </span>
                              </td>
                              <td className="py-4 px-6">
                                <div className="flex gap-2">
                                  <button onClick={() => openModal('appointment', apt)} className="p-1.5 hover:bg-[var(--gold-primary)]/10 rounded transition-colors">
                                    <Edit className="w-4 h-4 text-[var(--text-muted)]" />
                                  </button>
                                  <button onClick={() => deleteAppointment(apt.appointment_id)} className="p-1.5 hover:bg-red-500/10 rounded transition-colors">
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

          {/* ── DASHBOARD TAB (professional analytics layout) ─────────────────────── */}
          {activeTab === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="space-y-6">
                <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl p-6">
                  <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
                    <div>
                      <p className="text-[var(--gold-primary)] text-sm font-semibold uppercase tracking-[0.3em] mb-3">Admin Dashboard</p>
                      <h1 className="text-3xl md:text-4xl font-bold text-white">Welcome back, {user?.firstName || 'Admin'}</h1>
                      <p className="text-[var(--text-muted)] mt-3 max-w-2xl">Monitor sales performance, inventory health, and customer activity from a clean, modern dashboard layout.</p>
                    </div>
                    <div className="flex flex-wrap gap-3 items-center">
                      <button onClick={() => fetchOrders()} className="inline-flex items-center gap-2 rounded-2xl bg-[var(--gold-primary)] px-4 py-2 text-sm font-semibold text-black hover:bg-[var(--gold-secondary)] transition-all">
                        <RefreshCw className="w-4 h-4" /> Refresh data
                      </button>
                      <button className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border)] px-4 py-2 text-sm font-semibold text-white hover:border-[var(--gold-primary)] transition-all">
                        New Report
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-8">
                    <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-primary)] p-5">
                      <p className="text-[var(--text-muted)] text-sm">Revenue this month</p>
                      <p className="mt-3 text-3xl font-bold text-white">₱247,850</p>
                      <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-green-500/10 px-3 py-1 text-sm text-green-400">+8.2% vs last month</div>
                    </div>
                    <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-primary)] p-5">
                      <p className="text-[var(--text-muted)] text-sm">Total orders</p>
                      <p className="mt-3 text-3xl font-bold text-white">{orders.length}</p>
                      <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-sm text-blue-400">Order volume up</div>
                    </div>
                    <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-primary)] p-5">
                      <p className="text-[var(--text-muted)] text-sm">Active projects</p>
                      <p className="mt-3 text-3xl font-bold text-white">{projects.length}</p>
                      <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-purple-500/10 px-3 py-1 text-sm text-purple-400">Project pace strong</div>
                    </div>
                    <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-primary)] p-5">
                      <p className="text-[var(--text-muted)] text-sm">Open appointments</p>
                      <p className="mt-3 text-3xl font-bold text-white">{appointments.length}</p>
                      <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--gold-primary)]/10 px-3 py-1 text-sm text-[var(--gold-primary)]">Action required</div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.8fr_1.2fr]">
                  <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                      <div>
                        <h2 className="text-white text-2xl font-semibold">Performance Trends</h2>
                        <p className="text-[var(--text-muted)] mt-1">Review revenue and order performance across the last six months.</p>
                      </div>
                      <div className="flex flex-wrap gap-3 items-center">
                        <span className="rounded-full border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-muted)]">Last 6 months</span>
                        <span className="rounded-full bg-[var(--gold-primary)]/10 px-3 py-2 text-sm text-[var(--gold-primary)]">Growth</span>
                      </div>
                    </div>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={[
                          { month: 'Jan', revenue: 42000, orders: 24 },
                          { month: 'Feb', revenue: 38000, orders: 21 },
                          { month: 'Mar', revenue: 51000, orders: 28 },
                          { month: 'Apr', revenue: 47000, orders: 25 },
                          { month: 'May', revenue: 56000, orders: 32 },
                          { month: 'Jun', revenue: 62000, orders: 35 },
                        ]}>
                          <defs>
                            <linearGradient id="dashboardTrend" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#d4af37" stopOpacity={0.25}/>
                              <stop offset="95%" stopColor="#d4af37" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                          <XAxis dataKey="month" stroke="#b0b4bc" fontSize={12} />
                          <YAxis stroke="#b0b4bc" fontSize={12} tickFormatter={(value) => `₱${value / 1000}k`} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#131313', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px' }}
                            labelStyle={{ color: '#f8fafc' }}
                            itemStyle={{ color: '#d4af37' }}
                            formatter={(value) => [`₱${value.toLocaleString()}`, 'Revenue']}
                          />
                          <Area type="monotone" dataKey="revenue" stroke="#d4af37" strokeWidth={2} fill="url(#dashboardTrend)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                      <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
                        <p className="text-[var(--text-muted)] text-sm">Best month</p>
                        <p className="mt-2 text-white text-xl font-semibold">Jun</p>
                      </div>
                      <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
                        <p className="text-[var(--text-muted)] text-sm">Avg order value</p>
                        <p className="mt-2 text-white text-xl font-semibold">₱1,589</p>
                      </div>
                      <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
                        <p className="text-[var(--text-muted)] text-sm">New clients</p>
                        <p className="mt-2 text-white text-xl font-semibold">14</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-6">
                      <div className="flex items-center justify-between mb-5">
                        <div>
                          <h3 className="text-white text-lg font-semibold">Operational Pulse</h3>
                          <p className="text-[var(--text-muted)] text-sm">Quick measures of sales, inventory and client activity.</p>
                        </div>
                        <span className="text-[var(--gold-primary)] text-sm font-semibold">Real-time</span>
                      </div>
                      <div className="space-y-4">
                        {[
                          { label: 'Inventory health', value: '92%', status: 'Stable', icon: CheckCircle },
                          { label: 'Pending orders', value: orders.length, status: 'Processing', icon: Package },
                          { label: 'Support tickets', value: 5, status: 'Attention', icon: MessageSquare },
                        ].map((item) => {
                          const Icon = item.icon
                          return (
                            <div key={item.label} className="flex items-center justify-between rounded-3xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
                              <div className="flex items-center gap-4">
                                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--gold-primary)]/15">
                                  <Icon className="w-5 h-5 text-[var(--gold-primary)]" />
                                </div>
                                <div>
                                  <p className="text-white font-semibold">{item.label}</p>
                                  <p className="text-[var(--text-muted)] text-sm">{item.status}</p>
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
                          <p className="text-[var(--text-muted)] text-sm">Focus on your next customer meetings.</p>
                        </div>
                        <button onClick={() => setActiveTab('appointments')} className="text-[var(--gold-primary)] text-sm font-semibold hover:underline">View all</button>
                      </div>
                      {appointments.length === 0 ? (
                        <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-primary)] p-8 text-center text-[var(--text-muted)]">No upcoming appointments.</div>
                      ) : (
                        <div className="space-y-3">
                          {appointments.slice(0, 4).map((apt) => (
                            <div key={apt.appointment_id} className="rounded-3xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="text-white font-semibold">{apt.title || 'Appointment'}</p>
                                  <p className="text-[var(--text-muted)] text-sm">{apt.customer_name || apt.user_name || 'Customer'}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[var(--gold-primary)] font-semibold">{apt.time || 'TBA'}</p>
                                  <p className="text-[var(--text-muted)] text-xs">{apt.date ? new Date(apt.date).toLocaleDateString() : '—'}</p>
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

          {/* ── INVENTORY TAB ────────────────────────────────────────────────── */}
          {activeTab === 'inventory' && (
            <motion.div key="inventory" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="text-center py-12">
                <Activity className="w-16 h-16 text-[var(--gold-primary)] mx-auto mb-4" />
                <h2 className="text-white text-xl font-semibold mb-2">Inventory Management</h2>
                <p className="text-[var(--text-muted)]">Track and manage your guitar parts and materials inventory.</p>
              </div>
            </motion.div>
          )}

          {/* ── SALES REPORT TAB ────────────────────────────────────────────── */}
          {activeTab === 'sales-report' && (
            <motion.div key="sales-report" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              {salesReport ? (
                <div className="space-y-8">
                  {/* Report Header */}
                  <div className="text-center border-b border-[var(--border)] pb-6">
                    <h1 className="text-white text-3xl font-bold mb-2">Sales Performance Report</h1>
                    <p className="text-[var(--text-muted)] text-lg">Comprehensive analysis of sales data and customer behavior</p>
                    <p className="text-[var(--text-muted)] text-sm mt-2">Report generated on {new Date().toLocaleDateString()}</p>
                  </div>

                  {/* Key Metrics Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-gradient-to-br from-[var(--gold-primary)]/10 to-[var(--gold-secondary)]/5 border border-[var(--gold-primary)]/30 rounded-2xl p-6 text-center">
                      <DollarSign className="w-8 h-8 text-[var(--gold-primary)] mx-auto mb-3" />
                      <h3 className="text-white text-sm font-medium mb-1">Total Gross Sales</h3>
                      <p className="text-[var(--gold-primary)] text-2xl font-bold">{formatCurrency(salesReport.totalGrossSales || 0, true)}</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/30 rounded-2xl p-6 text-center">
                      <ShoppingBag className="w-8 h-8 text-blue-400 mx-auto mb-3" />
                      <h3 className="text-white text-sm font-medium mb-1">Total Transactions</h3>
                      <p className="text-blue-400 text-2xl font-bold">{salesReport.totalTransactions || 0}</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/30 rounded-2xl p-6 text-center">
                      <TrendingUp className="w-8 h-8 text-green-400 mx-auto mb-3" />
                      <h3 className="text-white text-sm font-medium mb-1">Avg per Transaction</h3>
                      <p className="text-green-400 text-2xl font-bold">{formatCurrency(salesReport.averagePerTransaction || 0, true)}</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/30 rounded-2xl p-6 text-center">
                      <BarChart3 className="w-8 h-8 text-purple-400 mx-auto mb-3" />
                      <h3 className="text-white text-sm font-medium mb-1">Customization Orders</h3>
                      <p className="text-purple-400 text-2xl font-bold">{salesReport.customizationOrders || 0}</p>
                    </div>
                  </div>

                  {/* Sales Comparison Chart */}
                  <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
                    <h2 className="text-white text-xl font-semibold mb-6 text-center">Sales Breakdown by Category</h2>
                    <div className="h-80 mb-6">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            {
                              category: 'Walk-in Sales',
                              amount: salesReport.walkInSales || 0,
                              transactions: salesReport.walkInTransactions || 0,
                              color: '#10B981'
                            },
                            {
                              category: 'Online Sales',
                              amount: salesReport.onlineSales || 0,
                              transactions: salesReport.onlineTransactions || 0,
                              color: '#3B82F6'
                            },
                            {
                              category: 'Customization',
                              amount: salesReport.customizationSales || 0,
                              transactions: salesReport.customizationTransactions || 0,
                              color: '#8B5CF6'
                            }
                          ]}
                          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis
                            dataKey="category"
                            stroke="var(--text-muted)"
                            fontSize={12}
                            tick={{ fill: 'var(--text-muted)' }}
                          />
                          <YAxis
                            stroke="var(--text-muted)"
                            fontSize={12}
                            tick={{ fill: 'var(--text-muted)' }}
                            tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'var(--surface-dark)',
                              border: '1px solid var(--border)',
                              borderRadius: '8px',
                              color: 'white'
                            }}
                            formatter={(value, name) => [
                              name === 'amount' ? formatCurrency(value, true) : value,
                              name === 'amount' ? 'Revenue' : 'Transactions'
                            ]}
                          />
                          <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                            {[
                              { color: '#10B981' },
                              { color: '#3B82F6' },
                              { color: '#8B5CF6' }
                            ].map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                      <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <p className="text-green-400 font-semibold">Walk-in Sales</p>
                        <p className="text-white text-lg">{formatCurrency(salesReport.walkInSales || 0, true)}</p>
                        <p className="text-[var(--text-muted)] text-sm">{salesReport.walkInTransactions || 0} transactions</p>
                      </div>
                      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p className="text-blue-400 font-semibold">Online Sales</p>
                        <p className="text-white text-lg">{formatCurrency(salesReport.onlineSales || 0, true)}</p>
                        <p className="text-[var(--text-muted)] text-sm">{salesReport.onlineTransactions || 0} transactions</p>
                      </div>
                      <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                        <p className="text-purple-400 font-semibold">Customization</p>
                        <p className="text-white text-lg">{formatCurrency(salesReport.customizationSales || 0, true)}</p>
                        <p className="text-[var(--text-muted)] text-sm">{salesReport.customizationTransactions || 0} transactions</p>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Sales Breakdown Table */}
                  <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
                    <h2 className="text-white text-xl font-semibold mb-6">Detailed Sales Analysis</h2>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-[var(--bg-primary)] border-b border-[var(--border)]">
                          <tr>
                            <th className="text-left py-4 px-6 text-[var(--text-muted)] font-semibold uppercase text-xs tracking-wider">Sales Category</th>
                            <th className="text-left py-4 px-6 text-[var(--text-muted)] font-semibold uppercase text-xs tracking-wider">Total Revenue</th>
                            <th className="text-left py-4 px-6 text-[var(--text-muted)] font-semibold uppercase text-xs tracking-wider">Transactions</th>
                            <th className="text-left py-4 px-6 text-[var(--text-muted)] font-semibold uppercase text-xs tracking-wider">Avg per Transaction</th>
                            <th className="text-left py-4 px-6 text-[var(--text-muted)] font-semibold uppercase text-xs tracking-wider">% of Total Sales</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          <tr className="hover:bg-[var(--bg-primary)]/50 transition-colors">
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                <span className="text-white font-medium">Walk-in Customers</span>
                              </div>
                            </td>
                            <td className="py-4 px-6 text-[var(--gold-primary)] font-bold text-lg">{formatCurrency(salesReport.walkInSales || 0, true)}</td>
                            <td className="py-4 px-6 text-white font-medium">{salesReport.walkInTransactions || 0}</td>
                            <td className="py-4 px-6 text-white">{formatCurrency(salesReport.walkInAvg || 0, true)}</td>
                            <td className="py-4 px-6">
                              <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
                                {salesReport.walkInPercentage || 0}%
                              </span>
                            </td>
                          </tr>
                          <tr className="hover:bg-[var(--bg-primary)]/50 transition-colors">
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                <span className="text-white font-medium">Online Customers</span>
                              </div>
                            </td>
                            <td className="py-4 px-6 text-[var(--gold-primary)] font-bold text-lg">{formatCurrency(salesReport.onlineSales || 0, true)}</td>
                            <td className="py-4 px-6 text-white font-medium">{salesReport.onlineTransactions || 0}</td>
                            <td className="py-4 px-6 text-white">{formatCurrency(salesReport.onlineAvg || 0, true)}</td>
                            <td className="py-4 px-6">
                              <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-medium">
                                {salesReport.onlinePercentage || 0}%
                              </span>
                            </td>
                          </tr>
                          <tr className="hover:bg-[var(--bg-primary)]/50 transition-colors">
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                                <span className="text-white font-medium">Customization Sales</span>
                              </div>
                            </td>
                            <td className="py-4 px-6 text-[var(--gold-primary)] font-bold text-lg">{formatCurrency(salesReport.customizationSales || 0, true)}</td>
                            <td className="py-4 px-6 text-white font-medium">{salesReport.customizationTransactions || 0}</td>
                            <td className="py-4 px-6 text-white">{formatCurrency(salesReport.customizationAvg || 0, true)}</td>
                            <td className="py-4 px-6">
                              <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm font-medium">
                                {salesReport.customizationPercentage || 0}%
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Time Period Analysis */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <Clock className="w-6 h-6 text-[var(--gold-primary)]" />
                        <h3 className="text-white text-lg font-semibold">Daily Performance</h3>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
                          <span className="text-[var(--text-muted)]">Today's Sales</span>
                          <span className="text-[var(--gold-primary)] font-bold">{formatCurrency(salesReport.dailySales || 0, true)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
                          <span className="text-[var(--text-muted)]">Transactions</span>
                          <span className="text-white font-medium">{salesReport.dailyTransactions || 0}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                          <span className="text-[var(--text-muted)]">Avg Transaction</span>
                          <span className="text-white">{formatCurrency((salesReport.dailySales || 0) / (salesReport.dailyTransactions || 1), true)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <Calendar className="w-6 h-6 text-blue-400" />
                        <h3 className="text-white text-lg font-semibold">Weekly Performance</h3>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
                          <span className="text-[var(--text-muted)]">This Week's Sales</span>
                          <span className="text-[var(--gold-primary)] font-bold">{formatCurrency(salesReport.weeklySales || 0, true)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
                          <span className="text-[var(--text-muted)]">Transactions</span>
                          <span className="text-white font-medium">{salesReport.weeklyTransactions || 0}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                          <span className="text-[var(--text-muted)]">Avg Transaction</span>
                          <span className="text-white">{formatCurrency((salesReport.weeklySales || 0) / (salesReport.weeklyTransactions || 1), true)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <BarChart3 className="w-6 h-6 text-green-400" />
                        <h3 className="text-white text-lg font-semibold">Monthly Performance</h3>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
                          <span className="text-[var(--text-muted)]">This Month's Sales</span>
                          <span className="text-[var(--gold-primary)] font-bold">{formatCurrency(salesReport.monthlySales || 0, true)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
                          <span className="text-[var(--text-muted)]">Transactions</span>
                          <span className="text-white font-medium">{salesReport.monthlyTransactions || 0}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                          <span className="text-[var(--text-muted)]">Avg Transaction</span>
                          <span className="text-white">{formatCurrency((salesReport.monthlySales || 0) / (salesReport.monthlyTransactions || 1), true)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Best-Selling Products */}
                  <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
                    <h2 className="text-white text-xl font-semibold mb-6">Top Performing Products & Services</h2>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-[var(--bg-primary)] border-b border-[var(--border)]">
                          <tr>
                            <th className="text-left py-4 px-6 text-[var(--text-muted)] font-semibold uppercase text-xs tracking-wider">Rank</th>
                            <th className="text-left py-4 px-6 text-[var(--text-muted)] font-semibold uppercase text-xs tracking-wider">Product/Service</th>
                            <th className="text-left py-4 px-6 text-[var(--text-muted)] font-semibold uppercase text-xs tracking-wider">Units Sold</th>
                            <th className="text-left py-4 px-6 text-[var(--text-muted)] font-semibold uppercase text-xs tracking-wider">Revenue Generated</th>
                            <th className="text-left py-4 px-6 text-[var(--text-muted)] font-semibold uppercase text-xs tracking-wider">Category</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {(salesReport.bestSellingProducts || []).map((product, i) => (
                            <tr key={i} className="hover:bg-[var(--bg-primary)]/50 transition-colors">
                              <td className="py-4 px-6">
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                                    i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-orange-600' : 'bg-[var(--bg-primary)]'
                                  }`}>
                                    {i + 1}
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 px-6 text-white font-medium">{product.name}</td>
                              <td className="py-4 px-6 text-white font-medium">{product.units}</td>
                              <td className="py-4 px-6 text-[var(--gold-primary)] font-bold">{formatCurrency(product.revenue, true)}</td>
                              <td className="py-4 px-6">
                                <span className="px-3 py-1 bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] rounded-full text-sm">
                                  {product.category}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Customization Services Analysis */}
                  <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
                    <h2 className="text-white text-xl font-semibold mb-6">Customization Services Overview</h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div>
                        <h3 className="text-white text-lg font-medium mb-4">Service Distribution</h3>
                        <div className="space-y-3">
                          {(salesReport.customizationTypes || []).map((type, i) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg hover:border-[var(--gold-primary)]/50 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                                <span className="text-white font-medium">{type.name}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-[var(--gold-primary)] font-bold text-lg">{type.count}</span>
                                <span className="text-[var(--text-muted)] text-sm ml-1">orders</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-white text-lg font-medium mb-4">Revenue Metrics</h3>
                        <div className="space-y-4">
                          <div className="p-4 bg-gradient-to-r from-purple-500/10 to-purple-600/5 border border-purple-500/30 rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-[var(--text-muted)]">Total Customization Revenue</span>
                              <span className="text-purple-400 font-bold text-lg">{formatCurrency(salesReport.customizationRevenue || 0, true)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[var(--text-muted)]">Average per Order</span>
                              <span className="text-white font-medium">{formatCurrency(salesReport.avgCustomization || 0, true)}</span>
                            </div>
                          </div>
                          <div className="p-4 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg">
                            <div className="flex justify-between items-center">
                              <span className="text-[var(--text-muted)]">Contribution to Total Sales</span>
                              <span className="text-[var(--gold-primary)] font-bold">{salesReport.customizationPercentage || 0}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Performance Insights */}
                  <div className="bg-gradient-to-r from-[var(--bg-primary)] to-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
                    <h2 className="text-white text-xl font-semibold mb-6">Key Performance Insights</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                          <div className="flex items-center gap-3 mb-3">
                            <ArrowUpRight className="w-5 h-5 text-green-400" />
                            <h4 className="text-green-400 font-semibold">Walk-in Customer Strength</h4>
                          </div>
                          <p className="text-white text-sm mb-2">Walk-in customers show higher average transaction values, indicating premium product preferences.</p>
                          <div className="flex justify-between text-sm">
                            <span className="text-[var(--text-muted)]">Conversion Rate:</span>
                            <span className="text-green-400 font-medium">{salesReport.walkInConversion || 0}%</span>
                          </div>
                        </div>
                        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                          <div className="flex items-center gap-3 mb-3">
                            <TrendingUp className="w-5 h-5 text-blue-400" />
                            <h4 className="text-blue-400 font-semibold">Online Growth Potential</h4>
                          </div>
                          <p className="text-white text-sm mb-2">Online sales demonstrate strong volume potential with consistent transaction flow.</p>
                          <div className="flex justify-between text-sm">
                            <span className="text-[var(--text-muted)]">Conversion Rate:</span>
                            <span className="text-blue-400 font-medium">{salesReport.onlineConversion || 0}%</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                          <div className="flex items-center gap-3 mb-3">
                            <BarChart3 className="w-5 h-5 text-purple-400" />
                            <h4 className="text-purple-400 font-semibold">Customization Value</h4>
                          </div>
                          <p className="text-white text-sm mb-2">Custom orders provide significant revenue contribution with high-value transactions.</p>
                          <div className="flex justify-between text-sm">
                            <span className="text-[var(--text-muted)]">Avg Order Value:</span>
                            <span className="text-purple-400 font-medium">{formatCurrency(salesReport.customizationAvg || 0, true)}</span>
                          </div>
                        </div>
                        <div className="p-4 bg-[var(--gold-primary)]/10 border border-[var(--gold-primary)]/30 rounded-lg">
                          <div className="flex items-center gap-3 mb-3">
                            <DollarSign className="w-5 h-5 text-[var(--gold-primary)]" />
                            <h4 className="text-[var(--gold-primary)] font-semibold">Revenue Optimization</h4>
                          </div>
                          <p className="text-white text-sm mb-2">Focus on high-margin products and premium customization services for maximum profitability.</p>
                          <div className="flex justify-between text-sm">
                            <span className="text-[var(--text-muted)]">Top Product Margin:</span>
                            <span className="text-[var(--gold-primary)] font-medium">35%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
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

      {/* ── MODAL ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modal.open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              {/* Product Modal */}
              {(modal.type === 'product') && (
                <>
                  <ModalHeader title={modal.data ? 'Edit Product' : 'New Product'} onClose={closeModal} />
                  <div className="space-y-4 mt-6">
                    <FormField label="SKU *" value={form.sku || ''} onChange={v => setForm(f => ({...f, sku: v}))} placeholder="e.g. GTR-001" />
                    <FormField label="Product Name *" value={form.name || ''} onChange={v => setForm(f => ({...f, name: v}))} />
                    <FormField label="Description" value={form.description || ''} onChange={v => setForm(f => ({...f, description: v}))} textarea />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField label="Price (₱) *" type="number" value={form.price || ''} onChange={v => setForm(f => ({...f, price: v}))} />
                      <FormField label="Cost (₱)" type="number" value={form.cost || ''} onChange={v => setForm(f => ({...f, cost: v}))} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField label="Stock" type="number" value={form.stock ?? ''} onChange={v => setForm(f => ({...f, stock: v}))} />
                      <FormField label="Low Stock Threshold" type="number" value={form.low_stock_threshold ?? ''} onChange={v => setForm(f => ({...f, low_stock_threshold: v}))} />
                    </div>
                    <div>
                      <label className={labelCls}>Category</label>
                      <select value={form.category_id || ''} onChange={e => setForm(f => ({...f, category_id: e.target.value}))} className={inputCls}>
                        <option value="">— None —</option>
                        {categories.map(c => <option key={c.category_id} value={c.category_id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-3">
                      <input type="checkbox" id="is_active" checked={form.is_active ?? true} onChange={e => setForm(f => ({...f, is_active: e.target.checked}))} className="w-4 h-4" />
                      <label htmlFor="is_active" className="text-white text-sm">Active (visible in shop)</label>
                    </div>
                  </div>
                  <ModalFooter onCancel={closeModal} onSave={saveProduct} isSaving={isSaving} />
                </>
              )}

              {/* Category Modal */}
              {modal.type === 'category' && (
                <>
                  <ModalHeader title={modal.data ? 'Edit Category' : 'New Category'} onClose={closeModal} />
                  <div className="space-y-4 mt-6">
                    <FormField label="Name *" value={form.name || ''} onChange={v => setForm(f => ({...f, name: v}))} />
                    <FormField label="Slug *" value={form.slug || ''} onChange={v => setForm(f => ({...f, slug: v}))} placeholder="e.g. custom-builds" />
                    <FormField label="Description" value={form.description || ''} onChange={v => setForm(f => ({...f, description: v}))} textarea />
                    <div>
                      <label className={labelCls}>Parent Category</label>
                      <select value={form.parent_id || ''} onChange={e => setForm(f => ({...f, parent_id: e.target.value || null}))} className={inputCls}>
                        <option value="">— None —</option>
                        {categories.filter(c => c.category_id !== modal.data?.category_id).map(c => (
                          <option key={c.category_id} value={c.category_id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <FormField label="Sort Order" type="number" value={form.sort_order ?? 0} onChange={v => setForm(f => ({...f, sort_order: v}))} />
                  </div>
                  <ModalFooter onCancel={closeModal} onSave={saveCategory} isSaving={isSaving} />
                </>
              )}

              {/* Guitar Part Modal */}
              {modal.type === 'part' && (
                <>
                  <ModalHeader title={modal.data ? 'Edit Guitar Part' : 'New Guitar Part'} onClose={closeModal} />
                  <div className="space-y-4 mt-6">
                    <FormField label="Part Name *" value={form.part_name || ''} onChange={v => setForm(f => ({...f, part_name: v}))} placeholder="e.g. Mahogany Body" />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField label="Quantity *" type="number" value={form.quantity || ''} onChange={v => setForm(f => ({...f, quantity: v}))} />
                      <FormField label="Price (₱) *" type="number" value={form.price || ''} onChange={v => setForm(f => ({...f, price: v}))} />
                    </div>
                    <div>
                      <label className={labelCls}>Linked Product (optional)</label>
                      <select value={form.product_id || ''} onChange={e => setForm(f => ({...f, product_id: e.target.value || null}))} className={inputCls}>
                        <option value="">— None —</option>
                        {products.map(p => <option key={p.product_id} value={p.product_id}>{p.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <ModalFooter onCancel={closeModal} onSave={savePart} isSaving={isSaving} />
                </>
              )}

              {/* Guitar Customization View */}
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
                      ['Total Price', formatCurrency(modal.data.total_price, true)],
                    ].map(([key, val]) => val ? (
                      <div key={key} className="flex justify-between gap-4 border-b border-[var(--border)] pb-2">
                        <span className="text-[var(--text-muted)]">{key}</span>
                        <span className="text-white font-medium capitalize">{val}</span>
                      </div>
                    ) : null)}
                  </div>
                  <button onClick={closeModal} className="w-full mt-6 py-3 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 transition-all">
                    Close
                  </button>
                </>
              )}

              {/* Order View Modal */}
              {modal.type === 'order_view' && modal.data && (
                <>
                  <ModalHeader title={`Order #${modal.data.order_number || modal.data.order_id}`} onClose={closeModal} />
                  <div className="mt-6 space-y-3 text-sm">
                    <div className="flex justify-between gap-4 border-b border-[var(--border)] pb-2">
                      <span className="text-[var(--text-muted)]">Status</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(modal.data.status)}`}>
                        {modal.data.status || 'Pending'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-[var(--border)] pb-2">
                      <span className="text-[var(--text-muted)]">Customer</span>
                      <span className="text-white font-medium">{modal.data.customer_name || modal.data.user_name || '—'}</span>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-[var(--border)] pb-2">
                      <span className="text-[var(--text-muted)]">Date</span>
                      <span className="text-white font-medium">{modal.data.created_at ? new Date(modal.data.created_at).toLocaleDateString() : '—'}</span>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-[var(--border)] pb-2">
                      <span className="text-[var(--text-muted)]">Total</span>
                      <span className="text-[var(--gold-primary)] font-bold">{formatCurrency(modal.data.total, true)}</span>
                    </div>
                    {modal.data.items && modal.data.items.length > 0 && (
                      <div className="mt-4">
                        <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">Items</p>
                        <div className="space-y-2">
                          {modal.data.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between bg-[var(--bg-primary)] p-3 rounded-lg">
                              <span className="text-white text-sm">{item.product_name || item.name || 'Item'}</span>
                              <span className="text-[var(--gold-primary)] text-sm">{formatCurrency(item.price, true)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <button onClick={closeModal} className="w-full mt-6 py-3 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 transition-all">
                    Close
                  </button>
                </>
              )}

              {/* Project Modal */}
              {(modal.type === 'project') && (
                <>
                  <ModalHeader title={modal.data ? 'Edit Project' : 'New Project'} onClose={closeModal} />
                  <div className="space-y-4 mt-6">
                    <FormField label="Project Name *" value={form.name || ''} onChange={v => setForm(f => ({...f, name: v}))} />
                    <FormField label="Customer Name" value={form.customer_name || ''} onChange={v => setForm(f => ({...f, customer_name: v}))} />
                    <FormField label="Description" value={form.description || ''} onChange={v => setForm(f => ({...f, description: v}))} textarea />
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>Status</label>
                        <select value={form.status || 'Pending'} onChange={e => setForm(f => ({...f, status: e.target.value}))} className={inputCls}>
                          <option value="Pending">Pending</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </div>
                      <FormField label="Progress (%)" type="number" value={form.progress ?? 0} onChange={v => setForm(f => ({...f, progress: v}))} />
                    </div>
                    <FormField label="Start Date" type="date" value={form.start_date || ''} onChange={v => setForm(f => ({...f, start_date: v}))} />
                    <FormField label="End Date" type="date" value={form.end_date || ''} onChange={v => setForm(f => ({...f, end_date: v}))} />
                    <FormField label="Budget" type="number" value={form.budget || ''} onChange={v => setForm(f => ({...f, budget: v}))} />
                  </div>
                  <ModalFooter onCancel={closeModal} onSave={saveProject} isSaving={isSaving} />
                </>
              )}

              {/* Project Team Modal */}
              {modal.type === 'project_team' && modal.data && (
                <>
                  <ModalHeader title="Assign Team" onClose={closeModal} />
                  <div className="mt-6">
                    <p className="text-[var(--text-muted)] text-sm mb-4">Select team members for: {modal.data.name}</p>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {users.filter(u => u.role !== 'customer').map(user => (
                        <label key={user.user_id} className="flex items-center gap-3 p-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg cursor-pointer hover:border-[var(--gold-primary)]/50 transition-all">
                          <input 
                            type="checkbox" 
                            checked={form.team_ids?.includes(user.user_id)}
                            onChange={e => {
                              const current = form.team_ids || []
                              const updated = e.target.checked 
                                ? [...current, user.user_id]
                                : current.filter(id => id !== user.user_id)
                              setForm(f => ({...f, team_ids: updated}))
                            }}
                            className="w-4 h-4" 
                          />
                          <div>
                            <p className="text-white text-sm font-medium">{user.first_name} {user.last_name}</p>
                            <p className="text-[var(--text-muted)] text-xs">{user.role}</p>
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
              {(modal.type === 'appointment') && (
                <>
                  <ModalHeader title={modal.data ? 'Edit Appointment' : 'Book Appointment'} onClose={closeModal} />
                  <div className="space-y-4 mt-6">
                    <FormField label="Title *" value={form.title || ''} onChange={v => setForm(f => ({...f, title: v}))} placeholder="e.g. Guitar Setup Consultation" />
                    <FormField label="Customer Name" value={form.customer_name || ''} onChange={v => setForm(f => ({...f, customer_name: v}))} />
                    <FormField label="Customer Email" value={form.customer_email || ''} onChange={v => setForm(f => ({...f, customer_email: v}))} />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField label="Date *" type="date" value={form.date || ''} onChange={v => setForm(f => ({...f, date: v}))} />
                      <FormField label="Time" type="time" value={form.time || ''} onChange={v => setForm(f => ({...f, time: v}))} />
                    </div>
                    <div>
                      <label className={labelCls}>Status</label>
                      <select value={form.status || 'Scheduled'} onChange={e => setForm(f => ({...f, status: e.target.value}))} className={inputCls}>
                        <option value="Scheduled">Scheduled</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                        <option value="No Show">No Show</option>
                      </select>
                    </div>
                    <FormField label="Notes" value={form.notes || ''} onChange={v => setForm(f => ({...f, notes: v}))} textarea placeholder="Any special requirements or notes..." />
                  </div>
                  <ModalFooter onCancel={closeModal} onSave={saveAppointment} isSaving={isSaving} />
                </>
              )}
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
      <button onClick={onCancel} className="flex-1 py-3 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 transition-all text-sm font-medium">
        Cancel
      </button>
      <button onClick={onSave} disabled={isSaving} className="flex-1 py-3 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black rounded-xl font-bold text-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all disabled:opacity-60 flex items-center justify-center gap-2">
        {isSaving ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
        {isSaving ? 'Saving...' : 'Save'}
      </button>
    </div>
  )
}

function FormField({ label, value, onChange, type = 'text', placeholder, textarea }) {
  const cls = 'w-full px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] text-sm'
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1.5">{label}</label>
      {textarea ? (
        <textarea rows={3} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      )}
    </div>
  )
}
