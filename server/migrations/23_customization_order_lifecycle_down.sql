-- Roll back migration 23_customization_order_lifecycle.sql.
--
-- This removes the schema introduced for the customization-only lifecycle.
-- It intentionally does not attempt to restore projects to `on_hold`: the
-- forward migration moved legacy hold state to orders, and a later resume or
-- lifecycle update makes the old project state impossible to reconstruct
-- safely.
--
-- Take a database backup before running this migration. The dropped columns
-- contain fulfillment snapshots and customization hold/audit history.

BEGIN;

DROP INDEX IF EXISTS idx_projects_fulfillment_address_id;
DROP INDEX IF EXISTS idx_orders_customization_status;

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_customization_status_check;

ALTER TABLE projects
  DROP COLUMN IF EXISTS fulfillment_address_snapshot,
  DROP COLUMN IF EXISTS fulfillment_address_id;

ALTER TABLE orders
  DROP COLUMN IF EXISTS customization_resumed_at,
  DROP COLUMN IF EXISTS customization_hold_approved_at,
  DROP COLUMN IF EXISTS customization_hold_approved_by,
  DROP COLUMN IF EXISTS customization_hold_requested_at,
  DROP COLUMN IF EXISTS customization_hold_reason,
  DROP COLUMN IF EXISTS customization_status;

COMMIT;
