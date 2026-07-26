-- =============================================
-- MIGRATION 02: Add Hold/Cancel & Installment Support
-- =============================================

-- Extend project_status_enum to include 'on_hold'
ALTER TYPE project_status_enum ADD VALUE IF NOT EXISTS 'on_hold';

-- Add hold/cancel columns to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS hold_reason TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS hold_option VARCHAR(50) CHECK (hold_option IN ('resume_later', 'hold_before_next_step'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS hold_at_step VARCHAR(200);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS hold_requested_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS hold_approved_by UUID REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS hold_approved_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS resumed_at TIMESTAMPTZ;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS cancel_option VARCHAR(50) CHECK (cancel_option IN ('ship_unfinished', 'pickup_unfinished'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cancel_requested_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cancel_approved_by UUID REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cancel_approved_at TIMESTAMPTZ;

-- Add fulfillment tracking for cancelled/shipped/pickup statuses
ALTER TABLE projects ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ready_for_pickup_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ;

-- Add installment schedule tracking
CREATE TABLE IF NOT EXISTS project_installment_schedules (
    schedule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    installment_number INT NOT NULL CHECK (installment_number > 0),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    due_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
    paid_at TIMESTAMPTZ,
    payment_id UUID REFERENCES payments(payment_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, installment_number)
);

CREATE INDEX IF NOT EXISTS idx_project_installment_schedules_project ON project_installment_schedules(project_id);
CREATE INDEX IF NOT EXISTS idx_project_installment_schedules_status ON project_installment_schedules(status);
CREATE INDEX IF NOT EXISTS idx_project_installment_schedules_due_date ON project_installment_schedules(due_date);

-- Add notification type for project hold/cancel
ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'project_update';

-- Add custom_build_id to projects if not exists
ALTER TABLE projects ADD COLUMN IF NOT EXISTS custom_build_id VARCHAR(30) UNIQUE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS claimed_by UUID REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

-- Add is_locked to customizations for tracking if a build is in an active project
ALTER TABLE customizations ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE;