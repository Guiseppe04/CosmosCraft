-- Add reference_code column to appointments table
-- Format: APT-{YYYYMMDD}-{0001}
-- Sequence resets per scheduled_at date, includes all statuses so numbers never get reused
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reference_code VARCHAR(20);

-- Add unique constraint as a safeguard against race conditions on concurrent bookings
CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_reference_code ON appointments(reference_code);