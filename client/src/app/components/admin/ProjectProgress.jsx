import { useState } from 'react'
import { motion } from 'motion/react'
import {
  Palette,
  TreeDeciduous,
  Wrench,
  Paintbrush,
  Settings,
  CheckCircle2,
  ChevronRight,
  Clock,
  User,
} from 'lucide-react'

// Project stages with icons and colors
const PROJECT_STAGES = [
  {
    id: 'design',
    name: 'Design',
    description: 'Initial design and specifications',
    icon: Palette,
    color: 'from-purple-500 to-purple-600',
    bgColor: 'bg-purple-500/20',
    textColor: 'text-purple-400',
  },
  {
    id: 'wood',
    name: 'Wood Selection',
    description: 'Choosing and preparing wood materials',
    icon: TreeDeciduous,
    color: 'from-amber-500 to-amber-600',
    bgColor: 'bg-amber-500/20',
    textColor: 'text-amber-400',
  },
  {
    id: 'assembly',
    name: 'Assembly',
    description: 'Building and assembling the guitar',
    icon: Wrench,
    color: 'from-blue-500 to-blue-600',
    bgColor: 'bg-blue-500/20',
    textColor: 'text-blue-400',
  },
  {
    id: 'painting',
    name: 'Painting',
    description: 'Finishing and painting the instrument',
    icon: Paintbrush,
    color: 'from-pink-500 to-pink-600',
    bgColor: 'bg-pink-500/20',
    textColor: 'text-pink-400',
  },
  {
    id: 'setup',
    name: 'Setup',
    description: 'Final setup and quality testing',
    icon: Settings,
    color: 'from-cyan-500 to-cyan-600',
    bgColor: 'bg-cyan-500/20',
    textColor: 'text-cyan-400',
  },
  {
    id: 'completed',
    name: 'Completed',
    description: 'Ready for delivery or pickup',
    icon: CheckCircle2,
    color: 'from-green-500 to-green-600',
    bgColor: 'bg-green-500/20',
    textColor: 'text-green-400',
  },
]

/**
 * ProjectProgress Component
 * Shows project stages with visual progress tracking
 */
export function ProjectProgress({
  currentStage = 0,
  projectName,
  customerName,
  orderId,
  assignedStaff,
  startDate,
  estimatedCompletion,
  onStageChange,
  isEditable = false,
}) {
  const currentStageData = PROJECT_STAGES[currentStage] || PROJECT_STAGES[0]
  const progressPercentage = ((currentStage + 1) / PROJECT_STAGES.length) * 100

  return (
    <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-[var(--border)]">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[var(--text-muted)] text-sm font-mono mb-1">{orderId}</p>
            <h3 className="text-white font-bold text-xl">{projectName}</h3>
            <p className="text-[var(--text-muted)] text-sm mt-1">Customer: {customerName}</p>
          </div>
          <div className={`px-4 py-2 rounded-xl ${currentStageData.bgColor}`}>
            <span className={`${currentStageData.textColor} font-semibold text-sm`}>
              {currentStageData.name}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative">
          <div className="h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className={`h-full bg-gradient-to-r ${currentStageData.color} rounded-full`}
            />
          </div>
          <p className="text-[var(--text-muted)] text-xs mt-2">
            {currentStage + 1} of {PROJECT_STAGES.length} stages completed ({Math.round(progressPercentage)}%)
          </p>
        </div>

        {/* Meta Info */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-[var(--border)]">
          <div>
            <p className="text-[var(--text-muted)] text-xs">Started</p>
            <p className="text-white font-medium text-sm">{startDate || 'TBD'}</p>
          </div>
          <div>
            <p className="text-[var(--text-muted)] text-xs">Est. Completion</p>
            <p className="text-white font-medium text-sm">{estimatedCompletion || 'TBD'}</p>
          </div>
          <div>
            <p className="text-[var(--text-muted)] text-xs">Assigned To</p>
            <p className="text-white font-medium text-sm flex items-center gap-1">
              <User className="w-3 h-3" />
              {assignedStaff || 'Unassigned'}
            </p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="p-6">
        <h4 className="text-white font-semibold mb-4">Project Timeline</h4>
        <div className="space-y-1">
          {PROJECT_STAGES.map((stage, index) => {
            const isCompleted = index < currentStage
            const isCurrent = index === currentStage
            const isPending = index > currentStage
            const StageIcon = stage.icon

            return (
              <div
                key={stage.id}
                className={`flex items-center gap-4 p-3 rounded-xl transition-all duration-200 ${
                  isCurrent ? 'bg-[var(--bg-primary)]' : ''
                }`}
              >
                {/* Icon */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isCompleted
                      ? `${stage.bgColor}`
                      : isCurrent
                      ? `${stage.bgColor}`
                      : 'bg-[var(--bg-primary)]'
                  }`}
                >
                  <StageIcon
                    className={`w-5 h-5 ${
                      isCompleted || isCurrent ? stage.textColor : 'text-[var(--text-muted)]'
                    }`}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-medium ${
                      isCompleted || isCurrent ? 'text-white' : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {stage.name}
                  </p>
                  <p className="text-[var(--text-muted)] text-xs">
                    {isCurrent ? stage.description : isCompleted ? 'Completed' : 'Pending'}
                  </p>
                </div>

                {/* Status */}
                <div>
                  {isCompleted && (
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  )}
                  {isCurrent && (
                    <Clock className="w-5 h-5 text-[var(--gold-primary)] animate-pulse" />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/**
 * Compact Progress Badge
 * Shows progress in a small inline format
 */
export function ProgressBadge({ currentStage, showPercentage = false }) {
  const currentStageData = PROJECT_STAGES[currentStage] || PROJECT_STAGES[0]
  const progressPercentage = ((currentStage + 1) / PROJECT_STAGES.length) * 100

  return (
    <div className="flex items-center gap-2">
      <div className={`px-2 py-1 rounded-lg ${currentStageData.bgColor}`}>
        <span className={`${currentStageData.textColor} text-xs font-medium`}>
          {currentStageData.name}
        </span>
      </div>
      {showPercentage && (
        <span className="text-[var(--text-muted)] text-xs">
          {Math.round(progressPercentage)}%
        </span>
      )}
    </div>
  )
}

/**
 * Progress Selector Component
 * Allows staff/admin to update project stage
 */
export function StageSelector({ currentStage, onStageChange }) {
  return (
    <div className="space-y-3">
      <label className="block text-white font-medium">Update Project Stage</label>
      <div className="grid grid-cols-2 gap-2">
        {PROJECT_STAGES.map((stage, index) => {
          const isSelected = index === currentStage
          const StageIcon = stage.icon

          return (
            <button
              key={stage.id}
              onClick={() => onStageChange(index)}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${
                isSelected
                  ? `border-[var(--gold-primary)] ${stage.bgColor}`
                  : 'border-[var(--border)] hover:border-[var(--gold-primary)]/50'
              }`}
            >
              <StageIcon
                className={`w-5 h-5 ${
                  isSelected ? stage.textColor : 'text-[var(--text-muted)]'
                }`}
              />
              <span
                className={`text-sm ${
                  isSelected ? 'text-white' : 'text-[var(--text-muted)]'
                }`}
              >
                {stage.name}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default ProjectProgress
