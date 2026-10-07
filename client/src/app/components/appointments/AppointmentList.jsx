import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Search, Filter, Calendar, Clock, User,
  X, CheckCircle, XCircle, AlertCircle, Loader2,
  MoreHorizontal, Eye, Trash2, Plus, Download, ChevronDown
} from 'lucide-react'
import { format, parseISO, isToday, isTomorrow, isPast, isFuture } from 'date-fns'
import React from 'react';
import AppointmentDetailsModal from './AppointmentDetailsModal';
import { PaginationBar } from '../../pages/admin/components/shared/PaginationBar';
import { adminApi } from '../../utils/adminApi';
import { useSocketEvent } from '../../context/SocketContext';

// Status configuration
const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: AlertCircle },
  confirmed: { label: 'Confirmed', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle },
  in_progress: { label: 'In Progress', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: Clock },
  ready_for_pickup: { label: 'Ready for Pickup', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: CheckCircle },
  completed: { label: 'Completed', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
  rescheduled_by_customer: { label: 'Rescheduled by Customer', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: XCircle },
  no_show: { label: 'No Show', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: XCircle },
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
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'ready_for_pickup', label: 'Ready for Pickup' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'rescheduled_by_customer', label: 'Rescheduled by Customer' },
  { value: 'no_show', label: 'No Show' },
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
  if (Number.isNaN(date.getTime())) return 'N/A'
  if (isToday(date)) return `Today, ${format(date, 'h:mm a')}`
  if (isTomorrow(date)) return `Tomorrow, ${format(date, 'h:mm a')}`
  return format(date, 'MMM d, yyyy h:mm a')
}

// Get customer name helper
function getCustomerName(appointment) {
  return appointment.user_name || appointment.customer_name || 'Guest'
}

function renderAppointmentServiceSummary(appointment) {
  if (appointment.service_name) {
    return String(appointment.service_name)
  }

  if (Array.isArray(appointment.service_names) && appointment.service_names.length > 0) {
    return appointment.service_names.map((name) => String(name).replace(/-/g, ' ')).filter(Boolean).join(', ')
  }

  if (Array.isArray(appointment.services)) {
    return appointment.services
      .map((service) => {
        if (typeof service === 'string') return service.replace(/-/g, ' ')
        if (typeof service === 'number') return String(service)
        if (service?.name) return String(service.name)
        if (service?.service_name) return String(service.service_name)
        return String(service || '')
      })
      .filter(Boolean)
      .join(', ')
  }

  if (typeof appointment.services === 'string') {
    try {
      const parsed = JSON.parse(appointment.services)
      if (Array.isArray(parsed)) {
        return parsed
          .map((service) => {
            if (typeof service === 'string') return service.replace(/-/g, ' ')
            if (typeof service === 'number') return String(service)
            if (service?.name) return String(service.name)
            if (service?.service_name) return String(service.service_name)
            return String(service || '')
          })
          .filter(Boolean)
          .join(', ')
      }
    } catch (err) {
      // fall back to raw string
    }
  }

  return appointment.services || 'N/A'
}

