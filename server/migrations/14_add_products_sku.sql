-- =============================================
-- MIGRATION 14: Add sku column to products
-- =============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'sku'
  ) THEN
    ALTER TABLE products ADD COLUMN sku VARCHAR(100);
  END IF;
END $$;

UPDATE products SET sku = 'SKU-' || product_id::text WHERE sku IS NULL;

ALTER TABLE products ALTER COLUMN sku SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_sku_unique'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_sku_unique UNIQUE (sku);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
