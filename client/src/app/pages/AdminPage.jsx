import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Users,
  Package,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Calendar,
  Settings,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  ChevronDown,
  BarChart3,
  PieChart,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  Download,
  RefreshCw,
  X,
  MessageSquare,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  User,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Topbar } from '../components/admin/Topbar'
import { MessagePanel } from '../components/admin/MessagePanel'
import { ProjectProgress, ProgressBadge } from '../components/admin/ProjectProgress'
import { formatCurrency } from '../utils/formatCurrency'

/**
 * AdminDashboard - Full Admin Dashboard
 * Theme: Dark theme with gold accents (matching LandingPage)
 * Features: 
 * - Tabbed navigation
 * - Interactive stats with Philippine Peso
 * - User/Product/Order/Project management
 * - Customer communication system
 * - Project progress tracking
 * - Role-based access control (can be enabled later)
 */
export function AdminPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [messagePanelOpen, setMessagePanelOpen] = useState(false)
  const [selectedConversation, setSelectedConversation] = useState(null)

  // Auth checks disabled - allow access without authentication for development

  // Dashboard Stats (in USD - will be converted to PHP)
  const stats = [
    { 
      label: 'Total Revenue', 
      value: 127845, 
      change: '+12.5%', 
      trend: 'up',
      icon: DollarSign, 
      color: 'gold',
      isCurrency: true 
    },
    { 
      label: 'Total Orders', 
      value: 1284, 
      change: '+8.2%', 
      trend: 'up',
      icon: ShoppingBag, 
      color: 'gold',
      isCurrency: false
    },
    { 
      label: 'Active Users', 
      value: 3847, 
      change: '+4.1%', 
      trend: 'up',
      icon: Users, 
      color: 'gold',
      isCurrency: false
    },
    { 
      label: 'Pending Orders', 
      value: 23, 
      change: '-15.3%', 
      trend: 'down',
      icon: Clock, 
      color: 'gold',
      isCurrency: false
    },
  ]

  // Recent Orders with Messages
  const recentOrders = [
    { 
      id: 'ORD-2024-001', 
      customer: 'Michael Chen', 
      customerEmail: 'michael.chen@email.com',
      product: 'Custom Les Paul', 
      amount: 2450, 
      status: 'In Progress', 
      date: '2024-03-15',
      hasMessages: true,
      unreadCount: 2,
      latestMessage: 'We\'ve started the painting process!'
    },
    { 
      id: 'ORD-2024-002', 
      customer: 'Sarah Williams', 
      customerEmail: 'sarah.w@musicmail.com',
      product: 'Floyd Rose Setup', 
      amount: 180, 
      status: 'Completed', 
      date: '2024-03-14',
      hasMessages: false,
      unreadCount: 0,
      latestMessage: null
    },
    { 
      id: 'ORD-2024-003', 
      customer: 'James Rodriguez', 
      customerEmail: 'j.rodriguez@guitarpro.com',
      product: 'Pickups Upgrade', 
      amount: 340, 
      status: 'Pending', 
      date: '2024-03-14',
      hasMessages: true,
      unreadCount: 1,
      latestMessage: 'When can I pick up my guitar?'
    },
    { 
      id: 'ORD-2024-004', 
      customer: 'Emily Thompson', 
      customerEmail: 'emily.t@stringshop.com',
      product: 'Refret Service', 
      amount: 285, 
      status: 'Completed', 
      date: '2024-03-13',
      hasMessages: false,
      unreadCount: 0,
      latestMessage: null
    },
    { 
      id: 'ORD-2024-005', 
      customer: 'David Kim', 
      customerEmail: 'david.kim@frets.com',
      product: 'Custom Telecaster', 
      amount: 3200, 
      status: 'In Progress', 
      date: '2024-03-12',
      hasMessages: true,
      unreadCount: 0,
      latestMessage: 'Looking forward to seeing the final result!'
    },
  ]

  // Projects Data
  const projects = [
    { 
      id: 'PRJ-2024-001', 
      name: 'Custom Les Paul - Michael Chen', 
      customer: 'Michael Chen',
      customerEmail: 'michael.chen@email.com',
      stage: 2,
      assignedStaff: 'Juan dela Cruz',
      totalPrice: 2450,
      startDate: '2024-03-01',
      estimatedCompletion: '2024-04-15',
      status: 'In Progress',
      messages: [
        { id: 1, sender: 'customer', text: 'Excited to see the progress!', timestamp: '2024-03-10T09:00:00' },
        { id: 2, sender: 'staff', text: 'We\'ve started the assembly process.', timestamp: '2024-03-12T14:30:00' },
      ]
    },
    { 
      id: 'PRJ-2024-002', 
      name: 'Custom Telecaster - David Kim', 
      customer: 'David Kim',
      customerEmail: 'david.kim@frets.com',
      stage: 3,
      assignedStaff: 'Maria Santos',
      totalPrice: 3200,
      startDate: '2024-02-15',
      estimatedCompletion: '2024-04-01',
      status: 'In Progress',
      messages: []
    },
  ]

  // Users Data
  const users = [
    { id: 1, name: 'Michael Chen', email: 'michael.chen@email.com', role: 'Customer', orders: 5, totalSpent: 4280, status: 'Active', joined: '2024-01-15' },
    { id: 2, name: 'Sarah Williams', email: 'sarah.w@musicmail.com', role: 'Customer', orders: 12, totalSpent: 8450, status: 'Active', joined: '2023-11-20' },
    { id: 3, name: 'James Rodriguez', email: 'j.rodriguez@guitarpro.com', role: 'VIP', orders: 28, totalSpent: 24500, status: 'Active', joined: '2023-06-10' },
    { id: 4, name: 'Emily Thompson', email: 'emily.t@stringshop.com', role: 'Customer', orders: 3, totalSpent: 920, status: 'Active', joined: '2024-02-28' },
    { id: 5, name: 'David Kim', email: 'david.kim@frets.com', role: 'VIP', orders: 45, totalSpent: 52300, status: 'Active', joined: '2022-08-15' },
    { id: 6, name: 'Lisa Martinez', email: 'lisa.m@guitarlife.com', role: 'Customer', orders: 1, totalSpent: 450, status: 'Inactive', joined: '2024-03-01' },
  ]

  // Products Data
  const products = [
    { id: 'PRD-001', name: 'Custom Les Paul', category: 'Custom Builds', price: 2450, stock: 5, sold: 23, status: 'Active' },
    { id: 'PRD-002', name: 'Floyd Rose Setup', category: 'Services', price: 180, stock: 999, sold: 156, status: 'Active' },
    { id: 'PRD-003', name: 'Seymour Duncan Pickups', category: 'Parts', price: 340, stock: 24, sold: 89, status: 'Active' },
    { id: 'PRD-004', name: 'Refret Service', category: 'Services', price: 285, stock: 999, sold: 67, status: 'Active' },
    { id: 'PRD-005', name: 'Custom Telecaster', category: 'Custom Builds', price: 3200, stock: 3, sold: 12, status: 'Low Stock' },
    { id: 'PRD-006', name: 'Vintage Tuners', category: 'Parts', price: 195, stock: 0, sold: 45, status: 'Out of Stock' },
  ]

  // Appointments Data
  const appointments = [
    { id: 'APT-001', customer: 'Michael Chen', service: 'Custom Build Consultation', date: '2024-03-20', time: '10:00 AM', status: 'Confirmed' },
    { id: 'APT-002', customer: 'Sarah Williams', service: 'Setup & Inspection', date: '2024-03-21', time: '2:00 PM', status: 'Pending' },
    { id: 'APT-003', customer: 'James Rodriguez', service: 'Electronics Upgrade', date: '2024-03-22', time: '11:30 AM', status: 'Confirmed' },
    { id: 'APT-004', customer: 'Emily Thompson', service: 'Refret Service', date: '2024-03-23', time: '9:00 AM', status: 'Confirmed' },
    { id: 'APT-005', customer: 'David Kim', service: 'Custom Paint Consultation', date: '2024-03-25', time: '3:00 PM', status: 'Pending' },
  ]

  // Get status badge color
  const getStatusBadge = (status) => {
    const statusConfig = {
      'Active': 'bg-green-500/20 text-green-400 border-green-500/30',
      'Inactive': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      'VIP': 'bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] border-[var(--gold-primary)]/30',
      'Completed': 'bg-green-500/20 text-green-400 border-green-500/30',
      'In Progress': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'Pending': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      'Confirmed': 'bg-green-500/20 text-green-400 border-green-500/30',
      'Cancelled': 'bg-red-500/20 text-red-400 border-red-500/30',
      'Low Stock': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      'Out of Stock': 'bg-red-500/20 text-red-400 border-red-500/30',
    }
    return statusConfig[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }

  // Handle modal
  const openModal = (type, item = null) => {
    setModalType(type)
    setSelectedItem(item)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setModalType(null)
    setSelectedItem(null)
  }

  // Handle refresh
  const handleRefresh = () => {
    setIsLoading(true)
    setTimeout(() => setIsLoading(false), 1000)
  }

  // Handle export
  const handleExport = () => {
    alert('Exporting data to CSV...')
  }

  // Open message panel
  const openMessagePanel = (order) => {
    setSelectedConversation(order)
    setMessagePanelOpen(true)
  }

  // Filter data based on search
  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredOrders = recentOrders.filter(o => 
    o.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.id.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Tab items
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'projects', label: 'Projects', icon: Briefcase },
    { id: 'appointments', label: 'Appointments', icon: Calendar },
    { id: 'messages', label: 'Messages', icon: MessageSquare, badge: recentOrders.reduce((acc, o) => acc + o.unreadCount, 0) },
  ]

  // Calculate total unread messages
  const totalUnread = recentOrders.reduce((acc, o) => acc + o.unreadCount, 0) + projects.reduce((acc, p) => acc + p.messages.filter(m => m.sender === 'customer').length, 0)

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-20 h-[calc(100vh-5rem)] bg-[var(--surface-dark)] border-r-2 border-white/30 transition-all duration-300 z-40 ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Toggle Button */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-6 w-6 h-6 bg-[var(--surface-dark)] border border-[var(--border)] rounded-full flex items-center justify-center hover:bg-[var(--gold-primary)] hover:border-[var(--gold-primary)] transition-all duration-200"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-[var(--text-muted)]" />
          )}
        </button>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 relative ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-primary)] hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && (
                  <>
                    <span>{tab.label}</span>
                    {tab.badge && tab.badge > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        {tab.badge}
                      </span>
                    )}
                  </>
                )}
                {sidebarCollapsed && tab.badge && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* User Profile */}
        <div className={`absolute bottom-4 left-0 right-0 px-4 ${sidebarCollapsed ? 'text-center' : ''}`}>
          <div className={`flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-primary)] border border-white/20 ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] flex items-center justify-center flex-shrink-0 border-2 border-white">
              <User className="w-5 h-5 text-[var(--text-dark)]" />
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm truncate">Admin User</p>
                <p className="text-white/60 text-xs">Administrator</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
        {/* Topbar */}
        <Topbar 
          title={tabs.find(t => t.id === activeTab)?.label || 'Dashboard'} 
          userRole="admin" 
        />

        {/* Page Content */}
        <main className="p-6">
          {/* Header Actions */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <p className="text-[var(--text-muted)]">Manage your CosmosCraft operations</p>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={handleRefresh}
                className="p-2 border border-[var(--border)] rounded-lg hover:border-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/10 transition-all duration-200"
              >
                <RefreshCw className={`w-5 h-5 text-[var(--text-muted)] ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button 
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 border border-[var(--border)] rounded-lg hover:border-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/10 transition-all duration-200 text-[var(--text-muted)]"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              <button 
                onClick={() => openModal('addProduct')}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] rounded-xl font-semibold hover:shadow-[0_0_30px_rgba(212,175,55,0.5)] transition-all duration-200"
              >
                <Plus className="w-5 h-5" />
                Add New
              </button>
            </div>
          </div>

          {/* Dashboard Tab */}
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {/* Stats Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  {stats.map((stat, i) => {
                    const Icon = stat.icon
                    return (
                      <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: i * 0.1 }}
                        className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 hover:border-[var(--gold-primary)]/50 transition-all duration-300"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-[var(--text-muted)] text-sm font-medium">{stat.label}</h3>
                          <div className="w-10 h-10 bg-[var(--gold-primary)]/20 rounded-lg flex items-center justify-center">
                            <Icon className="w-5 h-5 text-[var(--gold-primary)]" />
                          </div>
                        </div>
                        <div className="flex items-end justify-between">
                          <p className="text-3xl font-bold text-white">
                            {stat.isCurrency ? formatCurrency(stat.value, true) : stat.value.toLocaleString()}
                          </p>
                          <span className={`flex items-center gap-1 text-sm font-medium ${
                            stat.trend === 'up' ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {stat.trend === 'up' ? (
                              <ArrowUpRight className="w-4 h-4" />
                            ) : (
                              <ArrowDownRight className="w-4 h-4" />
                            )}
                            {stat.change}
                          </span>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>

                {/* Charts Row */}
                <div className="grid lg:grid-cols-2 gap-6 mb-8">
                  {/* Revenue Chart Placeholder */}
                  <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 shadow-lg">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-white">Revenue Overview</h3>
                      <select className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]">
                        <option>This Week</option>
                        <option>This Month</option>
                        <option>This Year</option>
                      </select>
                    </div>
                    <div className="h-48 flex items-end gap-2">
                      {[40, 65, 45, 80, 55, 90, 70].map((height, i) => (
                        <div
                          key={i}
                          className="flex-1 bg-gradient-to-t from-[var(--gold-primary)] to-[var(--gold-secondary)] rounded-t-lg transition-all duration-300 hover:opacity-80"
                          style={{ height: `${height}%` }}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between mt-4 text-xs text-[var(--text-muted)]">
                      <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                    </div>
                  </div>

                  {/* Order Status Chart */}
                  <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 shadow-lg">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-white">Order Status</h3>
                      <PieChart className="w-5 h-5 text-[var(--text-muted)]" />
                    </div>
                    <div className="flex items-center justify-center gap-8">
                      <div className="relative w-32 h-32">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="12" fill="none" className="text-[var(--gold-primary)]/20" />
                          <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="12" fill="none" strokeDasharray="176" strokeDashoffset="44" className="text-green-400" />
                          <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="12" fill="none" strokeDasharray="176" strokeDashoffset="88" className="text-blue-400" />
                          <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="12" fill="none" strokeDasharray="176" strokeDashoffset="132" className="text-yellow-400" />
                        </svg>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-green-400" />
                          <span className="text-sm text-[var(--text-muted)]">Completed (75%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-blue-400" />
                          <span className="text-sm text-[var(--text-muted)]">In Progress (25%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-yellow-400" />
                          <span className="text-sm text-[var(--text-muted)]">Pending (15%)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section Divider */}
                <div className="flex items-center gap-4 mb-8">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[var(--border)] to-transparent" />
                  <span className="text-sm font-medium text-[var(--text-muted)] px-4">Recent Activity</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[var(--border)] to-transparent" />
                </div>

                {/* Recent Orders with Messages */}
                <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-white">Recent Orders</h3>
                    <button 
                      onClick={() => setActiveTab('orders')}
                      className="text-sm text-[var(--gold-primary)] hover:text-[var(--gold-secondary)] transition-colors duration-200"
                    >
                      View All →
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b border-[var(--border)]">
                        <tr>
                          <th className="text-left py-3 text-[var(--text-muted)] font-medium text-sm">Order ID</th>
                          <th className="text-left py-3 text-[var(--text-muted)] font-medium text-sm">Customer</th>
                          <th className="text-left py-3 text-[var(--text-muted)] font-medium text-sm">Product</th>
                          <th className="text-left py-3 text-[var(--text-muted)] font-medium text-sm">Amount</th>
                          <th className="text-left py-3 text-[var(--text-muted)] font-medium text-sm">Status</th>
                          <th className="text-left py-3 text-[var(--text-muted)] font-medium text-sm">Date</th>
                          <th className="text-left py-3 text-[var(--text-muted)] font-medium text-sm">Messages</th>
                          <th className="text-left py-3 text-[var(--text-muted)] font-medium text-sm">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentOrders.slice(0, 5).map((order) => (
                          <tr key={order.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-primary)]/50 transition-colors duration-200">
                            <td className="py-4 text-white font-mono text-sm">{order.id}</td>
                            <td className="py-4 text-white">{order.customer}</td>
                            <td className="py-4 text-[var(--text-muted)]">{order.product}</td>
                            <td className="py-4 text-[var(--gold-primary)] font-semibold">{formatCurrency(order.amount, true)}</td>
                            <td className="py-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(order.status)}`}>
                                {order.status}
                              </span>
                            </td>
                            <td className="py-4 text-[var(--text-muted)] text-sm">{order.date}</td>
                            <td className="py-4">
                              <button
                                onClick={() => openMessagePanel(order)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors duration-200 ${
                                  order.hasMessages
                                    ? 'bg-[var(--gold-primary)]/10 hover:bg-[var(--gold-primary)]/20 text-[var(--gold-primary)]'
                                    : 'bg-[var(--bg-primary)] text-[var(--text-muted)] hover:text-white'
                                }`}
                              >
                                <MessageSquare className="w-4 h-4" />
                                {order.unreadCount > 0 && (
                                  <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                                    {order.unreadCount}
                                  </span>
                                )}
                              </button>
                            </td>
                            <td className="py-4">
                              <div className="flex items-center gap-2">
                                <button className="p-1.5 hover:bg-[var(--gold-primary)]/10 rounded transition-colors duration-200">
                                  <Eye className="w-4 h-4 text-[var(--text-muted)]" />
                                </button>
                                <button className="p-1.5 hover:bg-[var(--gold-primary)]/10 rounded transition-colors duration-200">
                                  <Edit className="w-4 h-4 text-[var(--text-muted)]" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Users Tab */}
          <AnimatePresence mode="wait">
            {activeTab === 'users' && (
              <motion.div
                key="users"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {/* Search */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      placeholder="Search users by name or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] focus:border-transparent transition-all duration-200"
                    />
                  </div>
                  <button className="flex items-center gap-2 px-4 py-3 bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl text-[var(--text-muted)] hover:text-white hover:border-[var(--gold-primary)] transition-all duration-200">
                    <Filter className="w-5 h-5" />
                    Filters
                  </button>
                </div>

                {/* Users Table */}
                <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-[var(--bg-primary)]">
                        <tr>
                          <th className="text-left py-4 px-6 text-[var(--text-muted)] font-medium text-sm">User</th>
                          <th className="text-left py-4 px-6 text-[var(--text-muted)] font-medium text-sm">Role</th>
                          <th className="text-left py-4 px-6 text-[var(--text-muted)] font-medium text-sm">Orders</th>
                          <th className="text-left py-4 px-6 text-[var(--text-muted)] font-medium text-sm">Total Spent</th>
                          <th className="text-left py-4 px-6 text-[var(--text-muted)] font-medium text-sm">Status</th>
                          <th className="text-left py-4 px-6 text-[var(--text-muted)] font-medium text-sm">Joined</th>
                          <th className="text-left py-4 px-6 text-[var(--text-muted)] font-medium text-sm">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((user) => (
                          <tr key={user.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-primary)]/50 transition-colors duration-200">
                            <td className="py-4 px-6">
                              <div>
                                <p className="text-white font-semibold">{user.name}</p>
                                <p className="text-[var(--text-muted)] text-sm">{user.email}</p>
                              </div>
                            </td>
                            <td className="py-4 px-6">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(user.role)}`}>
                                {user.role}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-white">{user.orders}</td>
                            <td className="py-4 px-6 text-[var(--gold-primary)] font-semibold">{formatCurrency(user.totalSpent, true)}</td>
                            <td className="py-4 px-6">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(user.status)}`}>
                                {user.status}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-[var(--text-muted)] text-sm">{user.joined}</td>
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-2">
                                <button className="p-1.5 hover:bg-[var(--gold-primary)]/10 rounded transition-colors duration-200">
                                  <Eye className="w-4 h-4 text-[var(--text-muted)]" />
                                </button>
                                <button className="p-1.5 hover:bg-[var(--gold-primary)]/10 rounded transition-colors duration-200">
                                  <Edit className="w-4 h-4 text-[var(--text-muted)]" />
                                </button>
                                <button className="p-1.5 hover:bg-red-500/10 rounded transition-colors duration-200">
                                  <Trash2 className="w-4 h-4 text-red-400" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Products Tab */}
          <AnimatePresence mode="wait">
            {activeTab === 'products' && (
              <motion.div
                key="products"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {/* Search */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      placeholder="Search products..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] focus:border-transparent transition-all duration-200"
                    />
                  </div>
                </div>

                {/* Products Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProducts.map((product) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 hover:border-[var(--gold-primary)]/50 transition-all duration-300"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="text-[var(--text-muted)] text-xs font-mono mb-1">{product.id}</p>
                          <h3 className="text-white font-semibold text-lg">{product.name}</h3>
                        </div>
                        <button className="p-1.5 hover:bg-[var(--bg-primary)] rounded transition-colors duration-200">
                          <MoreVertical className="w-5 h-5 text-[var(--text-muted)]" />
                        </button>
                      </div>
                      <p className="text-[var(--text-muted)] text-sm mb-4">{product.category}</p>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-2xl font-bold bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] bg-clip-text text-transparent">
                          {formatCurrency(product.price, true)}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(product.status)}`}>
                          {product.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
                        <div>
                          <p className="text-[var(--text-muted)] text-xs">Stock</p>
                          <p className="text-white font-semibold">{product.stock === 999 ? '∞' : product.stock}</p>
                        </div>
                        <div>
                          <p className="text-[var(--text-muted)] text-xs">Sold</p>
                          <p className="text-white font-semibold">{product.sold}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button className="p-2 hover:bg-[var(--gold-primary)]/10 rounded transition-colors duration-200">
                            <Edit className="w-4 h-4 text-[var(--text-muted)]" />
                          </button>
                          <button className="p-2 hover:bg-red-500/10 rounded transition-colors duration-200">
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Orders Tab */}
          <AnimatePresence mode="wait">
            {activeTab === 'orders' && (
              <motion.div
                key="orders"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {/* Search */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      placeholder="Search orders by ID or customer..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] focus:border-transparent transition-all duration-200"
                    />
                  </div>
                </div>

                {/* Orders Table */}
                <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-[var(--bg-primary)]">
                        <tr>
                          <th className="text-left py-4 px-6 text-[var(--text-muted)] font-medium text-sm">Order ID</th>
                          <th className="text-left py-4 px-6 text-[var(--text-muted)] font-medium text-sm">Customer</th>
                          <th className="text-left py-4 px-6 text-[var(--text-muted)] font-medium text-sm">Product</th>
                          <th className="text-left py-4 px-6 text-[var(--text-muted)] font-medium text-sm">Amount</th>
                          <th className="text-left py-4 px-6 text-[var(--text-muted)] font-medium text-sm">Status</th>
                          <th className="text-left py-4 px-6 text-[var(--text-muted)] font-medium text-sm">Date</th>
                          <th className="text-left py-4 px-6 text-[var(--text-muted)] font-medium text-sm">Messages</th>
                          <th className="text-left py-4 px-6 text-[var(--text-muted)] font-medium text-sm">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrders.map((order) => (
                          <tr key={order.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-primary)]/50 transition-colors duration-200">
                            <td className="py-4 px-6 text-white font-mono text-sm">{order.id}</td>
                            <td className="py-4 px-6 text-white">{order.customer}</td>
                            <td className="py-4 px-6 text-[var(--text-muted)]">{order.product}</td>
                            <td className="py-4 px-6 text-[var(--gold-primary)] font-semibold">{formatCurrency(order.amount, true)}</td>
                            <td className="py-4 px-6">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(order.status)}`}>
                                {order.status}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-[var(--text-muted)] text-sm">{order.date}</td>
                            <td className="py-4 px-6">
                              <button
                                onClick={() => openMessagePanel(order)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors duration-200 ${
                                  order.hasMessages
                                    ? 'bg-[var(--gold-primary)]/10 hover:bg-[var(--gold-primary)]/20 text-[var(--gold-primary)]'
                                    : 'bg-[var(--bg-primary)] text-[var(--text-muted)] hover:text-white'
                                }`}
                              >
                                <MessageSquare className="w-4 h-4" />
                                {order.unreadCount > 0 && (
                                  <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                                    {order.unreadCount}
                                  </span>
                                )}
                              </button>
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-2">
                                <button className="p-1.5 hover:bg-[var(--gold-primary)]/10 rounded transition-colors duration-200">
                                  <Eye className="w-4 h-4 text-[var(--text-muted)]" />
                                </button>
                                <button className="p-1.5 hover:bg-[var(--gold-primary)]/10 rounded transition-colors duration-200">
                                  <Edit className="w-4 h-4 text-[var(--text-muted)]" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Projects Tab */}
          <AnimatePresence mode="wait">
            {activeTab === 'projects' && (
              <motion.div
                key="projects"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="space-y-6">
                  {projects.map((project) => (
                    <div key={project.id} className="flex flex-col lg:flex-row gap-6">
                      <div className="flex-1">
                        <ProjectProgress
                          orderId={project.id}
                          projectName={project.name}
                          customerName={project.customer}
                          assignedStaff={project.assignedStaff}
                          currentStage={project.stage}
                          startDate={project.startDate}
                          estimatedCompletion={project.estimatedCompletion}
                          isEditable={true}
                        />
                      </div>
                      <div className="lg:w-80">
                        <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
                          <h3 className="text-white font-semibold mb-4">Project Value</h3>
                          <p className="text-3xl font-bold bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] bg-clip-text text-transparent mb-4">
                            {formatCurrency(project.totalPrice, true)}
                          </p>
                          <button
                            onClick={() => openMessagePanel(project)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[var(--gold-primary)]/10 hover:bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] rounded-xl transition-colors duration-200"
                          >
                            <MessageSquare className="w-5 h-5" />
                            View Messages ({project.messages.length})
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Appointments Tab */}
          <AnimatePresence mode="wait">
            {activeTab === 'appointments' && (
              <motion.div
                key="appointments"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {appointments.map((apt) => (
                    <motion.div
                      key={apt.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 hover:border-[var(--gold-primary)]/50 transition-all duration-300"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <p className="text-[var(--text-muted)] text-xs font-mono">{apt.id}</p>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(apt.status)}`}>
                          {apt.status}
                        </span>
                      </div>
                      <h3 className="text-white font-semibold text-lg mb-2">{apt.service}</h3>
                      <p className="text-[var(--gold-primary)] font-medium mb-4">{apt.customer}</p>
                      <div className="flex items-center gap-4 text-[var(--text-muted)] text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {apt.date}
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          {apt.time}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[var(--border)]">
                        <button className="flex-1 py-2 bg-[var(--gold-primary)]/10 hover:bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] rounded-lg transition-colors duration-200 text-sm font-medium">
                          View Details
                        </button>
                        <button className="p-2 hover:bg-green-500/10 rounded transition-colors duration-200">
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        </button>
                        <button className="p-2 hover:bg-red-500/10 rounded transition-colors duration-200">
                          <XCircle className="w-5 h-5 text-red-400" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Messages Tab */}
          <AnimatePresence mode="wait">
            {activeTab === 'messages' && (
              <motion.div
                key="messages"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
                  <h2 className="text-xl font-bold text-white mb-6">Customer Conversations</h2>
                  <div className="space-y-4">
                    {/* Orders with messages */}
                    {recentOrders.filter(o => o.hasMessages).map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between p-4 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl hover:border-[var(--gold-primary)]/50 transition-all duration-200"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] flex items-center justify-center">
                            <span className="text-[var(--text-dark)] font-bold text-lg">
                              {order.customer.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="text-white font-medium">{order.customer}</p>
                            <p className="text-[var(--text-muted)] text-sm">{order.product}</p>
                            {order.latestMessage && (
                              <p className="text-[var(--text-muted)] text-xs mt-1 truncate max-w-md">
                                {order.latestMessage}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {order.unreadCount > 0 && (
                            <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                              {order.unreadCount} new
                            </span>
                          )}
                          <button
                            onClick={() => openMessagePanel(order)}
                            className="px-4 py-2 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] rounded-xl font-medium text-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all duration-200"
                          >
                            Open Chat
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Message Panel */}
      <MessagePanel
        isOpen={messagePanelOpen}
        onClose={() => {
          setMessagePanelOpen(false)
          setSelectedConversation(null)
        }}
        orderId={selectedConversation?.id}
        customerName={selectedConversation?.customer}
        customerEmail={selectedConversation?.customerEmail}
        initialMessages={selectedConversation?.messages || []}
        onSendMessage={(message) => console.log('New message:', message)}
      />

      {/* Add Product Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-8 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Add New Product</h2>
                <button onClick={closeModal} className="p-2 hover:bg-[var(--bg-primary)] rounded-lg transition-colors duration-200">
                  <X className="w-5 h-5 text-[var(--text-muted)]" />
                </button>
              </div>
              <form className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Product Name</label>
                  <input
                    type="text"
                    placeholder="Enter product name"
                    className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Category</label>
                  <select className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] transition-all duration-200">
                    <option value="">Select category</option>
                    <option value="custom">Custom Builds</option>
                    <option value="services">Services</option>
                    <option value="parts">Parts</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Price (USD)</label>
                  <input
                    type="text"
                    placeholder="$0.00"
                    className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] transition-all duration-200"
                  />
                  <p className="text-[var(--text-muted)] text-xs mt-1">Will be displayed as ₱ in the frontend</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Stock</label>
                  <input
                    type="number"
                    placeholder="0"
                    className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] transition-all duration-200"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full px-6 py-3 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] rounded-xl font-semibold hover:shadow-[0_0_30px_rgba(212,175,55,0.5)] transition-all duration-200 mt-4"
                >
                  Add Product
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default AdminPage
