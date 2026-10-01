import { Edit, Trash2, Tag } from 'lucide-react'

function CategoryRow({ category, onEdit, onDelete }) {
  return (
    <tr className="border-b border-[var(--border)] hover:bg-[var(--bg-primary)]/50 transition-colors">
      <td className="py-4 px-6">
        <span className="font-semibold text-white">{category.name}</span>
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
  )
}

export function CategoryTreeView({ categories, onEditCategory, onDeleteCategory, isSuperAdmin, onAddCategory }) {
  const categoryList = categories || []

  return (
    <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl overflow-hidden">
      {categoryList.length === 0 ? (
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
              <th className="text-left py-4 px-6 text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Category</th>
              <th className="text-left py-4 px-6 text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Status</th>
              <th className="text-left py-4 px-6 text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categoryList.map((category) => (
              <CategoryRow
                key={category.category_id}
                category={category}
                onEdit={isSuperAdmin ? onEditCategory : undefined}
                onDelete={isSuperAdmin ? onDeleteCategory : undefined}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
