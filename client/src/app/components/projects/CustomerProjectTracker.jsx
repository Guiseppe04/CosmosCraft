import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { CheckCircle, Clock, AlertCircle, Guitar, DollarSign, Calendar, CreditCard, RefreshCw } from 'lucide-react';
import { adminApi } from '../../utils/adminApi';

const formatLabel = (value) => {
  if (!value) return '';
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatStatus = (status) => {
  if (!status) return 'Not Started';
  const map = {
    'not_started': 'Not Started',
    'in_progress': 'In Progress',
    'completed': 'Completed',
    'cancelled': 'Cancelled',
    'on_hold': 'On Hold',
    'pending': 'Pending',
    'delivered': 'Delivered',
  };
  return map[status] || formatLabel(status);
};

const formatDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatShortDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const formatCurrency = (value) => {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);
};

const REFUND_STATUS_CONFIG = {
  pending: { label: 'Refund Request Pending', className: 'border-amber-500/30 text-amber-400' },
  'pending_payment_verification': { label: 'Refund Awaiting Payment Verification', className: 'border-violet-500/30 text-violet-400' },
  approved: { label: 'Refund Approved', className: 'border-green-500/30 text-green-400' },
  processing: { label: 'Refund Processing', className: 'border-sky-500/30 text-sky-400' },
  rejected: { label: 'Refund Rejected', className: 'border-red-500/30 text-red-400' },
  refunded: { label: 'Refunded', className: 'border-sky-500/30 text-sky-400' },
};

