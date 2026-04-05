import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
import {
  BarChart3,
  Briefcase,
  MessageSquare,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  ChevronRight,
  ChevronLeft,
  Filter,
  Search,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  Send,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Edit,
  Save,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Topbar } from '../components/admin/Topbar'
import { MessagePanel } from '../components/admin/MessagePanel'
import { ProjectProgress, StageSelector } from '../components/admin/ProjectProgress'
import { formatCurrency } from '../utils/formatCurrency'

// Mock data for staff's assigned projects
const mockStaffProjects = [
  {
    id: 'PRJ-2024-001',
    name: 'Custom Les Paul - Michael Chen',
    customerName: 'Michael Chen',
    customerEmail: 'michael.chen@email.com',
    stage: 2, // Assembly
    assignedStaff: 'Juan dela Cruz',
    startDate: '2024-03-01',
    estimatedCompletion: '2024-04-15',
    totalPrice: 2450,
    messages: [
      { id: 1, sender: 'customer', text: 'Excited to see the progress!', timestamp: '2024-03-10T09:00:00', status: 'read' },
      { id: 2, sender: 'staff', text: 'We\'ve started the assembly process. The body is coming together beautifully.', timestamp: '2024-03-12T14:30:00', status: 'read' },
    ],
  },
  {
    id: 'PRJ-2024-002',
    name: 'Custom Telecaster - David Kim',
    customerName: 'David Kim',
    customerEmail: 'david.kim@frets.com',
    stage: 3, // Painting
    assignedStaff: 'Juan dela Cruz',
    startDate: '2024-02-15',
    estimatedCompletion: '2024-04-01',
    totalPrice: 3200,
    messages: [
      { id: 1, sender: 'staff', text: 'Wood selection is complete. Moving to assembly.', timestamp: '2024-02-20T10:00:00', status: 'read' },
      { id: 2, sender: 'customer', text: 'Can\'t wait! What wood did you choose?', timestamp: '2024-02-21T08:30:00', status: 'read' },
      { id: 3, sender: 'staff', text: 'We went with premium alder for the body and a gorgeous roasted maple neck.', timestamp: '2024-02-21T11:00:00', status: 'read' },
    ],
  },
  {
    id: 'PRJ-2024-003',
    name: 'Refret Service - Emily Thompson',
    customerName: 'Emily Thompson',
    customerEmail: 'emily.t@stringshop.com',
    stage: 0, // Design
    assignedStaff: 'Juan dela Cruz',
    startDate: '2024-03-18',
    estimatedCompletion: '2024-03-25',
    totalPrice: 285,
    messages: [],
  },
]

// Mock upcoming appointments
const mockAppointments = [
  { id: 'APT-001', customer: 'James Rodriguez', service: 'Pickup Consultation', date: '2024-03-20', time: '10:00 AM', status: 'Confirmed' },
  { id: 'APT-002', customer: 'Sarah Williams', service: 'Setup Inspection', date: '2024-03-21', time: '2:00 PM', status: 'Pending' },
  { id: 'APT-003', customer: 'Lisa Martinez', service: 'Custom Order Discussion', date: '2024-03-22', time: '11:30 AM', status: 'Confirmed' },
]

/**
 * StaffDashboard - Limited access dashboard for staff members
 * Features:
 * - View assigned projects
 * - Update project progress
 * - Send customer updates
 * - View schedule
 */
