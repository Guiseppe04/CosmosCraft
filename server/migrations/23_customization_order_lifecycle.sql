-- Customization orders have a lifecycle distinct from the product shipping flow.
-- `orders.status` remains the source of truth for product/service orders.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customization_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS customization_hold_reason TEXT,
  ADD COLUMN IF NOT EXISTS customization_hold_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customization_hold_approved_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customization_hold_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customization_resumed_at TIMESTAMPTZ;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_customization_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_customization_status_check CHECK (
  customization_status IS NULL OR customization_status IN (
    'payment_pending', 'active', 'on_hold', 'payment_required',
    'fulfillment_pending', 'fulfillment_in_progress', 'fulfilled',
    'cancellation_requested', 'resolution_in_progress', 'cancelled'
  )
);

CREATE INDEX IF NOT EXISTS idx_orders_customization_status
  ON orders(customization_status)
  WHERE order_type = 'customization';

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS fulfillment_address_id UUID REFERENCES addresses(address_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fulfillment_address_snapshot JSONB;

CREATE INDEX IF NOT EXISTS idx_projects_fulfillment_address_id
  ON projects(fulfillment_address_id)
  WHERE fulfillment_address_id IS NOT NULL;

-- Backfill existing custom orders without changing the product-facing status.
UPDATE orders o
SET customization_status = CASE
  WHEN o.status = 'cancelled' THEN 'cancelled'
  WHEN p.status = 'on_hold' THEN 'on_hold'
  WHEN p.status = 'completed' AND COALESCE(p.fulfillment_status, '') = '' THEN 'fulfillment_pending'
  WHEN p.fulfillment_status IN ('courier_arranged', 'out_for_delivery', 'ready_for_pickup', 'pickup_scheduled', 'shop_delivery_requested') THEN 'fulfillment_in_progress'
  WHEN p.fulfillment_status IN ('received', 'delivered', 'picked_up') THEN 'fulfilled'
  WHEN o.payment_status <> 'approved' THEN 'payment_pending'
  ELSE 'active'
END,
customization_hold_reason = COALESCE(o.customization_hold_reason, p.hold_reason),
customization_hold_requested_at = COALESCE(o.customization_hold_requested_at, p.hold_requested_at),
customization_hold_approved_by = COALESCE(o.customization_hold_approved_by, p.hold_approved_by),
customization_hold_approved_at = COALESCE(o.customization_hold_approved_at, p.hold_approved_at)
FROM projects p
WHERE p.order_id = o.order_id
  AND o.order_type = 'customization'
  AND o.customization_status IS NULL;

-- A hold is now owned by the order. Preserve project progress while restoring
-- legacy held projects to their appropriate build state.
UPDATE projects p
SET status = CASE WHEN p.progress > 0 THEN 'in_progress'::project_status_enum ELSE 'not_started'::project_status_enum END,
    updated_at = CURRENT_TIMESTAMP
FROM orders o
WHERE o.order_id = p.order_id
  AND o.order_type = 'customization'
  AND p.status = 'on_hold';
