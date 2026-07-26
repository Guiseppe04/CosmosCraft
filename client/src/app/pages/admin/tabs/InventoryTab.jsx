import { motion } from 'motion/react'
import { Search, Filter, ChevronLeft, ChevronRight, Package, MoreHorizontal, Guitar, Plus } from 'lucide-react'
import { formatCurrency } from '../../../utils/formatCurrency'

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
  setProductsInventoryFilter,
  setPartsInventoryFilter,
  resolveInventoryImage,
  openModal,
  isSuperAdmin,
}) {
  return (
    <motion.div key="inventory" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Inventory</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Manage your product inventory and listings.</p>
          </div>
          {isSuperAdmin && inventoryIsProducts && (
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

        <div className={`mt-5 grid gap-3 ${inventoryIsProducts ? 'lg:grid-cols-[1.2fr_auto_auto]' : 'xl:grid-cols-[1.2fr_auto_auto_auto]'}`}>
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
              <option value="healthy">Healthy</option>
              <option value="warning">Low Stock</option>
              <option value="critical">Critical</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>
          </div>

          {!inventoryIsProducts && (
            <select
              value={inventoryCurrentFilter.category || 'all'}
              onChange={(e) => {
                setPartsInventoryFilter((prev) => ({ ...prev, category: e.target.value }))
                setInventoryPage(1)
              }}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-white"
            >
              <option value="all">All Categories</option>
              {inventoryPartCategoryOptions.map((category) => (
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
            <option value="name">Sorted by Name</option>
            <option value="sku">Sorted by SKU</option>
            <option value="stock_high">Stock High-Low</option>
            <option value="stock_low">Stock Low-High</option>
          </select>
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-[var(--border)]">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--bg-primary)]/70">
              <tr className="border-b border-[var(--border)]">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Product</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Category</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">SKU</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Price</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Stock</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Status</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Action</th>
              </tr>
            </thead>
            <tbody>
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
                      <tr key={`group-${row.category}-${index}`} className="border-b border-[var(--border)]/70 bg-[var(--gold-primary)]/8">
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
                  const isOutOfStock = stock <= 0
                  const isCritical = !isOutOfStock && stock <= threshold
                  const isLowStock = stock > threshold && stock <= threshold * 2
                  const statusLabel = isOutOfStock ? 'Out of Stock' : isCritical ? 'Critical' : isLowStock ? 'Low Stock' : 'Healthy'
                  const statusClass = isOutOfStock || isCritical
                    ? 'bg-red-500/15 text-red-400 border-red-500/25'
                    : isLowStock
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/25'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
                  const rowId = item.product_id || item.part_id || item.id

                  return (
                    <tr key={rowId} className="border-b border-[var(--border)]/70 last:border-b-0 hover:bg-white/5">
                      <td className="px-4 py-3">
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
                            <p className="truncate font-medium text-white">{item.name}</p>
                            <p className="truncate text-xs text-[var(--text-muted)]">{inventoryIsProducts ? 'Product' : 'Guitar Part'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">
                        {inventoryIsProducts ? (item.category_name || 'Uncategorized') : item.inventory_category}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">{item.sku || '—'}</td>
                      <td className="px-4 py-3 font-semibold text-white">{formatCurrency(Number(item.price || 0))}</td>
                      <td className="px-4 py-3 text-white">{stock}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
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

        <div className="mt-4 flex flex-col gap-3 border-t border-[var(--border)] pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[var(--text-muted)]">{inventoryPageSize} rows per page</p>
          {inventoryCurrentRows.length > 0 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setInventoryPage((p) => Math.max(1, p - 1))}
                disabled={inventoryPage === 1}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[var(--text-muted)] disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: inventoryTotalPages }, (_, i) => i + 1)
                .slice(Math.max(0, inventoryPage - 2), Math.min(inventoryTotalPages, inventoryPage + 1))
                .map((page) => (
                  <button
                    key={page}
                    onClick={() => setInventoryPage(page)}
                    className={`h-9 w-9 rounded-lg border text-sm ${page === inventoryPage ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)] text-black' : 'border-[var(--border)] text-[var(--text-muted)]'}`}
                  >
                    {page}
                  </button>
                ))}
              <button
                onClick={() => setInventoryPage((p) => Math.min(inventoryTotalPages, p + 1))}
                disabled={inventoryPage >= inventoryTotalPages}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[var(--text-muted)] disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
