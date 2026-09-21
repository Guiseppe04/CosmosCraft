import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, ChevronUp, Edit, Guitar, Layers, Plus, Trash2 } from 'lucide-react'
import { BUILDER_CATEGORY_MAP, GUITAR_TYPE_LABELS, PART_CATEGORY_LABELS } from '../../constants/adminOptions'
import { formatCurrency } from '../../../../utils/formatCurrency'

export function GuitarPartAccordion({ parts, expandedGuitarTypes, onToggleGuitarType, expandedPartCategories, onTogglePartCategory, onEdit, onDelete, onQuickAdd, density }) {
  const guitarTypes = ['electric', 'bass', 'general']
  const densityClass = density === 'compact' ? 'text-xs' : 'text-sm'
  const sectionLabels = {
    pricing: 'Pricing',
    body: 'Body',
    neck: 'Neck & Headstock',
    hardware: 'Hardware',
    electronics: 'Electronics',
  }

  const formatSlotLabel = (slot) => slot
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (character) => character.toUpperCase())

  const getPartType = (part) => String(part.guitar_type || 'general').trim().toLowerCase() || 'general'
  const getPartSlot = (part) => String(part.type_mapping || '').trim()
  const getPartVariant = (part) => {
    const variant = part.metadata?.variant
    return typeof variant === 'string' && variant.trim() ? variant.trim() : null
  }
  const mappedSlots = new Set(Object.values(BUILDER_CATEGORY_MAP).flat())

  const renderPart = (part) => (
    <div
      key={part.part_id}
      className="flex items-center justify-between gap-3 rounded-lg bg-[var(--bg-primary)]/50 p-2 hover:bg-[var(--gold-primary)]/10 transition-colors group"
    >
      <div className="flex items-center gap-3 min-w-0">
        {part.image_url ? (
          <img src={part.image_url} alt={part.name} className="w-8 h-8 rounded object-contain border border-[var(--border)]" />
        ) : (
          <div className="w-8 h-8 rounded bg-[var(--surface-dark)] flex items-center justify-center border border-[var(--border)]">
            <Guitar className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
        )}
        <div className="min-w-0">
          <p className={`text-white truncate ${densityClass}`}>{part.name}</p>
          <p className="text-[var(--gold-primary)] text-xs">{formatCurrency(part.price)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`px-2 py-0.5 rounded-full text-xs ${part.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
          {part.is_active ? 'Active' : 'Inactive'}
        </span>
        <span className="text-[var(--text-muted)] text-xs">{part.quantity ?? 0} in stock</span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button type="button" onClick={() => onEdit(part)} className="p-1.5 hover:bg-[var(--gold-primary)]/20 rounded" title="Edit">
            <Edit className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          </button>
          <button type="button" onClick={() => onDelete(part.part_id, part.name)} className="p-1.5 hover:bg-red-500/20 rounded" title="Deactivate">
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </button>
        </div>
      </div>
    </div>
  )

  const renderSlot = (guitarType, sectionKey, slot, slotParts) => {
    const slotId = `${guitarType}-${sectionKey}-${slot}`
    const isSlotExpanded = expandedPartCategories.has(slotId)
    const variantGroups = Array.from(new Set(slotParts.map(getPartVariant).filter(Boolean)))
    const hasVariants = variantGroups.length > 0

    return (
      <div key={slot} className="border border-[var(--border)] rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-[var(--bg-primary)]/50">
          <button
            type="button"
            onClick={() => onTogglePartCategory(slotId)}
            className="flex-1 flex items-center gap-2 text-left hover:text-white transition-colors"
          >
            {isSlotExpanded ? <ChevronDown className="w-4 h-4 text-[var(--gold-primary)]" /> : <ChevronRight className="w-4 h-4 text-[var(--gold-primary)]" />}
            <span className="text-white font-medium">{formatSlotLabel(slot)}</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--bg-primary)] text-[var(--text-muted)]">{slotParts.length}</span>
          </button>
          <button
            type="button"
            onClick={() => onQuickAdd(guitarType, slot)}
            className="p-1.5 hover:bg-[var(--gold-primary)]/20 rounded-lg transition-colors"
            title={`Add ${formatSlotLabel(slot)} choice`}
          >
            <Plus className="w-4 h-4 text-[var(--gold-primary)]" />
          </button>
        </div>
        <AnimatePresence>
          {isSlotExpanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-[var(--border)]">
              <div className={`p-3 space-y-3 ${density === 'compact' ? 'p-2' : 'p-3'}`}>
                {hasVariants ? variantGroups.map((variant) => (
                  <div key={variant} className="rounded-lg border border-[var(--border)] bg-[var(--surface-dark)]/50 p-2">
                    <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{formatSlotLabel(variant)}</p>
                    <div className="space-y-2">{slotParts.filter((part) => getPartVariant(part) === variant).map(renderPart)}</div>
                  </div>
                )) : (
                  <div className="space-y-2">{slotParts.map(renderPart)}</div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {guitarTypes.map((guitarType) => {
        const isExpanded = expandedGuitarTypes.has(guitarType)
        const typeLabel = GUITAR_TYPE_LABELS[guitarType] || guitarType
        return (
          <div key={guitarType} className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => onToggleGuitarType(guitarType)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--gold-primary)]/20 flex items-center justify-center">
                  <Guitar className="w-5 h-5 text-[var(--gold-primary)]" />
                </div>
                <div className="text-left">
                  <h4 className="text-white font-semibold">{typeLabel}</h4>
                  <p className="text-[var(--text-muted)] text-xs">
                    {parts.filter((p) => p.guitar_type === guitarType).length} parts
                  </p>
                </div>
              </div>
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-[var(--text-muted)]" />
              ) : (
                <ChevronDown className="w-5 h-5 text-[var(--text-muted)]" />
              )}
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-[var(--border)]"
                >
                  <div className="p-4 space-y-2">
                    {Object.entries(BUILDER_CATEGORY_MAP).map(([sectionKey, slots]) => {
                      const sectionParts = parts.filter((part) => getPartType(part) === guitarType && slots.includes(getPartSlot(part)))
                      if (sectionParts.length === 0) return null
                      const sectionId = `${guitarType}-section-${sectionKey}`
                      const isSectionExpanded = expandedPartCategories.has(sectionId)
                      const presentSlots = slots.filter((slot) => sectionParts.some((part) => getPartSlot(part) === slot))

                      return (
                        <div key={sectionKey} className="border border-[var(--border)] rounded-xl overflow-hidden">
                          <button
                            type="button"
                            onClick={() => onTogglePartCategory(sectionId)}
                            className="flex w-full items-center gap-2 px-4 py-3 bg-[var(--bg-primary)]/50 text-left hover:text-white transition-colors"
                          >
                            {isSectionExpanded ? <ChevronDown className="w-4 h-4 text-[var(--gold-primary)]" /> : <ChevronRight className="w-4 h-4 text-[var(--gold-primary)]" />}
                            <span className="text-white font-semibold">{sectionLabels[sectionKey] || formatSlotLabel(sectionKey)}</span>
                            <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--bg-primary)] text-[var(--text-muted)]">{sectionParts.length}</span>
                          </button>
                          {isSectionExpanded && (
                            <div className="border-t border-[var(--border)] p-3 space-y-2">
                              {presentSlots.map((slot) => renderSlot(guitarType, sectionKey, slot, sectionParts.filter((part) => getPartSlot(part) === slot)))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {(() => {
                      const unmappedParts = parts.filter((part) => getPartType(part) === guitarType && !mappedSlots.has(getPartSlot(part)))
                      if (unmappedParts.length === 0) return null
                      const sectionKey = 'unmapped'
                      const sectionId = `${guitarType}-section-${sectionKey}`
                      const isSectionExpanded = expandedPartCategories.has(sectionId)
                      const presentSlots = Array.from(new Set(unmappedParts.map((part) => getPartSlot(part) || 'unassigned')))
                      return (
                        <div className="border border-amber-500/30 rounded-xl overflow-hidden">
                          <button
                            type="button"
                            onClick={() => onTogglePartCategory(sectionId)}
                            className="flex w-full items-center gap-2 px-4 py-3 bg-amber-500/10 text-left hover:text-white transition-colors"
                          >
                            {isSectionExpanded ? <ChevronDown className="w-4 h-4 text-amber-400" /> : <ChevronRight className="w-4 h-4 text-amber-400" />}
                            <span className="text-white font-semibold">Needs Mapping</span>
                            <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--bg-primary)] text-[var(--text-muted)]">{unmappedParts.length}</span>
                          </button>
                          {isSectionExpanded && (
                            <div className="border-t border-amber-500/30 p-3 space-y-2">
                              {presentSlots.map((slot) => renderSlot(guitarType, sectionKey, slot, unmappedParts.filter((part) => (getPartSlot(part) || 'unassigned') === slot)))}
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}

export function GuitarPartTableView({ parts, onEdit, onDelete, density, sortConfig, onSort }) {
  const densityClass = density === 'compact' ? 'text-xs py-2' : 'text-sm py-3'
  const [selectedParts, setSelectedParts] = useState(new Set())

  const handleSort = (column) => {
    if (onSort) {
      onSort(column)
    }
  }

  const toggleSelectAll = () => {
    if (selectedParts.size === parts.length) {
      setSelectedParts(new Set())
    } else {
      setSelectedParts(new Set(parts.map((p) => p.part_id)))
    }
  }

  const toggleSelect = (partId) => {
    const next = new Set(selectedParts)
    if (next.has(partId)) {
      next.delete(partId)
    } else {
      next.add(partId)
    }
    setSelectedParts(next)
  }

  return (
    <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-primary)]/50">
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedParts.size === parts.length && parts.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-[var(--border)]"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold cursor-pointer hover:text-white" onClick={() => handleSort('name')}>
                Part Name {sortConfig?.sortBy === 'name' && (sortConfig.sortDir === 'asc' ? <ArrowUp className="w-3 h-3 inline" /> : <ArrowDown className="w-3 h-3 inline" />)}
              </th>
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold cursor-pointer hover:text-white" onClick={() => handleSort('guitar_type')}>
                Guitar Type {sortConfig?.sortBy === 'guitar_type' && (sortConfig.sortDir === 'asc' ? <ArrowUp className="w-3 h-3 inline" /> : <ArrowDown className="w-3 h-3 inline" />)}
              </th>
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold cursor-pointer hover:text-white" onClick={() => handleSort('part_category')}>
                Category {sortConfig?.sortBy === 'part_category' && (sortConfig.sortDir === 'asc' ? <ArrowUp className="w-3 h-3 inline" /> : <ArrowDown className="w-3 h-3 inline" />)}
              </th>
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold cursor-pointer hover:text-white" onClick={() => handleSort('price')}>
                Price {sortConfig?.sortBy === 'price' && (sortConfig.sortDir === 'asc' ? <ArrowUp className="w-3 h-3 inline" /> : <ArrowDown className="w-3 h-3 inline" />)}
              </th>
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Stock</th>
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Status</th>
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {parts.map((part) => (
              <tr key={part.part_id} className="border-b border-[var(--border)] hover:bg-[var(--bg-primary)]/50 transition-colors">
                <td className="px-4">
                  <input
                    type="checkbox"
                    checked={selectedParts.has(part.part_id)}
                    onChange={() => toggleSelect(part.part_id)}
                    className="rounded border-[var(--border)]"
                  />
                </td>
                <td className={`px-4 ${densityClass}`}>
                  <div className="flex items-center gap-3">
                    {part.image_url ? (
                      <img src={part.image_url} alt={part.name} className="w-8 h-8 rounded object-contain border border-[var(--border)]" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-[var(--surface-dark)] flex items-center justify-center border border-[var(--border)]">
                        <Guitar className="w-4 h-4 text-[var(--text-muted)]" />
                      </div>
                    )}
                    <span className="text-white font-medium truncate max-w-[200px]">{part.name}</span>
                  </div>
                </td>
                <td className={`px-4 ${densityClass}`}>
                  <span className="px-2 py-1 rounded-full text-xs bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] border border-[var(--gold-primary)]/30 capitalize">
                    {GUITAR_TYPE_LABELS[part.guitar_type] || part.guitar_type}
                  </span>
                </td>
                <td className={`px-4 ${densityClass} text-[var(--text-muted)] capitalize`}>
                  {PART_CATEGORY_LABELS[part.part_category] || part.part_category || '—'}
                </td>
                <td className={`px-4 ${densityClass} text-[var(--gold-primary)] font-semibold`}>
                  {formatCurrency(part.price)}
                </td>
                <td className={`px-4 ${densityClass}`}>
                  <span className={(part.quantity ?? 0) > 0 ? 'text-green-400' : 'text-red-400'}>
                    {part.quantity ?? 0}
                  </span>
                </td>
                <td className={`px-4 ${densityClass}`}>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${part.is_active ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'}`}>
                    {part.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className={`px-4 ${densityClass}`}>
                  <div className="flex gap-2">
                    <button onClick={() => onEdit(part)} className="p-2 hover:bg-[var(--gold-primary)]/10 rounded-lg transition-colors" title="Edit">
                      <Edit className="w-4 h-4 text-[var(--text-muted)]" />
                    </button>
                    <button onClick={() => onDelete(part.part_id, part.name)} className="p-2 hover:bg-red-500/10 rounded-lg transition-colors" title="Delete">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {parts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <Layers className="w-12 h-12 text-[var(--text-muted)] mb-4" />
          <p className="text-[var(--text-muted)]">No parts found</p>
        </div>
      )}
    </div>
  )
}
