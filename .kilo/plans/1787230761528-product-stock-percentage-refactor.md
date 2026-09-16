# Product Stock Levels Refactor: Percentage-Based Low Stock Threshold

## Status: IMPLEMENTATION COMPLETE

> All 15 tasks completed. Backend syntax checks pass on all modified files. Frontend builds successfully (`npm run build` — 3529 modules transformed, 0 errors).

## Goal

Refactor the inventory status system so `low_stock_threshold` is a **percentage** (1–100) of `max_stock`, replacing the current absolute-units comparison. Update `ProductModal` UI, backend services, DB schema, and all frontend components that compute stock status.

### New Status Logic

```
lowStockLimit = max_stock * (low_stock_threshold / 100)
stock <= 0              → Out of Stock
stock <= lowStockLimit  → Low Stock
stock >  lowStockLimit  → In Stock
```

### Key Behaviors

- **Create**: `stock` is initialized to `max_stock` (full capacity).
- **Edit**: `stock` is never overwritten from the form — it's managed by transactions.
- **Builder parts** (guitar_builder_parts): Keep their existing absolute-threshold logic (threshold = 10 units) since they don't have `max_stock` or percentage thresholds. Parts are excluded from the percentage refactor.

---

## Decisions

1. **`low_stock_threshold` column type**: INT → NUMERIC(5,2) with CHECK (0.01–100), default 10 (= 10%). Existing data values (e.g. 10, 20, 50) now semantically mean percentages instead of absolute units — no data conversion needed since the numeric values map directly.
2. **`max_stock` column**: Already exists in DB via migration 18. Must be added to `schema.sql` inventory table definition (currently missing).
3. **Shared status helper**: Create a new utility function `getStockStatus(stock, lowStockThresholdPct, maxStock)` in a shared frontend location (e.g., `client/src/app/utils/stockUtils.js`) used by all frontend components. Parts path retains old logic.
4. **`reportService.js` bug fix**: The low-stock query at line 307 queries `FROM products` for `stock`/`low_stock_threshold` which don't exist there. Fix to JOIN `inventory` and use the new percentage formula.
5. **`ProductModal`**: Remove "Initial Stock Quantity" input (stock auto = max_stock on create). Rename "Low Stock Alert Threshold" → "Low Stock Threshold (%)" and "Max Stock Level" → "Maximum Stock". Add helper text.

---

## Task List

### 1. Database Schema & Migration

**File: `schema.sql`** (line 225–236, inventory table)
- Change `low_stock_threshold INT NOT NULL DEFAULT 10 CHECK (low_stock_threshold >= 0)` to `low_stock_threshold NUMERIC(5,2) NOT NULL DEFAULT 10 CHECK (low_stock_threshold >= 0 AND low_stock_threshold <= 100)`
- Add `max_stock INT NULL CHECK (max_stock IS NULL OR max_stock > 0)` column to the inventory table definition (matching migration 18)

**File: New migration `server/migrations/19_low_stock_threshold_percentage.sql`**
- Conditionally ALTER TABLE to change `low_stock_threshold` type from INT to NUMERIC(5,2) with updated CHECK constraint (1–100 range)
- Include `IF NOT EXISTS` / `DO $$` guard like migration 18

**File: `server/migrations/run-migration19.js`**
- Follow the `run-migration18.js` pattern (dotenv from `server/migrations/.env`, not `server/.env`)
- Execute migration 19 SQL

**Note:** Ensure `server/migrations/.env` exists (points to same DB as `server/.env`). If missing, create it or copy from `server/.env`.

### 2. Backend: Validation

**File: `server/utils/validation.js`**
- `createProductSchema` (line 476): Change `low_stock_threshold` from `.integer().min(0)` to `.number().precision(2).min(1).max(100)`
- `updateProductSchema` (line 564): Same change for `low_stock_threshold`
- `max_stock` validation stays as `.integer().min(1)` (must be positive integer units)
- `stock` stays in both schemas but is **not used for setting** during create/update — it's managed by transactions only. Keep it for API backward compatibility but the service layer should ignore it.

### 3. Backend: Product Service

**File: `server/services/productService.js`**

