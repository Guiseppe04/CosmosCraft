-- Migration: Add product_sku and product_name to order_items table
-- Update CHECK constraint to allow mock products

-- First, alter the table to add new columns
ALTER TABLE order_items
ADD COLUMN product_sku VARCHAR(50),
ADD COLUMN product_name VARCHAR(150);

-- Drop the old constraint
ALTER TABLE order_items
DROP CONSTRAINT order_items_check;

-- Add the new constraint that allows product_sku
ALTER TABLE order_items
ADD CONSTRAINT order_items_check 
CHECK ((product_id IS NOT NULL) OR (customization_id IS NOT NULL) OR (product_sku IS NOT NULL));

-- Add index for product_sku if you want to search by it
CREATE INDEX IF NOT EXISTS idx_order_items_product_sku ON order_items(product_sku);
