import { motion } from 'motion/react'
import { Search, Filter, Package, MoreHorizontal, Guitar, Plus } from 'lucide-react'
import { PaginationBar } from '../components/shared/PaginationBar'
import { formatCurrency } from '../../../utils/formatCurrency'
import { getStockStatusInfo } from '../../../utils/stockUtils'

export function InventoryTab({
  inventoryIsProducts,
  inventorySubTab,
  setInventorySubTab,
  inventoryCurrentFilter,
  inventoryPartCategoryOptions,
  inventoryCurrentPageRows,
  inventoryGroupedPartPageRows,
  inventoryCurrentRows,
  inventoryTotalPages,
  inventoryPage,
  setInventoryPage,
  inventoryPageSize,
  setInventoryPageSize,
  setProductsInventoryFilter,
  setPartsInventoryFilter,
  resolveInventoryImage,
  openModal,
  isSuperAdmin,
  canAddProduct,
  showAddProduct,
  hideAddProduct = false,
  categories,
}) {
  const allowAddProduct = !hideAddProduct && (showAddProduct !== undefined ? showAddProduct : (canAddProduct !== undefined ? canAddProduct : Boolean(isSuperAdmin)))

  return (
    <motion.div key="inventory" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Inventory</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Manage your product inventory and listings.</p>
          </div>
          {allowAddProduct && inventoryIsProducts && (
            <button
              onClick={() => openModal('product')}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] px-4 py-2 text-sm font-semibold text-black"
            >
              <Plus className="h-4 w-4" />
              Add New Product
            </button>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {[{ id: 'products', label: 'Products', icon: Package }, { id: 'guitar-parts', label: 'Guitar Parts', icon: Guitar }].map((tab) => {
            const isActive = inventorySubTab === tab.id
            const TabIcon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setInventorySubTab(tab.id)
                  setInventoryPage(1)
                }}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-[var(--gold-primary)] text-black'
                    : 'border border-[var(--border)] text-[var(--text-muted)] hover:text-white'
                }`}
              >
                <TabIcon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className={`mt-5 grid gap-3 ${inventoryIsProducts ? 'lg:grid-cols-[1.2fr_auto_auto_auto]' : 'xl:grid-cols-[1.2fr_auto_auto_auto]'}`}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={inventoryCurrentFilter.search || ''}
              onChange={(e) => {
                if (inventoryIsProducts) {
                  setProductsInventoryFilter((prev) => ({ ...prev, search: e.target.value }))
                } else {
                  setPartsInventoryFilter((prev) => ({ ...prev, search: e.target.value }))
                }
                setInventoryPage(1)
              }}
              placeholder={`Search ${inventoryIsProducts ? 'products' : 'parts'}...`}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] py-2.5 pl-9 pr-3 text-sm text-white"
            />
          </div>

          <div className="relative">
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <select
              value={inventoryCurrentFilter.status}
              onChange={(e) => {
                if (inventoryIsProducts) {
                  setProductsInventoryFilter((prev) => ({ ...prev, status: e.target.value }))
                } else {
                  setPartsInventoryFilter((prev) => ({ ...prev, status: e.target.value }))
                }
                setInventoryPage(1)
              }}
              className="appearance-none rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] py-2.5 pl-9 pr-8 text-sm text-white"
            >
              <option value="all">All Status</option>
              <option value="attention">Needs Attention</option>
              <option value="out_of_stock">Out of Stock</option>
              <option value="low_stock">Low Stock</option>
              <option value="healthy">Healthy</option>
              <option value="critical">Critical</option>
              <option value="warning">Low Stock (Warning)</option>
            </select>
          </div>

          {(inventoryIsProducts ? categories : inventoryPartCategoryOptions).length > 0 && (
            <select
              value={inventoryIsProducts ? (inventoryCurrentFilter.category || '') : (inventoryCurrentFilter.category || 'all')}
              onChange={(e) => {
                if (inventoryIsProducts) {
                  setProductsInventoryFilter((prev) => ({ ...prev, category: e.target.value }))
                } else {
                  setPartsInventoryFilter((prev) => ({ ...prev, category: e.target.value }))
                }
                setInventoryPage(1)
              }}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-white"
            >
              {inventoryIsProducts ? (
                <option value="">All Categories</option>
              ) : (
                <option value="all">All Categories</option>
              )}
              {inventoryIsProducts
                ? (categories || []).map((category) => (
                    <option key={category.category_id} value={category.category_id}>
                      {category.name}
                    </option>
                  ))
                : inventoryPartCategoryOptions.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
            </select>
          )}

          <select
            value={inventoryCurrentFilter.sort}
            onChange={(e) => {
              if (inventoryIsProducts) {
                setProductsInventoryFilter((prev) => ({ ...prev, sort: e.target.value }))
              } else {
                setPartsInventoryFilter((prev) => ({ ...prev, sort: e.target.value }))
              }
            }}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-white"
          >
            {inventoryIsProducts ? (
              <>
                <option value="name_asc">Name A-Z</option>
                <option value="name_desc">Name Z-A</option>
                <option value="category_asc">Category A-Z</option>
                <option value="category_desc">Category Z-A</option>
                <option value="date_modified_asc">Date Modified Oldest-Newest</option>
                <option value="date_modified_desc">Date Modified Newest-Oldest</option>
                <option value="sku_asc">SKU A-Z</option>
                <option value="sku_desc">SKU Z-A</option>
                <option value="stock_asc">Stock Low-High</option>
                <option value="stock_desc">Stock High-Low</option>
              </>
            ) : (
              <>
                <option value="name_asc">Name A-Z</option>
                <option value="name_desc">Name Z-A</option>
                <option value="sku_asc">SKU A-Z</option>
                <option value="sku_desc">SKU Z-A</option>
                <option value="stock_asc">Stock Low-High</option>
                <option value="stock_desc">Stock High-Low</option>
              </>
            )}
          </select>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-primary)] text-[var(--text-muted)] uppercase tracking-wider font-bold border-b border-[var(--border)]">
                <tr>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4 text-right">Price</th>
                  <th className="py-3 px-4 text-right">Stock</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]/50">
                {inventoryCurrentPageRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-[var(--text-muted)]">
                      No inventory items found.
                    </td>
                  </tr>
                ) : (
                  (inventoryIsProducts ? inventoryCurrentPageRows.map((item) => ({ type: 'item', item })) : inventoryGroupedPartPageRows).map((row, index) => {
                    if (row.type === 'group') {
                      return (
                        <tr key={`group-${row.category}-${index}`} className="bg-[var(--gold-primary)]/8">
                          <td colSpan={7} className="px-4 py-2.5">
                            <span className="inline-flex rounded-full border border-[var(--gold-primary)]/35 bg-[var(--gold-primary)]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gold-primary)]">
                              {row.category}
                            </span>
                          </td>
                        </tr>
                      )
                    }

                    const item = row.item
                    const stock = Number(item.stock ?? 0)
                    const threshold = Number(item.low_stock_threshold ?? 10)
                    const maxStock = Number(item.max_stock ?? 0)
                    const isProduct = inventoryIsProducts
                    const statusInfo = getStockStatusInfo(stock, threshold, isProduct ? maxStock : 0)
                    const statusLabel = statusInfo.label
                    const statusClass = statusInfo.status === 'out_of_stock'
                      ? 'bg-red-500/15 text-red-400 border-red-500/25'
                      : statusInfo.status === 'low_stock'
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/25'
                      : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
                    const rowId = item.product_id || item.part_id || item.id

                    return (
                      <tr key={rowId} className="hover:bg-[var(--bg-primary)]/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-primary)]">
                              {resolveInventoryImage(item) ? (
                                <img src={resolveInventoryImage(item)} alt={item.name} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                  <Package className="h-4 w-4 text-[var(--text-muted)]" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-[var(--text-primary)]">{item.name}</p>
                              <p className="truncate text-[var(--text-muted)]">{inventoryIsProducts ? 'Product' : 'Guitar Part'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-[var(--text-muted)] font-medium">
                          {inventoryIsProducts ? (item.category_name || 'Uncategorized') : item.inventory_category}
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-[var(--text-muted)]">{item.sku || '—'}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[var(--gold-primary)]">{formatCurrency(Number(item.price || 0))}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[var(--text-primary)]">{stock}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => {
                              if (inventoryIsProducts) {
                                openModal('inventory', { product_id: item.product_id, name: item.name })
                              } else {
                                openModal('part_inventory', {
                                  ...item,
                                  current_stock: Number(item.stock ?? item.quantity ?? 0),
                                })
                              }
                            }}
                            className="rounded-lg border border-[var(--border)] p-2 text-[var(--text-muted)] hover:text-white"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <PaginationBar
            attached
            page={inventoryPage}
            totalPages={inventoryTotalPages}
            total={inventoryCurrentRows.length}
            pageSize={inventoryPageSize}
            onPageChange={setInventoryPage}
            onPageSizeChange={(nextSize) => {
              setInventoryPageSize(nextSize)
              setInventoryPage(1)
            }}
          />
        </div>
      </div>
    </motion.div>
  )
}
