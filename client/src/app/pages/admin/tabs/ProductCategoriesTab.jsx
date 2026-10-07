import { motion } from 'motion/react'
import { CategoryTreeView } from '../components/categories/CategoryTreeView'

export function ProductCategoriesTab({
  categories,
  searchQuery = '',
  deleteCategory,
  openModal,
  isSuperAdmin,
}) {
  const query = searchQuery.trim().toLowerCase()
  const filteredCategories = categories.filter((category) =>
    [category.name, category.description].some((value) =>
      String(value || '').toLowerCase().includes(query)
    )
  )

  return (
    <motion.div key="product-categories" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <CategoryTreeView
        categories={filteredCategories}
        isSearching={Boolean(query)}
        onEditCategory={(cat) => openModal('category', cat)}
        onDeleteCategory={deleteCategory}
        isSuperAdmin={isSuperAdmin}
        onAddCategory={() => openModal('category')}
      />
    </motion.div>
  )
}
