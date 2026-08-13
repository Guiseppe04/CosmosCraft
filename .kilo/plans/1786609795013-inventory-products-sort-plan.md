# Plan: Inventory Products Tab — SKU Display + Sorting

## Goal
Add SKU to the Inventory → Products table and implement full sorting support (Name, Category, Date Modified, SKU, Stock) with Ascending/Descending directions, matching the existing AdminDashboard design and architecture.

## Current State
- **Frontend sorting**: Client-side only, in `AdminPage.jsx` via `useMemo`.
- **Products tab sort state**: `productsInventoryFilter.sort` (default `'name'`).
- **Parts tab sort state**: `partsInventoryFilter.sort` (default `'name'`).
- **Backend inventory API** (`GET /api/inventory/products`): Returns product stock data but does **not** include `sku` or `updated_at`.
- **Sort dropdown** (`InventoryTab.jsx`): Shared between Products and Parts tabs; current options are `name`, `sku`, `stock_high`, `stock_low`.
- **Dead/unused code**: `inventorySort` state + `filteredInventory`/`paginatedInventory` memos appear unused by the active Inventory tab (which uses `filteredProductsInventory` / `filteredPartsInventory`). **Do not remove** to avoid regressions.

## Decisions

### 1. Sort value naming
Use explicit directional values instead of ambiguous ones:
- `name_asc` / `name_desc`
- `category_asc` / `category_desc`
- `date_modified_asc` / `date_modified_desc`
- `sku_asc` / `sku_desc`
- `stock_asc` / `stock_desc`

### 2. Layer for sorting
Keep sorting **client-side** (consistent with existing architecture). The backend already returns the full dataset; frontend `useMemo` handles filtering, sorting, and pagination.

### 3. Backend response fields
Add `p.sku` and `p.updated_at` to `inventoryService.getProductsWithStock` SELECT so the frontend has the data needed for SKU display and Date Modified sorting. No backend sort param needed since frontend sorts.

### 4. Sort dropdown behavior
- **Products tab**: Show Name, Category, Date Modified, SKU, Stock options with Asc/Desc pairs.
- **Parts tab**: Keep existing Name, SKU, Stock options with Asc/Desc pairs. Category remains the default primary sort for parts (not exposed in dropdown, matching current behavior where parts are grouped by category).

### 5. Default sort values
Update defaults to new explicit values:
- `productsInventoryFilter.sort`: `'name_asc'`
- `partsInventoryFilter.sort`: `'name_asc'`
- `inventorySort`: `'name_asc'` (for the unused-but-present combined path)

## Implementation Steps

### Backend
1. **`server/services/inventoryService.js`**
   - In `getProductsWithStock`, add `p.sku` and `p.updated_at` to the SELECT list.
   - Keep existing `ORDER BY i.stock ASC, p.name ASC` as a DB-level default (frontend will override).

### Frontend — Sort dropdown
2. **`client/src/app/pages/admin/tabs/InventoryTab.jsx`**
   - Replace the single shared sort `<select>` with conditional rendering:
     - If `inventoryIsProducts`: render Name A-Z/Z-A, Category A-Z/Z-A, Date Modified Oldest-Newest/Newest-Oldest, SKU A-Z/Z-A, Stock Low-High/High-Low.
     - Else (Parts): render Name A-Z/Z-A, SKU A-Z/Z-A, Stock Low-High/High-Low.
   - Update option values to match the new explicit directional scheme.

### Frontend — Sort logic
3. **`client/src/app/pages/AdminPage.jsx`
   - Update `filteredProductsInventory` sort comparator to handle: `name_asc`, `name_desc`, `category_asc`, `category_desc`, `date_modified_asc`, `date_modified_desc`, `sku_asc`, `sku_desc`, `stock_asc`, `stock_desc`.
   - Update `filteredPartsInventory` sort comparator to handle: `name_asc`, `name_desc`, `sku_asc`, `sku_desc`, `stock_asc`, `stock_desc`. Keep category as the always-applied primary sort for parts.
   - Update `filteredInventory` sort comparator with the same new values (defensive; currently unused but keeps it consistent).
   - Update default sort states:
     - `productsInventoryFilter` → `sort: 'name_asc'`
     - `partsInventoryFilter` → `sort: 'name_asc'`
     - `inventorySort` → `'name_asc'`

## Validation
- Products tab shows SKU column with correct values (including legacy products with missing SKU showing `—`).
- Sorting works for all fields in both directions.
- Sorting interacts correctly with existing Search, Status filter, and Pagination.
- Parts tab behavior is unchanged.
- No extra API requests are made per product.
- Existing inventory functionality (stock adjustments, logs, alerts) is untouched.
