# Plan: Inventory — Percentage-Based Product Status

## Goal
In the **Inventory** feature, show each product's **Status** as a **percentage** of a configured `max_stock` level instead of the categorical labels (`Out of Stock / Critical / Low Stock / Healthy`).

The percentage baseline is a new `inventory.max_stock` column. When `max_stock` is not set (existing rows), the app falls back to the current implicit baseline (`low_stock_threshold * 2`), so behavior is unchanged until a max is configured.

## Decisions (recommended defaults)
1. **New column:** `inventory.max_stock` — `INT NULL CHECK (max_stock IS NULL OR max_stock > 0)`, default `NULL`.
   - `NULL` = "not configured" → app uses fallback baseline. No backfill required.
2. **Percentage baseline & tiers (percentage-based):**
   - `maxStock = max_stock > 0 ? max_stock : low_stock_threshold * 2`
   - `pct = clamp((stock / maxStock) * 100, 0, 100)`
   - Tier map: `stock === 0 → Out of Stock (0%)`; `0 < pct <= 50 → Critical`; `50 < pct < 100 → Low Stock`; `pct >= 100 → Healthy`.
   - Note: with the fallback (`maxStock = threshold*2`), these tiers are **identical** to today's labels — so existing unconfigured rows render the same status, just expressed as a percentage.
3. **Status display:** Status column shows `"{n}%"` (rounded) instead of the label; keep the color tier so visual signal is preserved.
4. **Alert logic unchanged:** `low_stock_threshold` still drives low-stock alerts (`inventoryService.deductStock`, `low_stock_alerts`). Only the *status display/tiers* move to percentage.

## Out of scope (optional / future)
- Staff dashboard inventory status (`StaffDashboard.jsx:478-481, 527-531`) — separate feature surface; apply same helper if desired.
- `ProductsTab.jsx` stock badges (`ProductsTab.jsx:189-191, 255-257`) — product list, not Inventory.
- `StockVisualizer.jsx` — uses `threshold*2` currently; can swap to `max_stock` fallback for parity (optional, listed as secondary task).
- `inventoryService.getInventorySummary` — no `max_stock` needed for the summary metrics.

## Affected boundaries / data flow
- DB → `inventoryService.getProductsWithStock` (SELECT adds `i.max_stock`) → `inventoryController.getProductsWithStock` (returns rows as-is) → `adminApi.getInventoryProducts` → `useInventoryAdmin.fetchInventory` → `visibleInventory` prop on `InventoryTab`.
- `getProductStock` (single product) also needs `max_stock` in SELECT.
- `productService.createProduct` / `updateProduct` need to accept & persist `max_stock`.
- Product creation/edit form (`ProductModal.jsx` inventory step) needs a `max_stock` input.

## Migration note
The repo has an inconsistency: numbered SQL files (`14_...sql`, `16_...sql`, `17_...sql`) sit at `server/migrations/` root, but their runners (`run-migration16.js`) read from `__dirname/migrations/...`. The migration for this change should follow the **numbered SQL file convention at `server/migrations/` root** and a matching runner. Implementer: verify the runner's SQL path matches the repo convention before running.

## Task list (ordered)

### Server
1. **Schema migration** — `server/migrations/18_add_inventory_max_stock.sql` (idempotent via `information_schema` check):
   - `ALTER TABLE inventory ADD COLUMN IF NOT EXISTS max_stock INT NULL CHECK (max_stock IS NULL OR max_stock > 0);`
2. **Migration runner** — `server/migrations/run-migration18.js` (template: `run-migration16.js`), but point SQL path at `server/migrations/18_add_inventory_max_stock.sql` (root). Verify path.
3. **`inventoryService.getProductsWithStock`** (`server/services/inventoryService.js:58-71`) — add `i.max_stock` to SELECT. Returns rows directly → API auto-exposes it.
4. **`inventoryService.getProductStock`** (`server/services/inventoryService.js:22-31`) — add `i.max_stock` to SELECT.
5. **`productService.createProduct`** (`server/services/productService.js:171-209`) — accept `max_stock`, include in INSERT into `inventory`, and in the returned object.
6. **`productService.updateProduct`** (`server/services/productService.js:211-278`) — accept `max_stock`, UPDATE/COALESCE it on the inventory row.
7. **Validation** (`server/utils/inventoryValidation.js` + `server/utils/validation.js`) — add optional `max_stock` integer schema (min 1 when provided) on product create/update payloads.

### Client
8. **`InventoryTab.jsx`** (status column, `client/.../tabs/InventoryTab.jsx:218-228`):
   - Compute `maxStock = item.max_stock > 0 ? item.max_stock : threshold * 2`.
   - Compute `pct`; set `statusLabel` to `${Math.round(pct)}%`.
   - Keep `statusClass` colors mapped to the percentage tier.
   - (Table headers/filters unaffected; the status filter already uses tier strings.)
9. **`AdminPage.jsx`** — make the two status filter blocks (`filteredInventory` filter `:425-434`, `filteredProductsInventory` `:464-471`) and `inventoryHealthData` (`:561-576`) consistent using the same percentage-based helper + fallback, so filters and the Status column agree. Add a small `getStockPct`/tier helper near the inventory memos to avoid duplication.
10. **`StockVisualizer.jsx`** (`:13-15`) — use `max_stock` (fallback `threshold*2`) as `maxStock` so its healthy/warning/critical bands align with the percentage scheme. (Secondary)
11. **`ProductModal.jsx`** (inventory step, `:643-668`) — add a "Max Stock Level" number input next to "Low Stock Alert Threshold"; wire to `form.max_stock` and clear/empty → NULL on submit.

### Optional (do not block)
12. `StaffDashboard.jsx` — apply same percentage helper to its status filters if the same `getProductsWithStock` response (which now includes `max_stock`) is reused. Requires confirming Staff uses the staff API response shape.

## Validation
- Lint/typecheck: `npm run lint` (and typecheck if configured) — per repo `AGENTS.md`.
- Manual: set a product's `max_stock` in ProductModal; confirm the Inventory Status column shows `0%…100%` and the tier color matches; confirm a NULL `max_stock` product behaves exactly as before; confirm status filter and StockVisualizer still align.

## Rollback
- Dropping the column: `ALTER TABLE inventory DROP COLUMN IF EXISTS max_stock;` (migration 19 if needed). App fallback (`threshold*2`) keeps status working with no column.
