import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Search, Filter, Calendar, Clock, User, ChevronLeft, ChevronRight,
  RefreshCw, X, CheckCircle, XCircle, AlertCircle, Loader2,
  MoreHorizontal, Eye, Edit, Trash2, Plus, Download, ChevronDown
} from 'lucide-react'
import { format, parseISO, isToday, isTomorrow, isPast, isFuture } from 'date-fns'
import React from 'react';
import AppointmentDetailsModal from './AppointmentDetailsModal';

// Status configuration
const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: AlertCircle },
  approved: { label: 'Approved', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: CheckCircle },
  confirmed: { label: 'Confirmed', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle },
  in_progress: { label: 'In Progress', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: Clock },
  completed: { label: 'Completed', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
}

const DATE_FILTERS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
]

const STATUS_FILTERS = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

// Skeleton loader component
function AppointmentSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-20 bg-[var(--surface-dark)] rounded-2xl mb-3" />
      <div className="h-20 bg-[var(--surface-dark)] rounded-2xl mb-3" />
      <div className="h-20 bg-[var(--surface-dark)] rounded-2xl mb-3" />
    </div>
  )
}

// Empty state component
function EmptyState({ onClearFilters }) {
  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-12 text-center">
      <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-[var(--border)] flex items-center justify-center">
        <Calendar className="w-8 h-8 text-[var(--text-muted)]" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">No Appointments Found</h3>
      <p className="text-[var(--text-muted)] mb-6">
        No appointments match your current filters. Try adjusting your search criteria.
      </p>
      <button
        onClick={onClearFilters}
        className="px-4 py-2 rounded-xl bg-[var(--gold-primary)] text-black font-medium hover:bg-[var(--gold-primary)]/90 transition-colors"
      >
        Clear Filters
      </button>
    </div>
  )
}

