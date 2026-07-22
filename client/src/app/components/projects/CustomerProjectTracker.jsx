import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { CheckCircle, Clock, AlertCircle, Guitar } from 'lucide-react';
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

export default function CustomerProjectTracker({ projectId, projectName, projectData, customBuildId }) {
  const [hierarchy, setHierarchy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const taskSummary = hierarchy?.task_summary || { total: 0, completed: 0, pending: 0 };
  const clampedProgress = Math.min(Math.max(Number(hierarchy?.progress) || 0, 0), 100);
  const milestones = Array.isArray(hierarchy?.milestones) ? hierarchy.milestones : [];

  // Find current milestone (first incomplete one) and completed milestones count
  const currentMilestone = milestones.find((m) => {
    const subtasks = Array.isArray(m?.subtasks) ? m.subtasks : [];
    // If has subtasks, check if not all completed; if no subtasks, check if the step is still pending/in_progress
    if (subtasks.length > 0) {
      return subtasks.some((s) => s.status === 'pending' || s.status === 'in_progress');
    }
    // If the milestone itself has no subtasks but is completed, skip it
    if (m.status === 'completed') return false;
    // If the milestone has no subtasks and is not completed, it's either pending or in_progress
    // Check if previous milestone is completed
    const idx = milestones.indexOf(m);
    if (idx === 0) return true;
    const prev = milestones[idx - 1];
    const prevSubtasks = Array.isArray(prev?.subtasks) ? prev.subtasks : [];
    return prevSubtasks.length > 0 ? prevSubtasks.every(s => s.status === 'completed') : prev.status === 'completed';
  });

  const currentTask = currentMilestone?.subtasks?.find((s) => s.status === 'pending' || s.status === 'in_progress');
  
  // Find which steps are completed (for the step indicators)
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
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">Status</p>
            <p className="mt-2 text-lg font-bold text-white">{formatStatus(hierarchy.status)}</p>
          </div>
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

        {/* Current Manufacturing Step */}
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
                  {currentMilestone ? 'Current Manufacturing Step' : 'Manufacturing Complete'}
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