-- =============================================
-- MIGRATION 20: Unified Refund Flow
-- Adds refund_type, audit fields, return tracking,
-- restock log, and DB-level duplicate protection.
-- =============================================

-- 0. Bridge refund_request_id identifier for backward compatibility.
-- The actual table uses refund_request_id as PK (from run-migration6.js).
-- No bridge needed since refund_request_id already exists.

-- 1. Extend refund_requests with refund type, audit, and return fields
ALTER TABLE refund_requests
  ADD COLUMN IF NOT EXISTS refund_type VARCHAR(30)
    CHECK (refund_type IS NULL OR refund_type IN ('money_refund', 'physical_release', 'no_refund')),
  ADD COLUMN IF NOT EXISTS approved_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS adjustment_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS adjustment_reason TEXT,
  ADD COLUMN IF NOT EXISTS adjusted_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS adjusted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS refund_method VARCHAR(30)
    CHECK (refund_method IS NULL OR refund_method IN ('gcash', 'bank_transfer', 'cash', 'store_credit')),
  ADD COLUMN IF NOT EXISTS refund_reference VARCHAR(255),
  ADD COLUMN IF NOT EXISTS refund_fee NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processing_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS withdrawn_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS return_status VARCHAR(30)
    CHECK (return_status IS NULL OR return_status IN ('not_required', 'return_pending', 'return_in_transit', 'returned', 'return_confirmed')),
  ADD COLUMN IF NOT EXISTS return_method VARCHAR(30)
    CHECK (return_method IS NULL OR return_method IN ('courier', 'pickup')),
  ADD COLUMN IF NOT EXISTS return_reference VARCHAR(255),
  ADD COLUMN IF NOT EXISTS return_confirmed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS return_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS restocked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS restocked_by UUID REFERENCES users(user_id) ON DELETE SET NULL;

-- 2. Widen refund status CHECK to include withdrawn, return_pending, returned
ALTER TABLE refund_requests DROP CONSTRAINT IF EXISTS refund_requests_status_check;
ALTER TABLE refund_requests ADD CONSTRAINT refund_requests_status_check
  CHECK (status IN (
    'pending', 'approved', 'processing', 'rejected', 'refunded',
    'pending_payment_verification', 'withdrawn', 'return_pending', 'returned'
  ));

-- 3. Add 'refunded' to order_payment_status_enum so order payment state can sync
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'order_payment_status_enum'::regtype
      AND enumlabel = 'refunded'
  ) THEN
    ALTER TYPE order_payment_status_enum ADD VALUE 'refunded';
  END IF;
END $$;

-- 4. DB-level duplicate-refund protection (prevents race conditions)
CREATE UNIQUE INDEX IF NOT EXISTS uq_refund_requests_active_order
  ON refund_requests(order_id)
  WHERE deleted_at IS NULL
    AND status IN ('pending', 'approved', 'processing', 'return_pending', 'returned', 'pending_payment_verification');

CREATE UNIQUE INDEX IF NOT EXISTS uq_refund_requests_active_project
  ON refund_requests(project_id)
  WHERE deleted_at IS NULL
    AND project_id IS NOT NULL
    AND status IN ('pending', 'approved', 'processing', 'return_pending', 'returned', 'pending_payment_verification');

-- 5. Idempotent restock log (prevents double restock per refund+item)
CREATE TABLE IF NOT EXISTS refund_restock_log (
  restock_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_request_id UUID NOT NULL REFERENCES refund_requests(refund_request_id) ON DELETE CASCADE,
  order_item_id BIGINT REFERENCES order_items(order_item_id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(product_id) ON DELETE SET NULL,
  quantity NUMERIC(12,2) NOT NULL,
  restocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  restocked_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  UNIQUE(refund_request_id, order_item_id)
);

CREATE INDEX IF NOT EXISTS idx_refund_restock_log_refund ON refund_restock_log(refund_request_id);
CREATE INDEX IF NOT EXISTS idx_refund_restock_log_product ON refund_restock_log(product_id);