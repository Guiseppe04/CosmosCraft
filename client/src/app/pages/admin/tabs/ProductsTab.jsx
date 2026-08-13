import { motion } from 'motion/react'
import { Search, RefreshCw, Grid3X3, List, Plus, Package, Edit, Trash2 } from 'lucide-react'
import { SectionLoader } from '../components/shared/SectionLoader'
import { EmptyState } from '../components/shared/EmptyState'
import { AdminTable } from '../components/shared/AdminTable'
import { PaginationBar } from '../components/shared/PaginationBar'
import { PAGE_SIZE_OPTIONS } from '../constants/adminOptions'
import { formatCurrency } from '../../../utils/formatCurrency'

export function ProductsTab({
  productViewMode,
  setProductViewMode,
  productActiveTab,
  setProductActiveTab,
  productQuery,
  setProductQuery,
  productsLoading,
  visibleProducts,
  productsPagination,
  categoryTree,
  openModal,
  handleRefresh,
  isLoading,
  isSuperAdmin,
  searchQuery,
  setSearchQuery,
  inputCls,
  deleteProduct,
}) {
  return (
    <motion.div key="products" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-white text-xl font-semibold">Products</h2>
          <p className="text-[var(--text-muted)] text-sm">Manage catalog items, visibility, and pricing.</p>
        </div>
        <div className="flex flex-wrap items-center justify-start lg:justify-end gap-2">
          <button onClick={handleRefresh} className="p-2 border border-[var(--border)] rounded-lg hover:border-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/10 transition-all" title="Refresh">
            <RefreshCw className={`w-4 h-4 text-[var(--text-muted)] ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
            <button
              onClick={() => setProductViewMode('grid')}
              className={`p-2 ${productViewMode === 'grid' ? 'bg-[var(--gold-primary)] text-black' : 'bg-[var(--surface-dark)] text-[var(--text-muted)] hover:text-white'} transition-colors`}
              title="Grid View"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setProductViewMode('table')}
              className={`p-2 ${productViewMode === 'table' ? 'bg-[var(--gold-primary)] text-black' : 'bg-[var(--surface-dark)] text-[var(--text-muted)] hover:text-white'} transition-colors`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          {isSuperAdmin && (
            <button onClick={() => openModal('product')} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black rounded-xl font-semibold text-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all">
              <Plus className="w-4 h-4" /> Add Product
            </button>
          )}
        </div>
      </div>

      <div className="flex border-b border-[var(--border)] mb-6 gap-4 pb-0">
        {[{ id: 'all', label: 'All Products' }, { id: 'active', label: 'Active' }, { id: 'inactive', label: 'Inactive' }].map((tab) => {
          const tabIsActive = productActiveTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => {
                setProductActiveTab(tab.id)
                const isActiveValue = tab.id === 'all' ? '' : tab.id === 'active' ? 'true' : 'false'
                setProductQuery((prev) => ({ ...prev, page: 1, is_active: isActiveValue }))
              }}
              className={`px-4 py-3 text-sm font-semibold uppercase tracking-wider transition-all relative ${tabIsActive ? 'text-[var(--gold-primary)]' : 'text-[var(--text-muted)] hover:text-white'}`}
            >
              {tab.label}
              {tabIsActive && <motion.div layoutId="product-tab-indicator" className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--gold-primary)]" />}
            </button>
          )
        })}
      </div>

      <div className="mb-6 p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)]/70 backdrop-blur-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[minmax(0,2.6fr)_minmax(0,1.1fr)_minmax(0,0.95fr)_minmax(0,0.9fr)_minmax(0,0.85fr)_auto] gap-3 items-center">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              aria-label="Search products"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`${inputCls} pl-11`}
            />
          </div>
          <input
            type="text"
            aria-label="Filter products by brand"
            placeholder="Filter by brand..."
            value={productQuery.brand}
            onChange={(e) => setProductQuery((prev) => ({ ...prev, page: 1, brand: e.target.value }))}
            className={inputCls}
          />
          <select
            aria-label="Filter products by category"
            value={productQuery.category_id}
            onChange={(e) => setProductQuery((prev) => ({ ...prev, page: 1, category_id: e.target.value }))}
            className={inputCls}
          >
            <option value="">All categories</option>
            {categoryTree.map((parent) => (
              <optgroup key={parent.category_id} label={parent.name}>
                <option value={parent.category_id}>{parent.name} (All)</option>
                {parent.children?.map((child) => (
                  <option key={child.category_id} value={child.category_id}>{`→ ${child.name}`}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <select
            aria-label="Sort products"
            value={`${productQuery.sortBy}:${productQuery.sortDir}`}
            onChange={(e) => {
              const [sortBy, sortDir] = e.target.value.split(':')
              setProductQuery((prev) => ({ ...prev, page: 1, sortBy, sortDir }))
            }}
            className={inputCls}
          >
            <option value="created_at:desc">Newest first</option>
            <option value="created_at:asc">Oldest first</option>
            <option value="name:asc">Name A-Z</option>
            <option value="name:desc">Name Z-A</option>
            <option value="price:asc">Price: Low to High</option>
            <option value="price:desc">Price: High to Low</option>
          </select>
          <select
            aria-label="Products page size"
            value={productQuery.pageSize}
            onChange={(e) => setProductQuery((prev) => ({ ...prev, page: 1, pageSize: Number(e.target.value) }))}
            className={inputCls}
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>{`${n} per page`}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setProductActiveTab('active')
              setProductQuery({ page: 1, pageSize: productQuery.pageSize, sortBy: 'created_at', sortDir: 'desc', category_id: '', is_active: 'true', min_price: '', max_price: '' })
            }}
            className="h-[50px] px-4 rounded-2xl border border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-white hover:border-[var(--gold-primary)] transition-colors whitespace-nowrap justify-self-start xl:justify-self-end"
          >
            Clear product filters
          </button>
        </div>
      </div>

      {productsLoading ? (
        <SectionLoader label="Loading products..." />
      ) : visibleProducts.length === 0 ? (
        <EmptyState icon={Package} label={searchQuery ? 'No products match your search/filters' : 'No products found'} action={() => openModal('product')} actionLabel="Add First Product" />
      ) : productViewMode === 'table' ? (
        <AdminTable
          columns={['Image', 'Product', 'SKU', 'Brand', 'Price', 'Cost', 'Stock Status', 'Actions']}
          rows={visibleProducts}
          renderRow={(p) => (
            <>
              <td className="py-4 px-6">
                {p.primary_image ? (
                  <img src={p.primary_image} alt={p.name} className="w-12 h-12 object-cover rounded-lg border border-[var(--border)]" loading="lazy" />
                ) : (
                  <div className="w-12 h-12 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg flex items-center justify-center">
                    <Package className="w-5 h-5 text-[var(--text-muted)]" />
                  </div>
                )}
              </td>
              <td className="py-4 px-6">
                <p className="text-white font-semibold">{p.name}</p>
              </td>
              <td className="py-4 px-6 text-[var(--text-muted)] font-mono text-sm">{p.sku || '—'}</td>
              <td className="py-4 px-6 text-[var(--text-muted)] font-semibold">{p.brand || '—'}</td>
              <td className="py-4 px-6 text-[var(--gold-primary)] font-bold">{formatCurrency(p.price)}</td>
              <td className="py-4 px-6 text-[var(--text-muted)] text-sm">{p.cost_price ? formatCurrency(p.cost_price) : '—'}</td>
              <td className="py-4 px-6">
                <div className="flex items-center gap-2" title={`Stock: ${p.stock}`}>
                  <span className={`w-2 h-2 rounded-full ${p.stock > (p.low_stock_threshold || 10) ? 'bg-green-400' : p.stock > 0 ? 'bg-amber-400' : 'bg-red-400'}`} />
                  <span className={`text-sm font-semibold ${p.stock > (p.low_stock_threshold || 10) ? 'text-green-400' : p.stock > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                    {p.stock > (p.low_stock_threshold || 10) ? 'In Stock' : p.stock > 0 ? 'Low Stock' : 'Out of Stock'}
                  </span>
                </div>
              </td>
              <td className="py-4 px-6">
                <div className="flex items-center gap-2">
                  {isSuperAdmin && (
                    <>
                      <button onClick={() => openModal('product', p)} className="p-2 hover:bg-[var(--gold-primary)]/10 rounded-lg transition-colors" title="Edit">
                        <Edit className="w-4 h-4 text-[var(--text-muted)]" />
                      </button>
                      <button onClick={() => deleteProduct(p.product_id, p.name)} className="p-2 hover:bg-red-500/10 rounded-lg transition-colors" title="Deactivate">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </>
                  )}
                </div>
              </td>
            </>
          )}
          empty={<EmptyState icon={Package} label="No products found" action={() => openModal('product')} actionLabel="Add Product" />}
        />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleProducts.map((p) => {
            const profitMargin = p.price && p.cost_price && p.cost_price > 0 && p.cost_price < p.price ? Math.round(((p.price - p.cost_price) / p.price) * 100) : null
            const hasNoMargin = p.price && p.cost_price && p.cost_price >= p.price
            return (
              <motion.div key={p.product_id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl overflow-hidden hover:border-[var(--gold-primary)]/50 hover:-translate-y-1 transition-all group ${!p.is_active ? 'opacity-60 filter grayscale-[0.4]' : ''}`}>
                <div className="relative h-44 overflow-hidden bg-[var(--bg-primary)]">
                  {p.primary_image ? (
                    <img src={p.primary_image} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-16 h-16 text-[var(--text-muted)]/30" />
                    </div>
                  )}
                  <div className="absolute top-3 right-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${p.is_active ? 'bg-green-500/80 text-white border-green-400' : 'bg-gray-500/80 text-white border-gray-400'}`}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div className="p-5">
                   <div className="flex items-start justify-between mb-3">
                     <div className="min-w-0 flex-1">
                       <h3 className="text-white font-semibold text-lg truncate">{p.name}</h3>
                       {p.sku && <p className="text-[var(--text-muted)] text-xs font-mono mt-1">SKU: <span className="text-white">{p.sku}</span></p>}
                       {p.brand && <p className="text-[var(--text-muted)] text-sm mt-1">Brand: <span className="text-white font-medium">{p.brand}</span></p>}
                     </div>
                   </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--border)]">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold text-xl">{formatCurrency(p.price)}</span>
                        {profitMargin !== null && !hasNoMargin && (
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded-full">+{profitMargin}% margin</span>
                        )}
                        {hasNoMargin && (
                          <span className="px-2 py-0.5 bg-red-500/10 text-red-400 text-xs font-semibold rounded-full">No margin</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${p.stock > (p.low_stock_threshold || 10) ? 'bg-green-400' : p.stock > 0 ? 'bg-amber-400' : 'bg-red-400'}`} />
                        <span className={`text-xs font-semibold ${p.stock > (p.low_stock_threshold || 10) ? 'text-green-400' : p.stock > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                          {p.stock > (p.low_stock_threshold || 10) ? 'In Stock' : p.stock > 0 ? 'Low Stock' : 'Out of Stock'}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {isSuperAdmin && (
                        <>
                          <button onClick={() => openModal('product', p)} className="p-2 bg-[var(--bg-primary)] hover:bg-[var(--gold-primary)]/20 rounded-lg transition-colors" title="Edit">
                            <Edit className="w-4 h-4 text-[var(--text-muted)]" />
                          </button>
                          <button onClick={() => deleteProduct(p.product_id, p.name)} className="p-2 bg-[var(--bg-primary)] hover:bg-red-500/20 rounded-lg transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      <PaginationBar pagination={productsPagination} onPageChange={(nextPage) => setProductQuery((prev) => ({ ...prev, page: nextPage }))} />
    </motion.div>
  )
}
