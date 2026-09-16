import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Truck,
  MapPin,
  CheckCircle,
  Clock,
  Search,
  RefreshCw,
  Eye,
  ArrowRight,
  Filter,
  ChevronLeft,
  ChevronRight,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { adminApi } from '../../../utils/adminApi';
import { FulfillmentDetailsModal } from '../components/modals/FulfillmentDetailsModal';

const formatLabel = (val) => {
  if (!val) return '';
  return String(val)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const formatDate = (val) => {
  if (!val) return '—';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export function FulfillmentTab({ showToast }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchRequests = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 10,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        method: methodFilter !== 'all' ? methodFilter : undefined,
        search: search.trim() || undefined,
      };

      const res = await adminApi.getFulfillmentRequests(params);
      setRequests(res.data || []);
      if (res.pagination) {
        setPagination(res.pagination);
      }
    } catch (err) {
      console.error('Failed to load fulfillment requests:', err);
      if (showToast) showToast('Failed to load fulfillment requests', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, methodFilter, search, showToast]);

  useEffect(() => {
    fetchRequests(1);
  }, [fetchRequests]);

  const handleAdvanceStatus = async (requestId, nextStatus, notes = '') => {
    try {
      setActionLoading(requestId);
      await adminApi.updateFulfillmentStatus(requestId, {
        status: nextStatus,
        admin_notes: notes || undefined,
      });

      if (showToast) {
        showToast(`Fulfillment status advanced to ${formatLabel(nextStatus)}`, 'success');
      }

      await fetchRequests(pagination.page);
    } catch (err) {
      console.error('Failed to advance fulfillment status:', err);
      if (showToast) {
        showToast(err.message || 'Failed to update status', 'error');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const getNextStage = (req) => {
    const method = req.fulfillment_method?.includes('delivery') ? 'delivery' : 'pickup';
    const s = req.status;

    if (method === 'pickup') {
      if (s === 'requested') return { nextStatus: 'processing', label: 'Start Processing' };
      if (s === 'processing') return { nextStatus: 'ready_for_pickup', label: 'Ready for Pickup' };
      if (s === 'ready_for_pickup') return { nextStatus: 'completed', label: 'Confirm Picked Up' };
    } else {
      if (s === 'requested') return { nextStatus: 'processing', label: 'Start Processing' };
      if (s === 'processing') return { nextStatus: 'out_for_delivery', label: 'Out for Delivery' };
      if (s === 'out_for_delivery') return { nextStatus: 'completed', label: 'Confirm Delivered' };
    }

    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Truck className="w-5 h-5 text-[var(--gold-primary)]" />
            Custom Build Fulfillment
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Manage fulfillment lifecycle for completed custom guitars, arrange shop delivery, and coordinate customer pickups.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchRequests(pagination.page)}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-sm font-semibold text-white hover:border-[var(--gold-primary)]/50 transition-all cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[var(--gold-primary)]' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order #, customer name, email, or guitar..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-xs text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--gold-primary)]"
          />
        </div>

        {/* Method & Status Selectors */}
        <div className="flex items-center gap-2">
          {/* Method Filter */}
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-xs text-white focus:outline-none focus:border-[var(--gold-primary)] cursor-pointer"
          >
            <option value="all">All Methods</option>
            <option value="pickup">Pickup at Shop</option>
            <option value="delivery">Shop Delivery</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-xs text-white focus:outline-none focus:border-[var(--gold-primary)] cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="requested">Requested</option>
            <option value="processing">Processing</option>
            <option value="ready_for_pickup">Ready for Pickup</option>
            <option value="out_for_delivery">Out for Delivery</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Requests Table */}
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] bg-black/20 text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                <th className="py-3.5 px-4">Order / Build</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Fulfillment Method</th>
                <th className="py-3.5 px-4">Destination / Schedule</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Lifecycle Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-[var(--text-muted)]">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[var(--gold-primary)] mb-2" />
                    Loading fulfillment requests...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-[var(--text-muted)]">
                    <Truck className="w-8 h-8 mx-auto text-white/20 mb-2" />
                    No custom build fulfillment requests found.
                  </td>
                </tr>
              ) : (
                requests.map((req) => {
                  const method = req.fulfillment_method?.includes('delivery') ? 'delivery' : 'pickup';
                  const next = getNextStage(req);
                  const isBusy = actionLoading === req.id;
                  const addr = req.delivery_address_snapshot;

                  return (
                    <tr
                      key={req.id}
                      className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                      onClick={() => setSelectedRequest(req)}
                    >
                      {/* Order / Build */}
                      <td className="py-4 px-4">
                        <span className="font-bold text-white block">
                          #{req.order_number || req.order_id?.slice(0, 8)}
                        </span>
                        <span className="text-[11px] text-[var(--gold-primary)] block mt-0.5 truncate max-w-[180px]">
                          {req.project_title || 'Custom Guitar Build'}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] capitalize block">
                          {req.guitar_type || 'Custom Guitar'}
                        </span>
                      </td>

                      {/* Customer */}
                      <td className="py-4 px-4">
                        <span className="font-semibold text-white block">
                          {req.first_name} {req.last_name}
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)] block truncate max-w-[150px]">
                          {req.email}
                        </span>
                        {req.phone && (
                          <span className="text-[10px] text-white/60 block">
                            {req.phone}
                          </span>
                        )}
                      </td>

                      {/* Fulfillment Method */}
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                          method === 'delivery'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        }`}>
                          {method === 'delivery' ? (
                            <Truck className="w-3.5 h-3.5" />
                          ) : (
                            <MapPin className="w-3.5 h-3.5" />
                          )}
                          {method === 'delivery' ? 'Shop Delivery' : 'Pickup at Shop'}
                        </span>
                      </td>

                      {/* Destination / Schedule */}
                      <td className="py-4 px-4 max-w-[200px]">
                        {method === 'delivery' ? (
                          addr ? (
                            <div className="text-[11px] text-white/80 truncate" title={`${addr.line1}, ${addr.city}, ${addr.province}`}>
                              <span className="block font-medium text-white truncate">{addr.line1}</span>
                              <span className="text-[var(--text-muted)] block truncate">{addr.city}, {addr.province}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-[var(--text-muted)]">Saved Address</span>
                          )
                        ) : (
                          <div className="text-[11px] text-white/80">
                            <span className="block font-medium text-white">Workshop Pickup</span>
                            {req.pickup_scheduled_at ? (
                              <span className="text-[var(--gold-primary)] block text-[10px]">
                                {formatDate(req.pickup_scheduled_at)}
                              </span>
                            ) : (
                              <span className="text-[var(--text-muted)] block text-[10px]">Awaiting schedule</span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                          req.status === 'completed'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : req.status === 'requested'
                            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            : 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            req.status === 'completed' ? 'bg-emerald-400' : req.status === 'requested' ? 'bg-amber-400' : 'bg-sky-400 animate-pulse'
                          }`} />
                          {formatLabel(req.status)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedRequest(req)}
                            className="p-2 rounded-xl border border-[var(--border)] text-white/70 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                            title="View Full Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {next && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleAdvanceStatus(req.id, next.nextStatus)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-xs font-bold text-black shadow hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer"
                            >
                              {isBusy ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <ArrowRight className="w-3.5 h-3.5" />
                              )}
                              {next.label}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border)] bg-black/10">
            <span className="text-xs text-[var(--text-muted)]">
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1 || loading}
                onClick={() => fetchRequests(pagination.page - 1)}
                className="p-2 rounded-xl border border-[var(--border)] text-white/70 hover:text-white disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() => fetchRequests(pagination.page + 1)}
                className="p-2 rounded-xl border border-[var(--border)] text-white/70 hover:text-white disabled:opacity-30 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {selectedRequest && (
          <FulfillmentDetailsModal
            request={selectedRequest}
            onClose={() => setSelectedRequest(null)}
            onUpdateStatus={handleAdvanceStatus}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
