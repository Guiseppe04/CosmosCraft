-- =============================================
-- MIGRATION 04: Add Installment Plan Columns
-- =============================================

-- Add payment_plan column to orders (full_payment or installment)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_plan VARCHAR(20) CHECK (payment_plan IN ('full_payment', 'installment'));

-- Add initial_payment_percentage (e.g. 0.50 for 50% down payment)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS initial_payment_percentage NUMERIC(5,2) CHECK (initial_payment_percentage >= 0 AND initial_payment_percentage <= 1);

-- Add installment_tenure_months (e.g. 6 for 6 months)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS installment_tenure_months INT CHECK (installment_tenure_months >= 1);

-- Add initial_payment_amount for tracking the required initial payment
ALTER TABLE orders ADD COLUMN IF NOT EXISTS initial_payment_amount NUMERIC(12, 2) CHECK (initial_payment_amount >= 0);

-- Add monthly_installment_amount for storing the calculated monthly payment
ALTER TABLE orders ADD COLUMN IF NOT EXISTS monthly_installment_amount NUMERIC(12, 2) CHECK (monthly_installment_amount >= 0);

-- Add project_status_enum if not present (ensure on_hold exists)
ALTER TYPE project_status_enum ADD VALUE IF NOT EXISTS 'on_hold';

-- Index for finding projects with overdue installments efficiently
CREATE INDEX IF NOT EXISTS idx_project_installment_schedules_overdue 
ON project_installment_schedules(project_id, status, due_date) 
WHERE status = 'overdue';

-- Add installment auto-hold tracking to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS auto_hold_due_to_overdue BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS auto_hold_triggered_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS auto_resumed_at TIMESTAMPTZ;