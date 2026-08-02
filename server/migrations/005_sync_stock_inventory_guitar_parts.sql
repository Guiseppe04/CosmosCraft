-- Sync stock between inventory and guitar_builder_parts
-- Adds product_id column to guitar_builder_parts to link builder parts with products

-- Add product_id column to guitar_builder_parts
ALTER TABLE guitar_builder_parts
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(product_id) ON DELETE SET NULL;

-- Create unique index to ensure one-to-one linking
CREATE UNIQUE INDEX IF NOT EXISTS idx_guitar_builder_parts_product_id
  ON guitar_builder_parts(product_id)
  WHERE product_id IS NOT NULL;

-- Create index for lookups
CREATE INDEX IF NOT EXISTS idx_guitar_builder_parts_product_id_lookup
  ON guitar_builder_parts(product_id);
