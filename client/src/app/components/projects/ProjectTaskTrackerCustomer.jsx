import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, Circle, ChevronDown, ChevronRight, User, Clock, AlertCircle, Calendar, Truck, Store, ShieldCheck, X, Lock, AlertTriangle } from 'lucide-react';
import { adminApi } from '../../utils/adminApi';
import { useAuth } from '../../context/AuthContext';

const SHOP_INFO = {
  name: 'CosmosCraft Guitar Shop',
  address: '123 Guitar Street, Music City, Philippines',
  availableDays: 'Monday to Saturday',
  availableTime: '9:00 AM to 6:00 PM',
};

const isValidBusinessDay = (dateStr, unavailableDates = []) => {
  if (!dateStr) return false;
  const targetDate = dateStr.split('T')[0];
  const date = new Date(targetDate + 'T00:00:00');
  const day = date.getDay();
  if (day === 0) return false; // Only Sunday is closed
  const isUnavailable = unavailableDates.some(d => {
    const unavailableDate = typeof d === 'object' ? d?.date : d;
    if (!unavailableDate) return false;
    return unavailableDate.split('T')[0] === targetDate;
  });
  return !isUnavailable;
};

const isDateUnavailable = (dateStr, unavailableDates = []) => {
  if (!dateStr || !unavailableDates.length) return false;
  const targetDate = dateStr.split('T')[0];
  return unavailableDates.some(d => {
    const unavailableDate = typeof d === 'object' ? d?.date : d;
    if (!unavailableDate) return false;
    return unavailableDate.split('T')[0] === targetDate;
  });
};

const getDayName = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-PH', { weekday: 'long' });
};

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

