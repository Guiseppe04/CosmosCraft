-- =============================================
-- MIGRATION 05: Add paid_in_advance column
-- Tracks installments paid ahead of their due date
-- =============================================

ALTER TABLE project_installment_schedules
  ADD COLUMN IF NOT EXISTS paid_in_advance BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_project_installment_schedules_paid_in_advance
  ON project_installment_schedules(paid_in_advance);

CREATE INDEX IF NOT EXISTS idx_project_installment_schedules_project_paid_in_advance
  ON project_installment_schedules(project_id, paid_in_advance);
