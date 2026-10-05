import ProjectTaskForm from './ProjectTaskForm';
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, Circle, ChevronDown, ChevronRight, Plus, Trash2, User, Clock, AlertCircle, Calendar, Truck, Store, ShieldCheck, Flag, Loader2, MapPin, Package, Lock, Edit3, ArrowRight } from 'lucide-react';
import { adminApi } from '../../utils/adminApi';
import { staffApi } from '../../utils/staffApi';
import { normalizePaymentStatus } from '../../utils/orderPaymentStatus';

import { useAuth } from '../../context/AuthContext';
import { ConfirmModal } from '../ui/ConfirmModal';
import { useToast } from '../ui/Toast';
import BuildClaimManager from './BuildClaimManager';

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

const formatDisplayDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString();
};

export default function ProjectTaskTracker({ projectId, projectName, isAdmin = false, parts = [], projectData = null, showTracker = true, onRestockPart = null, staffMembers = [], onProjectChange = null, orderPaymentStatus = null, orderId = null, sourceOrder = null, onRedirectToOrder = null }) {
  const { user } = useAuth();
  const toast = useToast();
  const [hierarchy, setHierarchy] = useState(null);
  const [requiredParts, setRequiredParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Exanded state for accordions
  const [expandedMilestones, setExpandedMilestones] = useState(new Set());

  // Form states for Admin
  const [isAddingMilestone, setIsAddingMilestone] = useState(false);
  const [addingSubtaskTo, setAddingSubtaskTo] = useState(null); // tracking milestone_id
  const [form, setForm] = useState({});
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [taskFeedback, setTaskFeedback] = useState(null);
  const [taskMutationBusy, setTaskMutationBusy] = useState(false);
  const [selectedFulfillmentMethod, setSelectedFulfillmentMethod] = useState('pickup');
  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [fulfillmentNotes, setFulfillmentNotes] = useState('');
  const [fulfillmentSaving, setFulfillmentSaving] = useState(false);
  const [fulfillmentFeedback, setFulfillmentFeedback] = useState(null);
  const [togglingPartKey, setTogglingPartKey] = useState(null);
  const [togglingSaving, setTogglingSaving] = useState(false);
  const [togglingFeedback, setTogglingFeedback] = useState(null);
  const [togglingSubtaskId, setTogglingSubtaskId] = useState(null);
  const [pendingUncheckSubtask, setPendingUncheckSubtask] = useState(null);
  const [pendingUncheckPart, setPendingUncheckPart] = useState(null);
  const [isEditingCompletion, setIsEditingCompletion] = useState(false);
  const [editCompletionValue, setEditCompletionValue] = useState('');

  const [restockingPartKey, setRestockingPartKey] = useState(null);
  const [restockQuantity, setRestockQuantity] = useState('1');
  const [restockNotes, setRestockNotes] = useState('');
  const [restockSaving, setRestockSaving] = useState(false);
  const [restockFeedback, setRestockFeedback] = useState(null);

  // Mark-all-as-done confirmation and per-milestone busy state
  const [pendingCompleteAll, setPendingCompleteAll] = useState(null);
  const [completingMilestoneId, setCompletingMilestoneId] = useState(null);

  // Delete confirmations and their busy states
  const [pendingDeleteMilestone, setPendingDeleteMilestone] = useState(null);
  const [deletingMilestoneId, setDeletingMilestoneId] = useState(null);
  const [pendingDeleteSubtask, setPendingDeleteSubtask] = useState(null);
  const [deletingSubtaskId, setDeletingSubtaskId] = useState(null);

  // Cancellation request review (admin only)
  const [cancelReviewLoading, setCancelReviewLoading] = useState(false);
  const [cancelReviewFeedback, setCancelReviewFeedback] = useState(null);
  const [cancelRejectReason, setCancelRejectReason] = useState('');

  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const projectApi = isAdmin ? adminApi : staffApi;
      const [hierarchyRes, requiredPartsRes] = await Promise.all([
        projectApi.getProjectHierarchy(projectId),
        projectApi.getProjectRequiredParts(projectId).catch(err => {
          console.warn('Could not refresh project parts:', err.message);
          return { data: requiredParts };
        }),
      ]);
      setHierarchy(hierarchyRes.data);
      onProjectChange?.(hierarchyRes.data);
      const loadedRequiredParts = Array.isArray(requiredPartsRes.data) ? requiredPartsRes.data : [];
      // Specs with no stock record (no guitar part match, no product) are not part of the
      // checklist, so keep only parts whose stock can actually be tracked.
      setRequiredParts(loadedRequiredParts.filter((part) => part.stock_status && part.stock_status !== 'unknown'));
      
      // Auto-expand all milestones on first load only
      if (hierarchyRes.data?.milestones) {
        setExpandedMilestones(prev => {
          if (prev.size > 0) return prev;
          return new Set(hierarchyRes.data.milestones.map(m => m.milestone_id));
        });
      }
      if (hierarchyRes.data?.fulfillment_method) {
        setSelectedFulfillmentMethod(hierarchyRes.data.fulfillment_method.includes('delivery') ? 'delivery' : 'pickup');
      }
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Cancellation Request Review (admin) ──────────────────────────────────
  const pendingCancelRequest = hierarchy?.cancel_requested_at && !hierarchy?.cancel_approved_at;

  const handleApproveCancelRequest = async () => {
    try {
      setCancelReviewLoading(true);
      await adminApi.approveProjectCancel(projectId, { action: 'approve' });
      setCancelReviewFeedback({ type: 'success', message: 'Cancellation approved. A build claim has been created.' });
      setCancelRejectReason('');
      await loadData();
    } catch (e) {
      setCancelReviewFeedback({ type: 'error', message: e.message });
    } finally {
      setCancelReviewLoading(false);
    }
  };

  const handleRejectCancelRequest = async () => {
    if (!cancelRejectReason.trim()) {
      setCancelReviewFeedback({ type: 'error', message: 'Please provide a reason for rejecting.' });
      return;
    }
    try {
      setCancelReviewLoading(true);
      await adminApi.approveProjectCancel(projectId, { action: 'reject', rejection_reason: cancelRejectReason });
      setCancelReviewFeedback({ type: 'success', message: 'Cancellation request rejected. The project remains active.' });
      setCancelRejectReason('');
      await loadData();
    } catch (e) {
      setCancelReviewFeedback({ type: 'error', message: e.message });
    } finally {
      setCancelReviewLoading(false);
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

  const pickupTimeSlots = useMemo(() => buildPickupTimeSlots(pickupDate), [pickupDate]);
  const taskSummary = hierarchy?.task_summary || { total: 0, completed: 0, pending: 0 };

  const getStockBadgeStyle = (stockStatus) => {
    switch (stockStatus) {
      case 'in_stock':
        return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
      case 'low_stock':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
      case 'out_of_stock':
        return 'bg-red-500/10 text-red-300 border-red-500/30';
      default:
        return 'bg-slate-500/10 text-slate-300 border-slate-500/30';
    }
  };
  const trackerTitleRaw = hierarchy?.name || hierarchy?.title || projectName || 'Project Tracker';
  const parsedTrackerHeader = useMemo(() => {
    const text = String(trackerTitleRaw || '');
    const match = text.match(/^(.*?)\s*\(((?:PO|CO|SO)-\d{8}-\d+)\)\s*$/);
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
  const estimatedCompletionDisplay = formatDisplayDate(
    hierarchy?.estimated_completion_date ||
    hierarchy?.end_date ||
    projectData?.estimated_completion_date ||
    projectData?.end_date
  );
  const isReadyForAssembly = requiredParts.length > 0 && requiredParts.every((part) => part.is_fully_received);

  // Check if project is on hold
  const isOnHold = String(hierarchy?.status || '').toLowerCase() === 'on_hold';

  const normalizedPaymentStatus = (orderPaymentStatus && String(orderPaymentStatus).trim()) ? normalizePaymentStatus(orderPaymentStatus) : null;
  const isTaskUpdateBlocked = isAdmin && normalizedPaymentStatus !== null && normalizedPaymentStatus !== 'approved';

  const isMilestoneLocked = (milestone) => {
    if (!isAdmin) return false;
    const milestoneIndex = milestones.findIndex((item) => item.milestone_id === milestone.milestone_id);
    if (milestoneIndex <= 0) return false;
    return milestones.slice(0, milestoneIndex).some((previousMilestone) => {
      const previousTasks = previousMilestone.subtasks || [];
      return previousTasks.length > 0 && previousTasks.some((subtask) => subtask.status !== 'completed');
    });
  };

  // User Actions
  const toggleSubtaskStatus = async (subtask) => {
    if (!isAdmin && !subtask.is_customer_updatable) return;
    if (togglingSaving || (isAdmin && isOnHold)) return;
    if (isTaskUpdateBlocked) return;
    if (togglingSubtaskId || taskMutationBusy) return;

    const parentMilestone = milestones.find((milestone) =>
      milestone.subtasks?.some((item) => item.subtask_id === subtask.subtask_id)
    );
    const milestoneIndex = parentMilestone
      ? milestones.findIndex((milestone) => milestone.milestone_id === parentMilestone.milestone_id)
      : -1;
    if (parentMilestone && isMilestoneLocked(parentMilestone)) return;

    try {
      if (subtask.status === 'completed') {
        const hasCompletedFollowingMilestone = milestones
          .slice(milestoneIndex + 1)
          .some((milestone) => milestone.subtasks?.some((item) => item.status === 'completed'));
        if (hasCompletedFollowingMilestone) {
          toast.warning('Complete or reopen tasks in later milestones before reopening this task.');
          return;
        }
        setPendingUncheckSubtask(subtask);
        return;
      }

      setTogglingSubtaskId(subtask.subtask_id);
      const result = await (isAdmin ? adminApi : staffApi).updateSubtask(subtask.subtask_id, { status: 'completed' });
      const updatedSubtask = result?.data?.subtask || {};
      const taskSummary = result?.data?.task_summary;
      const progress = result?.data?.progress;
      onProjectChange?.({ project_id: projectId, progress, task_summary: taskSummary });

      if (updatedSubtask.subtask_id) {
        setHierarchy((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            progress: progress != null ? progress : prev.progress,
            task_summary: taskSummary || prev.task_summary,
            milestones: prev.milestones.map((milestone) => {
              const milestoneSubtaskCount = milestone.subtasks?.length || 0;
              const updatedSubtasks = milestone.subtasks?.map((s) =>
                s.subtask_id === updatedSubtask.subtask_id ? { ...s, ...updatedSubtask } : s
              );
              const completedCount = updatedSubtasks.filter((s) => s.status === 'completed').length;
              const milestoneStatus = milestoneSubtaskCount > 0 && completedCount === milestoneSubtaskCount
                ? 'completed'
                : completedCount > 0
                  ? 'in_progress'
                  : 'not_started';
              return {
                ...milestone,
                status: milestoneStatus,
                subtasks: updatedSubtasks,
              };
            }),
          };
        });
      } else {
        await loadData();
      }
    } catch (err) {
      toast.error('Failed to update task: ' + err.message);
    } finally {
      setTogglingSubtaskId(null);
    }
  };

  const handleConfirmUncheckSubtask = async () => {
    if (!pendingUncheckSubtask) return;
    if (isTaskUpdateBlocked) return;
    const subtask = pendingUncheckSubtask;

    try {
      setTogglingSubtaskId(subtask.subtask_id);
      const result = await adminApi.updateSubtask(subtask.subtask_id, { status: 'pending' });
      const updatedSubtask = result?.data?.subtask || {};
      const taskSummary = result?.data?.task_summary;
      const progress = result?.data?.progress;
      onProjectChange?.({ project_id: projectId, progress, task_summary: taskSummary });

      setPendingUncheckSubtask(null);

      if (updatedSubtask.subtask_id) {
        setHierarchy((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            progress: progress != null ? progress : prev.progress,
            task_summary: taskSummary || prev.task_summary,
            milestones: prev.milestones.map((milestone) => {
              const milestoneSubtaskCount = milestone.subtasks?.length || 0;
              const updatedSubtasks = milestone.subtasks?.map((s) =>
                s.subtask_id === updatedSubtask.subtask_id ? { ...s, ...updatedSubtask } : s
              );
              const completedCount = updatedSubtasks.filter((s) => s.status === 'completed').length;
              const milestoneStatus = milestoneSubtaskCount > 0 && completedCount === milestoneSubtaskCount
                ? 'completed'
                : completedCount > 0
                  ? 'in_progress'
                  : 'not_started';
              return {
                ...milestone,
                status: milestoneStatus,
                subtasks: updatedSubtasks,
              };
            }),
          };
        });
      } else {
        await loadData();
      }
    } catch (err) {
      toast.error('Failed to update task: ' + err.message);
    } finally {
      setTogglingSubtaskId(null);
    }
  };

  // Admin Actions
  const handleAddMilestone = async () => {
    if (isOnHold || isTaskUpdateBlocked) return;
    setTaskMutationBusy(true);
    try {
      await adminApi.createMilestone(projectId, { title: form.milestoneTitle, description: form.milestoneDesc });
      setIsAddingMilestone(false);
      setForm({});
      setTaskFeedback({ type: 'success', message: 'Milestone created.' });
      await loadData();
    } catch (err) {
      setTaskFeedback({ type: 'error', message: err.message });
    } finally {
      setTaskMutationBusy(false);
    }
  };

  const requestDeleteMilestone = (milestone) => {
    if (isOnHold || taskMutationBusy || isTaskUpdateBlocked) return;
    setPendingDeleteMilestone(milestone);
  };

  const confirmDeleteMilestone = async () => {
    if (!pendingDeleteMilestone || deletingMilestoneId || isTaskUpdateBlocked) return;
    const milestone = pendingDeleteMilestone;

    setDeletingMilestoneId(milestone.milestone_id);
    setTaskMutationBusy(true);
    try {
      await adminApi.deleteMilestone(milestone.milestone_id);
      setTaskFeedback({ type: 'success', message: `Milestone "${milestone.title}" deleted.` });
      await loadData();
    } catch (err) {
      setTaskFeedback({ type: 'error', message: err.message });
    } finally {
      setPendingDeleteMilestone(null);
      setDeletingMilestoneId(null);
      setTaskMutationBusy(false);
    }
  };

  const handleTaskSaved = async (_result) => {
    if (isTaskUpdateBlocked) return;
    setAddingSubtaskTo(null);
    setEditingTaskId(null);
    setTaskFeedback({ type: 'success', message: 'Task saved successfully.' });
    await loadData();
  };

  const requestDeleteSubtask = (subtask) => {
    if (isOnHold || taskMutationBusy || isTaskUpdateBlocked) return;
    setPendingDeleteSubtask(subtask);
  };

  const confirmDeleteSubtask = async () => {
    if (!pendingDeleteSubtask || deletingSubtaskId || isTaskUpdateBlocked) return;
    const subtask = pendingDeleteSubtask;

    setDeletingSubtaskId(subtask.subtask_id);
    setTaskMutationBusy(true);
    try {
      await adminApi.deleteSubtask(subtask.subtask_id);
      setTaskFeedback({ type: 'success', message: 'Task deleted successfully.' });
      await loadData();
    } catch (err) {
      setTaskFeedback({ type: 'error', message: err.message });
    } finally {
      setPendingDeleteSubtask(null);
      setDeletingSubtaskId(null);
      setTaskMutationBusy(false);
    }
  };

  // Mark-all-as-done asks for confirmation through the branded modal, then reports
  // progress on the milestone it is working on.
  const requestCompleteAllSubtasks = (milestone) => {
    if (!isAdmin || isOnHold || isMilestoneLocked(milestone) || taskMutationBusy || togglingSubtaskId || isTaskUpdateBlocked) return;
    const remainingTasks = (milestone.subtasks || []).filter((subtask) => subtask.status !== 'completed');
    if (!remainingTasks.length) return;
    setPendingCompleteAll({ milestone, remainingCount: remainingTasks.length });
  };

  const cancelCompleteAllSubtasks = () => {
    if (completingMilestoneId) return;
    setPendingCompleteAll(null);
  };

  const completeAllSubtasks = async () => {
    if (!pendingCompleteAll || completingMilestoneId || isTaskUpdateBlocked) return;
    const { milestone, remainingCount } = pendingCompleteAll;

    setCompletingMilestoneId(milestone.milestone_id);
    setTaskMutationBusy(true);
    setTaskFeedback(null);
    let completedCount = 0;
    try {
      for (const subtask of (milestone.subtasks || []).filter((subtask) => subtask.status !== 'completed')) {
        await adminApi.updateSubtask(subtask.subtask_id, { status: 'completed' });
        completedCount += 1;
      }
      setTaskFeedback({ type: 'success', message: 'All tasks in this milestone are completed.' });
    } catch (err) {
      setTaskFeedback({ type: 'error', message: `${completedCount} of ${remainingCount} tasks completed. Could not complete the remaining tasks: ${err.message}` });
    } finally {
      setPendingCompleteAll(null);
      await loadData();
      setCompletingMilestoneId(null);
      setTaskMutationBusy(false);
    }
  };

  const handleSaveEstimatedCompletion = async () => {
    if (isTaskUpdateBlocked) return;
    try {
      await adminApi.updateProject(projectId, {
        estimated_completion_date: editCompletionValue || null,
      });
      await loadData();
      setIsEditingCompletion(false);
    } catch (err) {
      toast.error('Failed to update estimated completion: ' + err.message);
    }
  };

  const handleSubmitFulfillment = async () => {
    if (isTaskUpdateBlocked) return;
    try {
      setFulfillmentSaving(true);
      setFulfillmentFeedback(null);

      const method = selectedFulfillmentMethod === 'delivery' ? 'delivery' : 'pickup';
      const payload = {
        method,
        notes: fulfillmentNotes,
      };

      if (method === 'pickup' && pickupDate && pickupTime) {
        payload.scheduled_at = new Date(`${pickupDate}T${pickupTime}:00`).toISOString();
      }

      await adminApi.submitProjectFulfillment(projectId, payload);
      await loadData();
      setFulfillmentFeedback({
        type: 'success',
        message: 'Fulfillment preference saved. You can update your choice until the shop starts fulfillment.',
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


  const handleMarkAllReceived = async () => {
    if (!isAdmin || isOnHold || isTaskUpdateBlocked || togglingSaving) return;
    const pending = requiredParts.filter(part => !part.is_received &&
      (!(part.product_id || part.builder_part_id) ||
        (part.stock_status !== 'out_of_stock' && Number(part.stock) > 0)));
    setTogglingSaving(true);
    setTogglingPartKey(null);
    setTogglingFeedback(null);
    let marked = 0;
    try {
      for (const part of pending) {
        await adminApi.toggleProjectRequiredPart(projectId, part.part_key, true);
        marked += 1;
      }
      setTogglingFeedback({ type: 'success', message: `${marked} parts marked as received. Out-of-stock parts remain pending.` });
    } catch (err) {
      setTogglingFeedback({ type: 'error', message: `${marked} parts marked. ${err.message || 'Unable to mark remaining parts.'}` });
    } finally {
      await loadData();
      setTogglingSaving(false);
    }
  };

  const handleToggleReceive = async (part) => {
    if (togglingSaving || (isAdmin && isOnHold)) return;
    if (isTaskUpdateBlocked) return;

    if (part.is_received) {
      setPendingUncheckPart(part);
      return;
    }

    try {
      setTogglingSaving(true);
      setTogglingFeedback(null);
      setTogglingPartKey(part.part_key);

      const result = await adminApi.toggleProjectRequiredPart(projectId, part.part_key, true);
      const partData = result?.data?.part || {};
      const received = result?.data?.received ?? true;
      if (partData.part_key && (partData.stock !== undefined || partData.is_received !== undefined)) {
        setRequiredParts(prev =>
          prev.map(item =>
            item.part_key === part.part_key
              ? { ...item, ...partData, is_received: received }
              : item
          )
        );
      } else {
        await loadData();
      }
      setTogglingFeedback({
        type: 'success',
        message: `${partData.name || part.name} marked as received.`,
      });
    } catch (err) {
      setTogglingFeedback({
        type: 'error',
        message: err.message || 'Failed to update part status.',
      });
    } finally {
      setTogglingSaving(false);
      setTogglingPartKey(null);
    }
  };

  const handleConfirmUncheckPart = async () => {
    if (!pendingUncheckPart || isTaskUpdateBlocked) return;
    const part = pendingUncheckPart;
    setPendingUncheckPart(null);

    try {
      setTogglingSaving(true);
      setTogglingFeedback(null);
      setTogglingPartKey(part.part_key);

      const result = await adminApi.toggleProjectRequiredPart(projectId, part.part_key, false);
      const partData = result?.data?.part || {};
      const received = result?.data?.received ?? false;
      if (partData.part_key && (partData.stock !== undefined || partData.is_received !== undefined)) {
        setRequiredParts(prev =>
          prev.map(item =>
            item.part_key === part.part_key
              ? { ...item, ...partData, is_received: received }
              : item
          )
        );
      } else {
        await loadData();
      }
      setTogglingFeedback({
        type: 'success',
        message: `${partData.name || part.name} returned to inventory.`,
      });
    } catch (err) {
      setTogglingFeedback({
        type: 'error',
        message: err.message || 'Failed to return part to inventory.',
      });
    } finally {
      setTogglingSaving(false);
      setTogglingPartKey(null);
    }
  };

  const handleCancelUncheckPart = () => {
    setPendingUncheckPart(null);
  };

  const getStockStatus = (stock, quantity) => {
    const s = Number(stock);
    const q = Number(quantity) || 1;
    if (!Number.isFinite(s)) return 'unknown';
    if (s <= 0) return 'out_of_stock';
    if (s < q) return 'low_stock';
    return 'in_stock';
  };

  const handleRestockPart = async (part) => {
    if (isTaskUpdateBlocked) return;
    const isBuilderPart = Boolean(part.builder_part_id);
    if (!isBuilderPart && !part.product_id) return;
    try {
      setRestockSaving(true);
      setRestockFeedback(null);
      setRestockingPartKey(part.part_key);

      const quantity = Number(restockQuantity) || 1;
      let newStock;
      if (isBuilderPart) {
        // Guitar parts are not products: restock them in the Guitar Parts catalog.
        const result = await adminApi.updateBuilderPart(part.builder_part_id, {
          stock: (Number(part.stock) || 0) + quantity,
        });
        // The API nests the updated row under data.part.
        newStock = result?.data?.part?.stock ?? result?.data?.stock;
      } else {
        const result = await adminApi.addInventoryStock(part.product_id, quantity, restockNotes || `Restocked for project ${projectId}`);
        newStock = result.data?.product?.stock;
      }
      const newStatus = getStockStatus(newStock, part.quantity);

      setRequiredParts(prev =>
        prev.map(item =>
          item.part_key === part.part_key
            ? { ...item, stock: newStock, stock_status: newStatus }
            : item
        )
      );
      setRestockFeedback({
        type: 'success',
        message: `${part.name} restocked with ${quantity} unit(s).`,
      });
      setRestockingPartKey(null);
      setRestockQuantity('1');
      setRestockNotes('');
    } catch (err) {
      setRestockFeedback({
        type: 'error',
        message: err.message || 'Failed to restock part.',
      });
    } finally {
      setRestockSaving(false);
    }
  };

  const handleCancelRestock = () => {
    setRestockingPartKey(null);
    setRestockQuantity('1');
    setRestockNotes('');
  };


  if (loading) return <div className="text-center py-10 text-[var(--text-muted)] animate-pulse">Loading tracker data...</div>;
  if (error) return <div className="text-red-400 p-4 border border-red-500/30 bg-red-500/10 rounded-xl">{error}</div>;
  if (!hierarchy) return null;

  return (
    <div className="space-y-6">
      
      {/* MAIN TRACKER SECTION */}
      <div className="space-y-6">
        
        {taskFeedback && <p role={taskFeedback.type === 'error' ? 'alert' : 'status'} className={`mb-4 text-sm ${taskFeedback.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>{taskFeedback.message}</p>}
        {isTaskUpdateBlocked && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20 shrink-0">
                  <Clock className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-amber-300">Payment Verification Required</p>
                  <p className="mt-1 text-xs text-amber-200/70">Task updates are locked until the payment proof for this order is verified. Please verify the payment to continue.</p>
                </div>
              </div>
              {onRedirectToOrder && (
                <button
                  type="button"
                  onClick={() => onRedirectToOrder?.(sourceOrder || (orderId ? { order_id: orderId, payment_status: orderPaymentStatus } : null))}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-500/20 border border-amber-500/40 px-4 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/30 hover:text-white transition-all shrink-0"
                >
                  Verify Payment
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
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
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Estimated completion:{' '}
                {isAdmin && isEditingCompletion ? (
                  <input
                    type="date"
                    value={editCompletionValue}
                    onChange={(e) => setEditCompletionValue(e.target.value)}
                    onBlur={handleSaveEstimatedCompletion}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEstimatedCompletion();
                      if (e.key === 'Escape') setIsEditingCompletion(false);
                    }}
                    className="ml-2 rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-2 py-1 text-sm text-white"
                    autoFocus
                  />
                ) : (
                  <span
                    className={`text-white font-medium ${isAdmin && !isTaskUpdateBlocked ? 'cursor-pointer hover:underline' : ''}`}
                    onClick={() => {
                      if (isAdmin && !isTaskUpdateBlocked) {
                        setEditCompletionValue(formatInputDate(estimatedCompletionDisplay) || '');
                        setIsEditingCompletion(true);
                      }
                    }}
                  >
                    {estimatedCompletionDisplay || 'Not set'}
                  </span>
                )}
              </p>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3 text-left lg:text-right whitespace-nowrap">
              <span className="text-[var(--gold-primary)] text-3xl md:text-4xl font-black leading-none">{clampedProgress}%</span>
              <p className="mt-1 text-white font-semibold">{formatStatusLabel(hierarchy.status)}</p>
              {isReadyForAssembly && (
                <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Ready for Assembly
                </div>
              )}
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
                <p className="mt-2 text-2xl font-bold text-white">{clampedProgress}<span className="text-base text-[var(--text-muted)]">%</span></p>
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

          {/* On Hold Banner - shown to both admin and customer */}
          {String(hierarchy.status || '').toLowerCase() === 'on_hold' && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
              <div className="flex items-start gap-4">
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20 shrink-0">
                  <Clock className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-amber-300">Build On Hold</p>
                  {isAdmin ? (
                    <p className="mt-1 text-xs text-amber-200/70">
                      This project is currently on hold by the customer. Work cannot continue until the customer resumes the project.
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-amber-200/70">
                      Manufacturing is paused. Tasks cannot be updated until the customer resumes the project.
                    </p>
                  )}
                  {hierarchy.hold_reason && (
                    <p className="mt-2 text-xs text-amber-200/80">
                      Reason: <span className="font-medium">{hierarchy.hold_reason}</span>
                    </p>
                  )}
                  {hierarchy.hold_requested_at && (
                    <p className="mt-0.5 text-xs text-amber-300/60">
                      Placed on hold: {hierarchy.hold_requested_at ? new Date(hierarchy.hold_requested_at).toLocaleString() : '—'}
                    </p>
                  )}
                  {hierarchy.hold_at_step && (
                    <p className="mt-0.5 text-xs text-amber-300/60">
                      Paused at: {hierarchy.hold_at_step}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {requiredParts.length > 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)]/60 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Parts Needed</h3>
                <p className="text-sm text-[var(--text-muted)]">Parts required to complete this build.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                {isAdmin && (
                  <button type="button" onClick={handleMarkAllReceived}
                    disabled={togglingSaving || isOnHold || isTaskUpdateBlocked || !requiredParts.some(part => !part.is_received && (!(part.product_id || part.builder_part_id) || (part.stock_status !== 'out_of_stock' && Number(part.stock) > 0)))}
                    className="rounded-lg border border-[var(--gold-primary)]/40 px-3 py-2 font-semibold text-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/10 disabled:opacity-50">
                    {togglingSaving && !togglingPartKey ? 'Marking...' : 'Mark All'}
                  </button>
                )}
                <span className="text-[var(--text-muted)]">{requiredParts.length} Parts</span>
                <span className="text-emerald-400">{requiredParts.filter(p => p.is_received).length} Received</span>
                <span className="text-[var(--text-muted)]">{requiredParts.filter(p => !p.is_received).length} Pending</span>
              </div>
            </div>
            {togglingFeedback && !togglingPartKey && (
              <p className={`mt-3 text-xs ${togglingFeedback.type === 'error' ? 'text-red-400' : 'text-emerald-300'}`}>{togglingFeedback.message}</p>
            )}
            <div className="mt-5 border border-[var(--border)] rounded-2xl overflow-hidden bg-[var(--bg-primary)]/40">
              <div className="divide-y divide-[var(--border)]">
                {requiredParts.map((part, idx) => {
                  const isReceived = Boolean(part.is_received);
                  // Stock lives in Guitar Parts for builder parts and in Inventory for
                  // product-backed parts. Specs with neither have no stock to show.
                  const isStockTracked = Boolean(part.product_id || part.builder_part_id);
                  const stockLabel = !isStockTracked
                    ? (isReceived ? 'Received' : 'Not Received')
                    : part.stock_status === 'unknown' || !part.stock_status
                      ? 'Not Linked'
                      : formatStatusLabel(part.stock_status);
                  const stockDetail = isStockTracked
                    ? ` • Stock: ${part.stock !== null && part.stock !== undefined ? part.stock : 'Not Linked'}`
                    : '';
                  const isOutOfStock = isStockTracked
                    && (part.stock_status === 'out_of_stock' || (Number(part.stock) || 0) === 0)
                    && !isReceived;
                  const isRestocking = restockingPartKey === part.part_key;
                  return (
                    <div key={`${part.part_key || `${part.category}-${part.name}-${part.source}-${part.product_id || 'anon'}`}-${idx}`} className={`p-4 transition-colors hover:bg-white/[0.02] ${isReceived ? 'opacity-60' : ''}`}>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={isReceived}
                            onChange={() => handleToggleReceive(part)}
                             disabled={togglingSaving || isOutOfStock || isTaskUpdateBlocked}
                             title={isOutOfStock ? 'Out of stock. Restock this part before marking it received.' : undefined}
                            className="w-4 h-4 rounded border-[var(--border)] bg-[var(--surface-dark)] text-[var(--gold-primary)] focus:ring-[var(--gold-primary)] shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{part.name}</p>
                            <p className="text-xs text-[var(--text-muted)]">
                              {formatStatusLabel(part.category || 'Other')} • Qty: {part.quantity}{stockDetail}
                            </p>
                          </div>
                        </label>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold shrink-0 ${getStockBadgeStyle(isStockTracked ? part.stock_status : (isReceived ? 'in_stock' : 'unknown'))}`}>
                          {stockLabel}
                        </span>
                        {isAdmin && isOutOfStock && !isRestocking && !isTaskUpdateBlocked && (
                          <button
                            type="button"
                            onClick={() => onRestockPart ? onRestockPart(part) : setRestockingPartKey(part.part_key)}
                            className="text-[10px] font-semibold rounded-full border border-[var(--gold-primary)]/30 bg-[var(--gold-primary)]/10 px-2 py-1 text-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/20 transition-colors shrink-0"
                          >
                            Restock
                          </button>
                        )}
                        {togglingFeedback && togglingPartKey === part.part_key && (
                          <p className={`text-[11px] shrink-0 ${togglingFeedback.type === 'error' ? 'text-red-400' : 'text-emerald-300'}`}>
                            {togglingFeedback.message}
                          </p>
                        )}
                      </div>
                      {isRestocking && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            value={restockQuantity}
                            onChange={(e) => setRestockQuantity(e.target.value)}
                            className="w-20 rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-2 py-1 text-xs text-white focus:border-[var(--gold-primary)] focus:outline-none"
                          />
                          <input
                            type="text"
                            value={restockNotes}
                            onChange={(e) => setRestockNotes(e.target.value)}
                            placeholder="Notes (optional)"
                            className="flex-1 min-w-[120px] rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-2 py-1 text-xs text-white placeholder:text-[var(--text-muted)] focus:border-[var(--gold-primary)] focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleRestockPart(part)}
                            disabled={restockSaving}
                            className="rounded-lg bg-[var(--gold-primary)] px-3 py-1 text-xs font-bold text-black hover:bg-[var(--gold-secondary)] disabled:opacity-60"
                          >
                            {restockSaving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelRestock}
                            className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)] hover:text-white hover:bg-white/5 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                      {restockFeedback && restockingPartKey === part.part_key && (
                        <p className={`mt-2 text-[11px] ${restockFeedback.type === 'error' ? 'text-red-400' : 'text-emerald-300'}`}>
                          {restockFeedback.message}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Finished Notification */}
        {!isAdmin && hierarchy.progress === 100 && hierarchy.status !== 'cancelled' && (
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
                {hierarchy.fulfillment_status === 'completed' ? (
                  <span className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    <CheckCircle className="w-3 h-3 text-emerald-400" /> Fulfillment Completed
                  </span>
                ) : (
                  <p className="mt-1 text-sm text-cyan-100/80">Status: {formatStatusLabel(hierarchy.fulfillment_status)}</p>
                )}
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

        {/* Cancellation Request Review — admin only, for projects with a pending request */}
        {isAdmin && pendingCancelRequest && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 mb-4">
            <div className="flex items-start gap-3 mb-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-amber-300 font-semibold">Cancellation Request</h4>
                <p className="mt-1 text-xs text-amber-300/70">A customer has requested to cancel a build that has already started. Review the request and approve or reject it below.</p>
              </div>
            </div>

            <div className="space-y-3 mt-3 text-xs">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                <div className="flex"><span className="text-[var(--text-muted)]">Progress</span><span className="text-white ml-auto font-semibold">{hierarchy.progress || 0}%</span></div>
                <div className="flex"><span className="text-[var(--text-muted)]">Status</span><span className="text-amber-400 ml-auto font-semibold">Pending Approval</span></div>
                <div className="flex"><span className="text-[var(--text-muted)]">Requested</span><span className="text-white ml-auto">{formatDisplayDate(hierarchy.cancel_requested_at) || '—'}</span></div>
                <div className="flex">
                  <span className="text-[var(--text-muted)]">Fulfillment</span>
                  <span className="text-white ml-auto font-medium">
                    {hierarchy.cancel_option === 'ship_to_address' || hierarchy.cancel_option === 'ship_unfinished'
                      ? 'Ship to Address'
                      : 'Pick Up at Shop'}
                  </span>
                </div>
              </div>

              {/* Reason */}
              {hierarchy.cancel_reason && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-3">
                  <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)] font-semibold mb-1">Reason</p>
                  <p className="text-sm text-white break-words">{hierarchy.cancel_reason}</p>
                </div>
              )}

              {/* Delivery Address */}
              {(hierarchy.cancel_option === 'ship_to_address' || hierarchy.cancel_option === 'ship_unfinished') ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-3 space-y-1">
                  <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)] font-semibold flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-400" /> Delivery Address
                  </p>
                  {(() => {
                    const snap = hierarchy.cancel_address_snapshot
                      ? (typeof hierarchy.cancel_address_snapshot === 'string'
                          ? JSON.parse(hierarchy.cancel_address_snapshot)
                          : hierarchy.cancel_address_snapshot)
                      : null;
                    const recipient = snap?.recipient_name || hierarchy.customer_name || 'Customer';
                    const phone = snap?.phone || hierarchy.customer_phone;
                    const line1 = snap?.line1 || hierarchy.cancel_address_line1;
                    const line2 = snap?.line2 || hierarchy.cancel_address_line2;
                    const barangay = snap?.barangay || hierarchy.cancel_address_barangay;
                    const city = snap?.city || hierarchy.cancel_address_city;
                    const province = snap?.province || hierarchy.cancel_address_province;
                    const postalCode = snap?.postal_code || hierarchy.cancel_address_postal_code;

                    return (
                      <div className="text-xs text-white/90 space-y-0.5 mt-1">
                        <p className="font-semibold text-white">{recipient}</p>
                        {phone && <p className="text-[var(--text-muted)]">{phone}</p>}
                        {line1 && <p>{line1}</p>}
                        {line2 && <p>{line2}</p>}
                        {barangay && <p>{barangay}</p>}
                        {(city || province) && <p>{[city, province].filter(Boolean).join(', ')}</p>}
                        {postalCode && <p className="text-[var(--text-muted)]">{postalCode}</p>}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-3 text-xs text-[var(--text-muted)] flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>No delivery address required.</span>
                </div>
              )}
            </div>

            {cancelReviewFeedback && (
              <p className={`mt-3 text-xs font-medium ${cancelReviewFeedback.type === 'error' ? 'text-red-400' : 'text-emerald-300'}`}>{cancelReviewFeedback.message}</p>
            )}

            <div className="mt-4">
              <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1.5">Reject Reason</label>
              <textarea
                value={cancelRejectReason}
                onChange={(e) => setCancelRejectReason(e.target.value)}
                placeholder="Why is this cancellation request being rejected?"
                maxLength={300}
                rows={2}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-3 py-2 text-sm text-white placeholder:text-[var(--text-muted)] focus:border-amber-500/50 focus:outline-none resize-none"
              />
            </div>

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={handleApproveCancelRequest}
                disabled={cancelReviewLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-600 transition-colors disabled:opacity-60 flex-1"
              >
                {cancelReviewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Approve &amp; Create Claim
              </button>
              <button
                type="button"
                onClick={handleRejectCancelRequest}
                disabled={cancelReviewLoading || !cancelRejectReason.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-300 hover:bg-amber-500/20 transition-colors disabled:opacity-50 flex-1"
              >
                Reject
              </button>
            </div>
            <p className="mt-2 text-[11px] text-[var(--text-muted)]">Approving cancels the build and creates a build claim the customer will receive in its current state. The customer requested: "{String(hierarchy.cancel_option || 'pickup').replace(/_/g, ' ')}".</p>
          </div>
        )}

        {/* Shop Fulfillment Section for Approved Cancellations */}
        {isAdmin && String(hierarchy.status || '').toLowerCase() === 'cancelled' && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {hierarchy.cancel_option === 'ship_to_address' || hierarchy.cancel_option === 'ship_unfinished' ? (
                  <Truck className="w-5 h-5 text-amber-400" />
                ) : (
                  <Package className="w-5 h-5 text-amber-400" />
                )}
                <div>
                  <h4 className="text-amber-300 font-semibold text-sm">
                    {hierarchy.cancel_option === 'ship_to_address' || hierarchy.cancel_option === 'ship_unfinished'
                      ? 'Shop-Managed Delivery'
                      : 'Pick Up at Shop'}
                  </h4>
                  <p className="text-xs text-[var(--text-muted)]">
                    {hierarchy.cancel_option === 'ship_to_address' || hierarchy.cancel_option === 'ship_unfinished'
                      ? 'Owner/admin manually arranges courier delivery for unfinished build and parts.'
                      : 'Customer will collect unfinished build and parts in person from workshop.'}
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-xs font-semibold text-amber-400">
                {hierarchy.cancel_option === 'ship_to_address' || hierarchy.cancel_option === 'ship_unfinished'
                  ? 'Ready for Delivery'
                  : 'Ready for Pickup'}
              </span>
            </div>

            {(hierarchy.cancel_option === 'ship_to_address' || hierarchy.cancel_option === 'ship_unfinished') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-[var(--surface-dark)] p-3.5 rounded-xl border border-[var(--border)]">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] block font-medium mb-0.5">Customer / Recipient</span>
                  <p className="font-semibold text-white">
                    {(() => {
                      const snap = hierarchy.cancel_address_snapshot
                        ? (typeof hierarchy.cancel_address_snapshot === 'string'
                            ? JSON.parse(hierarchy.cancel_address_snapshot)
                            : hierarchy.cancel_address_snapshot)
                        : null;
                      return snap?.recipient_name || hierarchy.customer_name || 'Customer';
                    })()}
                  </p>
                  <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] block font-medium mt-2 mb-0.5">Contact</span>
                  <p className="text-white">
                    {(() => {
                      const snap = hierarchy.cancel_address_snapshot
                        ? (typeof hierarchy.cancel_address_snapshot === 'string'
                            ? JSON.parse(hierarchy.cancel_address_snapshot)
                            : hierarchy.cancel_address_snapshot)
                        : null;
                      return snap?.phone || hierarchy.customer_phone || '—';
                    })()}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] block font-medium mb-0.5">Delivery Address</span>
                  <div className="text-white/90 space-y-0.5">
                    {(() => {
                      const snap = hierarchy.cancel_address_snapshot
                        ? (typeof hierarchy.cancel_address_snapshot === 'string'
                            ? JSON.parse(hierarchy.cancel_address_snapshot)
                            : hierarchy.cancel_address_snapshot)
                        : null;
                      const line1 = snap?.line1 || hierarchy.cancel_address_line1;
                      const line2 = snap?.line2 || hierarchy.cancel_address_line2;
                      const barangay = snap?.barangay || hierarchy.cancel_address_barangay;
                      const city = snap?.city || hierarchy.cancel_address_city;
                      const province = snap?.province || hierarchy.cancel_address_province;
                      const postalCode = snap?.postal_code || hierarchy.cancel_address_postal_code;

                      return (
                        <>
                          {line1 && <p>{line1}</p>}
                          {line2 && <p>{line2}</p>}
                          {barangay && <p>{barangay}</p>}
                          {(city || province) && <p>{[city, province].filter(Boolean).join(', ')}</p>}
                          {postalCode && <p className="text-[var(--text-muted)]">{postalCode}</p>}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Build Claim Manager — admin only, for cancelled projects */}
        {isAdmin && String(hierarchy.status || '').toLowerCase() === 'cancelled' && (
          <BuildClaimManager projectId={projectId} projectData={projectData} />
        )}

        {!isAdmin && hierarchy.progress === 100 && hierarchy.status !== 'cancelled' && (() => {
          const isLocked = ['processing', 'ready_for_pickup', 'out_for_delivery', 'completed'].includes(hierarchy?.fulfillment_status);
          const currentMethod = hierarchy?.fulfillment_method ? (hierarchy.fulfillment_method.includes('delivery') ? 'delivery' : 'pickup') : null;
          const currentStatus = hierarchy?.fulfillment_status || 'requested';

          return (
            <div className="rounded-2xl border border-[var(--gold-primary)]/30 bg-[var(--surface-dark)] p-6 space-y-5 shadow-2xl">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--gold-primary)] font-bold">CosmosCraft Custom Shop</p>
                  <h3 className="mt-1 text-2xl font-black text-white">Your custom build is complete</h3>
                  <p className="mt-2 text-sm text-[var(--text-muted)]">
                    Choose how you would like to receive it. You can update your choice until the shop starts fulfillment.
                  </p>
                </div>
                <div className={`rounded-xl px-3 py-2 text-xs font-semibold ${hierarchy.shop_delivery_eligible ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border border-amber-500/30 bg-amber-500/10 text-amber-300'}`}>
                  {hierarchy.shop_delivery_eligible ? 'Free shop delivery available for this address' : 'Shop delivery is limited to Luzon addresses'}
                </div>
              </div>

              {/* Locked Notice */}
              {isLocked && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex items-center gap-3 text-amber-300 text-sm font-semibold">
                  <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <span>Fulfillment has started. Your delivery method can no longer be changed.</span>
                </div>
              )}

              {/* Method Selection Cards */}
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  {
                    id: 'pickup',
                    icon: Store,
                    title: 'Pickup at Shop',
                    description: 'Pick up your completed guitar at the CosmosCraft workshop. We inspect and hand over the instrument in person.',
                    disabled: isLocked,
                  },
                  {
                    id: 'delivery',
                    icon: Truck,
                    title: 'Shop Delivery',
                    description: hierarchy.shop_delivery_eligible
                      ? 'Free doorstep delivery to your Luzon address, handled securely by our team.'
                      : 'Delivery is available for verified Luzon addresses. Please verify your address.',
                    disabled: isLocked || !hierarchy.shop_delivery_eligible,
                  },
                ].map((option) => {
                  const Icon = option.icon;
                  const isSelected = selectedFulfillmentMethod === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={option.disabled}
                      onClick={() => !isLocked && setSelectedFulfillmentMethod(option.id)}
                      className={`rounded-2xl border p-5 text-left transition-all ${
                        option.disabled
                          ? 'cursor-not-allowed border-[var(--border)] bg-[var(--bg-primary)] opacity-60'
                          : isSelected
                          ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10 shadow-[0_0_25px_rgba(212,175,55,0.15)] ring-1 ring-[var(--gold-primary)]'
                          : 'border-[var(--border)] bg-[var(--bg-primary)] hover:border-[var(--gold-primary)]/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <Icon className={`h-6 w-6 ${isSelected ? 'text-[var(--gold-primary)]' : 'text-[var(--text-muted)]'}`} />
                        {isSelected && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--gold-primary)] text-black uppercase tracking-wider">
                            Selected
                          </span>
                        )}
                      </div>
                      <p className="text-base font-bold text-white">{option.title}</p>
                      <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">{option.description}</p>
                    </button>
                  );
                })}
              </div>

              {fulfillmentFeedback && (
                <div className={`rounded-xl border px-4 py-3 text-sm flex items-center gap-2 ${
                  fulfillmentFeedback.type === 'success'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-red-500/30 bg-red-500/10 text-red-300'
                }`}>
                  {fulfillmentFeedback.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
                  <span>{fulfillmentFeedback.message}</span>
                </div>
              )}

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-5 space-y-4">
                {selectedFulfillmentMethod === 'pickup' ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2 text-sm">
                        <span className="font-semibold text-white">Preferred Pickup Date (Optional)</span>
                        <input
                          type="date"
                          disabled={isLocked}
                          min={formatInputDate(new Date())}
                          value={pickupDate}
                          onChange={(e) => setPickupDate(e.target.value)}
                          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] px-4 py-3 text-white focus:border-[var(--gold-primary)] focus:outline-none disabled:opacity-50"
                        />
                      </label>
                      <label className="space-y-2 text-sm">
                        <span className="font-semibold text-white">Preferred Pickup Time</span>
                        <select
                          disabled={isLocked}
                          value={pickupTime}
                          onChange={(e) => setPickupTime(e.target.value)}
                          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] px-4 py-3 text-white focus:border-[var(--gold-primary)] focus:outline-none disabled:opacity-50"
                        >
                          <option value="">Any Workshop Hours (10 AM - 6 PM)</option>
                          {pickupTimeSlots.map((slot) => (
                            <option key={slot.value} value={slot.value}>{slot.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">
                      Pickup location: CosmosCraft Custom Shop, 123 Guitar Artisan Way, Quezon City, Metro Manila.
                    </p>
                  </>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-[var(--text-muted)] space-y-1">
                    <p className="font-semibold text-white">Delivery Address on File</p>
                    <p className="text-xs text-white/90">{shippingAddressLabel}</p>
                    {!shippingAddress?.line1 && (
                      <p className="text-xs text-amber-300">Please add or select a delivery address before requesting Shop Delivery.</p>
                    )}
                  </div>
                )}

                <label className="space-y-2 text-sm block">
                  <span className="font-semibold text-white">Fulfillment Notes & Instructions</span>
                  <textarea
                    disabled={isLocked}
                    value={fulfillmentNotes}
                    onChange={(e) => setFulfillmentNotes(e.target.value)}
                    placeholder={selectedFulfillmentMethod === 'delivery'
                      ? 'Add landmarks, gate codes, or preferred delivery hours.'
                      : 'Add any special pickup instructions or notes for the team.'}
                    rows={2}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] px-4 py-3 text-white placeholder:text-[var(--text-muted)] focus:border-[var(--gold-primary)] focus:outline-none disabled:opacity-50 resize-none"
                  />
                </label>
              </div>

              {!isLocked && (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <p className="text-xs text-[var(--text-muted)]">
                    {hasSavedFulfillment
                      ? 'You can update this preference until the shop starts processing your fulfillment.'
                      : 'Your selection will be sent directly to the workshop team to start fulfillment.'}
                  </p>
                  <button
                    type="button"
                    onClick={handleSubmitFulfillment}
                     disabled={fulfillmentSaving || isTaskUpdateBlocked || (selectedFulfillmentMethod === 'delivery' && !hierarchy.shop_delivery_eligible)}
                     className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] px-6 py-3 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-60 shadow-lg shadow-[var(--gold-primary)]/20 hover:opacity-95 transition-all cursor-pointer"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {fulfillmentSaving
                      ? 'Saving Choice...'
                      : hasSavedFulfillment
                      ? 'Update Fulfillment Method'
                      : 'Confirm Fulfillment Choice'}
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {/* Milestones Accordion - Only show when showTracker is true (My Guitar section) */}
        {showTracker && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="rounded-full border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gold-primary)]">
              Project-Specific Tasks
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              These tasks belong to this project. Default task edits apply to future projects only; edit this project?s tasks here.
            </p>
          </div>

          {hierarchy.milestones?.length === 0 ? (
             <div className="text-center py-12 bg-white/5 border border-[var(--border)] rounded-2xl">
               <AlertCircle className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
               <p className="text-white font-semibold">No milestones built yet.</p>
               <p className="text-[var(--text-muted)] text-sm">{(isAdmin ? 'Create a milestone to get started.' : 'Awaiting admin initialization.')}</p>
             </div>
          ) : (
            hierarchy.milestones?.map((milestone, i) => {
              const isExpanded = expandedMilestones.has(milestone.milestone_id);
              const isLockedMilestone = isMilestoneLocked(milestone);
              const mProgress = milestone.subtasks?.length 
                ? Math.round(milestone.subtasks.reduce((sum, task) => sum + (task.status === 'completed' ? 100 : Number(task.progress || 0)), 0) / milestone.subtasks.length)
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
                       {isAdmin && milestone.status !== 'completed' && milestone.subtasks?.some((subtask) => subtask.status !== 'completed') && (
                         <button 
                           onClick={(e) => { e.stopPropagation(); requestCompleteAllSubtasks(milestone); }}
                            disabled={isOnHold || isLockedMilestone || taskMutationBusy || Boolean(togglingSubtaskId) || isTaskUpdateBlocked}
                            className="p-2 hover:bg-green-500/10 rounded-lg text-green-400 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                           title="Complete all tasks in this milestone"
                           aria-label={`Complete all tasks in ${milestone.title}`}
                         >
                           {completingMilestoneId === milestone.milestone_id
                             ? <Loader2 className="w-4 h-4 animate-spin" />
                             : <Flag className="w-4 h-4" />}
                         </button>
                       )}
                       {isAdmin && milestone.status === 'completed' && (
                         <span className="text-xs font-semibold text-green-400 bg-green-500/10 px-2 py-1 rounded-lg border border-green-500/30">Done</span>
                       )}
                        {isAdmin && (
                          <button
                            onClick={(e) => { e.stopPropagation(); requestDeleteMilestone(milestone); }}
                            disabled={isOnHold || taskMutationBusy || isTaskUpdateBlocked}
                            className="p-2 hover:bg-red-500/10 rounded-lg text-red-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                            title={`Delete milestone ${milestone.title}`}
                            aria-label={`Delete milestone ${milestone.title}`}
                          >
                            {deletingMilestoneId === milestone.milestone_id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Trash2 className="w-4 h-4" />}
                          </button>
                        )}
                       <div className="p-2 bg-[var(--bg-primary)] rounded-lg">
                         {isExpanded ? <ChevronDown className="w-5 h-5 text-white" /> : <ChevronRight className="w-5 h-5 text-white" />}
                       </div>
                     </div>
                  </div>

                  {/* Mark-all-as-done progress for this milestone */}
                  {completingMilestoneId === milestone.milestone_id && (
                    <p role="status" className="flex items-center gap-2 border-t border-[var(--border)] bg-emerald-500/5 px-5 py-3 text-xs font-semibold text-emerald-300">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Marking all remaining tasks as done. Please wait...
                    </p>
                  )}

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
                            milestone.subtasks?.map((subtask) => {
                               const isCompleted = subtask.status === 'completed';
                               const isLocked = isLockedMilestone;
                               const canUserUpdate = (isAdmin || subtask.is_customer_updatable) && !isLocked && !isTaskUpdateBlocked;

                               if (editingTaskId === subtask.subtask_id) return <ProjectTaskForm key={subtask.subtask_id} task={subtask}
                                 staff={[...staffMembers, ...(hierarchy.team || [])]} onSaved={handleTaskSaved} onCancel={() => setEditingTaskId(null)} />;
                               return (
                                 <div key={subtask.subtask_id} className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${isLocked ? 'opacity-60' : ''} ${isCompleted ? 'bg-green-500/5 border-green-500/30' : 'bg-[var(--surface-dark)] border-[var(--border)] hover:border-[var(--gold-primary)]/50'}`}>
                                   <button
                                     onClick={() => toggleSubtaskStatus(subtask)}
                                     disabled={!canUserUpdate || taskMutationBusy || Boolean(togglingSubtaskId)}
                                    title={isLocked ? 'Complete all tasks in the previous milestone first' : undefined}
                                    className={`mt-0.5 rounded-full outline-none focus:ring-2 focus:ring-[var(--gold-primary)] transition-all ${canUserUpdate && !isCompleted && togglingSubtaskId !== subtask.subtask_id ? 'hover:scale-110' : 'cursor-not-allowed opacity-60'}`}
                                  >
                                    {togglingSubtaskId === subtask.subtask_id ? (
                                      <Loader2 className="w-6 h-6 animate-spin text-[var(--gold-primary)]" />
                                    ) : isCompleted ? (
                                      <CheckCircle className="w-6 h-6 text-green-400" />
                                    ) : (
                                      isLocked ? <Lock className="w-5 h-5 text-[var(--text-muted)]" /> : <Circle className={`w-6 h-6 ${canUserUpdate ? 'text-[var(--text-muted)] hover:text-[var(--gold-primary)]' : 'text-gray-600 cursor-not-allowed'}`} />
                                    )}
                                  </button>
                                  <div className="flex-1">
                                    <p className={`font-medium ${isCompleted ? 'text-[var(--text-muted)] line-through' : 'text-white'}`}>{subtask.title}</p>
                                    <p className="mt-1 text-xs text-[var(--text-muted)]">Progress: {isCompleted ? 100 : subtask.progress || 0}%{subtask.due_date ? ` ? Due ${subtask.due_date.slice(0, 10)}` : ''}</p>
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
                                   {isAdmin && !isOnHold && !isTaskUpdateBlocked && <button type="button" aria-label={`Edit task ${subtask.title}`} onClick={() => { setEditingTaskId(subtask.subtask_id); setAddingSubtaskTo(null); }} className="p-1.5 hover:bg-white/10 rounded"><Edit3 className="w-4 h-4" /></button>}
                                   {isAdmin && (
                                      <button
                                        type="button"
                                        disabled={taskMutationBusy || isOnHold || isTaskUpdateBlocked}
                                        onClick={() => requestDeleteSubtask(subtask)}
                                       title={`Delete task ${subtask.title}`}
                                       aria-label={`Delete task ${subtask.title}`}
                                       className="p-1.5 hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 rounded disabled:cursor-not-allowed disabled:opacity-50"
                                     >
                                       {deletingSubtaskId === subtask.subtask_id
                                         ? <Loader2 className="w-4 h-4 animate-spin" />
                                         : <Trash2 className="w-4 h-4" />}
                                     </button>
                                   )}
                                </div>
                              );
                            })
                          )}

                          {/* Admin: Add Subtask Row */}
                          {isAdmin && (
                            addingSubtaskTo === milestone.milestone_id ? (
                              <ProjectTaskForm milestoneId={milestone.milestone_id} staff={[...staffMembers, ...(hierarchy.team || [])]}
                                onSaved={handleTaskSaved} onCancel={() => setAddingSubtaskTo(null)} />
                            ) : (
                              <button disabled={isOnHold || isTaskUpdateBlocked} onClick={() => { setAddingSubtaskTo(milestone.milestone_id); setEditingTaskId(null); }} className="flex items-center gap-2 w-full p-3 rounded-xl border border-dashed border-[var(--border)] hover:border-[var(--gold-primary)]/50 text-[var(--text-muted)] hover:text-[var(--gold-primary)] transition-all justify-center mt-2">
                                <Plus className="w-4 h-4" /> Add Task
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
                      <button type="button" onClick={handleAddMilestone} disabled={taskMutationBusy || isTaskUpdateBlocked} className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 bg-[var(--gold-primary)] text-black font-bold rounded-xl disabled:opacity-60">
                        {taskMutationBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        {taskMutationBusy ? 'Creating...' : 'Create Milestone'}
                      </button>
                      <button type="button" onClick={() => setIsAddingMilestone(false)} className="flex-1 py-2.5 bg-white/10 text-white font-medium rounded-xl">Cancel</button>
                    </div>
                 </div>
               </div>
              ) : (
                <button disabled={isTaskUpdateBlocked} onClick={() => setIsAddingMilestone(true)} className="flex items-center justify-center gap-2 w-full p-4 rounded-2xl border-2 border-dashed border-[var(--border)] hover:border-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/5 text-[var(--text-muted)] hover:text-white transition-all font-semibold">
                  <Plus className="w-5 h-5" /> Add Milestone
                </button>
              )
          )}

        </div>
        )}
      </div>

      <AnimatePresence>
        {pendingUncheckSubtask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-5"
            >
              <h3 className="text-lg font-semibold text-white">Uncheck Completed Task?</h3>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                This will move the task back to pending.
              </p>
              <p className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-white">
                {pendingUncheckSubtask.title}
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPendingUncheckSubtask(null)}
                  className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text-light)] hover:bg-[var(--bg-primary)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmUncheckSubtask}
                  className="flex-1 rounded-lg bg-[var(--gold-primary)] px-3 py-2 text-sm font-semibold text-black hover:bg-[var(--gold-secondary)]"
                >
                  Yes, Uncheck
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingUncheckPart && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-5"
            >
              <h3 className="text-lg font-semibold text-white">Return this part to inventory?</h3>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Unchecking will return the deducted quantity back to inventory for{' '}
                <span className="text-white font-medium">{pendingUncheckPart.name}</span>.
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={handleCancelUncheckPart}
                  className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text-light)] hover:bg-[var(--bg-primary)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmUncheckPart}
                  disabled={togglingSaving || isTaskUpdateBlocked}
                  className="flex-1 rounded-lg bg-[var(--gold-primary)] px-3 py-2 text-sm font-semibold text-black hover:bg-[var(--gold-secondary)] disabled:opacity-60"
                >
                  {togglingSaving ? 'Returning...' : 'Confirm Return'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        open={Boolean(pendingCompleteAll)}
        title="Mark all tasks as done?"
        description={pendingCompleteAll
          ? `All ${pendingCompleteAll.remainingCount} remaining task${pendingCompleteAll.remainingCount === 1 ? '' : 's'} in "${pendingCompleteAll.milestone.title}" will be marked as completed.`
          : ''}
        confirmLabel="Mark all as done"
        cancelLabel="Cancel"
        variant="info"
        isBusy={Boolean(completingMilestoneId)}
        onConfirm={completeAllSubtasks}
        onCancel={cancelCompleteAllSubtasks}
      />

      <ConfirmModal
        open={Boolean(pendingDeleteMilestone)}
        title={pendingDeleteMilestone ? `Delete "${pendingDeleteMilestone.title}"?` : ''}
        description={pendingDeleteMilestone
          ? `This deletes the milestone and every task inside it (${(pendingDeleteMilestone.subtasks || []).length} task(s)). This cannot be undone.`
          : ''}
        confirmLabel="Delete Milestone"
        cancelLabel="Cancel"
        variant="danger"
        isBusy={Boolean(deletingMilestoneId)}
        onConfirm={confirmDeleteMilestone}
        onCancel={() => { if (!deletingMilestoneId) setPendingDeleteMilestone(null); }}
      />

      <ConfirmModal
        open={Boolean(pendingDeleteSubtask)}
        title="Delete this task?"
        description={pendingDeleteSubtask ? `"${pendingDeleteSubtask.title}" will be removed from this milestone.` : ''}
        confirmLabel="Delete Task"
        cancelLabel="Cancel"
        variant="danger"
        isBusy={Boolean(deletingSubtaskId)}
        onConfirm={confirmDeleteSubtask}
        onCancel={() => { if (!deletingSubtaskId) setPendingDeleteSubtask(null); }}
      />
    </div>
  );
}


