import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, Circle, ChevronDown, ChevronRight, Plus, Trash2, User, Clock, AlertCircle, Guitar, Package, Search, Calendar, Truck, Store, ShieldCheck } from 'lucide-react';
import { adminApi } from '../../utils/adminApi';
import { formatCurrency } from '../../utils/formatCurrency';
import { useAuth } from '../../context/AuthContext';

const formatStatusLabel = (status) => String(status || '')
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (char) => char.toUpperCase());

const formatInputDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatInputTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const buildPickupTimeSlots = (dateValue) => {
  if (!dateValue) return [];

  const date = new Date(dateValue);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isToday = date.toDateString() === today.toDateString();
  const startHour = isToday ? Math.max(10, new Date().getHours() + 1) : 10;
  const slots = [];

  for (let hour = startHour; hour < 18; hour += 1) {
    for (let minute = 0; minute < 60; minute += 30) {
      const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      const label = new Date(`2000-01-01T${value}:00`).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      });
      slots.push({ value, label });
    }
  }

  return slots;
};

const formatFulfillmentLabel = (method) => {
  switch (method) {
    case 'pickup_appointment':
      return 'Pickup Through Appointment';
    case 'external_delivery':
      return 'Customer External Delivery';
    case 'shop_delivery':
      return 'Shop Delivery';
    default:
      return 'Not Selected';
  }
};