export function StaffDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('mytasks')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [projects, setProjects] = useState(mockStaffProjects)
  const [selectedProject, setSelectedProject] = useState(null)
  const [messagePanelOpen, setMessagePanelOpen] = useState(false)
  const [showStageSelector, setShowStageSelector] = useState(false)
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [projectForm, setProjectForm] = useState({
    name: '',
    customerName: '',
    customerEmail: '',
    stage: 0,
    totalPrice: 0,
  })

  // Auth checks disabled - allow access without authentication for development

  // Calculate stats
  const totalProjects = projects.length
  const completedProjects = projects.filter(p => p.stage === 5).length
  const inProgressProjects = projects.filter(p => p.stage > 0 && p.stage < 5).length
  const pendingProjects = projects.filter(p => p.stage === 0).length
  const unreadMessages = projects.reduce((acc, p) => acc + p.messages.filter(m => m.sender === 'customer' && !m.status?.includes('read')).length, 0)

  const handleSendMessage = (projectId, message) => {
    setProjects(prev =>
      prev.map(p =>
        p.id === projectId
          ? { ...p, messages: [...p.messages, { ...message, status: 'sent' }] }
          : p
      )
    )
  }

  const handleStageChange = (projectId, newStage) => {
    setProjects(prev =>
      prev.map(p =>
        p.id === projectId ? { ...p, stage: newStage } : p
      )
    )
    setShowStageSelector(false)
  }

  // Open create project modal
  const handleOpenCreateProject = () => {
    setEditingProject(null)
    setProjectForm({
      name: '',
      customerName: '',
      customerEmail: '',
      stage: 0,
      totalPrice: 0,
    })
    setShowProjectModal(true)
  }

  // Open edit project modal
  const handleOpenEditProject = (project) => {
    setEditingProject(project)
    setProjectForm({
      name: project.name,
      customerName: project.customerName,
      customerEmail: project.customerEmail,
      stage: project.stage,
      totalPrice: project.totalPrice,
    })
    setShowProjectModal(true)
  }

  // Handle form input change
  const handleFormChange = (field, value) => {
    setProjectForm(prev => ({ ...prev, [field]: value }))
  }

  // Save project (create or update)
  const handleSaveProject = () => {
    if (!projectForm.name.trim() || !projectForm.customerName.trim()) {
      alert('Please fill in project name and customer name')
      return
    }

    if (editingProject) {
      // Update existing project
      setProjects(prev =>
        prev.map(p =>
          p.id === editingProject.id
            ? { ...p, ...projectForm }
            : p
        )
      )
    } else {
      // Create new project
      const newProject = {
        id: `PRJ-${Date.now()}`,
        name: projectForm.name,
        customerName: projectForm.customerName,
        customerEmail: projectForm.customerEmail,
        stage: parseInt(projectForm.stage) || 0,
        assignedStaff: user?.name || 'Staff Member',
        startDate: new Date().toISOString().split('T')[0],
        estimatedCompletion: '',
        totalPrice: parseFloat(projectForm.totalPrice) || 0,
        messages: [],
      }
      setProjects(prev => [newProject, ...prev])
    }

    setShowProjectModal(false)
    setEditingProject(null)
  }

  // Delete project
  const handleDeleteProject = (projectId) => {
    if (confirm('Are you sure you want to delete this project?')) {
      setProjects(prev => prev.filter(p => p.id !== projectId))
    }
  }

  const staffNavItems = [
    { id: 'mytasks', label: 'My Tasks', icon: BarChart3, path: '/staff' },
    { id: 'myprojects', label: 'My Projects', icon: Briefcase, path: '/staff/projects' },
    { id: 'messages', label: 'Messages', icon: MessageSquare, path: '/staff/messages', badge: unreadMessages || null },
    { id: 'schedule', label: 'Schedule', icon: Calendar, path: '/staff/schedule' },
  ]

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen bg-[#1E201E] border-r-2 border-white/30 transition-all duration-300 z-40 ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        } ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Toggle Button */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-6 w-6 h-6 bg-[#1E201E] border border-white/30 rounded-full flex items-center justify-center hover:bg-[var(--gold-primary)] hover:border-[var(--gold-primary)] transition-all duration-200 hidden lg:flex"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-[var(--text-muted)]" />
          )}
        </button>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {staffNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id)
                setMobileMenuOpen(false)
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 relative ${
                activeTab === item.id
                  ? 'bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] border-2 border-[var(--gold-primary)] shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-primary)] hover:text-white border-2 border-transparent'
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!sidebarCollapsed && (
                <>
                  <span className="font-medium">{item.label}</span>
                  {item.badge && item.badge > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
              {sidebarCollapsed && item.badge && item.badge > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* User Profile */}
        <div className={`absolute bottom-4 left-0 right-0 px-4 ${sidebarCollapsed ? 'text-center' : ''}`}>
          <div className={`flex items-center gap-3 p-3 rounded-xl bg-[#1E201E] border border-white/30 ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] flex items-center justify-center flex-shrink-0 border-2 border-white">
              <User className="w-5 h-5 text-[var(--text-dark)]" />
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm truncate">{user?.name || 'Staff Member'}</p>
                <p className="text-white/60 text-xs">Staff</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Topbar */}
        <Topbar
          title={staffNavItems.find(t => t.id === activeTab)?.label || 'Dashboard'}
          userRole="staff"
          onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          showMenuButton
        />

        {/* Page Content */}
        <main className="p-6 pt-20">
          {/* My Tasks Tab */}
          {activeTab === 'mytasks' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Quick Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-[var(--surface-dark)] border-2 border-[var(--border)] rounded-2xl p-4 hover:border-[var(--gold-primary)] hover:shadow-[0_0_15px_rgba(212,175,55,0.2)] transition-all duration-200 cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[var(--text-muted)] text-sm">Total Projects</p>
                    <Briefcase className="w-5 h-5 text-[var(--gold-primary)]" />
                  </div>
                  <p className="text-3xl font-bold text-white">{totalProjects}</p>
                </div>
                <div className="bg-[var(--surface-dark)] border-2 border-[var(--border)] rounded-2xl p-4 hover:border-blue-400 hover:shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-all duration-200 cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[var(--text-muted)] text-sm">In Progress</p>
                    <Clock className="w-5 h-5 text-blue-400" />
                  </div>
                  <p className="text-3xl font-bold text-white">{inProgressProjects}</p>
                </div>
                <div className="bg-[var(--surface-dark)] border-2 border-[var(--border)] rounded-2xl p-4 hover:border-green-400 hover:shadow-[0_0_15px_rgba(34,197,94,0.2)] transition-all duration-200 cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[var(--text-muted)] text-sm">Completed</p>
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  </div>
                  <p className="text-3xl font-bold text-white">{completedProjects}</p>
                </div>
                <div className="bg-[var(--surface-dark)] border-2 border-[var(--border)] rounded-2xl p-4 hover:border-yellow-400 hover:shadow-[0_0_15px_rgba(234,179,8,0.2)] transition-all duration-200 cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[var(--text-muted)] text-sm">Unread Messages</p>
                    <MessageSquare className="w-5 h-5 text-yellow-400" />
                  </div>
                  <p className="text-3xl font-bold text-white">{unreadMessages}</p>
                </div>
              </div>

              {/* Assigned Projects */}
              <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white">My Assigned Projects</h2>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={handleOpenCreateProject}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] rounded-lg font-medium text-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all duration-200"
                    >
                      <Plus className="w-4 h-4" />
                      Create Project
                    </button>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {projects.map((project) => (
                  <div
                    key={project.id}
                    className="bg-[var(--bg-primary)] border-2 border-[var(--border)] rounded-xl p-4 hover:border-[var(--gold-primary)] hover:shadow-[0_0_15px_rgba(212,175,55,0.2)] transition-all duration-200 cursor-pointer"
                  >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-[var(--text-muted)] text-xs font-mono mb-1">{project.id}</p>
                          <h3 className="text-white font-semibold">{project.name}</h3>
                          <p className="text-[var(--text-muted)] text-sm">Customer: {project.customerName}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedProject(project)
                              setMessagePanelOpen(true)
                            }}
                            className="p-2 hover:bg-[var(--gold-primary)]/10 rounded-lg transition-colors duration-200"
                            title="Send Message"
                          >
                            <MessageSquare className="w-5 h-5 text-[var(--gold-primary)]" />
                          </button>
                          <button
                            onClick={() => handleOpenEditProject(project)}
                            className="p-2 hover:bg-blue-500/10 rounded-lg transition-colors duration-200"
                            title="Edit Project"
                          >
                            <Edit className="w-5 h-5 text-blue-400" />
                          </button>
                          <button
                            onClick={() => handleDeleteProject(project.id)}
                            className="p-2 hover:bg-red-500/10 rounded-lg transition-colors duration-200"
                            title="Delete Project"
                          >
                            <X className="w-5 h-5 text-red-400" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedProject(project)
                              setShowStageSelector(true)
                            }}
                            className="px-3 py-1.5 bg-[var(--gold-primary)]/10 hover:bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] rounded-lg text-sm font-medium transition-colors duration-200"
                          >
                            Update Stage
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="text-[var(--text-muted)] text-xs">Est. Completion</p>
                            <p className="text-white text-sm">{project.estimatedCompletion}</p>
                          </div>
                          <div>
                            <p className="text-[var(--text-muted)] text-xs">Value</p>
                            <p className="text-[var(--gold-primary)] font-semibold text-sm">
                              {formatCurrency(project.totalPrice, true)}
                            </p>
                          </div>
                        </div>
                        {/* Mini Progress */}
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-[var(--surface-dark)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] rounded-full"
                              style={{ width: `${((project.stage + 1) / 6) * 100}%` }}
                            />
                          </div>
                          <span className="text-[var(--text-muted)] text-xs">
                            {Math.round(((project.stage + 1) / 6) * 100)}%
                          </span>
                        </div>
                      </div>
                      {/* Latest Message Preview */}
                      {project.messages.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-[var(--border)]">
                          <p className="text-[var(--text-muted)] text-xs truncate">
                            <span className="text-[var(--gold-primary)]">Latest:</span> {project.messages[project.messages.length - 1].text}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Upcoming Appointments */}
              <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 mt-6">
                <h2 className="text-xl font-bold text-white mb-6">Upcoming Appointments</h2>
                <div className="space-y-3">
                  {mockAppointments.map((apt) => (
                    <div
                      key={apt.id}
                      className="flex items-center justify-between p-4 bg-[var(--bg-primary)] border-2 border-[var(--border)] rounded-xl hover:border-[var(--gold-primary)] hover:shadow-[0_0_15px_rgba(212,175,55,0.2)] transition-all duration-200 cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[var(--gold-primary)]/20 to-[var(--gold-secondary)]/20 flex items-center justify-center">
                          <Calendar className="w-6 h-6 text-[var(--gold-primary)]" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{apt.service}</p>
                          <p className="text-[var(--text-muted)] text-sm">{apt.customer}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-medium">{apt.time}</p>
                        <p className="text-[var(--text-muted)] text-sm">{apt.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* My Projects Tab */}
          {activeTab === 'myprojects' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="space-y-6">
                {projects.map((project) => (
                  <ProjectProgress
                    key={project.id}
                    orderId={project.id}
                    projectName={project.name}
                    customerName={project.customerName}
                    assignedStaff={project.assignedStaff}
                    currentStage={project.stage}
                    startDate={project.startDate}
                    estimatedCompletion={project.estimatedCompletion}
                    isEditable={true}
                    onStageChange={(stage) => handleStageChange(project.id, stage)}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Messages Tab */}
          {activeTab === 'messages' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-white mb-6">Customer Messages</h2>
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-[var(--text-muted)] text-xs font-mono">{project.id}</p>
                        <h3 className="text-white font-semibold">{project.customerName}</h3>
                        <p className="text-[var(--text-muted)] text-sm">{project.name}</p>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedProject(project)
                          setMessagePanelOpen(true)
                        }}
                        className="px-4 py-2 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] rounded-xl font-medium text-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all duration-200"
                      >
                        Open Chat
                      </button>
                    </div>
                    {project.messages.length > 0 ? (
                      <div className="space-y-2">
                        {project.messages.slice(-3).map((msg) => (
                          <div
                            key={msg.id}
                            className={`p-3 rounded-xl ${
                              msg.sender === 'staff'
                                ? 'bg-[var(--gold-primary)]/10 ml-8'
                                : 'bg-[var(--bg-primary)] mr-8'
                            }`}
                          >
                            <p className="text-white text-sm">{msg.text}</p>
                            <p className="text-[var(--text-muted)] text-xs mt-1">
                              {new Date(msg.timestamp).toLocaleString('en-PH', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[var(--text-muted)] text-sm italic">No messages yet</p>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Schedule Tab */}
          {activeTab === 'schedule' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
                <h2 className="text-xl font-bold text-white mb-6">My Schedule</h2>
                <div className="space-y-4">
                  {mockAppointments.map((apt) => (
                    <div
                      key={apt.id}
                      className="flex items-center justify-between p-4 bg-[var(--bg-primary)] border-2 border-[var(--border)] rounded-xl hover:border-[var(--gold-primary)] hover:shadow-[0_0_15px_rgba(212,175,55,0.2)] transition-all duration-200 cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-[var(--gold-primary)]/20 to-[var(--gold-secondary)]/20 flex flex-col items-center justify-center">
                          <span className="text-[var(--gold-primary)] font-bold text-lg">
                            {apt.date.split('-')[2]}
                          </span>
                          <span className="text-[var(--text-muted)] text-xs">
                            {new Date(apt.date).toLocaleString('en-PH', { month: 'short' })}
                          </span>
                        </div>
                        <div>
                          <p className="text-white font-semibold">{apt.service}</p>
                          <p className="text-[var(--text-muted)] text-sm">{apt.customer}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[var(--gold-primary)] font-semibold">{apt.time}</p>
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium mt-1 ${
                          apt.status === 'Confirmed'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {apt.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </main>
      </div>

      {/* Message Panel */}
      <MessagePanel
        isOpen={messagePanelOpen}
        onClose={() => {
          setMessagePanelOpen(false)
          setSelectedProject(null)
        }}
        orderId={selectedProject?.id}
        customerName={selectedProject?.customerName}
        customerEmail={selectedProject?.customerEmail}
        initialMessages={selectedProject?.messages || []}
        onSendMessage={(message) => handleSendMessage(selectedProject?.id, message)}
      />

      {/* Stage Selector Modal */}
      {showStageSelector && selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 max-w-md w-full"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Update Project Stage</h2>
              <button
                onClick={() => setShowStageSelector(false)}
                className="p-2 hover:bg-[var(--bg-primary)] rounded-lg transition-colors duration-200"
              >
                <X className="w-5 h-5 text-[var(--text-muted)]" />
              </button>
            </div>
            <p className="text-[var(--text-muted)] text-sm mb-4">
              Project: {selectedProject.name}
            </p>
            <StageSelector
              currentStage={selectedProject.stage}
              onStageChange={(stage) => handleStageChange(selectedProject.id, stage)}
            />
          </motion.div>
        </div>
      )}

      {/* Create/Edit Project Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 max-w-lg w-full"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">
                {editingProject ? 'Edit Project' : 'Create New Project'}
              </h2>
              <button
                onClick={() => setShowProjectModal(false)}
                className="p-2 hover:bg-[var(--bg-primary)] rounded-lg transition-colors duration-200"
              >
                <X className="w-5 h-5 text-[var(--text-muted)]" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Project Name */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={projectForm.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  placeholder="e.g., Custom Les Paul - John Doe"
                  className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] focus:border-transparent transition-all duration-200"
                />
              </div>

              {/* Customer Name */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Customer Name *
                </label>
                <input
                  type="text"
                  value={projectForm.customerName}
                  onChange={(e) => handleFormChange('customerName', e.target.value)}
                  placeholder="e.g., John Doe"
                  className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] focus:border-transparent transition-all duration-200"
                />
              </div>

              {/* Customer Email */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Customer Email
                </label>
                <input
                  type="email"
                  value={projectForm.customerEmail}
                  onChange={(e) => handleFormChange('customerEmail', e.target.value)}
                  placeholder="e.g., john@example.com"
                  className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] focus:border-transparent transition-all duration-200"
                />
              </div>

              {/* Total Price */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Total Price (PHP)
                </label>
                <input
                  type="number"
                  value={projectForm.totalPrice}
                  onChange={(e) => handleFormChange('totalPrice', e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] focus:border-transparent transition-all duration-200"
                />
              </div>

              {/* Stage (only for edit) */}
              {editingProject && (
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Project Stage
                  </label>
                  <select
                    value={projectForm.stage}
                    onChange={(e) => handleFormChange('stage', parseInt(e.target.value))}
                    className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] focus:border-transparent transition-all duration-200"
                  >
                    <option value={0}>Design</option>
                    <option value={1}>Wood Selection</option>
                    <option value={2}>Assembly</option>
                    <option value={3}>Painting</option>
                    <option value={4}>Setup</option>
                    <option value={5}>Completed</option>
                  </select>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[var(--border)]">
              <button
                onClick={() => setShowProjectModal(false)}
                className="px-6 py-3 border border-[var(--border)] text-white rounded-lg font-medium hover:bg-[var(--bg-primary)] transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProject}
                className="px-6 py-3 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] rounded-lg font-semibold hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all duration-200 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {editingProject ? 'Save Changes' : 'Create Project'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

export default StaffDashboard
