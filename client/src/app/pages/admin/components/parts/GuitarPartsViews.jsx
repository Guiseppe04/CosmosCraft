import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, ChevronUp, Edit, Guitar, Layers, Plus, Trash2 } from 'lucide-react'
import { GUITAR_TYPE_LABELS, PART_CATEGORY_LABELS, PART_CATEGORIES_BY_GUITAR_TYPE } from '../../constants/adminOptions'
import { formatCurrency } from '../../../../utils/formatCurrency'

export function GuitarPartAccordion({ parts, expandedGuitarTypes, onToggleGuitarType, expandedPartCategories, onTogglePartCategory, onEdit, onDelete, onQuickAdd, density }) {
  const guitarTypes = ['electric', 'bass', 'general']
  const densityClass = density === 'compact' ? 'text-xs' : 'text-sm'

  const getPartsByGuitarTypeAndCategory = (guitarType, category) => {
    if (guitarType === 'general') {
      return parts.filter(
        (p) =>
          (!p.guitar_type || p.guitar_type === 'general' || p.guitar_type === '') &&
          (p.part_category || 'misc') === category
      )
    }

    return parts.filter(
      (p) =>
        p.guitar_type === guitarType &&
        (p.part_category || 'misc') === category
    )
  }

  return (
    <div className="space-y-3">
      {guitarTypes.map((guitarType) => {
        const isExpanded = expandedGuitarTypes.has(guitarType)
        const typeLabel = GUITAR_TYPE_LABELS[guitarType] || guitarType
        const baseCategories = PART_CATEGORIES_BY_GUITAR_TYPE[guitarType] || []
        const dataCategories = Array.from(
          new Set(
            parts
              .filter((p) =>
                guitarType === 'general'
                  ? (!p.guitar_type || p.guitar_type === 'general' || p.guitar_type === '')
                  : p.guitar_type === guitarType
              )
              .map((p) => p.part_category || 'misc')
          )
        )
        const categories = Array.from(new Set([...baseCategories, ...dataCategories]))

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
                    {categories.map((category) => {
                      const categoryParts = getPartsByGuitarTypeAndCategory(guitarType, category)
                      const isCategoryExpanded = expandedPartCategories.has(`${guitarType}-${category}`)
                      const categoryLabel = PART_CATEGORY_LABELS[category] || category

                      if (categoryParts.length === 0) return null

                      return (
                        <div key={category} className="border border-[var(--border)] rounded-xl overflow-hidden">
                          <div className="flex items-center gap-2 px-4 py-3 bg-[var(--bg-primary)]/50">
                            <button
                              type="button"
                              onClick={() => onTogglePartCategory(`${guitarType}-${category}`)}
                              className="flex-1 flex items-center gap-2 text-left hover:text-white transition-colors"
                            >
                              {isCategoryExpanded ? (
                                <ChevronDown className="w-4 h-4 text-[var(--gold-primary)]" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-[var(--gold-primary)]" />
                              )}
                              <span className="text-white font-medium">{categoryLabel}</span>
                              <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--bg-primary)] text-[var(--text-muted)]">
                                {categoryParts.length}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onQuickAdd(guitarType, category)}
                              className="p-1.5 hover:bg-[var(--gold-primary)]/20 rounded-lg transition-colors"
                              title="Quick add part"
                            >
                              <Plus className="w-4 h-4 text-[var(--gold-primary)]" />
                            </button>
                          </div>

                          <AnimatePresence>
                            {isCategoryExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="border-t border-[var(--border)]"
                              >
                                <div className={`p-3 space-y-2 ${density === 'compact' ? 'p-2' : 'p-3'}`}>
                                  {categoryParts.map((part) => (
                                    <div
                                      key={part.part_id}
                                      className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-primary)]/50 hover:bg-[var(--gold-primary)]/10 transition-colors group"
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
                                      <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded-full text-xs ${part.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                          {part.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                        <span className="text-[var(--text-muted)] text-xs">{part.quantity ?? 0} in stock</span>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button onClick={() => onEdit(part)} className="p-1.5 hover:bg-[var(--gold-primary)]/20 rounded" title="Edit">
                                            <Edit className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                                          </button>
                                          <button onClick={() => onDelete(part.part_id, part.name)} className="p-1.5 hover:bg-red-500/20 rounded" title="Delete">
                                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )
                    })}
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
