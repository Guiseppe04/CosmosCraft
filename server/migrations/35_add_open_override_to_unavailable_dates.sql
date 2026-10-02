-- Migration 35: Add is_open_override to unavailable_dates
-- Allows admins to mark a holiday as open for bookings

ALTER TABLE unavailable_dates
  ADD COLUMN IF NOT EXISTS is_open_override BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for quick lookups on holiday overrides
CREATE INDEX IF NOT EXISTS idx_unavailable_dates_open_override
  ON unavailable_dates (date)
  WHERE is_open_override = TRUE;