**`createProduct` (line 171–210):**
- On create: set `stock = max_stock` (instead of `stock ?? 0`). If `max_stock` is provided, `stock` = `max_stock`; if not, `stock` = 0.
- `low_stock_threshold` default stays 10 (now meaning 10%).
- Return object should reflect `stock = max_stock` when no explicit stock is provided.

**`updateProduct` (line 212–281):**
- Remove `stock` from the UPDATE query — never overwrite `stock` from form data. The `stock` parameter should be ignored or the field removed from the UPDATE statement.
- Keep `low_stock_threshold` and `max_stock` updates.
- Return object should NOT include a new `stock` value from the form.

### 4. Backend: Inventory Service

**File: `server/services/inventoryService.js`**

**`getProductsWithStock` (lines 51–52, 63):**
- Change `low_stock_only` filter from `i.stock <= COALESCE(i.low_stock_threshold, 10)` to `i.stock <= COALESCE(i.max_stock * (i.low_stock_threshold / 100.0), i.max_stock * 0.10)` — i.e. use the percentage formula. Handle NULL `max_stock` by falling back to a default.
- Update `is_low_stock` computed column: `(i.stock <= COALESCE(i.max_stock * (i.low_stock_threshold / 100.0), 0))`

**`getInventorySummary` (line 475):**
- Change `low_stock_count` from `i.stock <= i.low_stock_threshold` to `i.stock <= COALESCE(i.max_stock * (i.low_stock_threshold / 100.0), 0)`

**`deductStock` (lines 205–217):**
- The low-stock alert check: instead of `newStock <= threshold && newStock > 0`, compute `lowStockLimit = maxStock * (threshold / 100)` using the `max_stock` value. Query `max_stock` from inventory alongside `low_stock_threshold`. Alert condition: `newStock <= lowStockLimit && newStock > 0`.
- The `threshold` value stored in `low_stock_alerts` table: store the computed `lowStockLimit` (absolute units) for historical reference, or store the percentage. Decision: store the computed absolute limit so the alert record shows the actual unit threshold that was crossed.

### 5. Backend: Order Service

**File: `server/services/orderService.js`**
- `deductStock`-equivalent logic (lines 410–440): The `lowStockThreshold` at line 410 is used as an absolute value. Replace this check: query `max_stock` alongside `low_stock_threshold`, compute `lowStockLimit = maxStock * (threshold / 100)`, and alert when `newStock <= lowStockLimit && newStock > 0`.
- The `low_stock_threshold` query at line 380/398 should also fetch `max_stock`.

### 6. Backend: Report Service

**File: `server/services/reportService.js`**
- **Fix bug** at line 307–313: Change `FROM products` to a JOIN with `inventory` table. The current query references `stock` and `low_stock_threshold` columns on `products` which don't exist.
- Update the low-stock condition from `stock <= low_stock_threshold` to the percentage formula: `i.stock <= COALESCE(i.max_stock * (i.low_stock_threshold / 100.0), 0)`.

### 7. Frontend: Shared Utility

**File: `client/src/app/utils/stockUtils.js` (NEW)**
- Export `getStockStatus(stock, lowStockThresholdPct, maxStock)`:
  - Returns `{ status: 'out_of_stock' | 'low_stock' | 'in_stock', label: 'Out of Stock' | 'Low Stock' | 'In Stock', color: ... }`
  - `lowStockLimit = maxStock * (pct / 100)`, treating threshold as percentage
  - Handles null/undefined `maxStock` and `lowStockThresholdPct` with sensible defaults (fallback: maxStock = 0 → no low stock possible, pct = 10)
- Export `getStockTier(stock, lowStockThresholdPct, maxStock)` for backward-compatible filtering (returns `'out_of_stock' | 'critical' | 'warning' | 'healthy'`):
  - `out_of_stock`: stock <= 0
  - `critical`: stock > 0 and stock <= lowStockLimit (Low Stock tier)
  - `warning`: stock > lowStockLimit but stock < maxStock
  - `healthy`: stock >= maxStock
  - **Important**: This function must handle the parts case (no max_stock). When `maxStock` is not available (parts), fall back to absolute threshold logic: `critical` = stock > 0 && stock <= threshold, `warning` = stock > threshold && stock <= threshold * 2, `healthy` = stock > threshold * 2. Accept a parameter or detect parts by absence of max_stock.

### 8. Frontend: ProductModal

