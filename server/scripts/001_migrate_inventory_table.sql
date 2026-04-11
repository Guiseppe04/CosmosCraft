-- =============================================
-- MIGRATION: Separate Inventory from Products
-- =============================================
-- This migration moves inventory-related fields from the products table
-- to a new dedicated inventory table for better data organization.
--
-- Date: 2026-04-11
-- =============================================

BEGIN;

-- ─── Step 1: Create new inventory table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory (
    inventory_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL UNIQUE,
    cost_price NUMERIC(12, 2) CHECK (cost_price >= 0),
    stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    low_stock_threshold INT DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_stock ON inventory(stock);

-- ─── Step 2: Migrate data from products to inventory ──────────────────────────
-- This step creates inventory records for all existing products
INSERT INTO inventory (product_id, cost_price, stock, low_stock_threshold, created_at, updated_at)
SELECT 
    p.product_id,
    p.cost,
    p.stock,
    p.low_stock_threshold,
    p.created_at,
    p.updated_at
FROM products p
ON CONFLICT (product_id) DO NOTHING;

-- ─── Step 3: Alter products table - remove inventory fields ───────────────────
-- Remove the columns from products table now that data is migrated
ALTER TABLE products DROP COLUMN IF EXISTS cost;
ALTER TABLE products DROP COLUMN IF EXISTS stock;
ALTER TABLE products DROP COLUMN IF EXISTS low_stock_threshold;

-- ─── Step 4: Update products table indexes if needed ──────────────────────────
-- Add any additional indexes as needed
-- (The existing indexes should still be valid)

COMMIT;

-- ─── Verification queries (run after migration) ───────────────────────────────
-- Uncomment these to verify the migration was successful:

-- Check products table structure:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'products' ORDER BY ordinal_position;

-- Check inventory table structure:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'inventory' ORDER BY ordinal_position;

-- Count records in both tables:
-- SELECT (SELECT COUNT(*) FROM products) as product_count,
--        (SELECT COUNT(*) FROM inventory) as inventory_count;

-- Verify all products have inventory records:
-- SELECT COUNT(*) as orphaned_products FROM products p
-- WHERE NOT EXISTS (SELECT 1 FROM inventory i WHERE i.product_id = p.product_id);