export default function ProjectTaskTracker({ projectId, projectName, isAdmin = false, parts = [], projectData = null, showTracker = true }) {
  const { user } = useAuth();
  const [hierarchy, setHierarchy] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Parts panel state
  const [partsSearchQuery, setPartsSearchQuery] = useState('');
  const [expandedPartCategories, setExpandedPartCategories] = useState(new Set());
  const [isPartsPanelExpanded, setIsPartsPanelExpanded] = useState(true);

  // Exanded state for accordions
  const [expandedMilestones, setExpandedMilestones] = useState(new Set());

  // Form states for Admin
  const [isAddingMilestone, setIsAddingMilestone] = useState(false);
  const [addingSubtaskTo, setAddingSubtaskTo] = useState(null); // tracking milestone_id
  const [form, setForm] = useState({});
  const [selectedFulfillmentMethod, setSelectedFulfillmentMethod] = useState('pickup_appointment');
  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [fulfillmentNotes, setFulfillmentNotes] = useState('');
  const [fulfillmentSaving, setFulfillmentSaving] = useState(false);
  const [fulfillmentFeedback, setFulfillmentFeedback] = useState(null);

  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getProjectHierarchy(projectId);
      setHierarchy(res.data);
      
      const logsRes = await adminApi.getProjectActivity(projectId);
      setLogs(logsRes.data || []);
      
      // Auto-expand all milestones
      if (res.data?.milestones) {
        setExpandedMilestones(new Set(res.data.milestones.map(m => m.milestone_id)));
      }
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin || !hierarchy) return;

    const existingMethod = hierarchy.fulfillment_method || 'pickup_appointment';
    const existingPickupAt = hierarchy.pickup_appointment?.scheduled_at;

    setSelectedFulfillmentMethod(existingMethod);
    setPickupDate(existingPickupAt ? formatInputDate(existingPickupAt) : formatInputDate(new Date(Date.now() + 86400000)));
    setPickupTime(existingPickupAt ? formatInputTime(existingPickupAt) : '10:00');
    setFulfillmentNotes(hierarchy.fulfillment_notes || '');
  }, [hierarchy, isAdmin]);

  const toggleMilestone = (mId) => {
    setExpandedMilestones(prev => {
      const next = new Set(prev);
      if (next.has(mId)) next.delete(mId);
      else next.add(mId);
      return next;
    });
  };

  const togglePartCategory = (category) => {
    setExpandedPartCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const normalizePartValue = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

  const scoreCatalogMatch = (projectPart, catalogPart) => {
    const projectName = normalizePartValue(projectPart?.name);
    const catalogName = normalizePartValue(catalogPart?.name);
    if (!projectName || projectName !== catalogName) return -1;

    let score = 5;

    const projectGuitarType = normalizePartValue(projectPart?.guitar_type);
    const catalogGuitarType = normalizePartValue(catalogPart?.guitar_type);
    if (!projectGuitarType || !catalogGuitarType || projectGuitarType === catalogGuitarType) {
      score += 3;
    } else if (catalogGuitarType === 'general') {
      score += 1;
    } else {
      return -1;
    }

    const projectCategory = normalizePartValue(projectPart?.type_mapping || projectPart?.part_category);
    const catalogCategory = normalizePartValue(catalogPart?.type_mapping || catalogPart?.part_category);
    if (projectCategory && catalogCategory) {
      if (projectCategory === catalogCategory) score += 3;
      else if (catalogCategory.includes(projectCategory) || projectCategory.includes(catalogCategory)) score += 1;
    }

    return score;
  };

  const resolvedParts = useMemo(() => {
    const projectParts = Array.isArray(hierarchy?.parts) ? hierarchy.parts : [];
    const catalogParts = Array.isArray(parts) ? parts : [];

    if (projectParts.length === 0) return catalogParts;
    if (catalogParts.length === 0) return projectParts;

    return projectParts.map((projectPart) => {
      const matchedCatalogPart = catalogParts
        .map((catalogPart) => ({
          catalogPart,
          score: scoreCatalogMatch(projectPart, catalogPart),
        }))
        .filter((entry) => entry.score >= 0)
        .sort((a, b) => b.score - a.score)[0]?.catalogPart;

      if (!matchedCatalogPart) return projectPart;

      return {
        ...matchedCatalogPart,
        ...projectPart,
        image_url: projectPart.image_url || matchedCatalogPart.image_url || null,
        stock: projectPart.stock ?? matchedCatalogPart.stock ?? null,
        price: projectPart.price ?? matchedCatalogPart.price ?? null,
        is_active: projectPart.is_active ?? matchedCatalogPart.is_active,
      };
    });
  }, [hierarchy?.parts, parts]);
  const taskSummary = hierarchy?.task_summary || { total: 0, completed: 0, pending: 0 };
  const pickupTimeSlots = useMemo(() => buildPickupTimeSlots(pickupDate), [pickupDate]);
  const trackerTitleRaw = hierarchy?.name || hierarchy?.title || projectName || 'Project Tracker';
  const parsedTrackerHeader = useMemo(() => {
    const text = String(trackerTitleRaw || '');
    const match = text.match(/^(.*?)\s*\((ORD-[^)]+)\)\s*$/i);
    if (!match) {
      return {
        title: text,
        embeddedOrderRef: '',
      };
    }
    return {
      title: match[1]?.trim() || text,
      embeddedOrderRef: match[2]?.trim() || '',
    };
  }, [trackerTitleRaw]);
  const orderReference = [
    hierarchy?.order_number,
    hierarchy?.orderNumber,
    hierarchy?.order_no,
    hierarchy?.reference,
    hierarchy?.reference_no,
    parsedTrackerHeader.embeddedOrderRef,
  ].find((value) => typeof value === 'string' && value.trim());
  const displayOrderReference = useMemo(() => {
    if (!orderReference) return '';
    if (parsedTrackerHeader.embeddedOrderRef && orderReference === parsedTrackerHeader.embeddedOrderRef) {
      return orderReference;
    }
    return orderReference;
  }, [orderReference, parsedTrackerHeader.embeddedOrderRef]);
  const defaultAddress = Array.isArray(user?.addresses)
    ? user.addresses.find((address) => address.is_default) || user.addresses[0] || null
    : null;
  const shippingAddress = hierarchy?.shipping_address?.line1
    ? hierarchy.shipping_address
    : defaultAddress
    ? {
        line1: defaultAddress.street_line1,
        line2: defaultAddress.street_line2,
        city: defaultAddress.city,
        province: defaultAddress.province,
        postal_code: defaultAddress.postal_code,
        country: defaultAddress.country,
      }
    : null;
  const shippingAddressLabel = shippingAddress?.line1
    ? [
        shippingAddress.line1,
        shippingAddress.line2,
        shippingAddress.city,
        shippingAddress.province,
        shippingAddress.postal_code,
      ].filter(Boolean).join(', ')
    : 'No delivery address on file';
  const hasSavedFulfillment = Boolean(hierarchy?.fulfillment_method);
  const clampedProgress = Math.min(Math.max(Number(hierarchy?.progress) || 0, 0), 100);
  const milestones = Array.isArray(hierarchy?.milestones) ? hierarchy.milestones : [];
  const totalMilestones = milestones.length;
  const completedMilestones = milestones.filter((milestone) => {
    const subtasks = Array.isArray(milestone?.subtasks) ? milestone.subtasks : [];
    return subtasks.length > 0 && subtasks.every((subtask) => subtask.status === 'completed');
  }).length;
  const milestoneCompletionRate = totalMilestones > 0
    ? Math.round((completedMilestones / totalMilestones) * 100)
    : 0;
  const taskCompletionRate = taskSummary.total > 0
    ? Math.round((taskSummary.completed / taskSummary.total) * 100)
    : 0;
  const trackingScore = Math.round((clampedProgress + milestoneCompletionRate + taskCompletionRate) / 3);

  // Group parts by category
  const groupedParts = resolvedParts.reduce((groups, part) => {
    const category = part.type_mapping || part.part_category || 'Other';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(part);
    return groups;
  }, {});

  // Filter parts based on search query
  const getFilteredParts = () => {
    const filtered = {};
    Object.entries(groupedParts).forEach(([category, categoryParts]) => {
      const filteredCategoryParts = categoryParts.filter(part =>
        part.name.toLowerCase().includes(partsSearchQuery.toLowerCase())
      );
      if (filteredCategoryParts.length > 0) {
        filtered[category] = filteredCategoryParts;
      }
    });
    return filtered;
  };

  const getStockColor = (stock) => {
    if (stock === null || stock === undefined || Number.isNaN(Number(stock))) return 'text-slate-300';
    if (stock === 0) return 'text-red-400';
    if (stock <= 5) return 'text-amber-400';
    return 'text-emerald-400';
  };

  const getStockDot = (stock) => {
    if (stock === null || stock === undefined || Number.isNaN(Number(stock))) return 'bg-slate-400';
    if (stock === 0) return 'bg-red-500';
    if (stock <= 5) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  // User Actions
  const toggleSubtaskStatus = async (subtask) => {
    // If not admin, check if updatable
    if (!isAdmin && !subtask.is_customer_updatable) return;

    try {
      const newStatus = subtask.status === 'completed' ? 'pending' : 'completed';
      await adminApi.updateSubtask(subtask.subtask_id, { status: newStatus });
      loadData(); // Re-fetch to get new progress %
    } catch (err) {
      alert("Failed to update task: " + err.message);
    }
  };

  // Admin Actions
  const handleAddMilestone = async () => {
    try {
      await adminApi.createMilestone(projectId, { title: form.milestoneTitle, description: form.milestoneDesc });
      setIsAddingMilestone(false);
      setForm({});
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteMilestone = async (mId) => {
    if(!window.confirm("Are you sure? This deletes all subtasks within this milestone.")) return;
    try {
      await adminApi.deleteMilestone(mId);
      loadData();
    } catch (err) { alert(err.message); }
  };

  const handleAddSubtask = async (mId) => {
    try {
      await adminApi.createSubtask(mId, { 
        title: form.subtaskTitle, 
        is_customer_updatable: form.isCustomerUpdatable || false 
      });
      setAddingSubtaskTo(null);
      setForm({});
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteSubtask = async (sId) => {
    if(!window.confirm("Delete this subtask?")) return;
    try {
      await adminApi.deleteSubtask(sId);
      loadData();
    } catch (err) { alert(err.message); }
  };

  const handleSubmitFulfillment = async () => {
    try {
      setFulfillmentSaving(true);
      setFulfillmentFeedback(null);

      const payload = {
        method: selectedFulfillmentMethod,
        notes: fulfillmentNotes,
      };

      if (selectedFulfillmentMethod === 'pickup_appointment') {
        if (!pickupDate || !pickupTime) {
          throw new Error('Please choose a pickup date and time.');
        }
        payload.scheduled_at = new Date(`${pickupDate}T${pickupTime}:00`).toISOString();
      }

      await adminApi.submitProjectFulfillment(projectId, payload);
      await loadData();
      setFulfillmentFeedback({
        type: 'success',
        message: selectedFulfillmentMethod === 'pickup_appointment'
          ? 'Pickup appointment saved.'
          : 'Fulfillment preference saved.',
      });
    } catch (err) {
      setFulfillmentFeedback({
        type: 'error',
        message: err.message || 'Failed to save fulfillment preference.',
      });
    } finally {
      setFulfillmentSaving(false);
    }
  };


  if (loading) return <div className="text-center py-10 text-[var(--text-muted)] animate-pulse">Loading tracker data...</div>;
  if (error) return <div className="text-red-400 p-4 border border-red-500/30 bg-red-500/10 rounded-xl">{error}</div>;
  if (!hierarchy) return null;

  return (
    <div className="space-y-6">
      
      {/* MAIN TRACKER SECTION */}
      <div className="space-y-6">
        
        {/* Progress Header */}
        <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 md:p-7 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--gold-primary)]/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>

          <div className="mb-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(180px,220px)] lg:items-start">
            <div className="min-w-0 pr-0 lg:pr-2">
              <h2 className="text-white text-2xl sm:text-3xl font-bold leading-tight break-words">
                {parsedTrackerHeader.title}
              </h2>
              {displayOrderReference && (
                <p className="mt-2 text-sm font-medium text-[var(--text-muted)] break-words lg:break-normal">
                  Order: {displayOrderReference}
                </p>
              )}
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                {hierarchy.customer_name ? `For: ${hierarchy.customer_name}` : '-'}
              </p>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3 text-left lg:text-right whitespace-nowrap">
              <span className="text-[var(--gold-primary)] text-3xl md:text-4xl font-black leading-none">{clampedProgress}%</span>
              <p className="mt-1 text-white font-semibold">{formatStatusLabel(hierarchy.status)}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)]/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">Total progress</p>
              <span className="rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)] whitespace-nowrap">
                Live tracking
              </span>
            </div>

            <div className="mt-7 relative pb-7">
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${clampedProgress}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)]"
                />
              </div>

              <div className="pointer-events-none absolute top-0 left-0 h-2 w-full">
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-400/60 bg-emerald-400/20 p-1"
                  style={{ left: `${taskCompletionRate}%`, top: '50%' }}
                  title={`Tasks completed: ${taskCompletionRate}%`}
                >
                  <CheckCircle className="h-3 w-3 text-emerald-300" />
                </div>
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-blue-400/60 bg-blue-400/20 p-1"
                  style={{ left: `${milestoneCompletionRate}%`, top: '50%' }}
                  title={`Milestones completed: ${milestoneCompletionRate}%`}
                >
                  <Circle className="h-3 w-3 text-blue-300" />
                </div>
              </div>

              {[0, 25, 50, 100].map((value) => (
                <span
                  key={value}
                  className={`absolute -bottom-0.5 text-[11px] font-medium text-[var(--text-muted)] ${value === 0 ? 'left-0 translate-x-0' : value === 100 ? 'right-0 translate-x-0' : '-translate-x-1/2'}`}
                  style={value === 0 || value === 100 ? undefined : { left: `${value}%` }}
                >
                  {value}%
                </span>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">Task progress</p>
                <p className="mt-2 text-2xl font-bold text-white">{taskSummary.completed}<span className="text-base text-[var(--text-muted)]">/{taskSummary.total || 0}</span></p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">Milestones done</p>
                <p className="mt-2 text-2xl font-bold text-white">{completedMilestones}<span className="text-base text-[var(--text-muted)]">/{totalMilestones}</span></p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">Percentage</p>
                <p className="mt-2 text-2xl font-bold text-white">{trackingScore}<span className="text-base text-[var(--text-muted)]">%</span></p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-[var(--text-muted)] text-xs">
              {taskSummary.total > 0
                ? `${taskSummary.completed} of ${taskSummary.total} tasks completed`
                : 'No tasks added yet'}
            </p>

            {!isAdmin && (
              <div
                className={`py-2 px-4 rounded-lg font-bold text-xs inline-flex items-center gap-2 whitespace-nowrap ${
                  clampedProgress === 100
                    ? 'bg-[var(--gold-primary)]/15 text-[var(--gold-primary)] border border-[var(--gold-primary)]/30'
                    : 'bg-[var(--surface-elevated)] text-[var(--text-muted)] border border-[var(--border)]'
                }`}
              >
                <Calendar className="w-4 h-4" />
                {clampedProgress === 100 ? 'Choose release option below' : 'Release options unlock at 100%'}
              </div>
            )}
          </div>
        </div>

        {/* GUITAR PARTS PANEL */}
        {resolvedParts.length > 0 && (
        <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-5 flex flex-col">
          <button
            type="button"
            onClick={() => setIsPartsPanelExpanded((prev) => !prev)}
            className="mb-4 w-full flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Guitar className="w-5 h-5 text-[var(--gold-primary)]" />
              <h3 className="text-white font-bold text-lg">Project Parts</h3>
              <span className="px-2 py-0.5 bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] text-xs font-bold rounded-full">
                {resolvedParts.length}
              </span>
            </div>
            <motion.div
              initial={false}
              animate={{ rotate: isPartsPanelExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="shrink-0"
            >
              <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
            </motion.div>
          </button>

          <AnimatePresence initial={false}>
            {isPartsPanelExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                {/* Search Input */}
                <div className="mb-4 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    placeholder="Filter parts..."
                    value={partsSearchQuery}
                    onChange={(e) => setPartsSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] text-sm"
                  />
                </div>

                {/* Parts List */}
                <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                  {resolvedParts.length === 0 ? (
                    <div className="text-center py-12 flex flex-col items-center justify-center">
                      <Guitar className="w-12 h-12 text-[var(--text-muted)]/30 mb-3" />
                      <p className="text-[var(--text-muted)] text-sm font-semibold">No parts linked to this project yet.</p>
                    </div>
                  ) : Object.keys(getFilteredParts()).length === 0 ? (
                    <div className="text-center py-8">
                      <Package className="w-8 h-8 text-[var(--text-muted)]/30 mx-auto mb-2" />
                      <p className="text-[var(--text-muted)] text-xs">No parts match your search.</p>
                    </div>
                  ) : (
                    Object.entries(getFilteredParts()).map(([category, categoryParts]) => {
                      const isExpanded = expandedPartCategories.has(category) || Object.keys(getFilteredParts()).length === 1;
                      
                      return (
                        <div key={category} className="overflow-hidden">
                          {/* Category Header */}
                          <button
                            onClick={() => togglePartCategory(category)}
                            className="w-full flex items-center justify-between p-3 bg-[var(--bg-primary)]/60 border-l-2 border-[var(--gold-primary)] hover:bg-[var(--bg-primary)] transition-colors rounded-lg"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-white font-semibold text-sm capitalize">{category}</span>
                              <span className="px-2 py-0.5 bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] text-xs font-bold rounded-full">
                                {categoryParts.length}
                              </span>
                            </div>
                            <motion.div
                              initial={false}
                              animate={{ rotate: isExpanded ? 180 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                            </motion.div>
                          </button>

                          {/* Parts Cards (Collapsible) */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-2 mt-2"
                              >
                                {categoryParts.map((part) => {
                                  const stock = part.stock === null || part.stock === undefined ? null : Number(part.stock);
                                  const hasInventoryState = Number.isFinite(stock);
                                  const isLowStock = hasInventoryState && stock > 0 && stock <= 5;
                                  const isOutOfStock = hasInventoryState && stock === 0;

                                  return (
                                    <div
                                      key={part.part_id}
                                      className="p-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl hover:border-[var(--gold-primary)]/30 transition-all"
                                    >
                                      {/* Part Header */}
                                      <div className="flex gap-3 mb-2">
                                        {/* Image */}
                                        <div className="w-10 h-10 flex-shrink-0 rounded-lg bg-black/30 overflow-hidden border border-[var(--border)] flex items-center justify-center">
                                          {part.image_url ? (
                                            <img
                                              src={part.image_url}
                                              alt={part.name}
                                              className="w-full h-full object-contain"
                                            />
                                          ) : (
                                            <Guitar className="w-5 h-5 text-[var(--text-muted)]/50" />
                                          )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                          <p className="text-white font-semibold text-xs line-clamp-1">{part.name}</p>
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            <span className="px-1.5 py-0.5 bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] text-[10px] font-bold uppercase rounded">
                                              {category}
                                            </span>
                                            {part.guitar_type && (
                                              <span className="px-1.5 py-0.5 bg-gray-500/20 text-gray-400 text-[10px] font-medium rounded capitalize">
                                                {part.guitar_type}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Stock & Price */}
                                      <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]/30">
                                        <div className="flex items-center gap-1">
                                          <span className={`w-2 h-2 rounded-full ${getStockDot(stock)}`} />
                                          <span className={`text-xs font-semibold ${getStockColor(stock)}`}>
                                            {!hasInventoryState
                                              ? 'Configured'
                                              : isOutOfStock
                                              ? 'Out of stock'
                                              : isLowStock
                                              ? `Low: ${stock}`
                                              : `${stock} in stock`}
                                          </span>
                                        </div>
                                        {part.price && (
                                          <span className="text-[var(--gold-primary)] font-bold text-xs">
                                            {formatCurrency(part.price, true)}
                                          </span>
                                        )}
                                      </div>

                                      {/* Active Badge */}
                                      {part.is_active !== undefined && (
                                        <div className="mt-2 flex justify-end">
                                          <span
                                            className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${
                                              part.is_active
                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                                : 'bg-gray-500/10 text-gray-400 border-gray-500/30'
                                            }`}
                                          >
                                            {part.is_active ? 'Active' : 'Inactive'}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        )}

        {/* Finished Notification */}
        {!isAdmin && hierarchy.progress === 100 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-start gap-3"
          >
            <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-green-400 font-bold mb-1">Your Project is Finished!</h4>
              <p className="text-sm text-green-400/80">We have completed your build. Choose how you want to receive it: pickup through appointment, your own courier, or free shop delivery for Luzon addresses.</p>
            </div>
          </motion.div>
        )}

        {hierarchy.fulfillment_method && (
          <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/70">Fulfillment</p>
                <h3 className="mt-1 text-lg font-bold text-white">{formatFulfillmentLabel(hierarchy.fulfillment_method)}</h3>
                <p className="mt-1 text-sm text-cyan-100/80">Status: {formatStatusLabel(hierarchy.fulfillment_status)}</p>
                {hierarchy.fulfillment_notes && (
                  <p className="mt-3 text-sm text-cyan-50/85">{hierarchy.fulfillment_notes}</p>
                )}
              </div>
              {hierarchy.pickup_appointment?.scheduled_at && (
                <div className="rounded-xl border border-cyan-400/20 bg-black/20 px-4 py-3 text-sm text-cyan-50/90">
                  <p className="font-semibold text-white">Pickup Appointment</p>
                  <p>{new Date(hierarchy.pickup_appointment.scheduled_at).toLocaleString()}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-cyan-200/70">
                    {formatStatusLabel(hierarchy.pickup_appointment.status)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {!isAdmin && hierarchy.progress === 100 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-6 space-y-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Release Options</p>
                <h3 className="mt-1 text-xl font-bold text-white">Choose How You Want To Receive Your Build</h3>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  Pickup creates a shop appointment. Delivery requests are saved directly on your project for the team to process.
                </p>
              </div>
              <div className={`rounded-xl px-3 py-2 text-xs font-semibold ${hierarchy.shop_delivery_eligible ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border border-amber-500/30 bg-amber-500/10 text-amber-300'}`}>
                {hierarchy.shop_delivery_eligible ? 'Free shop delivery available for this address' : 'Shop delivery is limited to Luzon addresses'}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {[
                {
                  id: 'pickup_appointment',
                  icon: Store,
                  title: 'Pickup Through Appointment',
                  description: 'Schedule a release visit at the shop so the team can hand over the finished build.',
                  disabled: false,
                },
                {
                  id: 'external_delivery',
                  icon: Truck,
                  title: 'My Own Courier',
                  description: 'You will arrange an external rider or courier to pick up the guitar from the shop.',
                  disabled: false,
                },
                {
                  id: 'shop_delivery',
                  icon: ShieldCheck,
                  title: 'Shop Delivery',
                  description: hierarchy.shop_delivery_eligible ? 'Free delivery is available because your address is in Luzon.' : 'This option unlocks only for Luzon delivery addresses.',
                  disabled: !hierarchy.shop_delivery_eligible,
                },
              ].map((option) => {
                const Icon = option.icon;
                const isSelected = selectedFulfillmentMethod === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={option.disabled}
                    onClick={() => setSelectedFulfillmentMethod(option.id)}
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      option.disabled
                        ? 'cursor-not-allowed border-[var(--border)] bg-[var(--bg-primary)] opacity-50'
                        : isSelected
                        ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10 shadow-[0_0_20px_rgba(212,175,55,0.12)]'
                        : 'border-[var(--border)] bg-[var(--bg-primary)] hover:border-[var(--gold-primary)]/40'
                    }`}
                  >
                    <Icon className={`mb-3 h-5 w-5 ${isSelected ? 'text-[var(--gold-primary)]' : 'text-[var(--text-muted)]'}`} />
                    <p className="text-sm font-bold text-white">{option.title}</p>
                    <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">{option.description}</p>
                  </button>
                );
              })}
            </div>

            {fulfillmentFeedback && (
              <div className={`rounded-xl border px-4 py-3 text-sm ${
                fulfillmentFeedback.type === 'success'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-red-500/30 bg-red-500/10 text-red-300'
              }`}>
                {fulfillmentFeedback.message}
              </div>
            )}

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-5 space-y-4">
              {selectedFulfillmentMethod === 'pickup_appointment' ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2 text-sm">
                      <span className="font-semibold text-white">Pickup Date</span>
                      <input
                        type="date"
                        min={formatInputDate(new Date())}
                        value={pickupDate}
                        onChange={(e) => setPickupDate(e.target.value)}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] px-4 py-3 text-white focus:border-[var(--gold-primary)] focus:outline-none"
                      />
                    </label>
                    <label className="space-y-2 text-sm">
                      <span className="font-semibold text-white">Pickup Time</span>
                      <select
                        value={pickupTime}
                        onChange={(e) => setPickupTime(e.target.value)}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] px-4 py-3 text-white focus:border-[var(--gold-primary)] focus:outline-none"
                      >
                        <option value="" disabled>Select a time</option>
                        {pickupTimeSlots.map((slot) => (
                          <option key={slot.value} value={slot.value}>{slot.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    The appointment will be tagged to this project so the team can prepare your finished instrument for release.
                  </p>
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-white">
                    {selectedFulfillmentMethod === 'external_delivery'
                      ? 'Courier Instructions'
                      : 'Delivery Notes'}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {selectedFulfillmentMethod === 'external_delivery'
                      ? 'Add courier, rider, or coordination instructions so the team knows who will pick up the project.'
                      : 'Add landmarks, preferred contact details, or any special delivery instructions for the shop team.'}
                  </p>
                </div>
              )}

              <label className="space-y-2 text-sm block">
                <span className="font-semibold text-white">Notes</span>
                <textarea
                  value={fulfillmentNotes}
                  onChange={(e) => setFulfillmentNotes(e.target.value)}
                  placeholder={selectedFulfillmentMethod === 'external_delivery'
                    ? 'Example: Lalamove booked under Juan Dela Cruz, call before handoff.'
                    : selectedFulfillmentMethod === 'shop_delivery'
                    ? 'Example: Gate code, landmark, or preferred delivery contact.'
                    : 'Add any preferred pickup instructions.'}
                  className="min-h-[110px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] px-4 py-3 text-white placeholder:text-[var(--text-muted)] focus:border-[var(--gold-primary)] focus:outline-none"
                />
              </label>

              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-[var(--text-muted)]">
                <p className="font-semibold text-white">Delivery Address on File</p>
                <p className="mt-1">{shippingAddressLabel}</p>
                {selectedFulfillmentMethod === 'shop_delivery' && !shippingAddress?.line1 && (
                  <p className="mt-2 text-amber-300">Add a saved address to your profile if you want the shop to deliver your build.</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[var(--text-muted)]">
                {hasSavedFulfillment
                  ? 'You can update this preference any time before the team dispatches the project.'
                  : 'Your selection will be attached to the finished project for staff follow-up.'}
              </p>
              <button
                type="button"
                onClick={handleSubmitFulfillment}
                disabled={fulfillmentSaving || (selectedFulfillmentMethod === 'shop_delivery' && !hierarchy.shop_delivery_eligible)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] px-5 py-3 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle className="h-4 w-4" />
                {fulfillmentSaving
                  ? 'Saving...'
                  : selectedFulfillmentMethod === 'pickup_appointment'
                  ? (hierarchy.pickup_appointment ? 'Update Pickup Appointment' : 'Schedule Pickup Appointment')
                  : hasSavedFulfillment
                  ? 'Update Fulfillment Choice'
                  : 'Save Fulfillment Choice'}
              </button>
            </div>
          </div>
)}

        {/* Milestones Accordion - Only show when showTracker is true (My Guitar section) */}
        {showTracker && (
        <div className="space-y-4">
          {hierarchy.milestones?.length === 0 ? (
             <div className="text-center py-12 bg-white/5 border border-[var(--border)] rounded-2xl">
               <AlertCircle className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
               <p className="text-white font-semibold">No milestones built yet.</p>
               <p className="text-[var(--text-muted)] text-sm">{(isAdmin ? 'Create a milestone to get started.' : 'Awaiting admin initialization.')}</p>
             </div>
          ) : (
            hierarchy.milestones?.map((milestone, i) => {
              const isExpanded = expandedMilestones.has(milestone.milestone_id);
              const mProgress = milestone.subtasks?.length 
                ? Math.round((milestone.subtasks.filter(s => s.status === 'completed').length / milestone.subtasks.length) * 100)
                : 0;
              const milestoneStatusLabel = mProgress === 100 ? 'Done' : mProgress > 0 ? 'In Progress' : 'Pending';
              
              return (
                <div key={milestone.milestone_id} className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl overflow-hidden transition-all hover:border-[var(--gold-primary)]/30">
                  
                  {/* Milestone Header (Clickable) */}
                  <div 
                    className="p-5 cursor-pointer flex items-center justify-between select-none"
                    onClick={() => toggleMilestone(milestone.milestone_id)}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg
                        ${mProgress === 100 ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--gold-primary)]'}
                      `}>
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-white font-semibold text-lg">{milestone.title}</h3>
                        <div className="flex items-center gap-4 mt-1">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${mProgress === 100 ? 'bg-green-500/10 text-green-400' : mProgress > 0 ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-500/10 text-slate-300'}`}>
                            {milestoneStatusLabel}
                          </span>
                          <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                            <div className="h-1.5 flex-1 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                              <div className="h-full bg-[var(--gold-primary)]" style={{ width: `${mProgress}%` }} />
                            </div>
                            <span className="text-[var(--text-muted)] text-xs font-mono">{mProgress}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {isAdmin && (
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteMilestone(milestone.milestone_id); }} className="p-2 hover:bg-red-500/10 rounded-lg text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <div className="p-2 bg-[var(--bg-primary)] rounded-lg">
                        {isExpanded ? <ChevronDown className="w-5 h-5 text-white" /> : <ChevronRight className="w-5 h-5 text-white" />}
                      </div>
                    </div>
                  </div>

                  {/* Subtasks Block */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }} 
                        animate={{ height: 'auto', opacity: 1 }} 
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-[var(--border)] bg-[var(--bg-primary)]/30"
                      >
                        <div className="p-5 space-y-3">
                          {milestone.subtasks?.length === 0 ? (
                            <p className="text-[var(--text-muted)] text-sm text-center italic py-2">No tasks defined for this milestone.</p>
                          ) : (
                            milestone.subtasks?.map(subtask => {
                              const isCompleted = subtask.status === 'completed';
                              const canUserUpdate = isAdmin || subtask.is_customer_updatable;

                              return (
                                <div key={subtask.subtask_id} className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${isCompleted ? 'bg-green-500/5 border-green-500/30' : 'bg-[var(--surface-dark)] border-[var(--border)] hover:border-[var(--gold-primary)]/50'}`}>
                                  <button 
                                    onClick={() => toggleSubtaskStatus(subtask)}
                                    disabled={!canUserUpdate}
                                    className={`mt-0.5 rounded-full outline-none focus:ring-2 focus:ring-[var(--gold-primary)] transition-all ${canUserUpdate && !isCompleted ? 'hover:scale-110' : ''}`}
                                  >
                                    {isCompleted ? (
                                      <CheckCircle className="w-6 h-6 text-green-400" />
                                    ) : (
                                      <Circle className={`w-6 h-6 ${canUserUpdate ? 'text-[var(--text-muted)] hover:text-[var(--gold-primary)]' : 'text-gray-600 cursor-not-allowed'}`} />
                                    )}
                                  </button>
                                  <div className="flex-1">
                                    <p className={`font-medium ${isCompleted ? 'text-[var(--text-muted)] line-through' : 'text-white'}`}>{subtask.title}</p>
                                    <div className="flex flex-wrap items-center gap-3 mt-1.5">
                                      {subtask.assignee_first && (
                                        <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                                          <User className="w-3 h-3" /> {subtask.assignee_first} {subtask.assignee_last}
                                        </span>
                                      )}
                                      {isCompleted && (
                                        <span className="flex items-center gap-1 text-xs text-green-400/70">
                                          <Clock className="w-3 h-3" /> {new Date(subtask.completed_at).toLocaleDateString()}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {isAdmin && (
                                     <button onClick={() => handleDeleteSubtask(subtask.subtask_id)} className="p-1.5 hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 rounded">
                                       <Trash2 className="w-4 h-4" />
                                     </button>
                                  )}
                                </div>
                              );
                            })
                          )}

                          {/* Admin: Add Subtask Row */}
                          {isAdmin && (
                            addingSubtaskTo === milestone.milestone_id ? (
                              <div className="p-4 bg-[var(--surface-dark)] border border-[var(--gold-primary)]/50 rounded-xl mt-4">
                                <input autoFocus type="text" placeholder="Task description..." value={form.subtaskTitle || ''} onChange={e => setForm({...form, subtaskTitle: e.target.value})} className="w-full bg-transparent text-white border-b border-[var(--border)] focus:border-[var(--gold-primary)] px-2 py-1 outline-none mb-3" />
                                <label className="flex items-center gap-2 mb-4 cursor-pointer w-fit">
                                  <input type="checkbox" checked={form.isCustomerUpdatable || false} onChange={e => setForm({...form, isCustomerUpdatable: e.target.checked})} className="w-4 h-4" />
                                  <span className="text-sm text-[var(--text-muted)]">Click to mark this complete</span>
                                </label>
                                <div className="flex gap-2">
                                  <button onClick={() => handleAddSubtask(milestone.milestone_id)} className="px-4 py-1.5 bg-[var(--gold-primary)] text-black font-bold text-sm rounded-lg">Save Task</button>
                                  <button onClick={() => setAddingSubtaskTo(null)} className="px-4 py-1.5 bg-white/10 text-white font-medium text-sm rounded-lg">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => setAddingSubtaskTo(milestone.milestone_id)} className="flex items-center gap-2 w-full p-3 rounded-xl border border-dashed border-[var(--border)] hover:border-[var(--gold-primary)]/50 text-[var(--text-muted)] hover:text-[var(--gold-primary)] transition-all justify-center mt-2">
                                <Plus className="w-4 h-4" /> Add Subtask
                              </button>
                            )
                          )}

                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}

          {/* Admin: Add Milestone Global */}
          {isAdmin && (
             isAddingMilestone ? (
               <div className="bg-[var(--surface-dark)] border border-[var(--gold-primary)] shadow-[0_0_20px_rgba(212,175,55,0.1)] rounded-2xl p-6">
                 <h3 className="text-white font-bold mb-4">New Milestone</h3>
                 <div className="space-y-4">
                   <input type="text" placeholder="Milestone Title (e.g. Body Construction)" value={form.milestoneTitle || ''} onChange={e => setForm({...form, milestoneTitle: e.target.value})} className="w-full px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-white outline-none focus:border-[var(--gold-primary)]" />
                   <textarea placeholder="Description (optional)" value={form.milestoneDesc || ''} onChange={e => setForm({...form, milestoneDesc: e.target.value})} className="w-full px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-white outline-none focus:border-[var(--gold-primary)] min-h-[80px]" />
                   <div className="flex gap-3">
                      <button onClick={handleAddMilestone} className="flex-1 py-2.5 bg-[var(--gold-primary)] text-black font-bold rounded-xl">Create Milestone</button>
                      <button onClick={() => setIsAddingMilestone(false)} className="flex-1 py-2.5 bg-white/10 text-white font-medium rounded-xl">Cancel</button>
                   </div>
                 </div>
               </div>
             ) : (
               <button onClick={() => setIsAddingMilestone(true)} className="flex items-center justify-center gap-2 w-full p-4 rounded-2xl border-2 border-dashed border-[var(--border)] hover:border-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/5 text-[var(--text-muted)] hover:text-white transition-all font-semibold">
                 <Plus className="w-5 h-5" /> Add Milestone
               </button>
             )
          )}

        </div>
        )}
      </div>

    </div>
  );
}


