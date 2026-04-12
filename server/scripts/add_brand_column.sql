-- Migration: Add Brand column to products table
-- Description: Adds a brand column to products table for product brand information
-- Created: 2026-04-12

-- Add brand column if it doesn't exist
ALTER TABLE products
ADD COLUMN IF NOT EXISTS brand VARCHAR(100);

-- Add index on brand for faster filtering
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);

-- Update updated_at timestamp for audit
UPDATE products SET updated_at = now() WHERE brand IS NULL AND product_id IS NOT NULL;