**File: `client/src/app/pages/admin/components/modals/ProductModal.jsx`**

**Stock Levels section (lines 670–706):**
- Remove the "Initial Stock Quantity" input field entirely (lines 673–683). Stock is auto-set to `max_stock` on create by the backend.
- Rename "Low Stock Alert Threshold" input (lines 684–694) to "Low Stock Threshold (%)" with `type="number"`, placeholder "10", and step="0.01". Add min=0.01 max=100.
- Rename "Max Stock Level" input (lines 695–705) to "Maximum Stock" with placeholder "e.g. 100".
- Add helper text below Low Stock Threshold (%): dynamically show `lowStockLimit = max_stock * (threshold / 100)`, formatted as e.g. "10% of 100 = 10 units or less". Compute from `form.max_stock` and `form.low_stock_threshold`.
- Keep form field bindings: `form.max_stock` and `form.low_stock_threshold`.

**Unsaved changes tracking (line 198):**
- `stock` is already in `trackedFields`. Keep it (it's still a valid field, just not editable in the modal anymore). Actually, since stock is no longer user-editable in the modal, remove `'stock'` from trackedFields since it can't change via the form. But `low_stock_threshold` and `max_stock` stay.

### 9. Frontend: AdminPage

**File: `client/src/app/pages/AdminPage.jsx`**

- **Replace `getStockPercentage` (line 131) and `getStockTier` (line 139)** with imports from the new shared utility. Or refactor to use `getStockTier` from `stockUtils.js` that accepts `(stock, lowStockThresholdPct, maxStock)`.
- **Lines 435–436**: Product items now carry `low_stock_threshold` as percentage. Parts keep `low_stock_threshold: 10` (absolute, for backward compat with the parts path in `getStockTier`).
- **Line 445**: `getStockTier` call for products — pass `item.low_stock_threshold` (now percentage) and `item.max_stock`. For parts — the `getStockTier` must detect no `max_stock` and use absolute fallback.
- **Lines 472–486**: Same pattern for `filteredProductsInventory` and `filteredPartsInventory`.
- **Lines 521–548**: Same pattern for `filteredPartsInventory`.
- **Lines 582–596** (`inventoryHealthData`): Update to use new `getStockTier` function.
- **saveProduct (lines 900–902)**: Remove `stock` from the payload — it should not be sent to the backend for create/update. Keep `low_stock_threshold` (now percentage) and `max_stock`. On create, the backend will set `stock = max_stock`.
- **Line 902**: `max_stock` should be sent as a number when provided.

### 10. Frontend: StaffDashboard

**File: `client/src/app/pages/StaffDashboard.jsx`**

- **Line 444**: `visibleInventory` mapping — `low_stock_threshold` now comes as a percentage. No structural change needed, just semantics change.
- **Lines 463–493** (`filteredProductsInventory`): Replace inline threshold-based filtering with `getStockTier` from shared utility. The filter logic currently uses absolute threshold; switch to percentage logic for products.
- **Lines 500–533** (`filteredPartsInventory`): Parts keep absolute threshold logic (hardcoded 10). No change needed, or use the parts-fallback path of `getStockTier`.

### 11. Frontend: ProductsTab

**File: `client/src/app/pages/admin/tabs/ProductsTab.jsx`**

- **Lines 189–191**: Replace `p.stock > (p.low_stock_threshold || 10)` inline logic with `getStockStatus` from shared utility. Display "🟢 In Stock" / "🟡 Low Stock" / "🔴 Out of Stock" status badges instead of the current inline text.
- **Lines 255–257**: Same replacement for the grid view stock badge.

### 12. Frontend: InventoryTab

**File: `client/src/app/pages/admin/tabs/InventoryTab.jsx`**

- **Lines 218–225**: Replace the `maxStock = item.max_stock || threshold * 2` and `stockPct` calculation with the new percentage-based `lowStockLimit` computation. For products: `lowStockLimit = max_stock * (low_stock_threshold / 100)`.
- **Line 225**: Change `statusLabel` from `"0%"` / `"${pct}%"` to the status text ("In Stock" / "Low Stock" / "Out of Stock") using `getStockStatus`.
- **Lines 226–230**: `statusClass` colors should reflect the new status (green for In Stock, amber for Low Stock, red for Out of Stock).
- Parts items should use the absolute-threshold fallback.

### 13. Frontend: StockVisualizer

**File: `client/src/app/pages/admin/components/inventory/StockVisualizer.jsx`**

- **Line 9**: Props stay the same (`threshold`, `maxStock`). But `threshold` is now a percentage.
- **Line 11**: `baseLevel = hasMaxStock ? maxStock : threshold * 2` — this fallback is now wrong because `threshold` is a percentage, not units. When `maxStock` is 0/undefined, fall back to a sensible default (e.g., threshold treated as percentage of a notional max, or just show raw stock). Decision: when `maxStock` is not available, compute `lowStockLimit = maxStock ? maxStock * (threshold / 100) : 0` and show "Low Stock" when `stock <= 0`, "In Stock" otherwise. The visualizer is primarily for product inventory adjustments where `max_stock` is expected to be set.
- **Line 17**: `isWarning = currentStock > 0 && (hasMaxStock ? currentStock <= baseLevel : currentStock <= threshold * 2)` — replace with: `currentStock <= lowStockLimit` where `lowStockLimit = maxStock * (threshold / 100)`.
- Overall: update the warning calculation to use `lowStockLimit = maxStock * (threshold / 100)`. If `maxStock` is 0, the percentage logic doesn't apply — fall back to showing "In Stock" for any stock > 0.

### 14. Frontend: StockAdjustmentModals

**File: `client/src/app/pages/admin/components/inventory/StockAdjustmentModals.jsx`**

- **Lines 311–316**: The `StockVisualizer` receives `threshold={selectedProduct.low_stock_threshold || 10}` and `maxStock={selectedProduct.max_stock || 0}`. Since `threshold` is now a percentage, this is correct — the `StockVisualizer` will use the percentage formula. No change needed here as long as `StockVisualizer` is updated to handle percentage thresholds.

### 15. Frontend: PosWorkspace

**File: `client/src/app/components/pos/PosWorkspace.jsx`**

- **Lines 735–744** (`updateQuantity`): The `maxStock` parameter is used for quantity capping. Currently passes `item.stock` as `maxStock` (lines 1079, 1089, 1097). This should pass `item.max_stock` instead so the cart is capped at maximum capacity, not current stock. 
  - Line 1079: `updateQuantity(item.product_id, 0, item.max_stock)` — or `item.stock` to remove. When setting to 0, maxStock doesn't matter.
  - Lines 1089, 1097: `updateQuantity(item.product_id, item.quantity - 1, item.max_stock)` and `item.quantity + 1, item.max_stock`. Currently passes `item.stock` as the cap, which prevents ordering more than current stock. Change to `item.max_stock` to allow up to max capacity, **but** the orderService already validates `currentStock >= quantity` server-side, so the UI cap should remain at `item.stock` to prevent over-ordering. 
  - **Decision**: Keep UI cap at `item.stock` (line 545 already filters `stock > 0`). The `maxStock` parameter name is misleading but the behavior (cap at current stock) is correct for POS. No change needed, or rename parameter for clarity.

---

## Validation Plan

1. **Migration**: Run `node migrations/run-migration19.js` — verify `low_stock_threshold` column type changed, no data loss.
2. **Backend lint/typecheck**: `npm run lint` (if configured) on server.
3. **Frontend lint/typecheck**: `npm run lint` / `npm run typecheck` on client.
4. **Manual scenarios to verify**:
   - Create new product with `max_stock=100`, `low_stock_threshold=10` → `stock=100`, status = In Stock
   - Sell down to 10 units → status = Low Stock (10% of 100 = 10)
   - Sell down to 0 → status = Out of Stock
   - Edit product → `stock` field unchanged by edit payload
   - Low stock alert fires when `newStock <= max_stock * (threshold / 100)`
   - Admin dashboard inventory health shows correct status
   - StaffDashboard inventory filters work with new percentage logic
   - ProductsTab shows In Stock / Low Stock / Out of Stock status badges
   - InventoryTab shows text status (not percentage) for products, percentage fallback for parts

## Out of Scope

- Builder parts (`guitar_builder_parts`) inventory logic — kept as-is with absolute threshold of 10 units
- Guitar builder part creation UI — not part of this refactor
- Existing low-stock alert records in `low_stock_alerts` table — historical data remains as-is
