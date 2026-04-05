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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
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

  // Load data when tab changes
  useEffect(() => {
    setSearchQuery('')
    if (activeTab === 'products') { fetchProducts(); fetchCategories() }
    if (activeTab === 'guitars') fetchGuitars()
    if (activeTab === 'parts') fetchParts()
    if (activeTab === 'users') fetchUsers()
    if (activeTab === 'orders') fetchOrders()
    if (activeTab === 'projects') fetchProjects()
    if (activeTab === 'appointments') fetchAppointments()
  }, [activeTab])

  // Re-search on query change
  useEffect(() => {
    if (activeTab === 'products') fetchProducts()
    if (activeTab === 'guitars') fetchGuitars()
    if (activeTab === 'users') fetchUsers()
    if (activeTab === 'orders') fetchOrders()
    if (activeTab === 'projects') fetchProjects()
    if (activeTab === 'appointments') fetchAppointments()
  }, [searchQuery])

  const handleRefresh = () => {
    setIsLoading(true)
    const fetchers = {
      products: () => { fetchProducts(); fetchCategories() },
      guitars: fetchGuitars,
      parts: fetchParts,
      users: fetchUsers,
      orders: fetchOrders,
      projects: fetchProjects,
      appointments: fetchAppointments,
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

  const inputCls = 'w-full px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] text-sm'
  const labelCls = 'block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1.5'

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'dashboard',  label: 'Dashboard',       icon: BarChart3 },
    { id: 'products',   label: 'Products',         icon: Package },
    { id: 'categories', label: 'Categories',       icon: Tag },
    { id: 'parts',      label: 'Guitar Parts',     icon: Layers },
    { id: 'guitars',    label: 'Customizations',   icon: Guitar },
    { id: 'orders',     label: 'Orders',           icon: ShoppingBag },
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
      <aside className={`fixed left-0 top-0 h-screen bg-[#1E201E] border-r-2 border-[#4A4747] transition-all duration-300 z-40 ${sidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-6 w-6 h-6 bg-[#1E201E] border border-white/30 rounded-full flex items-center justify-center hover:bg-[#FFD700] hover:border-[#FFD700] transition-all"
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4 text-white" /> : <ChevronLeft className="w-4 h-4 text-white" />}
        </button>

        <nav className="p-4 space-y-0 overflow-y-auto max-h-[calc(100vh-10rem)]">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-[#FFD700] text-black font-bold shadow-lg shadow-[#FFD700]/20'
                    : 'text-white hover:bg-[#4A4747] hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${activeTab === tab.id ? 'text-black' : 'text-white'}`} />
                {!sidebarCollapsed && <span className={`truncate ${activeTab === tab.id ? 'text-black' : 'text-white'}`}>{tab.label}</span>}
              </button>
            )
          })}
        </nav>

        {/* Admin badge */}
        <div className={`absolute bottom-4 left-0 right-0 px-4`}>
          <div className={`flex items-center gap-3 p-3 rounded-xl bg-[#1E201E] border border-white/30 ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="w-9 h-9 rounded-full bg-gradient-to-r from-[#FFD700] to-[#FFD700] flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-black" />
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{user?.firstName || 'Admin'}</p>
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
            {['products', 'guitars', 'users', 'parts', 'categories', 'orders', 'projects', 'appointments'].includes(activeTab) && (
              <div className="relative max-w-sm w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder={`Search ${activeTab}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] text-sm"
                />
              </div>
            )}
            <div className="flex items-center gap-2 ml-auto">
              {activeTab === 'products' && (
                <>
                  <button onClick={handleRefresh} className="p-2 border border-[var(--border)] rounded-lg hover:border-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/10 transition-all">
                    <RefreshCw className={`w-4 h-4 text-[var(--text-muted)] ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                  
                  <button onClick={() => openModal('product')} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black rounded-xl font-semibold text-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all">
                    <Plus className="w-4 h-4" /> Add Product
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
              {activeTab === 'parts' && (
                <>
                  <button onClick={handleRefresh} className="p-2 border border-[var(--border)] rounded-lg hover:border-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/10 transition-all">
                    <RefreshCw className={`w-4 h-4 text-[var(--text-muted)] ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                  
                  <button onClick={() => openModal('part')} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black rounded-xl font-semibold text-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all">
                    <Plus className="w-4 h-4" /> Add Part
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

          {/* ── PRODUCTS TAB ─────────────────────────────────────────────── */}
          {activeTab === 'products' && (
            <motion.div key="products" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
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

          {/* ── GUITAR PARTS TAB ─────────────────────────────────────────── */}
          {activeTab === 'parts' && (
            <motion.div key="parts" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
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

          {/* ── USERS & RBAC TAB ─────────────────────────────────────────── */}
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

          {/* ── DASHBOARD TAB (modern analytics layout) ──────────────────────────── */}
          {activeTab === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              {/* Top Notification Bar */}
              <div className="mb-6 bg-gradient-to-r from-[var(--gold-primary)]/20 to-[var(--gold-secondary)]/10 border border-[var(--gold-primary)]/30 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[var(--gold-primary)]/20 rounded-lg flex items-center justify-center">
                    <AlertCircle className="w-4 h-4 text-[var(--gold-primary)]" />
                  </div>
                  <p className="text-white text-sm">Welcome back, <span className="font-semibold">{user?.firstName || 'Admin'}</span>! You have 3 new orders today.</p>
                </div>
                <button className="text-[var(--gold-primary)] text-sm font-medium hover:underline">Dismiss</button>
              </div>

              {/* Profile and Quick Actions Row */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
                {/* Profile Section */}
                <div className="flex items-center gap-4 p-4 bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] flex items-center justify-center">
                    <User className="w-6 h-6 text-black" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">{user?.firstName} {user?.lastName}</h3>
                    <p className="text-[var(--gold-primary)] text-sm capitalize">{user?.role?.replace('_', ' ')}</p>
                    <p className="text-[var(--text-muted)] text-xs">Last login: Just now</p>
                  </div>
                </div>
                {/* Quick Stats Pills */}
                <div className="flex flex-wrap gap-3">
                  <div className="px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-full flex items-center gap-2">
                    <ArrowUpRight className="w-4 h-4 text-green-400" />
                    <span className="text-green-400 text-sm font-medium">+12%</span>
                    <span className="text-[var(--text-muted)] text-sm">this month</span>
                  </div>
                  <div className="px-4 py-2 bg-[var(--surface-dark)] border border-[var(--border)] rounded-full flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-[var(--gold-primary)]" />
                    <span className="text-white text-sm font-medium">{orders.length}</span>
                    <span className="text-[var(--text-muted)] text-sm">orders</span>
                  </div>
                  <div className="px-4 py-2 bg-[var(--surface-dark)] border border-[var(--border)] rounded-full flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-[var(--gold-primary)]" />
                    <span className="text-white text-sm font-medium">{projects.length}</span>
                    <span className="text-[var(--text-muted)] text-sm">projects</span>
                  </div>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Total Revenue', value: '₱247,850', trend: '+8.2%', trendUp: true, icon: DollarSign, color: 'green' },
                  { label: 'Active Subscriptions', value: '12', trend: '+2', trendUp: true, icon: CreditCard, color: 'blue' },
                  { label: 'Total Sales', value: '156', trend: '+18', trendUp: true, icon: ShoppingBag, color: 'gold' },
                  { label: 'Active Users', value: '89', trend: '-3', trendUp: false, icon: UsersRound, color: 'purple' },
                ].map((stat, i) => {
                  const Icon = stat.icon
                  const colorMap = {
                    green: 'bg-green-500/20 text-green-400 border-green-500/30',
                    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                    gold: 'bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] border-[var(--gold-primary)]/30',
                    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
                  }
                  return (
                    <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                      className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-5 hover:border-[var(--gold-primary)]/50 transition-all"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[var(--text-muted)] text-sm">{stat.label}</span>
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${colorMap[stat.color]}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-white mb-1">{stat.value}</p>
                      <div className={`flex items-center gap-1 text-xs ${stat.trendUp ? 'text-green-400' : 'text-red-400'}`}>
                        {stat.trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        <span>{stat.trend}</span>
                        <span className="text-[var(--text-muted)]">vs last month</span>
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              {/* Line Graph - Monthly Performance */}
              <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 mb-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-white font-semibold text-lg">Monthly Performance</h3>
                    <p className="text-[var(--text-muted)] text-sm">Revenue and orders over time</p>
                  </div>
                  <select className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[var(--gold-primary)]">
                    <option>Last 6 months</option>
                    <option>Last 12 months</option>
                    <option>This year</option>
                  </select>
                </div>
                <div className="h-64">
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
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#d4af37" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#d4af37" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="month" stroke="#b0b4bc" fontSize={12} />
                      <YAxis stroke="#b0b4bc" fontSize={12} tickFormatter={(v) => `₱${v/1000}k`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1E201E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}
                        labelStyle={{ color: '#eff1f3' }}
                        itemStyle={{ color: '#d4af37' }}
                        formatter={(value) => [`₱${value.toLocaleString()}`, 'Revenue']}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#d4af37" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Recent Appointments Section */}
              <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-white font-semibold text-lg">Recent Appointments</h3>
                    <p className="text-[var(--text-muted)] text-sm">Upcoming client meetings</p>
                  </div>
                  <button onClick={() => setActiveTab('appointments')} className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-white text-sm hover:border-[var(--gold-primary)]/50 transition-all">
                    View All <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                {appointments.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
                    <p className="text-[var(--text-muted)]">No upcoming appointments</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {appointments.slice(0, 4).map((apt) => (
                      <div key={apt.appointment_id} className="flex items-center justify-between p-4 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl hover:border-[var(--gold-primary)]/50 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-[var(--gold-primary)]/20 rounded-lg flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-[var(--gold-primary)]" />
                          </div>
                          <div>
                            <p className="text-white font-medium">{apt.title || 'Appointment'}</p>
                            <p className="text-[var(--text-muted)] text-sm">{apt.customer_name || apt.user_name || '—'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-white text-sm">{apt.date ? new Date(apt.date).toLocaleDateString() : '—'}</p>
                          <p className="text-[var(--text-muted)] text-xs">{apt.time || ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
