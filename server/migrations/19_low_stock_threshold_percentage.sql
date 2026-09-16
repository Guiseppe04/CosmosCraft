-- Migration 19: Convert low_stock_threshold from absolute units to percentage
-- Previously low_stock_threshold was an INT representing absolute unit count.
-- Now it is NUMERIC(5,2) representing a percentage (1-100) of max_stock.
-- Existing data values map directly (e.g. 10 = 10%, 20 = 20%) so no data conversion needed.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inventory' AND column_name = 'low_stock_threshold'
    ) THEN
        -- Drop the old CHECK constraint (if any) and the old type
        ALTER TABLE inventory ALTER COLUMN low_stock_threshold TYPE NUMERIC(5,2) USING low_stock_threshold::NUMERIC(5,2);

        -- Recreate the CHECK constraint with percentage range
        -- Drop any existing constraint named low_stock_threshold_check
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = 'inventory' AND constraint_name = 'inventory_low_stock_threshold_check'
        ) THEN
            ALTER TABLE inventory DROP CONSTRAINT inventory_low_stock_threshold_check;
        END IF;

        -- Re-add the default (in case it was dropped)
        ALTER TABLE inventory ALTER COLUMN low_stock_threshold SET DEFAULT 10;

        RAISE NOTICE 'Converted low_stock_threshold to NUMERIC(5,2) percentage';
    ELSE
        RAISE NOTICE 'low_stock_threshold column does not exist; skipping';
    END IF;
END $$;

-- Add the percentage range CHECK constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'inventory' AND constraint_name = 'inventory_low_stock_threshold_check'
    ) THEN
        ALTER TABLE inventory ADD CONSTRAINT inventory_low_stock_threshold_check
        CHECK (low_stock_threshold >= 0 AND low_stock_threshold <= 100);
        RAISE NOTICE 'Added low_stock_threshold range CHECK (0-100)';
    ELSE
        RAISE NOTICE 'low_stock_threshold CHECK constraint already exists';
    END IF;
END $$;
