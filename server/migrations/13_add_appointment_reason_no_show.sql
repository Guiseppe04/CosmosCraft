-- Add reason column to appointments table
-- Stores the cancellation / status-change / reschedule reason separately
-- from customer-submitted notes.
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reason TEXT;

-- Add 'no_show' status to the appointment status enum (if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'no_show'
      AND enumtypid = 'appointment_status_enum'::regtype
  ) THEN
    ALTER TYPE appointment_status_enum ADD VALUE IF NOT EXISTS 'no_show';
  END IF;
END
$$;

-- Index for the auto no-show sweep query
CREATE INDEX IF NOT EXISTS idx_appointments_no_show_sweep
  ON appointments (status, scheduled_at)
  WHERE status = 'confirmed';