// Status badge component
function StatusBadge({ status, config = STATUS_CONFIG }) {
  const statusConfig = config[status] || { label: status, color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' }
  const Icon = statusConfig.icon || AlertCircle

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider border ${statusConfig.color}`}>
      <Icon className="w-3 h-3" />
      {statusConfig.label}
    </span>
  )
}

// Format date helper
function formatAppointmentDate(dateStr) {
  if (!dateStr) return 'N/A'
  const date = new Date(dateStr)
  if (isToday(date)) return `Today, ${format(date, 'h:mm a')}`
  if (isTomorrow(date)) return `Tomorrow, ${format(date, 'h:mm a')}`
  return format(date, 'MMM d, yyyy h:mm a')
}

// Get customer name helper
function getCustomerName(appointment) {
  return appointment.user_name || appointment.customer_name || 'Guest'
}

// Main AppointmentList component
export default function AppointmentList({
  appointments = [],
  loading = false,
  onRefresh,
  onViewDetails,
  onEdit,
  onCreateNew,
  pagination = {},
  onPageChange,
  onFilterChange,
  selectedDate = null,
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode] = useState('list') // 'list' or 'grid'
  const [showFilters, setShowFilters] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)

  // Filter appointments based on search and filters
  const filteredAppointments = useMemo(() => {
    let result = [...appointments]

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(apt =>
        getCustomerName(apt).toLowerCase().includes(query) ||
        apt.appointment_id?.toLowerCase().includes(query) ||
        apt.notes?.toLowerCase().includes(query) ||
        (apt.services && JSON.stringify(apt.services).toLowerCase().includes(query))
      )
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date()
      result = result.filter(apt => {
        const aptDate = new Date(apt.scheduled_at)
        switch (dateFilter) {
          case 'today':
            return isToday(aptDate)
          case 'upcoming':
            return isFuture(aptDate) && !isToday(aptDate)
          case 'past':
            return isPast(aptDate) && !isToday(aptDate)
          default:
            return true
        }
      })
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(apt => apt.status === statusFilter)
    }

    return result
  }, [appointments, searchQuery, dateFilter, statusFilter])

  // Handle filter changes
  const handleDateFilterChange = (value) => {
    setDateFilter(value)
    onFilterChange?.({ date: value, status: statusFilter, search: searchQuery })
  }

  const handleStatusFilterChange = (value) => {
    setStatusFilter(value)
    onFilterChange?.({ date: dateFilter, status: value, search: searchQuery })
  }

  const handleSearchChange = (value) => {
    setSearchQuery(value)
    onFilterChange?.({ date: dateFilter, status: statusFilter, search: value })
  }

  const clearFilters = () => {
    setSearchQuery('')
    setDateFilter('all')
    setStatusFilter('all')
    onFilterChange?.({ date: 'all', status: 'all', search: '' })
  }

  const hasActiveFilters = searchQuery || dateFilter !== 'all' || statusFilter !== 'all'

  // Pagination
  const currentPage = pagination.page || 1
  const totalPages = pagination.pages || 1
  const totalItems = pagination.total || 0

  const handlePrevPage = () => {
    if (currentPage > 1) {
      onPageChange?.(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      onPageChange?.(currentPage + 1)
    }
  }

  const handleViewDetails = (appointment) => {
    setSelectedAppointment(appointment)
    setShowDetailsModal(true)
  }

  const handleCloseModal = () => {
    setShowDetailsModal(false)
    setSelectedAppointment(null)
  }

  const handleEditAppointment = () => {
    console.log('Edit appointment:', selectedAppointment)
    // Add logic to handle editing the appointment
  }

  const handleCancelAppointment = () => {
    console.log('Cancel appointment:', selectedAppointment)
    // Add logic to handle canceling the appointment
  }

  const handleCompleteAppointment = () => {
    console.log('Mark appointment as completed:', selectedAppointment)
    // Add logic to handle marking the appointment as completed
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-white">Appointments</h2>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            {selectedDate ? `Showing appointments for ${format(parseISO(selectedDate), 'MMMM d, yyyy')}` :
              `${filteredAppointments.length} appointment${filteredAppointments.length !== 1 ? 's' : ''} found`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-[var(--text-muted)] hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)] transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={onCreateNew}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--gold-primary)] text-black font-medium hover:bg-[var(--gold-primary)]/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Appointment</span>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && <AppointmentSkeleton />}

      {/* Empty State */}
      {!loading && filteredAppointments.length === 0 && (
        <EmptyState onClearFilters={clearFilters} />
      )}

      {/* Compact Table */}
      {!loading && filteredAppointments.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)]">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                <th className="px-4 py-3 text-left font-semibold">Ref</th>
                <th className="px-4 py-3 text-left font-semibold">Customer</th>
                <th className="px-4 py-3 text-left font-semibold">Service</th>
                <th className="px-4 py-3 text-left font-semibold">Date & Time</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAppointments.map((apt) => (
                <tr
                  key={apt.appointment_id}
                  className="border-b border-[var(--border)] hover:bg-[var(--bg-primary)]/40 transition-colors group cursor-pointer"
                  onClick={() => onViewDetails?.(apt)}
                >
                  <td className="px-4 py-3 whitespace-nowrap font-mono text-[var(--text-muted)]">{apt.appointment_id}</td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-white">{getCustomerName(apt)}</span>
                    {apt.user_email && (
                      <div className="text-xs text-[var(--text-muted)]">{apt.user_email}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 capitalize text-[var(--gold-primary)]">
                    {Array.isArray(apt.services)
                      ? apt.services.map(s => s.replace(/-/g, ' ')).join(', ')
                      : apt.services}
                  </td>
                  <td className="px-4 py-3 text-white">
                    <div>{formatAppointmentDate(apt.scheduled_at)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={apt.status} config={STATUS_CONFIG} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={e => { e.stopPropagation(); onViewDetails?.(apt); }}
                      className="p-2 rounded-lg hover:bg-[var(--gold-primary)]/20 text-[var(--text-muted)] hover:text-[var(--gold-primary)] transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); onEdit?.(apt); }}
                      className="p-2 rounded-lg hover:bg-[var(--gold-primary)]/20 text-[var(--text-muted)] hover:text-[var(--gold-primary)] transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && filteredAppointments.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-[var(--text-muted)]">
            Showing {((currentPage - 1) * (pagination.limit || 20)) + 1} to {Math.min(currentPage * (pagination.limit || 20), totalItems)} of {totalItems} appointments
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className="p-2 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-[var(--text-muted)] hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const page = i + 1
                return (
                  <button
                    key={page}
                    onClick={() => onPageChange?.(page)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === page
                        ? 'bg-[var(--gold-primary)] text-black'
                        : 'bg-[var(--surface-dark)] text-[var(--text-muted)] hover:border-[var(--gold-primary)] border border-[var(--border)]'
                    }`}
                  >
                    {page}
                  </button>
                )
              })}
            </div>
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="p-2 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-[var(--text-muted)] hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {showDetailsModal && (
        <AppointmentDetailsModal
          show={showDetailsModal}
          onClose={handleCloseModal}
          appointment={selectedAppointment}
          onEdit={handleEditAppointment}
          onCancel={handleCancelAppointment}
          onComplete={handleCompleteAppointment}
        />
      )}
    </div>
  )
}