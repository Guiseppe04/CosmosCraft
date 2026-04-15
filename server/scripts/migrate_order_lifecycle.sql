-- =============================================
-- ORDER LIFECYCLE MIGRATION
-- Adds new order status values and shipping tracking fields
-- =============================================

-- =============================================
-- 1. ADD NEW VALUES TO EXISTING ENUMS
-- =============================================

ALTER TYPE order_status_enum ADD VALUE IF NOT EXISTS 'delivered';
ALTER TYPE order_status_enum ADD VALUE IF NOT EXISTS 'shipped';
ALTER TYPE order_status_enum ADD VALUE IF NOT EXISTS 'out_for_delivery';

ALTER TYPE order_payment_status_enum ADD VALUE IF NOT EXISTS 'awaiting_approval';

-- Commit the new enum values before using them
COMMIT;


-- =============================================
-- 2. MIGRATE EXISTING DATA
-- =============================================

-- Migrate order status: completed -> delivered
UPDATE orders 
SET status = 'delivered'::order_status_enum
WHERE status::text = 'completed';


-- =============================================
-- 3. ADD SHIPPING TRACKING COLUMNS
-- =============================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_name VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS out_for_delivery_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rider_name VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rider_contact VARCHAR(50);

-- Map existing completed_at to delivered_at for migrated orders
UPDATE orders 
SET delivered_at = completed_at
WHERE status = 'delivered'::order_status_enum
  AND delivered_at IS NULL 
  AND completed_at IS NOT NULL;

-- Drop old completed_at column (now replaced by delivered_at)
ALTER TABLE orders DROP COLUMN IF EXISTS completed_at;


-- =============================================
-- 4. ADD INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON orders(tracking_number);
CREATE INDEX IF NOT EXISTS idx_orders_shipped_at ON orders(shipped_at) WHERE shipped_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_delivered_at ON orders(delivered_at) WHERE delivered_at IS NOT NULL;


-- =============================================
-- COMPLETE
-- =============================================

SELECT 'Migration complete: Order lifecycle updated successfully' AS result;