export default function CustomerProjectTracker({ projectId, projectName, projectData, customBuildId }) {
  const [hierarchy, setHierarchy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [installmentData, setInstallmentData] = useState(null);
  const [installmentLoading, setInstallmentLoading] = useState(false);
  const [refundEligibility, setRefundEligibility] = useState(null);
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundMessage, setRefundMessage] = useState(null);

  useEffect(() => {
    if (projectId) {
      loadData();
      loadInstallments();
      loadRefundEligibility();
    }
  }, [projectId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const hierarchyRes = await adminApi.getProjectHierarchy(projectId);
      setHierarchy(hierarchyRes.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadInstallments = async () => {
    try {
      setInstallmentLoading(true);
      const res = await adminApi.getProjectInstallments(projectId);
      setInstallmentData(res.data);
    } catch (err) {
      console.error('Failed to load installments:', err);
    } finally {
      setInstallmentLoading(false);
    }
  };

  const loadRefundEligibility = async () => {
    if (!projectId) return;
    try {
      setRefundLoading(true);
      const res = await adminApi.getProjectRefundEligibility(projectId);
      setRefundEligibility(res.data);
    } catch (err) {
      console.error('Failed to load refund eligibility:', err);
      setRefundEligibility(null);
    } finally {
      setRefundLoading(false);
    }
  };

  const handleRequestRefund = async () => {
    if (!projectId || !refundReason.trim()) return;
    try {
      setRefundSubmitting(true);
      await adminApi.requestProjectRefund(projectId, {
        reason: refundReason.trim(),
        amount_requested: refundEligibility?.refundable_amount,
      });
      setRefundMessage({ type: 'success', text: 'Refund request submitted. An admin will review it shortly.' });
      setRefundReason('');
      setRefundEligibility(null);
    } catch (err) {
      setRefundMessage({ type: 'error', text: err.message });
    } finally {
      setRefundSubmitting(false);
    }
  };

  const taskSummary = hierarchy?.task_summary || { total: 0, completed: 0, pending: 0 };
  const clampedProgress = Math.min(Math.max(Number(hierarchy?.progress) || 0, 0), 100);
  const milestones = Array.isArray(hierarchy?.milestones) ? hierarchy.milestones : [];

  // Find current milestone (first incomplete one) and completed milestones count
  const currentMilestone = milestones.find((m) => {
    const subtasks = Array.isArray(m?.subtasks) ? m.subtasks : [];
    if (subtasks.length > 0) {
      return subtasks.some((s) => s.status === 'pending' || s.status === 'in_progress');
    }
    if (m.status === 'completed') return false;
    const idx = milestones.indexOf(m);
    if (idx === 0) return true;
    const prev = milestones[idx - 1];
    const prevSubtasks = Array.isArray(prev?.subtasks) ? prev.subtasks : [];
    return prevSubtasks.length > 0 ? prevSubtasks.every(s => s.status === 'completed') : prev.status === 'completed';
  });

  const currentTask = currentMilestone?.subtasks?.find((s) => s.status === 'pending' || s.status === 'in_progress');

  const completedMilestones = milestones.filter((m) => {
    const subtasks = Array.isArray(m?.subtasks) ? m.subtasks : [];
    if (subtasks.length > 0) {
      return subtasks.every(s => s.status === 'completed');
    }
    return m.status === 'completed';
  }).length;

  const estimatedCompletion = formatShortDate(
    hierarchy?.estimated_completion_date ||
    projectData?.estimated_completion_date
  );

  const lastUpdated = formatDate(hierarchy?.updated_at || hierarchy?.claimed_at || hierarchy?.created_at);

  const installmentSummary = installmentData?.summary;
  const paymentPlan = installmentData?.payment_plan;
  const isFullPayment = paymentPlan === 'full_payment';

  // Compute payment status
  const getPaymentStatus = () => {
    if (!installmentSummary || !installmentSummary.total_months) return null;
    const { paid_count, total_months } = installmentSummary;
    if (paid_count === 0) return { label: 'Pending', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' };
    if (paid_count >= total_months) return { label: 'Fully Paid', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' };
    return { label: 'Ongoing', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' };
  };

  const paymentStatus = getPaymentStatus();

  // Refund status from the project payload (single source of truth)
  const refundStatus = hierarchy?.refund_status || null;
  const refundStatusConfig = refundStatus ? (REFUND_STATUS_CONFIG[refundStatus] || REFUND_STATUS_CONFIG.pending) : null;

  // Last completed stage: prefer the cancellation snapshot, then the live column
  const lastCompletedStage = hierarchy?.cancelled_stage_snapshot || hierarchy?.last_completed_stage || null;
  const lastCompletedStageAt = hierarchy?.cancelled_stage_snapshot_at || hierarchy?.last_completed_stage_at || null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--gold-primary)] border-t-transparent" />
          <p className="text-sm text-[var(--text-muted)]">Loading progress...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <p className="text-sm text-red-300">Unable to load project progress. Please try again later.</p>
        </div>
      </div>
    );
  }

  if (!hierarchy) return null;

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white">{projectName || hierarchy.name || hierarchy.title || 'Custom Build'}</h2>
          {customBuildId && (
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Custom Build ID: {customBuildId}
            </p>
          )}
        </div>

        {/* Status & Progress */}
        <div className="grid gap-4 sm:grid-cols-2 mb-6">
          {String(hierarchy.status || '').toLowerCase() === 'on_hold' ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 sm:col-span-2">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20">
                  <Clock className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-amber-300/70">Status</p>
                  <p className="text-lg font-bold text-amber-300">On Hold</p>
                </div>
              </div>
              {hierarchy.hold_reason && (
                <p className="mt-2 text-sm text-amber-200/80 pl-11">
                  Reason: {hierarchy.hold_reason}
                </p>
              )}
              {hierarchy.hold_requested_at && (
                <p className="mt-1 text-xs text-amber-300/60 pl-11">
                  Placed on hold: {formatDate(hierarchy.hold_requested_at)}
                </p>
              )}
              {hierarchy.hold_at_step && (
                <p className="mt-1 text-xs text-amber-300/60 pl-11">
                  Paused at: {formatLabel(hierarchy.hold_at_step)}
                </p>
              )}
              <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                <p className="text-xs text-amber-200/70">
                  Manufacturing is paused. Staff cannot complete or start any build tasks until you resume the project. You can resume it from your dashboard.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">Status</p>
              <p className="mt-2 text-lg font-bold text-white">{formatStatus(hierarchy.status)}</p>
            </div>
          )}
           <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
             <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">Progress</p>
             <p className="mt-2 text-lg font-bold text-[var(--gold-primary)]">{clampedProgress}%</p>
           </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-[var(--text-muted)]">Overall Progress</span>
            <span className="text-sm font-semibold text-white">{taskSummary.completed} of {taskSummary.total} tasks</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-white/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${clampedProgress}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)]"
            />
          </div>
        </div>

        {/* Current Build Progress (renamed from Current Manufacturing Step) */}
        {milestones.length > 0 ? (
          <div className="rounded-xl border border-[var(--gold-primary)]/30 bg-[var(--gold-primary)]/5 p-5">
            <div className="flex items-start gap-4">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--gold-primary)]/20">
                {currentMilestone ? (
                  <Clock className="h-5 w-5 text-[var(--gold-primary)]" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-green-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-[0.1em] text-[var(--text-muted)]">
                  {currentMilestone ? 'Current Build Progress' : 'Manufacturing Complete'}
                </p>
                <p className="mt-1.5 font-semibold text-white text-lg">
                  {currentMilestone ? formatLabel(currentMilestone.title) : 'All Steps Completed'}
                </p>
                {currentTask && (
                  <p className="mt-1.5 text-sm text-[var(--gold-primary)]">
                    Current Task: {formatLabel(currentTask.title)}
                  </p>
                )}

                {/* Step progress indicator */}
                {milestones.length > 0 && (
                  <div className="mt-4 flex items-center gap-2">
                    {milestones.map((m, i) => {
                      const subtasks = Array.isArray(m?.subtasks) ? m.subtasks : [];
                      const isStepComplete = subtasks.length > 0
                        ? subtasks.every(s => s.status === 'completed')
                        : m.status === 'completed';
                      const isCurrentStep = m.milestone_id === currentMilestone?.milestone_id;

                      return (
                        <div key={m.milestone_id} className="flex items-center gap-1">
                          <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                            isStepComplete
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                              : isCurrentStep
                              ? 'bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] border border-[var(--gold-primary)]/40'
                              : 'bg-white/5 text-[var(--text-muted)] border border-[var(--border)]'
                          }`}>
                            {isStepComplete ? (
                              <CheckCircle className="h-3.5 w-3.5" />
                            ) : (
                              i + 1
                            )}
                          </div>
                          {i < milestones.length - 1 && (
                            <div className={`h-px w-4 ${
                              isStepComplete ? 'bg-green-500/40' : 'bg-[var(--border)]'
                            }`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-5 text-center">
            <Guitar className="mx-auto h-8 w-8 text-[var(--text-muted)]/30 mb-2" />
            <p className="text-white font-semibold">Build Not Yet Started</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              The manufacturing process will begin once a staff member claims this project.
            </p>
          </div>
        )}

        {/* Last Completed Stage (what the customer receives if cancelled now) */}
        <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-5">
          <p className="text-xs uppercase tracking-[0.1em] text-[var(--text-muted)]">Current Build — What You Receive</p>
          {lastCompletedStage ? (
            <div className="mt-2 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
              <div>
                <p className="text-white font-semibold">{formatLabel(lastCompletedStage)}</p>
                {lastCompletedStageAt && (
                  <p className="text-xs text-[var(--text-muted)]">Completed {formatDate(lastCompletedStageAt)}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-[var(--text-muted)] shrink-0" />
              <p className="text-sm text-[var(--text-muted)]">No completed build available.</p>
            </div>
          )}
        </div>

        {/* Cancellation Info */}
        {String(hierarchy.status || '').toLowerCase() === 'cancelled' && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/5 p-5">
            <p className="text-xs uppercase tracking-[0.1em] text-red-300/70">Cancellation</p>
            <p className="mt-2 text-sm text-white">
              {hierarchy.cancel_reason || 'Cancelled'}
            </p>
            {hierarchy.cancel_approved_at && (
              <p className="mt-1 text-xs text-red-300/60">
                Cancelled on {formatDate(hierarchy.cancel_approved_at)}
              </p>
            )}
          </div>
        )}

        {/* Refund Status */}
        {refundStatusConfig && (
          <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-5">
            <p className="text-xs uppercase tracking-[0.1em] text-[var(--text-muted)]">Refund</p>
            <div className="mt-2 flex items-center gap-2">
              <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-semibold ${refundStatusConfig.className}`}>
                {refundStatusConfig.label}
              </span>
              {hierarchy.refund_amount_requested && (
                <span className="text-sm text-white">{formatCurrency(hierarchy.refund_amount_requested)}</span>
              )}
            </div>
            {hierarchy.refund_requested_at && (
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Requested {formatDate(hierarchy.refund_requested_at)}
              </p>
            )}
            {refundStatus === 'pending_payment_verification' && (
              <p className="mt-2 text-xs text-violet-300/80">
                Your payment proof is being reviewed by the admin. Once verified, your refund request will be submitted for approval.
              </p>
            )}
            {refundStatus === 'rejected' && (
              <p className="mt-2 text-xs text-red-300/80">
                Refund unavailable — your submitted payment proof was not verified by the admin.
              </p>
            )}
          </div>
        )}

        {/* Request Refund (customer-only, only when eligible) */}
        {refundEligibility?.eligible && !refundStatus && (
          <div className="mt-6 rounded-xl border border-[var(--gold-primary)]/30 bg-[var(--gold-primary)]/5 p-5">
            <p className="text-xs uppercase tracking-[0.1em] text-[var(--text-muted)]">Request Refund</p>
            <p className="mt-2 text-sm text-white">
              You are eligible for a refund of{' '}
              <span className="font-bold text-[var(--gold-primary)]">{formatCurrency(refundEligibility.refundable_amount)}</span>{' '}
              because this project has not started yet.
            </p>
            <textarea
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="Reason for refund (required)..."
              rows={3}
              className="mt-3 w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-sm text-white placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--gold-primary)] resize-none"
            />
            {refundMessage && (
              <p className={`mt-2 text-sm ${refundMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                {refundMessage.text}
              </p>
            )}
            <button
              onClick={handleRequestRefund}
              disabled={refundSubmitting || !refundReason.trim()}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] px-4 py-2.5 text-sm font-semibold text-black transition-all hover:shadow-[0_0_20px_rgba(212,175,55,0.35)] disabled:opacity-50"
            >
              {refundSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
              {refundSubmitting ? 'Submitting...' : 'Request Refund'}
            </button>
          </div>
        )}

        {/* Installment Schedule */}
        {isFullPayment ? (
          <div className="mt-6 rounded-xl border border-green-500/30 bg-green-500/5 p-5">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-400" />
              <div>
                <p className="text-white font-bold text-lg">Payment Complete</p>
                <p className="text-sm text-[var(--text-muted)]">You paid it in Full Payment.</p>
              </div>
            </div>
          </div>
        ) : installmentSummary ? (
          <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-5">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-5 h-5 text-[var(--gold-primary)]" />
              <h3 className="text-white font-bold text-lg">Payment Installment Schedule</h3>
              {paymentStatus && (
                <span className={`ml-auto text-xs font-semibold px-2.5 py-1 rounded-full border ${paymentStatus.bg} ${paymentStatus.border} ${paymentStatus.color}`}>
                  {paymentStatus.label}
                </span>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] p-3">
                <p className="text-xs uppercase tracking-[0.1em] text-[var(--text-muted)]">Remaining Balance</p>
                <p className="mt-1 text-lg font-bold text-[var(--gold-primary)]">
                  {formatCurrency(installmentSummary.remaining_balance)}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] p-3">
                <p className="text-xs uppercase tracking-[0.1em] text-[var(--text-muted)]">Monthly Payment</p>
                <p className="mt-1 text-lg font-bold text-white">
                  {formatCurrency(installmentSummary.monthly_payment)}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] p-3">
                <p className="text-xs uppercase tracking-[0.1em] text-[var(--text-muted)]">Paid Installments</p>
                <p className="mt-1 text-lg font-bold text-green-400">
                  {installmentSummary.paid_count || 0} / {installmentSummary.total_months} Paid
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] p-3">
                <p className="text-xs uppercase tracking-[0.1em] text-[var(--text-muted)]">Remaining Installments</p>
                <p className="mt-1 text-lg font-bold text-white">
                  {installmentSummary.remaining_months} / {installmentSummary.total_months} Remaining
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] p-3">
                <p className="text-xs uppercase tracking-[0.1em] text-[var(--text-muted)]">Next Due Date</p>
                <p className="mt-1 text-lg font-bold text-white">
                  {installmentSummary.next_due_date ? formatShortDate(installmentSummary.next_due_date) : '—'}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] p-3">
                <p className="text-xs uppercase tracking-[0.1em] text-[var(--text-muted)]">Last Updated</p>
                <p className="mt-1 text-lg font-bold text-white">
                  {installmentSummary.last_updated ? formatDate(installmentSummary.last_updated) : '—'}
                </p>
              </div>
            </div>

            {/* Installment list */}
            {installmentData?.installments?.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs uppercase tracking-[0.1em] text-[var(--text-muted)] mb-2">Payment History</p>
                {installmentData.installments.map((inst) => (
                  <div key={inst.schedule_id} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        inst.status === 'paid' ? 'bg-green-500' :
                        inst.status === 'overdue' ? 'bg-red-500' : 'bg-yellow-500'
                      }`} />
                      <span className="text-sm text-white">Month {inst.installment_number}</span>
                      <span className="text-sm text-[var(--text-muted)]">— {formatCurrency(inst.amount)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[var(--text-muted)]">
                        Due: {formatShortDate(inst.due_date)}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        inst.status === 'paid' ? 'bg-green-500/10 text-green-400' :
                        inst.status === 'overdue' ? 'bg-red-500/10 text-red-400' :
                        'bg-yellow-500/10 text-yellow-400'
                      }`}>
                        {formatLabel(inst.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* Info Row */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {estimatedCompletion && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">Estimated Completion</p>
              <p className="mt-1 text-sm font-medium text-white">{estimatedCompletion}</p>
            </div>
          )}
          {lastUpdated && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">Last Updated</p>
              <p className="mt-1 text-sm font-medium text-white">{lastUpdated}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}