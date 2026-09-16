# Plan: Fix ProjectTaskTracker Inventory Flow

## Root Cause
`inventoryService.deductStock` is called with the wrong argument order in both `receiveProjectRequiredPart` and `toggleProjectRequiredPart`. The options object `{ notes, createdBy }` is passed as the 3rd argument (`referenceType`) instead of the 5th. This causes the inventory log insert to fail, rolling back the stock deduction, while the audit log in `projectService` is written in a separate transaction. Result: project part shows as received but inventory stock never changes.

---

## Step 1: Fix Backend `deductStock` Call Signatures

**File:** `server/services/projectService.js`

In both `receiveProjectRequiredPart` and `toggleProjectRequiredPart`, change:
```js
await inventoryService.deductStock(part.product_id, quantity, {
  notes: `...`,
  createdBy: userId,
});
```

To:
```js
await inventoryService.deductStock(part.product_id, quantity, 'project_part', projectId, {
  notes: `...`,
  createdBy: userId,
});
```

---

## Step 2: Make Inventory Updates Atomic

**Problem:** `inventoryService.deductStock`/`addStock` each open their own connection and transaction. The audit log is written in a separate transaction. If the audit log fails, inventory is already changed.

**Solution:** Refactor `inventoryService.deductStock` and `addStock` to accept an optional `client` parameter. When provided, use that client and do NOT manage transactions (caller manages BEGIN/COMMIT/ROLLBACK). Also refactor `syncStockToBuilderParts` to accept an optional client.

**File:** `server/services/inventoryService.js`

- Add `client = null` to options destructuring in `addStock`, `deductStock`, and `adjustStock`
- When `client` is provided, use it directly; skip `pool.connect()`, `BEGIN`, `COMMIT`, `ROLLBACK`, and `release()`
- Update `syncStockToBuilderParts(productId, delta, client)` to accept optional client

**File:** `server/services/projectService.js`

In `toggleProjectRequiredPart` and `receiveProjectRequiredPart`:
1. Get a client: `const client = await pool.connect();`
2. Pass it to `inventoryService.deductStock(..., { client, notes, createdBy: userId })`
3. Write audit log using the same `client`
4. `COMMIT` or `ROLLBACK` once
5. Release client

This guarantees: inventory deduction + audit log succeed or fail together.

---

## Step 3: Return Updated Inventory from Backend

After the atomic transaction commits, query the updated stock directly instead of calling expensive `getProjectRequiredParts`:

```js
let updatedStock = null;
if (part.product_id) {
  const stockRow = await client.query('SELECT stock FROM inventory WHERE product_id = $1', [part.product_id]);
  updatedStock = stockRow.rows[0] ? Number(stockRow.rows[0].stock) : null;
}

const stockStatus = getPartStockStatus(updatedStock, quantity);

return {
  part: {
    part_key: part.part_key,
    name: part.name,
    is_received: received,
    quantity,
    stock: updatedStock,
    stock_status: stockStatus,
    product_id: part.product_id,
  },
  received,
  stock_updated: Boolean(part.product_id),
};
```

For `receiveProjectRequiredPart`, use the same pattern. Avoid the expensive `getProjectRequiredParts` re-fetch.

---

## Step 4: Frontend — Update Only Affected Part (No Full Reload)

**File:** `client/src/app/components/projects/ProjectTaskTracker.jsx`

In `handleToggleReceive`:
1. Remove `await loadData()`
2. After successful API response, update `requiredParts` directly:
   ```js
   setRequiredParts(prev =>
     prev.map(item =>
       item.part_key === part.part_key
         ? { ...item, ...result.part, is_received: result.received }
         : item
     )
   );
   ```
3. Set feedback on the affected part only (already scoped by `togglingPartKey`)

Keep `loadData()` for initial load and explicit refresh only.

---

## Step 5: Frontend — Remove Auto-Receive Effect

**File:** `client/src/app/components/projects/ProjectTaskTracker.jsx`

Remove the entire `useEffect` that auto-receives in-stock parts on load. Per requirement #13: do not auto-receive merely because stock is available.

---

## Step 6: Frontend — Add Out-of-Stock Restock Flow

**File:** `client/src/app/components/projects/ProjectTaskTracker.jsx`

For parts with `stock_status === 'out_of_stock'` or `stock === 0`:
- Show a small `[Restock]` button next to the part row
- When clicked, reveal an inline quantity input + notes field
- On submit, call `adminApi.addInventoryStock(part.product_id, quantity, notes)` (new API method)
- After success, update the affected part's `stock` and `stock_status` in local state

**File:** `client/src/app/utils/adminApi.js`

Add:
```js
addInventoryStock: (productId, quantity, notes) =>
  request('/api/inventory/stock-in', { method: 'PATCH', body: { productId, quantity, notes } }),
```

---

## Step 7: Frontend — State Cleanup

Remove unused state variables if confirmed unused:
- `receivingPartKey`, `receivingSaving`, `receivingFeedback` (used only by dead `handleReceivePart`)
- `uncheckFeedback` (declared but never set/read)
- `userToggledParts` ref (no longer needed without auto-receive)

Keep `handleReceivePart` as dead code to preserve existing API surface unless user confirms removal.

---

## Step 8: Validation

| Scenario | Expected |
|----------|----------|
| Stock 30, req 1, receive | Stock 29, part received |
| Stock 29, req 1, return | Stock 30, part pending |
| Rapid double-click receive | Stock 29 (not 28) |
| Rapid double-click return | Stock 30 (not 31) |
| Out of stock, restock 1 | Stock 1, then can check received |
| Insufficient stock | Error on affected part, no state change |
| Page refresh after receive | Inventory 29, part received |
| Page refresh after return | Inventory 30, part pending |

---

## Files to Modify

1. `server/services/inventoryService.js` — accept optional `client`, refactor transaction management
2. `server/services/projectService.js` — fix `deductStock` args, atomic transactions, return updated stock
3. `client/src/app/components/projects/ProjectTaskTracker.jsx` — remove auto-receive, update affected part only, add restock flow
4. `client/src/app/utils/adminApi.js` — add `addInventoryStock`
