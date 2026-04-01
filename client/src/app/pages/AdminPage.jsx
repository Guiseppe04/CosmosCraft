import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Users, Package, ShoppingBag, Calendar, Settings, Search,
  Filter, MoreVertical, Edit, Trash2, Eye, BarChart3,
  PieChart, Activity, ArrowUpRight, ArrowDownRight, Clock,
  CheckCircle, XCircle, Plus, Download, RefreshCw, X,
  MessageSquare, Briefcase, ChevronLeft, ChevronRight,
  User, Guitar, Layers, Shield, Tag, AlertCircle, DollarSign,
  Save,
} from 'lucide-react'
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

  // Load data when tab changes
  useEffect(() => {
    setSearchQuery('')
    if (activeTab === 'products') { fetchProducts(); fetchCategories() }
    if (activeTab === 'guitars') fetchGuitars()
    if (activeTab === 'parts') fetchParts()
    if (activeTab === 'users') fetchUsers()
  }, [activeTab])

  // Re-search on query change
  useEffect(() => {
    if (activeTab === 'products') fetchProducts()
    if (activeTab === 'guitars') fetchGuitars()
    if (activeTab === 'users') fetchUsers()
  }, [searchQuery])

  const handleRefresh = () => {
    setIsLoading(true)
    const fetchers = {
      products: () => { fetchProducts(); fetchCategories() },
      guitars: fetchGuitars,
      parts: fetchParts,
      users: fetchUsers,
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
    { id: 'guitars',    label: 'Customizations',   icon: Guitar },
    { id: 'parts',      label: 'Guitar Parts',     icon: Layers },
    { id: 'users',      label: 'Users & RBAC',     icon: Shield },
    { id: 'orders',     label: 'Orders',           icon: ShoppingBag },
    { id: 'projects',   label: 'Projects',         icon: Briefcase },
    { id: 'appointments', label: 'Appointments',   icon: Calendar },
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
      <aside className={`fixed left-0 top-20 h-[calc(100vh-5rem)] bg-[var(--surface-dark)] border-r-2 border-white/10 transition-all duration-300 z-40 ${sidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-6 w-6 h-6 bg-[var(--surface-dark)] border border-[var(--border)] rounded-full flex items-center justify-center hover:bg-[var(--gold-primary)] hover:border-[var(--gold-primary)] transition-all"
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronLeft className="w-4 h-4 text-[var(--text-muted)]" />}
        </button>

        <nav className="p-4 space-y-1 overflow-y-auto max-h-[calc(100vh-10rem)]">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-primary)] hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && <span className="truncate">{tab.label}</span>}
              </button>
            )
          })}
        </nav>

        {/* Admin badge */}
        <div className={`absolute bottom-4 left-0 right-0 px-4`}>
          <div className={`flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-primary)] border border-white/10 ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="w-9 h-9 rounded-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-black" />
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{user?.firstName || 'Admin'}</p>
                <p className="text-[var(--gold-primary)] text-xs capitalize">{user?.role?.replace('_', ' ')}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
        <Topbar title={tabs.find(t => t.id === activeTab)?.label || 'Dashboard'} userRole={user?.role} />

        <main className="p-6 pt-28">

          {/* Actions bar */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            {/* Search */}
            {['products', 'guitars', 'users', 'parts'].includes(activeTab) && (
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
            <div className="flex items-center gap-3 ml-auto">
              <button onClick={handleRefresh} className="p-2 border border-[var(--border)] rounded-lg hover:border-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/10 transition-all">
                <RefreshCw className={`w-4 h-4 text-[var(--text-muted)] ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              {activeTab === 'products' && (
                <button onClick={() => openModal('product')} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black rounded-xl font-semibold text-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all">
                  <Plus className="w-4 h-4" /> Add Product
                </button>
              )}
              {activeTab === 'categories' && (
                <button onClick={() => openModal('category')} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black rounded-xl font-semibold text-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all">
                  <Plus className="w-4 h-4" /> Add Category
                </button>
              )}
              {activeTab === 'parts' && (
                <button onClick={() => openModal('part')} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black rounded-xl font-semibold text-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all">
                  <Plus className="w-4 h-4" /> Add Part
                </button>
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

          {/* ── DASHBOARD TAB (static overview) ──────────────────────────── */}
          {activeTab === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {[
                  { label: 'Products', value: products.length, icon: Package },
                  { label: 'Customizations', value: guitars.length, icon: Guitar },
                  { label: 'Guitar Parts', value: parts.length, icon: Layers },
                  { label: 'Users', value: users.length, icon: Users },
                ].map((stat, i) => {
                  const Icon = stat.icon
                  return (
                    <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                      className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 hover:border-[var(--gold-primary)]/50 transition-all"
                    >
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-[var(--text-muted)] text-sm">{stat.label}</h3>
                        <div className="w-10 h-10 bg-[var(--gold-primary)]/20 rounded-lg flex items-center justify-center">
                          <Icon className="w-5 h-5 text-[var(--gold-primary)]" />
                        </div>
                      </div>
                      <p className="text-3xl font-bold text-white">{stat.value}</p>
                    </motion.div>
                  )
                })}
              </div>
              <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-4">Quick Navigation</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {tabs.slice(1).map(t => {
                    const Icon = t.icon
                    return (
                      <button key={t.id} onClick={() => setActiveTab(t.id)}
                        className="flex items-center gap-3 p-4 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl hover:border-[var(--gold-primary)]/50 transition-all text-left"
                      >
                        <Icon className="w-5 h-5 text-[var(--gold-primary)]" />
                        <span className="text-white text-sm font-medium">{t.label}</span>
                      </button>
                    )
                  })}
                </div>
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