// Main AppointmentList component
export default function AppointmentList({
  appointments = [],
  loading = false,
  onRefresh,
  onViewDetails,
  onEdit,
  onCreateNew,
  onViewCalendar,
  pagination = {},
  onPageChange,
  onPageSizeChange,
  onFilterChange,
  selectedDate = null,
  searchQuery: externalSearchQuery,
  onSearchChange: externalOnSearchChange,
  onStatusChange,
  onPaymentStatusUpdate,
  initialStatusFilter = 'all',
}) {
  const [internalSearchQuery, setInternalSearchQuery] = useState('')
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery
  const [dateFilter, setDateFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter)
  const [viewMode, setViewMode] = useState('list') // 'list' or 'grid'
  const [showFilters, setShowFilters] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('desc')
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const filterMenuRef = useRef(null)

  useSocketEvent('appointment:updated', (data) => {
    const updated = data?.appointment
    const id = updated?.appointment_id || updated?.id
    if (!id) return
    setSelectedAppointment(prev => prev && String(prev.appointment_id || prev.id) === String(id)
      ? { ...prev, ...updated } : prev)
  })

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target)) {
        setFilterMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter appointments based on search and filters
  const filteredAppointments = useMemo(() => {
    let result = [...appointments]

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(apt =>
        getCustomerName(apt).toLowerCase().includes(query) ||
        apt.user_email?.toLowerCase().includes(query) ||
        apt.customer_email?.toLowerCase().includes(query) ||
        apt.user_phone?.toLowerCase().includes(query) ||
        String(apt.appointment_id || '').toLowerCase().includes(query) ||
        apt.reference_code?.toLowerCase().includes(query) ||
        apt.notes?.toLowerCase().includes(query) ||
        (apt.services && JSON.stringify(apt.services).toLowerCase().includes(query)) ||
        (apt.service_name && String(apt.service_name).toLowerCase().includes(query))
      )
    }

    // Date quick filter
    if (dateFilter !== 'all') {
      result = result.filter(apt => {
        if (!apt.scheduled_at) return false
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

    // Date range: start date
    if (dateFrom) {
      const fromTime = new Date(dateFrom).setHours(0, 0, 0, 0)
      result = result.filter(apt => {
        if (!apt.scheduled_at) return false
        return new Date(apt.scheduled_at).getTime() >= fromTime
      })
    }

    // Date range: end date
    if (dateTo) {
      const toTime = new Date(dateTo).setHours(23, 59, 59, 999)
      result = result.filter(apt => {
        if (!apt.scheduled_at) return false
        return new Date(apt.scheduled_at).getTime() <= toTime
      })
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(apt => apt.status === statusFilter)
    }

    // Sort
    result.sort((a, b) => {
      let aVal, bVal
      switch (sortBy) {
        case 'status':
          aVal = (a.status || '').toLowerCase()
          bVal = (b.status || '').toLowerCase()
          break
        case 'customer':
          aVal = getCustomerName(a).toLowerCase()
          bVal = getCustomerName(b).toLowerCase()
          break
        case 'reference':
          aVal = String(a.reference_code || a.appointment_id || '').toLowerCase()
          bVal = String(b.reference_code || b.appointment_id || '').toLowerCase()
          break
        case 'scheduled_at':
          aVal = new Date(a.scheduled_at || 0).getTime()
          bVal = new Date(b.scheduled_at || 0).getTime()
          break
        case 'created_at':
        default:
          aVal = new Date(a.created_at || 0).getTime()
          bVal = new Date(b.created_at || 0).getTime()
          break
      }
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1

      if (sortBy === 'created_at') {
        const aSched = new Date(a.scheduled_at || 0).getTime()
        const bSched = new Date(b.scheduled_at || 0).getTime()
        if (aSched !== bSched) return sortOrder === 'asc' ? aSched - bSched : bSched - aSched
      } else if (sortBy === 'scheduled_at') {
        const aCreated = new Date(a.created_at || 0).getTime()
        const bCreated = new Date(b.created_at || 0).getTime()
        if (aCreated !== bCreated) return sortOrder === 'asc' ? aCreated - bCreated : bCreated - aCreated
      }
      return 0
    })

    return result
  }, [appointments, searchQuery, dateFilter, dateFrom, dateTo, statusFilter, sortBy, sortOrder])

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
    if (externalOnSearchChange) {
      externalOnSearchChange(value)
    } else {
      setInternalSearchQuery(value)
    }
    onFilterChange?.({ date: dateFilter, status: statusFilter, search: value })
  }

  const handleResetSortAndFilters = () => {
    setDateFilter('all')
    setStatusFilter('all')
    setDateFrom('')
    setDateTo('')
    setSortBy('created_at')
    setSortOrder('desc')
    onFilterChange?.({ date: 'all', status: 'all', search: searchQuery })
  }

  const clearFilters = () => {
    handleSearchChange('')
    handleResetSortAndFilters()
  }

  const hasActiveFilters = searchQuery || dateFilter !== 'all' || statusFilter !== 'all' || dateFrom || dateTo || sortBy !== 'created_at' || sortOrder !== 'desc'

  // Pagination
  const currentPage = pagination.page || 1
  const totalPages = pagination.pages || 1
  const totalItems = pagination.total || 0

  const handleViewDetails = (appointment) => {
    setSelectedAppointment(appointment)
    setShowDetailsModal(true)
  }

  const handleCloseModal = () => {
    setShowDetailsModal(false)
    setSelectedAppointment(null)
  }

  const handleEditAppointment = (appointment) => {
    setShowDetailsModal(false)
    if (onEdit) {
      onEdit(appointment || selectedAppointment)
    }
  }

  const handleStatusChange = async (nextStatus, reason) => {
    const apt = selectedAppointment
    if (!apt) return
    const id = apt.appointment_id || apt.id
    if (onStatusChange) {
      await onStatusChange(id, nextStatus, reason)
    } else {
      await adminApi.updateAppointmentStatus(id, nextStatus, reason)
    }
    setSelectedAppointment((prev) => prev ? { ...prev, status: nextStatus } : null)
    onRefresh?.()
  }

  const handleCancelAppointment = async (reason) => {
    const apt = selectedAppointment
    if (!apt) return
    const id = apt.appointment_id || apt.id
    if (onStatusChange) {
      await onStatusChange(id, 'cancelled', reason)
    } else {
      await adminApi.updateAppointmentStatus(id, 'cancelled', reason)
    }
    setSelectedAppointment((prev) => prev ? { ...prev, status: 'cancelled' } : null)
    onRefresh?.()
  }

  const handlePaymentStatusUpdate = async (id, newPaymentStatus) => {
    const aptId = id || selectedAppointment?.appointment_id || selectedAppointment?.id
    if (!aptId) return
    if (onPaymentStatusUpdate) {
      await onPaymentStatusUpdate(aptId, newPaymentStatus)
    } else {
      await adminApi.updateAppointmentPaymentStatus(aptId, newPaymentStatus)
    }
    setSelectedAppointment((prev) => prev ? { ...prev, payment_status: newPaymentStatus } : null)
    onRefresh?.()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Appointments</h2>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            {selectedDate ? `Showing appointments for ${format(parseISO(selectedDate), 'MMMM d, yyyy')}` :
              `${filteredAppointments.length} appointment${filteredAppointments.length !== 1 ? 's' : ''} found`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          <button
            type="button"
            onClick={onCreateNew}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--gold-primary)] px-4 text-sm font-semibold text-black transition-colors hover:bg-[var(--gold-primary)]/90"
          >
            <Plus className="w-4 h-4" />
            <span>New Appointment</span>
          </button>
          {onViewCalendar && (
            <button
              type="button"
              onClick={onViewCalendar}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] px-4 text-sm font-semibold text-white transition-colors hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)]"
            >
              <Calendar className="w-4 h-4" />
              <span>View Calendar</span>
            </button>
          )}
        </div>
      </div>

      {/* Advanced Search & Filter Controls */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by customer, reference code, service…"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] pl-10 pr-10 py-2.5 text-sm text-white placeholder:text-[var(--text-muted)] focus:border-[var(--gold-primary)] focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => handleSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="relative shrink-0" ref={filterMenuRef}>
          <button
            type="button"
            onClick={() => setFilterMenuOpen((open) => !open)}
            aria-expanded={filterMenuOpen}
            aria-haspopup="true"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] px-3 text-sm font-semibold text-[var(--text-light)] transition-colors hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)]"
          >
            <Filter className="h-4 w-4" />
            Sort &amp; Filter
            <ChevronDown className="h-4 w-4" />
          </button>

          {filterMenuOpen && (
            <div className="absolute right-0 top-full z-40 mt-2 grid max-h-[70vh] w-[min(88vw,28rem)] gap-3 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-4 shadow-2xl sm:grid-cols-2">
              <label className="text-xs font-semibold text-[var(--text-muted)]">
                Sort by
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-2.5 py-2 text-sm text-[var(--text-light)] focus:border-[var(--gold-primary)] focus:outline-none"
                >
                  <option value="scheduled_at">Appointment date &amp; time</option>
                  <option value="status">Status</option>
                  <option value="created_at">Created date &amp; time</option>
                  <option value="customer">Customer name</option>
                  <option value="reference">Reference code</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-[var(--text-muted)]">
                Sort direction
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-2.5 py-2 text-sm text-[var(--text-light)] focus:border-[var(--gold-primary)] focus:outline-none"
                >
                  <option value="desc">Descending (Newest to Oldest)</option>
                  <option value="asc">Ascending (Oldest to Newest)</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-[var(--text-muted)]">
                Appointment status
                <select
                  value={statusFilter}
                  onChange={(e) => handleStatusFilterChange(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-2.5 py-2 text-sm text-[var(--text-light)] focus:border-[var(--gold-primary)] focus:outline-none"
                >
                  <option value="all">All statuses</option>
                  {STATUS_FILTERS.filter(f => f.value !== 'all').map((status) => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-[var(--text-muted)]">
                Date quick filter
                <select
                  value={dateFilter}
                  onChange={(e) => handleDateFilterChange(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-2.5 py-2 text-sm text-[var(--text-light)] focus:border-[var(--gold-primary)] focus:outline-none"
                >
                  {DATE_FILTERS.map((df) => (
                    <option key={df.value} value={df.value}>{df.label}</option>
                  ))}
                </select>
              </label>
              <div className="text-xs font-semibold text-[var(--text-muted)] sm:col-span-2">
                Date range
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    aria-label="Start date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="min-w-0 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-2 py-2 text-sm text-[var(--text-light)] focus:border-[var(--gold-primary)] focus:outline-none"
                  />
                  <input
                    type="date"
                    aria-label="End date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="min-w-0 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-2 py-2 text-sm text-[var(--text-light)] focus:border-[var(--gold-primary)] focus:outline-none"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleResetSortAndFilters}
                className="text-left text-xs font-semibold text-[var(--gold-primary)] hover:underline sm:col-span-2"
              >
                Reset filters and sort
              </button>
            </div>
          )}
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
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-primary)] text-[var(--text-muted)] uppercase tracking-wider font-bold border-b border-[var(--border)]">
                <tr>
                  <th className="py-3 px-4">Ref</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Service</th>
                  <th className="py-3 px-4">Date &amp; Time</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]/50">
                {filteredAppointments.map((apt) => (
                  <tr
                    key={apt.appointment_id}
                    className="hover:bg-[var(--bg-primary)]/40 transition-colors group cursor-pointer"
                    onClick={() => (onViewDetails ? onViewDetails(apt) : handleViewDetails(apt))}
                  >
                    <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-[var(--text-primary)]">
                      {apt.reference_code || apt.appointment_id}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-[var(--text-primary)]">{getCustomerName(apt)}</span>
                      {apt.user_email && (
                        <div className="text-[var(--text-muted)]">{apt.user_email}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 capitalize text-[var(--gold-primary)] font-semibold">
                      {renderAppointmentServiceSummary(apt)}
                    </td>
                    <td className="py-3 px-4 text-[var(--text-primary)] whitespace-nowrap font-medium">
                      <div>{formatAppointmentDate(apt.scheduled_at)}</div>
                    </td>
                    <td className="py-3 px-4 text-[var(--text-muted)] whitespace-nowrap font-mono">
                      <div>{formatAppointmentDate(apt.created_at)}</div>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={apt.status} config={STATUS_CONFIG} />
                    </td>
                    <td className="py-3 px-4 text-[var(--text-primary)] capitalize whitespace-nowrap font-medium">
                      {(apt.payment_status || 'pending').replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          if (onViewDetails) {
                            onViewDetails(apt)
                          } else {
                            handleViewDetails(apt)
                          }
                        }}
                        className="p-2 rounded-lg hover:bg-[var(--gold-primary)]/20 text-[var(--text-muted)] hover:text-[var(--gold-primary)] transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <PaginationBar
            attached
            page={currentPage}
            totalPages={totalPages}
            total={totalItems}
            pageSize={pagination.limit || 20}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </div>
      )}

      {showDetailsModal && (
        <AppointmentDetailsModal
          show={showDetailsModal}
          onClose={handleCloseModal}
          appointment={selectedAppointment}
          onEdit={handleEditAppointment}
          onCancel={handleCancelAppointment}
          onStatusChange={handleStatusChange}
          onPaymentStatusUpdate={handlePaymentStatusUpdate}
        />
      )}
    </div>
  )
}
