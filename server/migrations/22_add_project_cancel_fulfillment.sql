-- Migration 22: Add cancellation fulfillment address columns to projects
ALTER TABLE projects 
  ADD COLUMN IF NOT EXISTS cancel_address_id UUID REFERENCES addresses(address_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancel_address_snapshot JSONB;

-- Update cancel_option check constraint to allow standard values
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_cancel_option_check;
ALTER TABLE projects ADD CONSTRAINT projects_cancel_option_check 
  CHECK (cancel_option IS NULL OR cancel_option IN ('ship_to_address', 'pickup_at_shop', 'ship_unfinished', 'pickup_unfinished'));
