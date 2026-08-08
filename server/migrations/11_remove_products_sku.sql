-- =============================================
-- MIGRATION 11: Remove sku column from products
-- =============================================
-- The products.sku column was added directly to the live database but is
-- not part of the application schema. The product creation flow does not
-- provide a SKU value, causing NOT NULL violations (error 23502) on insert.
-- This migration removes the column entirely.

ALTER TABLE products DROP COLUMN IF EXISTS sku;