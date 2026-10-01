import { motion } from 'motion/react'
import { CategoryTreeView } from '../components/categories/CategoryTreeView'

export function ProductCategoriesTab({
  categories,
  deleteCategory,
  openModal,
  isSuperAdmin,
}) {
  return (
    <motion.div key="product-categories" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <CategoryTreeView
        categories={categories}
        onEditCategory={(cat) => openModal('category', cat)}
        onDeleteCategory={deleteCategory}
        isSuperAdmin={isSuperAdmin}
        onAddCategory={() => openModal('category')}
      />
    </motion.div>
  )
}
