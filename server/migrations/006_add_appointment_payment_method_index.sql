-- Migration: Add payment_method index for appointment reporting
-- Ensures efficient filtering and grouping by payment_method in reports

CREATE INDEX IF NOT EXISTS idx_appointments_payment_method ON appointments(payment_method) WHERE payment_method IS NOT NULL;