export default function ProjectTaskTracker({ projectId, projectName, showTracker = true }) {
  const { user } = useAuth();
  const [hierarchy, setHierarchy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Expanded state for accordions
  const [expandedMilestones, setExpandedMilestones] = useState(new Set());

  // Fulfillment form states
  const [selectedFulfillmentMethod, setSelectedFulfillmentMethod] = useState('pickup_appointment');
  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [fulfillmentNotes, setFulfillmentNotes] = useState('');
  const [fulfillmentSaving, setFulfillmentSaving] = useState(false);
  const [fulfillmentFeedback, setFulfillmentFeedback] = useState(null);

  // Confirmation modal state
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [confirmedSelection, setConfirmedSelection] = useState(null);
  const [unavailableDates, setUnavailableDates] = useState([]);

  // Validation state
  const [validationErrors, setValidationErrors] = useState({});

  // Validation helpers
  const validateRequired = (value, fieldName) => {
    if (!value || (typeof value === 'string' && !value.trim())) {
      return `${fieldName} is required`;
    }
    return null;
  };

  const validateDate = (dateStr, fieldName) => {
    if (!dateStr) return `${fieldName} is required`;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return `${fieldName} is invalid`;
    if (date < new Date()) return `${fieldName} cannot be in the past`;
    return null;
  };

  const validateTime = (timeStr, fieldName) => {
    if (!timeStr) return `${fieldName} is required`;
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(timeStr)) return `${fieldName} format is invalid`;
    return null;
  };

  const validateBusinessHours = (timeStr) => {
    if (!timeStr) return null;
    const [hours, minutes] = timeStr.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    const openMinutes = 9 * 60; // 9:00 AM
    const closeMinutes = 18 * 60; // 6:00 PM
    return totalMinutes >= openMinutes && totalMinutes <= closeMinutes ? null : 'Time must be between 9:00 AM and 6:00 PM';
  };

  const validateAddress = (address, fieldName) => {
    if (!address?.line1) return `${fieldName} is required`;
    if (!address?.city) return 'City is required';
    if (!address?.province) return 'Province is required';
    if (!address?.postal_code) return 'Postal code is required';
    return null;
  };

  const validateAllFields = () => {
    const errors = {};
    
    if (selectedFulfillmentMethod === 'pickup_appointment') {
      const dateError = validateRequired(pickupDate, 'Pickup date');
      if (!dateError) {
        if (!isValidBusinessDay(pickupDate, unavailableDates)) {
          if (isDateUnavailable(pickupDate, unavailableDates)) {
            errors.pickupDate = 'Selected date is unavailable';
          } else {
            errors.pickupDate = 'Please select a weekday or Saturday (Monday to Saturday)';
          }
        }
      } else {
        errors.pickupDate = dateError;
      }
      
      const timeError = validateRequired(pickupTime, 'Pickup time');
      if (!timeError) {
        const businessHoursError = validateBusinessHours(pickupTime);
        if (businessHoursError) {
          errors.pickupTime = businessHoursError;
        }
      } else {
        errors.pickupTime = timeError;
      }
    } else if (selectedFulfillmentMethod === 'shop_delivery') {
      const addressError = validateAddress(shippingAddress, 'Delivery address');
      if (addressError) {
        errors.deliveryAddress = addressError;
      }
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const clearValidationError = (field) => {
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  };

  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  useEffect(() => {
    fetchUnavailableDates();
  }, []);

  const fetchUnavailableDates = async () => {
    try {
      const res = await adminApi.getUnavailableDates();
      const dates = res.data?.unavailable_dates || [];
      setUnavailableDates(dates);
    } catch (e) {
      console.error('Failed to fetch unavailable dates:', e);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getProjectHierarchy(projectId);
      setHierarchy(res.data);
      
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
    if (!hierarchy) return;

    const existingMethod = hierarchy.fulfillment_method || 'pickup_appointment';
    const existingPickupAt = hierarchy.pickup_appointment?.scheduled_at;

    setSelectedFulfillmentMethod(existingMethod);
    setPickupDate(existingPickupAt ? formatInputDate(existingPickupAt) : formatInputDate(new Date(Date.now() + 86400000)));
    setPickupTime(existingPickupAt ? formatInputTime(existingPickupAt) : '10:00');
    setFulfillmentNotes(hierarchy.fulfillment_notes || '');
    
    // If there's an existing fulfillment method, lock the selection
    if (hierarchy.fulfillment_method) {
      setConfirmedSelection(hierarchy.fulfillment_method);
    }
  }, [hierarchy]);

  const toggleMilestone = (mId) => {
    setExpandedMilestones(prev => {
      const next = new Set(prev);
      if (next.has(mId)) next.delete(mId);
      else next.add(mId);
      return next;
    });
  };

  const taskSummary = hierarchy?.task_summary || { total: 0, completed: 0, pending: 0 };
  const pickupTimeSlots = buildPickupTimeSlots(pickupDate);
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

  // User Actions
  const toggleSubtaskStatus = async (subtask) => {
    if (!subtask.is_customer_updatable) return;

    try {
      const newStatus = subtask.status === 'completed' ? 'pending' : 'completed';
      await adminApi.updateSubtask(subtask.subtask_id, { status: newStatus });
      loadData();
    } catch (err) {
      alert("Failed to update task: " + err.message);
    }
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
      
      {/* ── MAIN TRACKER SECTION ── */}
      <div className="space-y-6">
        
        {/* Progress Header */}
        <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--gold-primary)]/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-white text-2xl font-bold">{hierarchy.name || hierarchy.title || projectName || 'Project Tracker'}</h2>
              <p className="text-[var(--text-muted)] text-sm">{hierarchy.customer_name ? `For: ${hierarchy.customer_name}` : '—'}</p>
            </div>
            <div className="text-right">
              <span className="text-[var(--gold-primary)] text-3xl font-black">{hierarchy.progress}%</span>
              <p className="text-white font-semibold flex items-center justify-end gap-2">
                {formatStatusLabel(hierarchy.status)}
              </p>
            </div>
          </div>
          
          <div className="h-3 w-full bg-[var(--bg-primary)] rounded-full overflow-hidden mb-2">
             <motion.div 
               initial={{ width: 0 }} 
               animate={{ width: `${hierarchy.progress}%` }} 
               transition={{ duration: 1, ease: 'easeOut' }}
               className="h-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)]" 
             />
          </div>
          <div className="flex items-center justify-between mt-4">
            <p className="text-[var(--text-muted)] text-xs">
              {taskSummary.total > 0
                ? `${taskSummary.completed} of ${taskSummary.total} tasks completed`
                : 'No tasks added yet'}
            </p>
            
            {false && (
              <div
                className={`py-2 px-4 rounded-lg font-bold text-xs flex items-center gap-2 ${
                  hierarchy.progress === 100
                    ? 'bg-[var(--gold-primary)]/15 text-[var(--gold-primary)] border border-[var(--gold-primary)]/30'
                    : 'bg-[var(--surface-elevated)] text-[var(--text-muted)] border border-[var(--border)]'
                }`}
              >
                <Calendar className="w-4 h-4" />
                {hierarchy.progress === 100 ? 'Choose release option below' : 'Release options unlock at 100%'}
              </div>
            )}
          </div>
        </div>

        {/* Finished Notification */}
        {hierarchy.progress === 100 && (
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

        {hierarchy.progress === 100 && (
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
                const isConfirmed = confirmedSelection !== null;
                const isThisConfirmed = confirmedSelection === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={option.disabled || isConfirmed}
                    onClick={() => !isConfirmed && setSelectedFulfillmentMethod(option.id)}
                    className={`rounded-2xl border p-4 text-left transition-all relative ${
                      option.disabled
                        ? 'cursor-not-allowed border-[var(--border)] bg-[var(--bg-primary)] opacity-50'
                        : isThisConfirmed
                        ? 'border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.12)]'
                        : isSelected
                        ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10 shadow-[0_0_20px_rgba(212,175,55,0.12)]'
                        : isConfirmed
                        ? 'cursor-not-allowed border-[var(--border)] bg-[var(--bg-primary)] opacity-50'
                        : 'border-[var(--border)] bg-[var(--bg-primary)] hover:border-[var(--gold-primary)]/40'
                    }`}
                  >
                    {isThisConfirmed && (
                      <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                        <Lock className="w-3 h-3" /> Confirmed
                      </div>
                    )}
                    <Icon className={`mb-3 h-5 w-5 ${isThisConfirmed ? 'text-emerald-400' : isSelected ? 'text-[var(--gold-primary)]' : 'text-[var(--text-muted)]'}`} />
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
              {(() => {
                const isConfirmed = confirmedSelection !== null;
                return selectedFulfillmentMethod === 'pickup_appointment' ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2 text-sm">
                        <span className="font-semibold text-white">Pickup Date</span>
                        <div className="relative">
                          <input
                            type="date"
                            min={formatInputDate(new Date())}
                            value={pickupDate}
                            onChange={(e) => {
                              const newDate = e.target.value;
                              if (newDate && !isValidBusinessDay(newDate, unavailableDates)) {
                                if (isDateUnavailable(newDate, unavailableDates)) {
                                  setValidationErrors(prev => ({ ...prev, pickupDate: 'That date is unavailable. Please select another date.' }));
                                  return;
                                }
                                setValidationErrors(prev => ({ ...prev, pickupDate: 'Please select a weekday or Saturday (Monday to Saturday).' }));
                                return;
                              }
                              setPickupDate(newDate);
                              clearValidationError('pickupDate');
                            }}
                            disabled={confirmedSelection !== null}
                            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] px-4 py-3 text-white focus:border-[var(--gold-primary)] focus:outline-none disabled:opacity-50"
                          />
                          {pickupDate && (
                            <div className="absolute right-12 top-1/2 -translate-y-1/2 pointer-events-none">
                              <Calendar className="w-4 h-4 text-[var(--gold-primary)]" />
                            </div>
                          )}
                        </div>
                        {validationErrors.pickupDate && (
                          <p className="text-sm text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {validationErrors.pickupDate}
                          </p>
                        )}
                      </label>
                      <label className="space-y-2 text-sm">
                        <span className="font-semibold text-white">Pickup Time</span>
                        <div className="relative">
                          <select
                            value={pickupTime}
                            onChange={(e) => {
                              setPickupTime(e.target.value);
                              clearValidationError('pickupTime');
                            }}
                            disabled={confirmedSelection !== null}
                            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] px-4 py-3 text-white focus:border-[var(--gold-primary)] focus:outline-none disabled:opacity-50"
                          >
                            <option value="" disabled>Select a time</option>
                            {pickupTimeSlots.map((slot) => (
                              <option key={slot.value} value={slot.value}>{slot.label}</option>
                            ))}
                          </select>
                          {pickupTime && (
                            <div className="absolute right-12 top-1/2 -translate-y-1/2 pointer-events-none">
                              <Clock className="w-4 h-4 text-[var(--gold-primary)]" />
                            </div>
                          )}
                        </div>
                        {validationErrors.pickupTime && (
                          <p className="text-sm text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {validationErrors.pickupTime}
                          </p>
                        )}
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
                );
              })()}

              <label className="space-y-2 text-sm block">
                <span className="font-semibold text-white">Notes</span>
                <textarea
                  value={fulfillmentNotes}
                  onChange={(e) => setFulfillmentNotes(e.target.value)}
                  disabled={confirmedSelection !== null}
                  placeholder={selectedFulfillmentMethod === 'external_delivery'
                    ? 'Example: Lalamove booked under Juan Dela Cruz, call before handoff.'
                    : selectedFulfillmentMethod === 'shop_delivery'
                    ? 'Example: Gate code, landmark, or preferred delivery contact.'
                    : 'Add any preferred pickup instructions.'}
                  className="min-h-[110px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] px-4 py-3 text-white placeholder:text-[var(--text-muted)] focus:border-[var(--gold-primary)] focus:outline-none disabled:opacity-50"
                />
              </label>

              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-[var(--text-muted)]">
                <p className="font-semibold text-white">Delivery Address on File</p>
                <p className="mt-1">{shippingAddressLabel}</p>
                {selectedFulfillmentMethod === 'shop_delivery' && !shippingAddress?.line1 && (
                  <p className="mt-2 text-amber-300">Add a saved address to your profile if you want the shop to deliver your build.</p>
                )}
              </div>
              {validationErrors.deliveryAddress && (
                <p className="text-sm text-red-400 flex items-center gap-1 mt-2">
                  <AlertTriangle className="w-3 h-3" />
                  {validationErrors.deliveryAddress}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[var(--text-muted)]">
                {hasSavedFulfillment
                  ? 'You can update this preference any time before the team dispatches the project.'
                  : 'Your selection will be attached to the finished project for staff follow-up.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (!validateAllFields()) {
                    return;
                  }
                  if (selectedFulfillmentMethod === 'pickup_appointment') {
                    if (!pickupDate || !pickupTime) {
                      return;
                    }
                    if (!isValidBusinessDay(pickupDate, unavailableDates)) {
                      return;
                    }
                  }
                  setShowConfirmationModal(true);
                }}
                disabled={fulfillmentSaving || (selectedFulfillmentMethod === 'shop_delivery' && !hierarchy.shop_delivery_eligible) || confirmedSelection !== null}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] px-5 py-3 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle className="h-4 w-4" />
                {confirmedSelection !== null
                  ? 'Selection Confirmed'
                  : fulfillmentSaving
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

        {/* Confirmation Modal */}
        <AnimatePresence>
          {showConfirmationModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 max-w-md w-full space-y-5"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white">Confirm Your Choice</h3>
                  <button
                    onClick={() => setShowConfirmationModal(false)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-[var(--text-muted)]" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Release Method Details */}
                  <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mb-2">Selected Release Method</p>
                    <div className="flex items-center gap-3">
                      {selectedFulfillmentMethod === 'pickup_appointment' ? (
                        <Store className="w-6 h-6 text-[var(--gold-primary)]" />
                      ) : selectedFulfillmentMethod === 'external_delivery' ? (
                        <Truck className="w-6 h-6 text-[var(--gold-primary)]" />
                      ) : (
                        <ShieldCheck className="w-6 h-6 text-[var(--gold-primary)]" />
                      )}
                      <p className="text-lg font-bold text-white">{formatFulfillmentLabel(selectedFulfillmentMethod)}</p>
                    </div>
                  </div>

                  {/* Pickup Details (if pickup appointment) */}
                  {selectedFulfillmentMethod === 'pickup_appointment' && (
                    <div className="space-y-3">
                      <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mb-2">Shop Details</p>
                        <div className="space-y-2">
                          <p className="text-white font-semibold">{SHOP_INFO.name}</p>
                          <p className="text-sm text-[var(--text-muted)]">{SHOP_INFO.address}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl p-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mb-1">Available Days</p>
                          <p className="text-white font-semibold">{SHOP_INFO.availableDays}</p>
                        </div>
                        <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl p-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mb-1">Available Time</p>
                          <p className="text-white font-semibold">{SHOP_INFO.availableTime}</p>
                        </div>
                      </div>
                      {/* Selected Date/Time */}
                      <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mb-1">Your Selected Schedule</p>
                        <div className="flex items-center gap-3">
                          <Calendar className="w-5 h-5 text-[var(--gold-primary)]" />
                          <div>
                            <p className="text-white font-semibold">
                              {pickupDate && new Date(pickupDate + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                            <p className="text-sm text-[var(--gold-primary)]">{pickupTime && new Date(`2000-01-01T${pickupTime}:00`).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Delivery Details (if shop delivery) */}
                  {selectedFulfillmentMethod === 'shop_delivery' && (
                    <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mb-2">Delivery Address</p>
                      <p className="text-white">{shippingAddressLabel}</p>
                    </div>
                  )}

                  {/* Notes (if any) */}
                  {fulfillmentNotes && (
                    <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mb-2">Your Notes</p>
                      <p className="text-white">{fulfillmentNotes}</p>
                    </div>
                  )}
                </div>

                {/* Confirmation Text */}
                <p className="text-center text-[var(--text-muted)]">
                  Please verify your choice above. Once confirmed, this selection cannot be changed.
                </p>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowConfirmationModal(false)}
                    className="flex-1 py-3 px-4 rounded-xl border border-[var(--border)] text-white font-semibold hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setShowConfirmationModal(false);
                      setConfirmedSelection(selectedFulfillmentMethod);
                      await handleSubmitFulfillment();
                    }}
                    disabled={fulfillmentSaving}
                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black font-bold disabled:opacity-60"
                  >
                    {fulfillmentSaving ? 'Confirming...' : 'Confirm Selection'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Milestones Accordion - Only show when showTracker is true (My Guitar section) */}
        {showTracker && (
        <div className="space-y-4">
          {hierarchy.milestones?.length === 0 ? (
             <div className="text-center py-12 bg-white/5 border border-[var(--border)] rounded-2xl">
               <AlertCircle className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
               <p className="text-white font-semibold">No milestones built yet.</p>
               <p className="text-[var(--text-muted)] text-sm">{('Awaiting admin initialization.')}</p>
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
                      {false && (
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
                              const canUserUpdate = subtask.is_customer_updatable;

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
                                      {subtask.is_customer_updatable && (
                                        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] uppercase font-bold tracking-wider rounded">CUSTOMER ACTION REQ</span>
                                      )}
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
                                  {false && (
                                     <button onClick={() => handleDeleteSubtask(subtask.subtask_id)} className="p-1.5 hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 rounded">
                                       <Trash2 className="w-4 h-4" />
                                     </button>
                                  )}
                                </div>
                              );
                            })
                          )}

                          {/* Admin: Add Subtask Row */}
                          {false && (
                            addingSubtaskTo === milestone.milestone_id ? (
                              <div className="p-4 bg-[var(--surface-dark)] border border-[var(--gold-primary)]/50 rounded-xl mt-4">
                                <input autoFocus type="text" placeholder="Task description..." value={form.subtaskTitle || ''} onChange={e => setForm({...form, subtaskTitle: e.target.value})} className="w-full bg-transparent text-white border-b border-[var(--border)] focus:border-[var(--gold-primary)] px-2 py-1 outline-none mb-3" />
                                <label className="flex items-center gap-2 mb-4 cursor-pointer w-fit">
                                  <input type="checkbox" checked={form.isCustomerUpdatable || false} onChange={e => setForm({...form, isCustomerUpdatable: e.target.checked})} className="w-4 h-4" />
                                  <span className="text-sm text-[var(--text-muted)]">Customer can mark this complete</span>
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
          {false && (
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
