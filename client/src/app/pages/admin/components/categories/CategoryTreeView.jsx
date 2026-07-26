import { Edit, Trash2, ChevronDown, ChevronRight, Tag } from 'lucide-react'

function CategoryTreeRow({ category, expandedIds, onToggle, onEdit, onDelete, categories, depth = 0 }) {
  const hasChildren = category.children && category.children.length > 0
  const isExpanded = expandedIds.has(category.category_id)
  const indent = depth * 24

  return (
    <>
      <tr className="border-b border-[var(--border)] hover:bg-[var(--bg-primary)]/50 transition-colors">
        <td className="py-4 px-6" style={{ paddingLeft: `${16 + indent}px` }}>
          <div className="flex items-center gap-2">
            {hasChildren ? (
              <button
                onClick={() => onToggle(category.category_id)}
                className="p-0.5 hover:bg-[var(--gold-primary)]/20 rounded transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-[var(--gold-primary)]" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[var(--gold-primary)]" />
                )}
              </button>
            ) : (
              <span className="w-4" />
            )}
            <span className="font-semibold text-white">{category.name}</span>
          </div>
        </td>
        <td className="py-4 px-6">
          {hasChildren ? (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] border border-[var(--gold-primary)]/30">
              Parent
            </span>
          ) : category.parent_id ? (
            (() => {
              const parentCat = categories?.find((c) => c.category_id === category.parent_id)
              return parentCat ? (
                <span className="text-[var(--text-muted)] text-sm">{parentCat.name}</span>
              ) : (
                <span className="text-[var(--text-muted)]/50">—</span>
              )
            })()
          ) : (
            <span className="text-[var(--text-muted)]/50">—</span>
          )}
        </td>
        <td className="py-4 px-6">
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${category.is_active ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'}`}>
            {category.is_active ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td className="py-4 px-6">
          <div className="flex gap-2">
            {onEdit && (
              <button onClick={() => onEdit(category)} className="p-1.5 hover:bg-[var(--gold-primary)]/10 rounded">
                <Edit className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            )}
            {onDelete && (
              <button onClick={() => onDelete(category.category_id, category.name)} className="p-1.5 hover:bg-red-500/10 rounded">
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
            )}
          </div>
        </td>
      </tr>
      {hasChildren && isExpanded && category.children.map((child) => (
        <CategoryTreeRow
          key={child.category_id}
          category={child}
          expandedIds={expandedIds}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
          categories={categories}
          depth={depth + 1}
        />
      ))}
    </>
  )
}

export function CategoryTreeView({ categoryTree, categories, expandedCategoryIds, onToggleExpand, onEditCategory, onDeleteCategory, isSuperAdmin, onAddCategory }) {
  return (
    <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl overflow-hidden">
      {categoryTree.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Tag className="w-12 h-12 text-[var(--text-muted)] mb-4" />
          <p className="text-[var(--text-muted)] mb-4">No categories yet</p>
          {isSuperAdmin && (
            <button onClick={onAddCategory} className="px-4 py-2 bg-[var(--gold-primary)] text-black rounded-xl font-semibold text-sm">
              Add Category
            </button>
          )}
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left py-4 px-6 text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Name</th>
              <th className="text-left py-4 px-6 text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Parent</th>
              <th className="text-left py-4 px-6 text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Type</th>
              <th className="text-left py-4 px-6 text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Status</th>
              <th className="text-left py-4 px-6 text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categoryTree.map((rootCat) => (
              <CategoryTreeRow
                key={rootCat.category_id}
                category={rootCat}
                expandedIds={expandedCategoryIds}
                onToggle={onToggleExpand}
                onEdit={isSuperAdmin ? onEditCategory : undefined}
                onDelete={isSuperAdmin ? onDeleteCategory : undefined}
                categories={categories}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
