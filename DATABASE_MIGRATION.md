# Database Migration: Inventory System Refactoring

## Overview
The inventory management system has been refactored to separate product catalog information from inventory/stock data. This improves data organization and allows for better inventory tracking.

## Changes Made

### 1. **Schema Changes**

#### Products Table (Updated)
**Removed fields:**
- `cost` → moved to inventory table as `cost_price`
- `stock` → moved to inventory table
- `low_stock_threshold` → moved to inventory table

**Remaining fields:**
- `product_id`, `sku`, `name`, `description`, `price`, `category_id`, `is_active`, `created_at`, `updated_at`

#### New Inventory Table
```sql
CREATE TABLE inventory (
    inventory_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL UNIQUE,
    cost_price NUMERIC(12, 2),
    stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    low_stock_threshold INT DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);
```

### 2. **Backend Service Changes**

#### ProductService
- All queries now LEFT JOIN with inventory table
- `cost` parameter renamed to `cost_price`
- Create/Update operations are transactional and handle both products and inventory

#### InventoryService
- Now queries from inventory table instead of products
- Stock operations (add, deduct, adjust) update inventory table
- All functionality remains the same

#### CartService
- Stock validation queries updated to use inventory table
- Stock deduction operations updated to use inventory table

### 3. **Migration Steps**

**Step 1:** Update Supabase schema (execute schema.sql changes)
```
1. Remove cost, stock, low_stock_threshold columns from products table
2. Create new inventory table with provided SQL
```

**Step 2:** Run migration script
```bash
node scripts/migrateToinventory.js
```

This script will:
- Create inventory records for all existing products
- Migrate cost → cost_price
- Migrate stock and low_stock_threshold values
- Validate data integrity

**Step 3:** Verify migration
- Check that all products have matching inventory records
- Verify stock levels match before/after migration
- Test product creation/update operations

### 4. **API Behavior**

**Product Creation/Update:**
Send both product and inventory data in request body:
```json
{
  "sku": "GT-001",
  "name": "Acoustic Guitar",
  "description": "...",
  "price": 299.99,
  "cost_price": 150.00,
  "category_id": 1,
  "stock": 10,
  "low_stock_threshold": 3,
  "is_active": true
}
```

**Product Response:**
Now includes inventory data:
```json
{
  "product_id": "...",
  "sku": "GT-001",
  "name": "Acoustic Guitar",
  "price": 299.99,
  "cost_price": 150.00,
  "stock": 10,
  "low_stock_threshold": 3,
  "is_active": true,
  "inventory_id": "...",
  "category_name": "Guitars"
}
```

### 5. **Inventory Operations**

Stock operations continue to work as before:
- `GET /api/inventory/products` - View all products with stock
- `PATCH /api/inventory/stock-in` - Add stock
- `PATCH /api/inventory/stock-out` - Deduct stock
- `PATCH /api/inventory/adjust` - Adjust stock

All operations are atomic and create audit logs via inventory_logs table.

### 6. **Benefits**

✅ **Better Data Organization**: Product catalog vs. inventory management separated
✅ **Scalability**: Can track multiple warehouses/locations in future
✅ **Clarity**: Clear distinction between product pricing and cost tracking
✅ **Flexibility**: Easier to implement advanced inventory features

### 7. **Rollback Plan**

If you need to rollback:
1. Keep a database backup before migration
2. Restore from backup
3. Or manually move inventory data back to products table:
```sql
UPDATE products p
SET cost = i.cost_price,
    stock = i.stock,
    low_stock_threshold = i.low_stock_threshold
FROM inventory i
WHERE p.product_id = i.product_id;
```

## Frontend Changes

The frontend now receives `cost_price` instead of `cost` in product data. The admin dashboard already displays this correctly.

## Questions?

If you encounter any issues during migration, check:
1. All products have inventory records
2. Data types match expectations
3. Foreign key constraints are satisfied
4. Inventory_logs table is accessible for audit trails
