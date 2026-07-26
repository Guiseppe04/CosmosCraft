-- =============================================
-- MIGRATION 03: Add missing product_sku and other columns to order_items
-- =============================================

-- Add product_sku column if it doesn't exist
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_sku VARCHAR(50);

-- Update the check constraint to allow product_sku as an alternative identifier
-- First drop the old constraint, add the new one
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'order_items_product_id_check' 
        AND conrelid = 'order_items'::regclass
    ) THEN
        ALTER TABLE order_items DROP CONSTRAINT order_items_product_id_check;
        ALTER TABLE order_items ADD CONSTRAINT order_items_product_id_check 
            CHECK ((product_id IS NOT NULL) OR (customization_id IS NOT NULL) OR (product_sku IS NOT NULL));
    END IF;
END $$;