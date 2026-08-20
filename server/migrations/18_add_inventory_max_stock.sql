-- Migration 18: Add max_stock column to inventory table
-- max_stock serves as the percentage baseline for product status.
-- NULL = "not configured" → app falls back to low_stock_threshold * 2.

DO $$
BEGIN
   IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'inventory' AND column_name = 'max_stock'
   ) THEN
      ALTER TABLE inventory ADD COLUMN max_stock INT NULL CHECK (max_stock IS NULL OR max_stock > 0);
      RAISE NOTICE 'Added max_stock column to inventory';
   ELSE
      RAISE NOTICE 'max_stock column already exists in inventory';
   END IF;
END $$;
