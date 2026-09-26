-- Migration 26: Add partial unique index for normal (non-customized) cart items
-- This prevents duplicate rows where the same product_id appears more than once
-- in the same cart without a customization, which cannot be caught by NULL = NULL
-- comparisons in application code alone.
--
-- Customized guitar cart items (where customization_id IS NOT NULL) are
-- intentionally excluded from this index and are unaffected by this migration.

-- Step 1: Safely deduplicate any existing duplicate normal-product rows before
-- creating the index. We keep the row with the lowest cart_item_id and sum up
-- the quantities of all duplicates into it.
DO $$
DECLARE
  dup RECORD;
  kept_item_id INTEGER;
  total_qty INTEGER;
BEGIN
  -- Find all (cart_id, product_id) pairs that have more than one row
  -- with customization_id IS NULL.
  FOR dup IN
    SELECT cart_id, product_id
    FROM cart_items
    WHERE product_id IS NOT NULL
      AND customization_id IS NULL
    GROUP BY cart_id, product_id
    HAVING COUNT(*) > 1
  LOOP
    -- Determine which row to keep (earliest insert)
    SELECT cart_item_id INTO kept_item_id
    FROM cart_items
    WHERE cart_id = dup.cart_id
      AND product_id = dup.product_id
      AND customization_id IS NULL
    ORDER BY cart_item_id ASC
    LIMIT 1;

    -- Sum up all quantities for this (cart_id, product_id)
    SELECT SUM(quantity) INTO total_qty
    FROM cart_items
    WHERE cart_id = dup.cart_id
      AND product_id = dup.product_id
      AND customization_id IS NULL;

    -- Merge into the kept row
    UPDATE cart_items
    SET quantity = total_qty, updated_at = now()
    WHERE cart_item_id = kept_item_id;

    -- Delete the duplicate rows
    DELETE FROM cart_items
    WHERE cart_id = dup.cart_id
      AND product_id = dup.product_id
      AND customization_id IS NULL
      AND cart_item_id <> kept_item_id;
  END LOOP;
END $$;

-- Step 2: Create the partial unique index for normal products only.
-- IF NOT EXISTS makes this safe to re-run.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cart_normal_product
  ON cart_items (cart_id, product_id)
  WHERE product_id IS NOT NULL
    AND customization_id IS NULL;
